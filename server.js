/**
 * 네이버 브랜드 검색 대시보드 - 로컬 프록시 서버
 * Node.js 내장 모듈만 사용 (별도 설치 불필요)
 *
 * 실행: node server.js
 * 접속: http://localhost:3000
 */

const http  = require('http');
const https = require('https');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');

const PORT = process.env.PORT || 3000;
// 클라우드(PORT 환경변수 존재 시): 0.0.0.0 / 로컬: 127.0.0.1
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
             '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── 데이터 영속성 (JSONBin.io 우선 → 로컬 파일 폴백) ──
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const JBIN_KEY  = process.env.JSONBIN_KEY || '';
const JBIN_ID   = process.env.JSONBIN_ID  || '';

async function readData() {
  if (JBIN_KEY && JBIN_ID) {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${JBIN_ID}/latest`,
        { headers: { 'X-Master-Key': JBIN_KEY } });
      const j = await r.json();
      return j.record || { groups: [], saved: [] };
    } catch (e) { console.error('JSONBin 읽기 실패:', e.message); }
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { groups: [], saved: [] }; }
}

async function writeData(data) {
  if (JBIN_KEY && JBIN_ID) {
    try {
      await fetch(`https://api.jsonbin.io/v3/b/${JBIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JBIN_KEY },
        body: JSON.stringify(data)
      });
      return;
    } catch (e) { console.error('JSONBin 저장 실패:', e.message); }
  }
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8'); }
  catch (e) { console.error('파일 저장 실패:', e.message); }
}

// ── 압축 해제 ──
function decompress(stream, encoding) {
  if (encoding === 'gzip')    return stream.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return stream.pipe(zlib.createInflate());
  if (encoding === 'br')      return stream.pipe(zlib.createBrotliDecompress());
  return stream;
}

// ── HTML 내 상대 URL을 절대 URL로 교체 ──
function rewriteHtml(html, baseUrl) {
  return html
    // //cdn.naver.com → https://cdn.naver.com
    .replace(/((?:href|src|action|data-src)=")\/\//g, `$1https://`)
    // "/path" → "https://naver.com/path"
    .replace(/((?:href|src|action|data-src)=")(\/?[^"#][^"]*?)(")/g, (m, a, p, c) => {
      if (p.startsWith('http') || p.startsWith('//') || p.startsWith('data:')) return m;
      return a + (p.startsWith('/') ? baseUrl + p : baseUrl + '/' + p) + c;
    })
    // srcset
    .replace(/srcset="([^"]+)"/g, (_, s) =>
      'srcset="' + s.replace(/\/\//g, 'https://') + '"'
    )
    // CSS url()
    .replace(/url\(["']?(\/[^)"']+)["']?\)/g, (_, p) => `url(${baseUrl}${p})`)
    // X-Frame-Options / CSP 메타태그 제거
    .replace(/<meta[^>]+http-equiv=["']?[Xx]-[Ff]rame-[Oo]ptions["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?[Cc]ontent-[Ss]ecurity-[Pp]olicy["']?[^>]*>/gi, '');
}

// ── 네이버 페이지 프록시 ──
function proxyRequest(targetUrl, clientRes, depth) {
  if (depth > 5) { clientRes.writeHead(508); clientRes.end('Redirect loop'); return; }

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch (e) { clientRes.writeHead(400); clientRes.end('Invalid URL'); return; }

  const mod = parsed.protocol === 'https:' ? https : http;

  const req = mod.request({
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method:   'GET',
    headers: {
      'User-Agent':      UA,
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer':         `https://${parsed.hostname}/`,
      'Connection':      'keep-alive',
    },
    timeout: 10000,
  }, (upstream) => {

    // 리다이렉트 처리
    if ([301,302,303,307,308].includes(upstream.statusCode) && upstream.headers.location) {
      upstream.resume();
      const loc = upstream.headers.location;
      const next = loc.startsWith('http') ? loc
                 : loc.startsWith('/')    ? `${parsed.protocol}//${parsed.hostname}${loc}`
                 :                          `${parsed.protocol}//${parsed.hostname}/${loc}`;
      proxyRequest(next, clientRes, depth + 1);
      return;
    }

    const ct    = (upstream.headers['content-type'] || '').toLowerCase();
    const isHtml = ct.includes('text/html');
    const enc   = upstream.headers['content-encoding'];

    // 응답 헤더 정제 (X-Frame-Options, CSP 제거)
    const outHeaders = { 'Access-Control-Allow-Origin': '*' };
    for (const [k, v] of Object.entries(upstream.headers)) {
      const kl = k.toLowerCase();
      if (['x-frame-options', 'content-security-policy',
           'content-encoding', 'transfer-encoding'].includes(kl)) continue;
      outHeaders[k] = v;
    }

    if (!isHtml) {
      // 이미지, CSS, JS 등은 그대로 파이프
      clientRes.writeHead(upstream.statusCode, outHeaders);
      upstream.pipe(clientRes);
      return;
    }

    // HTML: 압축 해제 → URL 재작성 → 반환
    const stream = decompress(upstream, enc);
    const chunks = [];
    stream.on('data', c => chunks.push(Buffer.from(c)));
    stream.on('end', () => {
      const raw      = Buffer.concat(chunks).toString('utf8');
      const baseUrl  = `${parsed.protocol}//${parsed.hostname}`;
      const modified = rewriteHtml(raw, baseUrl);
      const buf      = Buffer.from(modified, 'utf8');
      outHeaders['content-type']   = 'text/html; charset=utf-8';
      outHeaders['content-length'] = buf.length;
      clientRes.writeHead(upstream.statusCode || 200, outHeaders);
      clientRes.end(buf);
    });
    stream.on('error', () => {
      if (!clientRes.headersSent) { clientRes.writeHead(500); clientRes.end('Decompress error'); }
    });
  });

  req.on('timeout', () => {
    req.destroy();
    if (!clientRes.headersSent) { clientRes.writeHead(504); clientRes.end('Timeout'); }
  });
  req.on('error', e => {
    if (!clientRes.headersSent) { clientRes.writeHead(502); clientRes.end('Fetch error: ' + e.message); }
  });
  req.end();
}

// ── HTTP 서버 ──
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /api/data — 공유 데이터 로드
  if (req.url === '/api/data' && req.method === 'GET') {
    readData().then(data => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    }).catch(() => { res.writeHead(500); res.end('Read error'); });
    return;
  }

  // POST /api/data — 공유 데이터 저장
  if (req.url === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!Array.isArray(data.groups) || !Array.isArray(data.saved)) throw new Error('invalid');
        writeData(data).then(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        }).catch(() => { res.writeHead(500); res.end('Save error'); });
      } catch (e) {
        res.writeHead(400); res.end('Invalid data');
      }
    });
    return;
  }

  // 대시보드 HTML 서빙
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (e) {
      res.writeHead(500); res.end('index.html을 찾을 수 없습니다.');
    }
    return;
  }

  // 프록시 엔드포인트: /proxy?url=...
  if (req.url.startsWith('/proxy?')) {
    try {
      const params = new URL('http://x' + req.url);
      const target = params.searchParams.get('url');
      if (!target) { res.writeHead(400); res.end('url 파라미터가 없습니다.'); return; }
      proxyRequest(decodeURIComponent(target), res, 0);
    } catch (e) {
      res.writeHead(400); res.end('잘못된 요청: ' + e.message);
    }
    return;
  }

  // 정적 파일 (favicon 등 무시)
  res.writeHead(204); res.end();
});

server.listen(PORT, HOST, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   네이버 브랜드 검색 대시보드 서버           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   🌐  http://localhost:${PORT}  을 브라우저에서 열기  ║`);
  console.log('║   🛑  종료: Ctrl + C                         ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
