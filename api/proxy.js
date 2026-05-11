// Vercel Serverless Function — 네이버 검색 프록시
const https = require('https');
const zlib  = require('zlib');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function decompress(stream, encoding) {
  if (encoding === 'gzip')    return stream.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return stream.pipe(zlib.createInflate());
  if (encoding === 'br')      return stream.pipe(zlib.createBrotliDecompress());
  return stream;
}

function rewriteHtml(html, baseUrl) {
  return html
    .replace(/((?:href|src|action|data-src)=")\/\//g, `$1https://`)
    .replace(/((?:href|src|action|data-src)=")(\/?[^"#][^"]*?)(")/g, (m, a, p, c) => {
      if (p.startsWith('http') || p.startsWith('//') || p.startsWith('data:')) return m;
      return a + (p.startsWith('/') ? baseUrl + p : baseUrl + '/' + p) + c;
    })
    .replace(/srcset="([^"]+)"/g, (_, s) =>
      'srcset="' + s.replace(/\/\//g, 'https://') + '"'
    )
    .replace(/url\(["']?(\/[^)"']+)["']?\)/g, (_, p) => `url(${baseUrl}${p})`)
    .replace(/<meta[^>]+http-equiv=["']?[Xx]-[Ff]rame-[Oo]ptions["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?[Cc]ontent-[Ss]ecurity-[Pp]olicy["']?[^>]*>/gi, '');
}

function fetchAndPipe(targetUrl, res, depth) {
  if (depth > 5) { res.status(508).send('Redirect loop'); return; }
  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { res.status(400).send('Invalid URL'); return; }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    res.status(400).send('Bad protocol'); return;
  }

  const req = https.request({
    hostname: parsed.hostname,
    port:     parsed.port || 443,
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
    timeout: 9000,
  }, (upstream) => {
    if ([301,302,303,307,308].includes(upstream.statusCode) && upstream.headers.location) {
      upstream.resume();
      const loc = upstream.headers.location;
      const next = loc.startsWith('http') ? loc
                 : loc.startsWith('/')    ? `${parsed.protocol}//${parsed.hostname}${loc}`
                 :                          `${parsed.protocol}//${parsed.hostname}/${loc}`;
      fetchAndPipe(next, res, depth + 1);
      return;
    }

    const ct     = (upstream.headers['content-type'] || '').toLowerCase();
    const isHtml = ct.includes('text/html');
    const enc    = upstream.headers['content-encoding'];

    res.setHeader('Access-Control-Allow-Origin', '*');
    for (const [k, v] of Object.entries(upstream.headers)) {
      const kl = k.toLowerCase();
      if (['x-frame-options','content-security-policy','content-encoding','transfer-encoding'].includes(kl)) continue;
      res.setHeader(k, v);
    }

    if (!isHtml) {
      res.status(upstream.statusCode);
      upstream.pipe(res);
      return;
    }

    const stream = decompress(upstream, enc);
    const chunks = [];
    stream.on('data', c => chunks.push(Buffer.from(c)));
    stream.on('end', () => {
      const raw      = Buffer.concat(chunks).toString('utf8');
      const baseUrl  = `${parsed.protocol}//${parsed.hostname}`;
      const modified = rewriteHtml(raw, baseUrl);
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(upstream.statusCode || 200).send(modified);
    });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).send('Decompress error');
    });
  });

  req.on('timeout', () => { req.destroy(); if (!res.headersSent) res.status(504).send('Timeout'); });
  req.on('error',  e => { if (!res.headersSent) res.status(502).send('Fetch error: ' + e.message); });
  req.end();
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const target = (req.query && req.query.url) ? req.query.url : '';
  if (!target) { res.status(400).send('url 파라미터가 없습니다.'); return; }
  fetchAndPipe(decodeURIComponent(target), res, 0);
};
