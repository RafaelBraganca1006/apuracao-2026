/* Utilidades compartilhadas das páginas de cargos (cargo.html): tema, formatação, gestos do celular,
   números que rolam e dados. É uma cópia enxuta do que `app.js` (presidente) tem embutido; depois de 25/10
   o `app.js` deve passar a usar este arquivo para não haver duas versões. */
(() => {
'use strict';

const params = new URLSearchParams(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('og');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmtInt = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtPct = (x, d = 2) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const pctNum = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const captureEvent = (event, properties) => window.posthog?.capture(event, properties);

const UF_COD = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
const UF_NOME = { RO: 'Rondônia', AC: 'Acre', AM: 'Amazonas', RR: 'Roraima', PA: 'Pará', AP: 'Amapá', TO: 'Tocantins', MA: 'Maranhão', PI: 'Piauí', CE: 'Ceará', RN: 'Rio Grande do Norte', PB: 'Paraíba', PE: 'Pernambuco', AL: 'Alagoas', SE: 'Sergipe', BA: 'Bahia', MG: 'Minas Gerais', ES: 'Espírito Santo', RJ: 'Rio de Janeiro', SP: 'São Paulo', PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', GO: 'Goiás', DF: 'Distrito Federal' };
const UF_BY_COD = Object.fromEntries(Object.entries(UF_COD).map(([s, c]) => [c, s]));

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbaOf = (hex, al) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${al})`; };
const mixHex = (c, base, k) => { const [a, b] = [hex2rgb(c), hex2rgb(base)]; return '#' + a.map((x, i) => Math.round(x * k + b[i] * (1 - k)).toString(16).padStart(2, '0')).join(''); };
const dist = (a, b) => { const [x, y] = [hex2rgb(a), hex2rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/* ---------- tema claro / escuro ---------- */
const THEMES = {
  dark: {
    empty: '#171a23', leadBase: '#232733', leadK: [0.3, 0.55, 0.82, 1],
    munLine: ['#0b0b0c', 0.5], ufLine: ['#ffffff', 0.28, 0.5], ink: '#ffffff', meta: '#0b0b0c', lightI: 0.42,
    canvas: { bg: '#0b0b0c', text: '#eceef4', muted: '#8b92a3', soft: 'rgba(255,255,255,.6)', foot: 'rgba(255,255,255,.45)' },
  },
  light: {
    empty: '#e8eaed', leadBase: '#e8eaed', leadK: [0.3, 0.55, 0.82, 1],
    munLine: ['#ffffff', 0.8], ufLine: ['#3c4043', 0.35, 0.55], ink: '#202124', meta: '#f1f1f2', lightI: 0.55,
    canvas: { bg: '#ebebec', text: '#202124', muted: '#5f6368', soft: 'rgba(32,33,36,.7)', foot: 'rgba(32,33,36,.55)' },
  },
};
const TK = { THEME: 'dark', T: THEMES.dark };
function useTheme(name) {
  TK.THEME = THEMES[name] ? name : 'dark'; TK.T = THEMES[TK.THEME];
  document.documentElement.dataset.theme = TK.THEME;
  $('meta[name="theme-color"]')?.setAttribute('content', TK.T.meta);
}
{
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) { /* sem storage */ }
  const q = params.get('theme');
  useTheme(q === 'light' || q === 'dark' ? q : saved || 'dark');
}

/* ---------- dados ---------- */
async function getJSON(url, bust) {
  // janela de 15 s: o CDN pode cachear e todos os visitantes dividem o mesmo pedido
  const r = await fetch(bust ? `${url}?t=${Math.floor(Date.now() / 15000)}` : url, { cache: bust ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

/* ---------- gestos: arrastar o painel para cima/baixo (celular) ---------- */
function swipePanel(el, onUp, onDown, ignore = 'input, textarea, select, .rank-wrap, #sres, .scroll-x') {
  let x0 = 0, y0 = 0, active = false, done = false;
  el.addEventListener('pointerdown', (e) => {
    if (!isMobile() || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest(ignore)) return;
    x0 = e.clientX; y0 = e.clientY; active = true; done = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (!active || done) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dy) < 14 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
    done = true;
    if (dy < 0) onUp(); else onDown();
  });
  const end = () => { active = false; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => { if (done) { e.preventDefault(); e.stopPropagation(); done = false; } }, true);
}

/* ---------- números com dígitos que rolam ---------- */
const DIGITS = '<b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b><b>7</b><b>8</b><b>9</b>';
function setRoll(el, text) {
  if (!el) return;
  const chars = [...text], digits = chars.filter((c) => /\d/.test(c));
  const sig = chars.map((c) => (/\d/.test(c) ? '#' : c)).join('');
  const bump = () => { if (REDUCED) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  if (el._sig !== sig) {
    const first = el._sig === undefined;
    el._sig = sig; el._text = text;
    el.innerHTML = chars.map((c) => (/\d/.test(c) ? `<span class="dg" aria-hidden="true"><i style="--d:0">${DIGITS}</i></span>` : `<span class="ch" aria-hidden="true">${esc(c)}</span>`)).join('');
    void el.offsetWidth;
    el.querySelectorAll('.dg i').forEach((i, k) => i.style.setProperty('--d', digits[k]));
    if (!first) bump();
  } else if (el._text !== text) {
    el._text = text;
    el.querySelectorAll('.dg i').forEach((i, k) => i.style.setProperty('--d', digits[k]));
    bump();
  }
  el.setAttribute('aria-label', text);
}

/* ---------- segmentados com indicador deslizante ---------- */
function placeThumb(seg) {
  const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
  if (!on || !th || !seg.offsetWidth) return;
  const first = !th._placed;
  if (first) th.style.transition = 'none';
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft}px)`;
  if (first) { void th.offsetWidth; th.style.transition = ''; th._placed = true; }
}
function updateThumbs() { $$('.seg').forEach(placeThumb); }
const segRO = new ResizeObserver((es) => es.forEach((e) => placeThumb(e.target)));
const watchSegs = () => $$('.seg').forEach((s) => segRO.observe(s));
document.fonts?.ready.then(updateThumbs);

Object.assign(TK, {
  params, REDUCED, $, $$, isMobile, clamp, fmtInt, fmtPct, pctNum, esc, norm, captureEvent,
  UF_COD, UF_NOME, UF_BY_COD, hex2rgb, rgbaOf, mixHex, dist, useTheme, getJSON, swipePanel, setRoll,
  placeThumb, updateThumbs, watchSegs,
});
window.TK = TK;
})();
