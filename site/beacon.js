/* Analytics anônimo e sem cookies: visita, aba visível (tempo de tela) e cliques nos botões principais.
   Guarda só um id aleatório no navegador. Respeita "Não rastrear". Os dados vão para /api/e (Cloudflare). */
(() => {
'use strict';
if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
const q = new URLSearchParams(location.search);
if (/^(localhost|127\.|\[::1\])/.test(location.hostname) && !q.has('beacon')) return;   // nada em desenvolvimento

const rnd = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const get = (st, k) => { try { let v = st.getItem(k); if (!v) { v = rnd(); st.setItem(k, v); } return v; } catch { return rnd(); } };
const vid = get(localStorage, 'vid'), sid = get(sessionStorage, 'sid');
// Modo econômico (plano grátis do Worker: 100 mil requisições/dia): só 1 em cada SAMPLE visitantes manda eventos,
// de forma estável por navegador, e o painel multiplica os números por SAMPLE. Tempo de tela e "agora" ficam no PostHog.
const SAMPLE = 5;
let h = 0; for (const c of vid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
if (h % SAMPLE !== 0) return;
const path = location.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
const page = (path === '' || path === 'index' ? 'home' : path) + (path === 'apuracao' && q.get('data') === 'r1' ? ':1turno' : '');
let ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* sem referrer */ }

function send(e, extra) {
  const body = JSON.stringify({ e, p: page, v: vid, s: sid, r: ref, u: q.get('utm_source') || q.get('utm') || '', k: SAMPLE, ...extra });
  try { if (navigator.sendBeacon && navigator.sendBeacon('/api/e', new Blob([body], { type: 'text/plain' }))) return; } catch { /* usa fetch */ }
  fetch('/api/e', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
}

send('pageview');
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-ev], a[href]'); if (!el) return;
  const label = el.dataset.ev || (el.getAttribute('href') || '').replace(/^.*\//, '').replace(/[?#].*$/, '').replace(/\.html$/, '');
  if (label) send('click', { x: label.slice(0, 24) });
}, { passive: true });
})();
