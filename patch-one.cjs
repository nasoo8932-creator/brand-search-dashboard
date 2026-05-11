'use strict';
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, 'index.html');
let s = fs.readFileSync(htmlPath, 'utf8');

const L = '\u2500'.repeat(45);
const K = {
  cardIf: '// \uCE74\uB4DC HTML (iframe \uBBF8\uB9AC\uBCF4\uAE30)',
  cardWas: '// \uCE74\uB4DC HTML (\uD31D\uC5C5 \uB7F0\uCC98)',
  grp: '\uADF8\uB8F9 \uCD94\uAC00',
  col: '\uC5F4 \uC218 \uD1A0\uAE00',
  srv0: '\uC11C\uBC84 \uBBF8\uC2E4\uD589',
  srv1: '\uC11C\uBC84 \uC2E4\uD589 \uC911',
  load: '\uB85C\uB529 \uC911\u2026',
  tab: '\u2197 \uC0C8 \uD0ED',
  refr: '\uD83D\uDD04 \uC0C8\uB85C\uACE0\uCE68',
  noPrev: '\uC0C8\uB85C\uACE0\uCE68\uD560 \uBBF8\uB9AC\uBCF4\uAE30\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4',
  close: '\uB2EB\uAE30',
};

const proxyBlock = `const PROXY   = '/proxy?url=';
const FRAME_H = 240;
const MO_W    = 390;
const PC_W    = 1280;

async function checkServer() {
  const dot    = document.getElementById('statusDot');
  const txt    = document.getElementById('statusText');
  const banner = document.getElementById('serverBanner');
  if (!dot || !txt || !banner) return false;

  if (location.protocol === 'file:') {
    dot.className = 'status-dot err';
    txt.textContent = '${K.srv0}';
    banner.classList.add('show');
    return false;
  }

  try {
    const r = await fetch(location.origin + '/', { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      dot.className = 'status-dot ok';
      txt.textContent = '${K.srv1}';
      banner.classList.remove('show');
      return true;
    }
  } catch (_) {}

  dot.className = 'status-dot err';
  txt.textContent = '${K.srv0}';
  banner.classList.add('show');
  return false;
}

function proxyUrl(navUrl) {
  if (location.protocol === 'file:') return navUrl;
  return PROXY + encodeURIComponent(navUrl);
}

function scaleFrames() {
  document.querySelectorAll('.frame-wrap[data-type]').forEach(wrap => {
    const type = wrap.dataset.type;
    const base = type === 'mo' ? MO_W : PC_W;
    const w    = wrap.offsetWidth;
    if (!w) return;
    const scale = w / base;
    const ifrH  = Math.round(FRAME_H / scale);
    wrap.style.height = FRAME_H + 'px';
    const iframe = wrap.querySelector('iframe');
    if (iframe) {
      iframe.style.width           = base + 'px';
      iframe.style.height          = ifrH + 'px';
      iframe.style.transform       = 'scale(' + scale + ')';
      iframe.style.transformOrigin = 'top left';
    }
  });
}

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(scaleFrames, 150);
});

function reloadAll() {
  const frames = document.querySelectorAll('.frame-wrap iframe');
  if (!frames.length) { toast('${K.noPrev}'); return; }
  frames.forEach(fr => {
    const ovId = fr.id.replace('_fr', '_ov');
    const ov   = document.getElementById(ovId);
    if (ov) ov.classList.remove('hidden');
    const base = fr.src.split('&_t=')[0].split('?_t=')[0];
    fr.src = base + (base.includes('?') ? '&' : '?') + '_t=' + Date.now();
  });
  toast('\\uD83D\\uDD04 ' + frames.length + '\uAC1C \uBBF8\uB9AC\uBCF4\uAE30 \uC0C8\uB85C\uACE0\uCE68');
}

`;

const cardBlock = `${K.cardIf}
// ${L}
function buildCard({ keyword, showMo, showPc }) {
  const moNav = MO_URL + encodeURIComponent(keyword);
  const pcNav = PC_URL + encodeURIComponent(keyword);
  const moSrc = proxyUrl(moNav);
  const pcSrc = proxyUrl(pcNav);
  const uid   = 'f' + Math.random().toString(36).slice(2, 8);
  const safeKw = escA(keyword);

  let moHtml = '', pcHtml = '';

  if (showMo) {
    moHtml = \`
      <div class="frame-col">
        <div class="frame-lbl mo">\uD83D\uDCF1 MO</div>
        <div class="frame-wrap" data-type="mo">
          <div class="frame-overlay" id="\${uid}mo_ov">
            <div class="spinner"></div><span>${K.load}</span>
          </div>
          <iframe src="\${moSrc}" id="\${uid}mo_fr"
            onload="hideOv('\${uid}mo_ov')"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">
          </iframe>
        </div>
        <div class="frame-foot">
          <a href="\${moNav}" target="_blank" rel="noopener">${K.tab}</a>
          <button onclick="reloadFrame('\${uid}mo_fr','\${escJ(moSrc)}')">${K.refr}</button>
        </div>
      </div>\`;
  }

  if (showPc) {
    pcHtml = \`
      <div class="frame-col">
        <div class="frame-lbl pc">\uD83D\uDDA5\uFE0F PC</div>
        <div class="frame-wrap" data-type="pc">
          <div class="frame-overlay" id="\${uid}pc_ov">
            <div class="spinner"></div><span>${K.load}</span>
          </div>
          <iframe src="\${pcSrc}" id="\${uid}pc_fr"
            onload="hideOv('\${uid}pc_ov')"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">
          </iframe>
        </div>
        <div class="frame-foot">
          <a href="\${pcNav}" target="_blank" rel="noopener">${K.tab}</a>
          <button onclick="reloadFrame('\${uid}pc_fr','\${escJ(pcSrc)}')">${K.refr}</button>
        </div>
      </div>\`;
  }

  const cls = (showMo && showPc) ? 'both' : 'one';
  return \`
    <div class="kw-card">
      <div class="card-header">
        <span class="card-kw">\uD83D\uDD0D \${esc(keyword)}</span>
        <div class="card-actions">
          <button class="card-close" data-rm="\${safeKw}" title="${K.close}">\u2715</button>
        </div>
      </div>
      <div class="frames \${cls}">\${moHtml}\${pcHtml}</div>
    </div>\`;
}

function hideOv(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function reloadFrame(frameId, src) {
  const fr = document.getElementById(frameId);
  const ovId = frameId.replace('_fr', '_ov');
  const ov = document.getElementById(ovId);
  if (!fr) return;
  if (ov) ov.classList.remove('hidden');
  fr.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now();
}

`;

const p0 = s.indexOf('let editTmpKws  = [];\r\n\r\n') + 'let editTmpKws  = [];\r\n\r\n'.length;
const grpHdr = '\r\n\r\n// ' + L + '\r\n// ' + K.grp + '\r\n';
const p1 = s.indexOf(grpHdr, 20000);
if (p1 === -1) throw new Error('grpHdr not found');
s = s.slice(0, p0) + proxyBlock + s.slice(p1);

let c0 = s.indexOf(K.cardWas);
if (c0 === -1) c0 = s.indexOf(K.cardIf);
const colHdr = '\r\n\r\n// ' + L + '\r\n// ' + K.col + '\r\n';
const c1 = s.indexOf(colHdr, c0);
if (c0 === -1 || c1 === -1) throw new Error('card markers ' + c0 + ' ' + c1);
s = s.slice(0, c0) + cardBlock + s.slice(c1);

s = s.replace(
  /grid\.querySelectorAll\('\[data-rm\]'\)\.forEach\(btn => \{\r?\n    btn\.addEventListener\('click', \(\) => remove\(btn\.dataset\.rm\)\);\r?\n  \}\);\r?\n\}/,
  `grid.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => remove(btn.dataset.rm));
  });
  requestAnimationFrame(() => requestAnimationFrame(scaleFrames));
}`
);

s = s.replace(
  /function setCols\(n\) \{\r?\n  cols = n;\r?\n  document\.getElementById\('grid'\)\.className = `results-grid c\$\{n\}`;\r?\n  document\.querySelectorAll\('\.col-btn'\)\.forEach\(b => b\.classList\.toggle\('active', \+b\.dataset\.c === n\)\);\r?\n\}/,
  `function setCols(n) {
  cols = n;
  document.getElementById('grid').className = \`results-grid c\${n}\`;
  document.querySelectorAll('.col-btn').forEach(b => b.classList.toggle('active', +b.dataset.c === n));
  setTimeout(scaleFrames, 100);
}`
);

s = s.replace(
  /\/\/ ─────────────────────────────────────────────\r?\n\/\/ \uC2DC\uC791\r?\n\/\/ ─────────────────────────────────────────────\r?\nloadLS\(\);/,
  '// ─────────────────────────────────────────────\r\n// \uC2DC\uC791\r\n// ─────────────────────────────────────────────\r\ncheckServer();\r\nsetInterval(checkServer, 10000);\r\nloadLS();'
);

s = s.replace(/\s*<button class="btn btn-ghost btn-sm" onclick="openAllBoth\(\)">[^<]*<\/button>\r?\n/, '\n');

s = s.replace(
  /    \/\* ── \uB7F0\uCE58 \uC874 \(\uD31D\uC5C5 \uBC84\uD2BC \uC601\uC57D\) ── \*\//,
  '    /* iframe 미리보기 */'
);

if (!s.includes('id="serverBanner"')) {
  const ban =
    '</header>\r\n\r\n  <div class="server-banner" id="serverBanner">\r\n    ' +
    '\uD55C \uD654\uBA74 \uBBF8\uB9AC\uBCF4\uAE30\uB294 \uB85C\uCEEC \uC11C\uBC84\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. <strong>\uC2DC\uC791.bat</strong> \uC2E4\uD589 \uD6C4\r\n    ' +
    '<a href="http://localhost:3000" target="_self">http://localhost:3000</a> \uC5D0\uC11C \uC5EC\uC138\uC694.\r\n    ' +
    '(<a href="https://nodejs.org" target="_blank">Node.js</a>)\r\n  </div>\r\n\r\n  <!-- \u2550\u2550\u2550 BODY \u2550\u2550\u2550 -->';
  s = s.replace(/<\/header>\r?\n\r?\n  <!-- \u2550\u2550\u2550 BODY \u2550\u2550\u2550 -->/, ban);
}

s = s.replace(
  /          \uCE74\uB4DC \uD074\uB9AD \uB610\uB294 \uBC84\uD2BC\uC73C\uB85C \uC2E4\uC81C \uB124\uC774\uBC84 \uAC80\uC0C9 \uCC3D\uC744 \uC5FD\uB2C8\uB2E4/,
  '          MO·PC \uBBF8\uB9AC\uBCF4\uAE30 (\uB85C\uCEEC \uD504\uB85D\uC2DC \uACBD\uC720, \uD55C \uD654\uBA74)'
);

fs.writeFileSync(htmlPath, s, 'utf8');
console.log('patch-one: OK');
