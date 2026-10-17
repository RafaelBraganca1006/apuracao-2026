/* Fundo da home: o Brasil feito de pontos, um por município.
   Cor = quem foi mais votado no 1º turno (vermelho Lula, azul Flávio), tamanho = votos válidos.
   Os pontos respiram devagar e se afastam do cursor. */
(() => {
'use strict';
const cv = document.getElementById('bgMap');
if (!cv) return;
const ctx = cv.getContext('2d');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pts = null, W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0, raf = 0, t0 = performance.now();
const mouse = { x: -9999, y: -9999, on: false };
let cL = '#d93025', cF = '#1a73e8', cN = '#888';

const LON0 = -74, LON1 = -34, LAT0 = -34, LAT1 = 5.5, KX = Math.cos(15 * Math.PI / 180);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const readColors = () => { cL = css('--lula') || cL; cF = css('--flavio') || cF; cN = css('--muted') || cN; };

function layout() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const bw = (LON1 - LON0) * KX, bh = LAT1 - LAT0;
  scale = Math.min((W * 1.06) / bw, (H * 0.94) / bh);
  ox = W / 2 - (bw * scale) / 2; oy = H / 2 - (bh * scale) / 2 + H * (W < 900 ? 0.17 : 0.01);   // celular: o mapa desce para ficar embaixo dos retratos
  if (!pts) return;
  const maxV = Math.sqrt(Math.max(...pts.map((p) => p[2])));
  for (const p of pts) {
    p.x = ox + (p[0] - LON0) * KX * scale; p.y = oy + (LAT1 - p[1]) * scale;
    p.r = (0.55 + 2.6 * Math.sqrt(Math.sqrt(p[2]) / maxV)) * Math.max(0.7, scale / 13);
    p.a = 0.34 + 0.66 * Math.min(1, Math.abs(p[3]) / 0.45);
    p.k = p[3] > 0.01 ? 0 : p[3] < -0.01 ? 1 : 2;
    p.ph = (p.x * 0.011 + p.y * 0.017);
    p.d = (p.x / W) * 0.9 + Math.random() * 0.35;       // atraso da entrada: varre da esquerda para a direita
  }
}

function frame(now) {
  const t = (now - t0) / 1000, intro = REDUCED ? 1 : Math.min(1, t / 2.6);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const buckets = new Map();
  for (const p of pts) {
    const appear = Math.max(0, Math.min(1, (intro * 1.5 - p.d) * 2.2));
    if (appear <= 0) continue;
    let x = p.x, y = p.y, r = p.r * appear;
    if (!REDUCED) {
      r *= 1 + 0.16 * Math.sin(t * 0.8 + p.ph);
      if (mouse.on) {
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy, R = 110;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) ** 2 * 26; x += (dx / d) * f; y += (dy / d) * f; r *= 1 + (1 - d / R) * 0.6; }
      }
    }
    const key = p.k * 4 + Math.min(3, Math.floor(p.a * 4));
    let b = buckets.get(key); if (!b) buckets.set(key, (b = []));
    b.push(x, y, r);
  }
  for (const [key, arr] of buckets) {
    const k = key >> 2, lvl = key & 3;
    ctx.globalAlpha = 0.22 + lvl * 0.2;
    ctx.fillStyle = k === 0 ? cL : k === 1 ? cF : cN;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 3) { ctx.moveTo(arr[i] + arr[i + 2], arr[i + 1]); ctx.arc(arr[i], arr[i + 1], arr[i + 2], 0, 6.2832); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!REDUCED || intro < 1) raf = requestAnimationFrame(frame);
}

const start = () => { cancelAnimationFrame(raf); readColors(); raf = requestAnimationFrame(frame); };
addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
addEventListener('pointerleave', () => { mouse.on = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
new ResizeObserver(() => { layout(); if (REDUCED) start(); }).observe(cv);
new MutationObserver(() => { readColors(); if (REDUCED) start(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

fetch('data/brasil-pontos.json').then((r) => r.json()).then((d) => { pts = d; layout(); start(); }).catch(() => { cv.hidden = true; });
})();
