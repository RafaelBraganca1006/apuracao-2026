/* Retrato em dither (matriz de Bayer 8×8) desenhado em WebGL.
   A foto vira pontos de uma cor só sobre fundo transparente: as áreas escuras da foto viram tinta.
   Mesma técnica do shader de imagem do portfólio, simplificada para um retrato por canvas. */
(() => {
'use strict';

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision highp float;
varying vec2 uv;
uniform sampler2D img;
uniform vec3 ink;
uniform float cell;        // tamanho da célula do dither em pixels do canvas
uniform float contrast;
uniform float flip;        // 0: tinta nas áreas escuras · 1: tinta nas claras
uniform vec2 mouse;        // cursor em coordenadas do retrato (0..1, topo = 0)
uniform float power;       // 0..1: quão perto o cursor está
uniform float time;
uniform float aspect;      // largura / altura do canvas

float bayer4(vec2 c){
  vec2 q = mod(c, 4.);
  float i = q.x + q.y * 4.;
  // matriz 4×4 normalizada
  if (i < .5) return 0.; if (i < 1.5) return 8.; if (i < 2.5) return 2.; if (i < 3.5) return 10.;
  if (i < 4.5) return 12.; if (i < 5.5) return 4.; if (i < 6.5) return 14.; if (i < 7.5) return 6.;
  if (i < 8.5) return 3.; if (i < 9.5) return 11.; if (i < 10.5) return 1.; if (i < 11.5) return 9.;
  if (i < 12.5) return 15.; if (i < 13.5) return 7.; if (i < 14.5) return 13.; return 5.;
}
float bayer8(vec2 c){
  return (bayer4(floor(c / 2.)) / 16.) * .75 + ((mod(c.x, 2.) + mod(c.y, 2.) * 2.) / 4.) * .25;
}
void main(){
  // o retrato respira devagar e se afasta do cursor, com uma onda saindo dele
  vec2 suv = uv + vec2(0., sin(time * .9 + uv.x * 6.) * .0025);
  vec2 dv = (uv - mouse) * vec2(aspect, 1.);
  float r = length(dv);
  float f = power * pow(max(0., 1. - r / .7), 2.);
  vec2 dir = dv / max(r, .0001) / vec2(aspect, 1.);
  suv -= dir * (f * .1 + sin(r * 34. - time * 4.) * f * .006);
  vec4 t = texture2D(img, suv);
  if (t.a < .5) discard;                     // fundo removido
  float lum = dot(t.rgb, vec3(.299, .587, .114));
  float amount = mix(1. - lum, lum, flip);
  amount = smoothstep(.1, 1., (amount - .5) * contrast + .5);
  amount = pow(amount, mix(1.25, .85, flip)) * mix(.86, 1., flip);
  // dissolve as bordas (laterais e base) em vez de cortar reto
  float fade = smoothstep(1., .66, uv.y) * smoothstep(0., .16, uv.x) * smoothstep(1., .84, uv.x);
  amount *= fade;
  amount = min(1., amount + f * .22);
  float b = bayer8(floor(gl_FragCoord.xy / cell));
  float on = step(b + .02, amount);
  if (on < .5) discard;
  gl_FragColor = vec4(ink, 1.);
}`;

function hex(c) { const m = c.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) : [.5, .5, .5]; }

/* Tira o fundo da foto: pixels parecidos com a cor das bordas e ligados a elas (flood fill) ficam transparentes. */
function cutout(img) {
  const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const o = cv.getContext('2d', { willReadFrequently: true });
  o.drawImage(img, 0, 0);
  const im = o.getImageData(0, 0, w, h), px = im.data, seen = new Uint8Array(w * h), st = [];
  const sr = [], sg = [], sb = [];
  const edge = (x, y) => { const i = (y * w + x) * 4; sr.push(px[i]); sg.push(px[i + 1]); sb.push(px[i + 2]); };
  for (let x = 0; x < w; x++) { edge(x, 0); edge(x, 1); }
  for (let y = 0; y < h * .35; y++) { edge(0, y | 0); edge(w - 1, y | 0); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1], br = med(sr), bg = med(sg), bb = med(sb);
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x; if (seen[i]) return;
    const q = i * 4;
    if (Math.hypot(px[q] - br, px[q + 1] - bg, px[q + 2] - bb) < 30) { seen[i] = 1; st.push(i); }
  };
  for (let x = 0; x < w; x++) push(x, 0);
  for (let y = 0; y < h * .35; y++) { push(0, y | 0); push(w - 1, y | 0); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  for (let i = 0; i < seen.length; i++) if (seen[i]) px[i * 4 + 3] = 0;
  o.putImageData(im, 0, 0);
  return cv;
}

class Dither {
  constructor(canvas) {
    this.c = canvas;
    this.gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!this.gl) { canvas.hidden = true; return; }
    const gl = this.gl, sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { canvas.hidden = true; return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['img', 'ink', 'cell', 'contrast', 'flip', 'mouse', 'power', 'time', 'aspect'].map((k) => [k, gl.getUniformLocation(pr, k)]));
    this.ready = false;
    this.m = { x: .5, y: .5, p: 0, tx: .5, ty: .5, tp: 0 };
    const img = new Image();
    img.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cutout(img));
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      this.ready = true; this.draw();
    };
    img.src = canvas.dataset.src;
    new ResizeObserver(() => this.draw()).observe(canvas);
  }
  draw() {
    if (!this.gl || !this.ready) return;
    const gl = this.gl, c = this.c, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pr);
    gl.uniform1i(this.u.img, 0);
    gl.uniform3fv(this.u.ink, hex(getComputedStyle(c).getPropertyValue('--ink') || '#888888'));
    gl.uniform1f(this.u.cell, Math.max(2, Math.round(c.clientWidth / 120 * dpr)));
    gl.uniform1f(this.u.contrast, 1.15);
    gl.uniform1f(this.u.flip, document.documentElement.dataset.theme === 'dark' ? 1 : 0);
    gl.uniform2f(this.u.mouse, this.m.x, this.m.y);
    gl.uniform1f(this.u.power, this.m.p);
    gl.uniform1f(this.u.time, (performance.now() - T0) / 1000);
    gl.uniform1f(this.u.aspect, w / h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

const all = [...document.querySelectorAll('canvas.dither')].map((c) => new Dither(c));
const T0 = performance.now(), REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!REDUCED) {
  const ptr = { x: -9999, y: -9999 };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; ptr.x = e.clientX; ptr.y = e.clientY; });   // só mouse: no toque não distorce
  addEventListener('pointerleave', () => { ptr.x = ptr.y = -9999; });
  const loop = () => {
    for (const d of all) {
      if (!d.ready) continue;
      const r = d.c.getBoundingClientRect(), m = d.m;
      m.tx = (ptr.x - r.left) / r.width; m.ty = (ptr.y - r.top) / r.height;
      const dx = Math.max(0, Math.abs(m.tx - .5) - .5), dy = Math.max(0, Math.abs(m.ty - .5) - .5);
      m.tp = Math.max(0, 1 - Math.hypot(dx, dy) / .45);              // só reage com o cursor por perto
      m.x += (m.tx - m.x) * .22; m.y += (m.ty - m.y) * .22; m.p += (m.tp - m.p) * .12;
      d.draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
new MutationObserver(() => all.forEach((d) => d.draw())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
