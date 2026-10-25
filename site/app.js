(() => {
'use strict';

/* ================= config ================= */
const params = new URLSearchParams(location.search);
if (params.has('og')) document.body.classList.add('og');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('og');
if (REDUCED) document.body.classList.add('noanim');
const START_GRAIN = params.get('grain') === 'uf' ? 'uf' : 'mun';
const START_MODE = ['map', 'bubbles', '3d'].includes(params.get('mode')) ? params.get('mode') : 'map';
const POLL_MS = 30000;
const LIVE_BASE = window.TRACKER_LIVE_BASE || 'data/';
const captureEvent = (event, properties) => window.posthog?.capture(event, properties);
const ZSTOPS = [[3, 2.6], [5, 0.95], [7, 0.25], [9, 0.06], [11, 0.016]];   // fator da altura por zoom (os blocos são em metros)
const LIFT = 1.12, RIM_T = 9000;     // hover: bloco sobe 12%; espessura do contorno (m, antes da escala de zoom)
const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const H3D_UF = 160;                   // blocos de estado: altura (m) = H3D_UF * raiz(votos do estado)
const COD_BY_UF = Object.fromEntries(Object.entries({ 11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF' }).map(([c, s]) => [s, +c]));
const H3D = 700, H3D_EXP = 0.45;      // altura do bloco (m) = H3D * votos^0,45 — expoente < 0,5 comprime os extremos (SP x cidades pequenas)
const H3D_OLD = 330;                      // altura do bloco (m) = H3D * raiz(votos), reduzida conforme o zoom
const CAM3D = { pitch: 58, bearing: -18 };
const COL = {};                         // cores principais do tema atual (preenchido por useTheme)

const UF_BY_COD = { 11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF' };
const UF_NOME = { RO:'Rondônia',AC:'Acre',AM:'Amazonas',RR:'Roraima',PA:'Pará',AP:'Amapá',TO:'Tocantins',MA:'Maranhão',PI:'Piauí',CE:'Ceará',RN:'Rio Grande do Norte',PB:'Paraíba',PE:'Pernambuco',AL:'Alagoas',SE:'Sergipe',BA:'Bahia',MG:'Minas Gerais',ES:'Espírito Santo',RJ:'Rio de Janeiro',SP:'São Paulo',PR:'Paraná',SC:'Santa Catarina',RS:'Rio Grande do Sul',MS:'Mato Grosso do Sul',MT:'Mato Grosso',GO:'Goiás',DF:'Distrito Federal',ZZ:'Exterior' };

// candidatos do 1º turno: nomes de exibição aqui; as cores vêm do tema (THEMES[...].cand)
const CAND = {
  '13': { short: 'Lula' }, '22': { short: 'Flávio Bolsonaro' },
  '70': { short: 'Augusto Cury', tag: 'Cury' }, '14': { short: 'Renan Santos', tag: 'Renan' },
  '55': { short: 'Ronaldo Caiado', tag: 'Caiado' }, '30': { short: 'Zema' },
  '80': { short: 'Samara' }, '16': { short: 'Hertz Dias' },
  '27': { short: 'Clariana Barão' }, '21': { short: 'Edmilson Costa' },
  '35': { short: 'Wilson Grassi' }, '29': { short: 'Rui Costa Pimenta' },
};
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbaOf = (hex, al) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${al})`; };
const mixHex = (c, base, k) => { const [a, b] = [hex2rgb(c), hex2rgb(base)]; return '#' + a.map((x, i) => Math.round(x * k + b[i] * (1 - k)).toString(16).padStart(2, '0')).join(''); };

/* ================= tema claro / escuro ================= */
const THEMES = {
  dark: {
    col: { lula: '#ff4a5c', flavio: '#4d8dff', neutral: '#2c303c', empty: '#171a23' },
    cand: { '13': '#ff4a5c', '22': '#4d8dff', '70': '#f5a524', '14': '#a78bfa', '55': '#34d399', '30': '#fb923c', '80': '#f472b6', '16': '#facc15', '27': '#22d3ee', '21': '#e879f9', '35': '#a3e635', '29': '#94a3b8' },
    fallback: '#94a3b8',
    ramp: [[-0.7,'#6ea3ff'],[-0.4,'#3f78ee'],[-0.2,'#2a53b8'],[-0.07,'#222f58'],[0,'#2a2e3c'],[0.07,'#4a2a3a'],[0.2,'#942a43'],[0.4,'#dc3b53'],[0.7,'#ff6377']],
    bubble: [[-0.5,'#7aadff'],[-0.2,'#4a82f2'],[-0.06,'#3a5fc0'],[0,'#8b92a3'],[0.06,'#d04a60'],[0.2,'#ef4560'],[0.5,'#ff6a7e']],
    leadBase: '#232733', leadK: [0.3, 0.55, 0.82, 1], leadKB: [0.5, 0.72, 0.9, 1],
    munLine: ['#0b0b0c', 0.5], ufLine: ['#ffffff', 0.28, 0.5], ink: '#ffffff', circleStroke: '#0b0b0c',
    lightI: 0.42, meta: '#0b0b0c', muted: '#8b92a3',
    canvas: { bg: '#0b0b0c', text: '#eceef4', muted: '#8b92a3', soft: 'rgba(255,255,255,.6)', foot: 'rgba(255,255,255,.45)' },
  },
  light: {
    // paleta "mapa": vermelho/azul do Google Maps nos dados, cinza de terra como neutro
    col: { lula: '#d93025', flavio: '#1a73e8', neutral: '#dadce0', empty: '#e8eaed' },
    cand: { '13': '#d93025', '22': '#1a73e8', '70': '#e37400', '14': '#8430ce', '55': '#188038', '30': '#f06a00', '80': '#d01884', '16': '#b06000', '27': '#12a4af', '21': '#b31dc7', '35': '#5f8f1a', '29': '#5f6368' },
    fallback: '#5f6368',
    ramp: [[-0.7,'#174ea6'],[-0.4,'#3b78e7'],[-0.2,'#8ab4f8'],[-0.07,'#d2e3fc'],[0,'#e8eaed'],[0.07,'#fad2cf'],[0.2,'#ee8f86'],[0.4,'#e0443a'],[0.7,'#b3261e']],
    bubble: [[-0.5,'#1967d2'],[-0.2,'#4285f4'],[-0.06,'#9bb8ef'],[0,'#bdc1c6'],[0.06,'#f0a5a0'],[0.2,'#e8453c'],[0.5,'#b3261e']],
    leadBase: '#e8eaed', leadK: [0.3, 0.55, 0.82, 1], leadKB: [0.55, 0.75, 0.92, 1],
    munLine: ['#ffffff', 0.8], ufLine: ['#3c4043', 0.35, 0.55], ink: '#202124', circleStroke: '#ffffff',
    lightI: 0.55, meta: '#f1f1f2', muted: '#5f6368',
    canvas: { bg: '#ebebec', text: '#202124', muted: '#5f6368', soft: 'rgba(32,33,36,.7)', foot: 'rgba(32,33,36,.55)' },
  },
};
const SWING_SCALE = 0.3 / 0.7; // variação usa escala mais curta
let THEME = 'dark', T = THEMES.dark, RAMP_MARGIN, RAMP_BUBBLE, RAMP_SWING, RAMP_BUBBLE_SWING;
function useTheme(name) {
  THEME = THEMES[name] ? name : 'dark'; T = THEMES[THEME];
  Object.assign(COL, T.col);
  RAMP_MARGIN = T.ramp; RAMP_BUBBLE = T.bubble;
  RAMP_SWING = RAMP_MARGIN.map(([v, c]) => [v * SWING_SCALE, c]);
  RAMP_BUBBLE_SWING = RAMP_BUBBLE.map(([v, c]) => [v * SWING_SCALE, c]);
  document.documentElement.dataset.theme = THEME;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', T.meta);
}
{
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) { /* sem storage */ }
  const q = params.get('theme');
  useTheme(q === 'light' || q === 'dark' ? q : saved || 'dark');
}
const cand = (n) => ({ ...(CAND[n] || { short: String(n) }), color: T.cand[n] || T.fallback });

// rampa de um candidato: tom neutro quando a vantagem é pequena, cor cheia quando é grande
function leadStops(color, bubble) {
  const base = T.leadBase, k = bubble ? T.leadKB : T.leadK;
  return [[0, mixHex(color, base, k[0])], [0.12, mixHex(color, base, k[1])], [0.3, mixHex(color, base, k[2])], [0.5, color]];
}
function r1Expr(bubble) {
  const leadExpr = (color) => ['interpolate', ['linear'], ['feature-state', 'v'], ...leadStops(color, bubble).flat()];
  const arms = Object.keys(CAND).flatMap((n) => [+n, leadExpr(T.cand[n])]);
  return ['case', ['==', ['feature-state', 'c'], 1], ['match', ['feature-state', 'w'], ...arms, leadExpr(T.fallback)], bubble ? 'rgba(0,0,0,0)' : COL.empty];
}

/* ================= utilidades ================= */
const $ = (s) => document.querySelector(s);
const fmtInt = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtPct = (x, d = 2) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
// Arrastar para cima/baixo em QUALQUER ponto do painel (celular). Age assim que o dedo passa de 14 px na vertical;
// o clique que o gesto geraria é engolido. Campos de texto e listas roláveis ficam de fora.
function swipePanel(el, onUp, onDown, ignore = 'input, textarea, select, .rank-wrap, #sres, .evo-chart') {
  let x0 = 0, y0 = 0, active = false, done = false;
  el.addEventListener('pointerdown', (e) => {
    if (!isMobile() || e.pointerType === 'mouse' && e.button !== 0 || e.target.closest(ignore)) return;
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

async function getJSON(url, bust) {
  // janela de 15 s: o CDN pode cachear e todos os visitantes dividem o mesmo pedido
  const r = await fetch(bust ? `${url}?t=${Math.floor(Date.now() / 15000)}` : url, { cache: 'no-store' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

function normalize(j) {
  const rows = {};
  for (const [id, a] of Object.entries(j.mun)) {
    rows[id] = { uf: a[0], nome: a[1], sec: a[2], ap: a[3], aptos: a[4], val: a[5], l: a[6], f: a[7], bn: a[8], vb: a[9] || 0, vn: a[10] || 0, comp: a[11] || 0, vs: a[12] || null };
  }
  return { meta: j.meta, rows };
}

function aggregate(rows) {
  const blank = () => ({ l: 0, f: 0, val: 0, sec: 0, ap: 0, aptos: 0, vb: 0, vn: 0, comp: 0, vs: null });
  const T = blank(), U = {};
  for (const r of Object.values(rows)) {
    const u = (U[r.uf] ||= blank());
    for (const t of [T, u]) {
      t.l += r.l; t.f += r.f; t.val += r.val; t.sec += r.sec; t.ap += r.ap;
      t.aptos += r.aptos; t.vb += r.vb || 0; t.vn += r.vn || 0; t.comp += r.comp || 0;
      if (r.vs) { t.vs ||= new Array(r.vs.length).fill(0); for (let i = 0; i < r.vs.length; i++) t.vs[i] += r.vs[i]; }
    }
  }
  return { T, U };
}

// os dois mais votados de um vetor de votos (índices alinhados a S.cands)
function top2(vs) {
  let i1 = -1, i2 = -1;
  for (let i = 0; i < vs.length; i++) {
    if (i1 < 0 || vs[i] > vs[i1]) { i2 = i1; i1 = i; } else if (i2 < 0 || vs[i] > vs[i2]) i2 = i;
  }
  return { n1: S.cands[i1].n, v1: vs[i1], n2: i2 >= 0 ? S.cands[i2].n : null, v2: i2 >= 0 ? vs[i2] : 0 };
}
const margin = (x) => { const t = x.l + x.f; return t > 0 ? (x.l - x.f) / t : null; };

function rampExpr(stops) {
  return ['interpolate', ['linear'], ['feature-state', 'v'], ...stops.flat()];
}
function rampCss(stops) {
  const min = stops[0][0], max = stops[stops.length - 1][0];
  return `linear-gradient(90deg, ${stops.map(([v, c]) => `${c} ${((v - min) / (max - min)) * 100}%`).join(', ')})`;
}

/* ================= estado ================= */
const S = {
  r1: null, r2: null,           // { meta, rows }
  agg1: null, agg2: null,
  history: [],
  view: { data: params.get('data') === 'r1' ? 'r1' : 'r2', mode: START_MODE, grain: START_GRAIN },
  userPicked: params.get('data') === 'r1',
  ready: false,
  hover: null,
  sel: null,                    // município selecionado pela busca
  bbox: {}, cent: {},           // limites e centroide de cada município
  geom: {}, ufGeom: {},         // geometrias originais (contorno do hover no 3D)
  hvMun: {}, hvUf: {},          // altura (m, sem escala de zoom) de cada bloco 3D
  rimKey: null,
  r1f: null, agg1f: null,       // 1º turno FINAL (referência fixa); S.r1/S.agg1 = o que está na tela (pode ser um instante do replay)
  at1: null, hist1: [], snap1Ts: [],
  liveR2: null, liveAgg2: null,   // apuração ao vivo (S.r2/S.agg2 apontam para ela, ou para o instante escolhido)
  at: null,                     // instante do replay (s) ou null = ao vivo
  snapTs: [], snapCache: new Map(), byUf: {},
  cands: [],                    // candidatos do 1º turno (ordem do vetor de votos)
  sort: 'margin',
  uf: null,                     // UF selecionada
  prev: { pcL: 0, pcF: 0 },
};

/* ================= mapa ================= */
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [], light: { anchor: 'viewport', color: '#ffffff', intensity: T.lightI, position: [1.5, 205, 52] } },
  bounds: [[-74.5, -34.5], [-33.5, 5.8]],
  minZoom: 2, maxZoom: 11,
  maxBounds: [[-140, -70], [30, 50]],
  attributionControl: false,
  dragRotate: false, pitchWithRotate: true, maxPitch: 70,
  preserveDrawingBuffer: true,
});
map.touchZoomRotate.disableRotation();
window.trackerMap = map;

function padding() {
  const sc = $('#score').getBoundingClientRect(), ct = $('#controls').getBoundingClientRect(), sd = $('#side').getBoundingClientRect();
  if (isMobile()) {
    // painéis nunca podem reservar mais de ~58% da altura; o excedente sobrepõe o mapa
    let top = sc.bottom + 6 + (S.view.mode === '3d' ? 50 : 0), bottom = innerHeight - ct.top + 6;   // blocos altos sobem na tela
    const cap = innerHeight * 0.58;
    if (top + bottom > cap) { const k = cap / (top + bottom); top *= k; bottom *= k; }
    return { top, bottom, left: 8, right: 8 };
  }
  const extra = S.view.mode === '3d' ? 70 : 0;
  return { top: 30 + extra, bottom: 30, left: Math.min(Math.max(sc.right, ct.right) + 10, innerWidth * 0.36) + extra, right: Math.min(innerWidth - sd.left + 10, innerWidth * 0.26) + extra };
}
const BR_BOUNDS = [[-74.5, -34.5], [-33.5, 5.8]];
function camOf(mode) { return mode === '3d' ? CAM3D : { pitch: 0, bearing: 0 }; }
// enquadra uma região com a inclinação do modo atual. A câmera "plana" é calculada aqui (Mercator) em vez de
// cameraForBounds/fitBounds, que falham durante o carregamento e são conservadores demais com pitch.
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
const unMercX = (x) => x * 360 - 180;
const unMercY = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
function flatCamera(bounds, pad, maxZoom = 18) {
  const c = map.getCanvas(), W = c.clientWidth - pad.left - pad.right, H = c.clientHeight - pad.top - pad.bottom;
  const [[w, s], [e, n]] = bounds;
  const dx = Math.abs(mercX(e) - mercX(w)) || 1e-9, dy = Math.abs(mercY(s) - mercY(n)) || 1e-9;
  const zoom = clamp(Math.min(Math.log2(Math.max(W, 40) / (512 * dx)), Math.log2(Math.max(H, 40) / (512 * dy))), map.getMinZoom(), maxZoom);
  const px = 512 * 2 ** zoom;                      // tamanho do mundo em pixels
  const cx = (mercX(w) + mercX(e)) / 2 - (pad.left - pad.right) / 2 / px;
  const cy = (mercY(s) + mercY(n)) / 2 - (pad.top - pad.bottom) / 2 / px;
  return { center: [unMercX(cx), unMercY(cy)], zoom };
}
function fitTo(bounds, { padding: pad, duration = 800, maxZoom } = {}) {
  const cam = flatCamera(bounds, pad || padding(), maxZoom);
  map.easeTo({ center: cam.center, zoom: cam.zoom + (S.view.mode === '3d' && !isMobile() ? 0.1 : 0), ...camOf(S.view.mode), duration });
}
function refit(animate) { fitTo(BR_BOUNDS, { duration: animate ? 800 : 0 }); }

let ufBounds = {};   // sigla -> [[w,s],[e,n]]
let ufCenters = {};

function ringsOf(g) { return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; }
function boundsOf(geom) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const poly of ringsOf(geom)) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}

async function initMap() {
  const [mun, ufs, cent, r1] = await Promise.all([
    getJSON('data/municipios.geojson'), getJSON('data/ufs.geojson'),
    getJSON('data/centroides.json'), getJSON('data/turno1.json'),
  ]);
  S.cands = r1.meta.candidatos || [];
  S.r1 = normalize(r1);
  S.agg1 = aggregate(S.r1.rows);
  S.r1f = S.r1; S.agg1f = S.agg1;
  for (const [id, r] of Object.entries(S.r1.rows)) (S.byUf[r.uf] ||= []).push(id);

  for (const f of ufs.features) {
    const sg = UF_BY_COD[+f.properties.cod];
    if (!sg) continue;
    f.properties.sg = sg;
    f.id = +f.properties.cod;
    ufBounds[sg] = boundsOf(f.geometry);
    const [[w, s], [e, n]] = ufBounds[sg];
    ufCenters[sg] = [(w + e) / 2, (s + n) / 2];
  }

  // limites de cada município (busca) e centroides
  S.cent = cent;
  for (const f of mun.features) { S.bbox[f.id] = boundsOf(f.geometry); S.geom[f.id] = f.geometry; }
  for (const f of ufs.features) S.ufGeom[f.id] = f.geometry;

  // pontos para o modo bolhas (peso = eleitorado, fixo)
  const pts = { type: 'FeatureCollection', features: Object.entries(cent).map(([id, c]) => ({
    type: 'Feature', id: +id, properties: { w: S.r1.rows[id]?.aptos || 0 }, geometry: { type: 'Point', coordinates: c },
  })) };

  await new Promise((res) => (map.loaded() ? res() : map.once('load', res)));

  // tolerância baixa: com o padrão (0,375) os municípios pequenos do Nordeste somem em zoom baixo
  map.addSource('mun', { type: 'geojson', data: mun, tolerance: 0.08, buffer: 16 });
  map.addSource('uf', { type: 'geojson', data: ufs });
  map.addSource('pts', { type: 'geojson', data: pts });

  map.addLayer({ id: 'fill', type: 'fill', source: 'mun', paint: {
    'fill-color': ['case', ['==', ['feature-state', 'c'], 1], rampExpr(RAMP_MARGIN), COL.empty],
    'fill-opacity': 1,
    'fill-antialias': false,
  } });
  map.addLayer({ id: 'mun-line', type: 'line', source: 'mun', minzoom: 5.5, paint: {
    'line-color': T.munLine[0], 'line-opacity': T.munLine[1], 'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 0.2, 9, 0.8],
  } });
  map.addLayer({ id: 'uf-line', type: 'line', source: 'uf', paint: {
    'line-color': T.ufLine[0], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, T.ufLine[1], 7, T.ufLine[2]],
    'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.4],
  } });
  map.addLayer({ id: 'hover', type: 'line', source: 'mun', paint: {
    'line-color': T.ink, 'line-width': ['case', ['boolean', ['feature-state', 'h'], false], isMobile() ? 2.6 : 1.8, 0],
  } });
  map.addLayer({ id: 'sel', type: 'line', source: 'mun', paint: {
    'line-color': T.ink, 'line-width': ['case', ['boolean', ['feature-state', 's'], false], 2.6, 0],
  } });
  // hover: o bloco sobe um pouco e ganha contorno branco no topo e na base (faixas finas extrudadas, pois linhas não têm altura)
  const isH = ['boolean', ['feature-state', 'h'], false];
  const zk = (f) => ['interpolate', ['linear'], ['zoom'], ...ZSTOPS.flatMap(([z, k]) => [z, f(k)])];
  for (const [id, source] of [['cols3d', 'mun'], ['uf3d', 'uf']]) {
    map.addLayer({ id, type: 'fill-extrusion', source, layout: { visibility: 'none' }, paint: {
      'fill-extrusion-color': ['case', ['==', ['feature-state', 'c'], 1], rampExpr(RAMP_BUBBLE), COL.empty],
      'fill-extrusion-height': extrusionHeight(1),
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95,
      'fill-extrusion-vertical-gradient': true,
    } });
  }
  map.addSource('rim', { type: 'geojson', data: EMPTY_FC });
  map.addLayer({ id: 'rimTop', type: 'fill-extrusion', source: 'rim', filter: ['==', ['get', 'kind'], 'top'], paint: {
    'fill-extrusion-color': T.ink, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false,
    'fill-extrusion-height': zk((k) => ['+', ['*', ['get', 'hv'], LIFT, k], ['*', 1500, k]]),
    'fill-extrusion-base': zk((k) => ['-', ['*', ['get', 'hv'], LIFT, k], ['*', RIM_T, k]]),
  } });
  map.addLayer({ id: 'rimBot', type: 'fill-extrusion', source: 'rim', filter: ['==', ['get', 'kind'], 'bot'], paint: {
    'fill-extrusion-color': T.ink, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false,
    'fill-extrusion-height': zk((k) => ['*', RIM_T, k]), 'fill-extrusion-base': 0,
  } });
  map.addLayer({ id: 'bubbles', type: 'circle', source: 'pts', layout: { visibility: 'none', 'circle-sort-key': ['-', 0, ['get', 'w']] }, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['sqrt', ['get', 'w']], 0.008], 5, ['*', ['sqrt', ['get', 'w']], 0.026], 7, ['*', ['sqrt', ['get', 'w']], 0.07], 9, ['*', ['sqrt', ['get', 'w']], 0.14]],
    'circle-color': ['case', ['==', ['feature-state', 'c'], 1], rampExpr(RAMP_MARGIN), 'rgba(0,0,0,0)'],
    'circle-opacity': 0.82,
    'circle-stroke-color': T.circleStroke, 'circle-stroke-width': 0.4,
  } });

  // rótulos HTML das UFs
  for (const [sg, c] of Object.entries(ufCenters)) {
    const el = document.createElement('div');
    el.className = 'uf-label'; el.textContent = sg;
    new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map);
  }

  // garante que o estado de cor seja reaplicado quando a fonte terminar de carregar
  map.on('sourcedata', (e) => { if (e.sourceId === 'mun' && e.isSourceLoaded && !S.synced) { S.synced = true; paintMap(); map.triggerRepaint(); } });
  bindMapEvents();
  S.ready = true;
  setView();
}

// altura dos blocos 3D; g (0→1) é o fator de "crescimento" usado na animação de entrada
function extrusionHeight(g) {
  const isH = ['boolean', ['feature-state', 'h'], false];
  const hz = (k) => ['*', ['coalesce', ['feature-state', 'hv'], 0], k, g, ['case', isH, LIFT, 1]];
  return ['interpolate', ['linear'], ['zoom'], ...ZSTOPS.flatMap(([z, k]) => [z, hz(k)])];
}
let growRaf = 0, growTimer = 0;
function setHeights(g) { const e = extrusionHeight(g); for (const id of ['cols3d', 'uf3d']) map.setPaintProperty(id, 'fill-extrusion-height', e); }
function grow() {                                    // os blocos sobem do chão ao entrar no 3D ou trocar os dados
  cancelAnimationFrame(growRaf); clearTimeout(growTimer);
  if (REDUCED) { setHeights(1); return; }
  updateRim(null);
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const k = clamp((t - t0) / dur, 0, 1); setHeights(Math.max(1 - Math.pow(1 - k, 3), 0.001)); if (k < 1) growRaf = requestAnimationFrame(step); };
  setHeights(0.001); growRaf = requestAnimationFrame(step);
  growTimer = setTimeout(() => setHeights(1), dur + 250);   // garante o estado final mesmo se o rAF for pausado
}

// contorno do bloco sob o cursor: faixas finas ao longo de cada aresta, no topo e na base
function rimFeatures(geom, hv, w) {
  const out = [];
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const quads = (kind) => {
    const coords = [];
    for (const poly of polys) for (const ring of poly) for (let i = 0; i + 1 < ring.length; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      const c = Math.cos((y1 * Math.PI) / 180) || 1;
      const dx = (x2 - x1) * c, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (!len) continue;
      const nx = (-dy / len) * w / c, ny = (dx / len) * w;     // normal, em graus (corrigida pela latitude)
      coords.push([[[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny]]]);
    }
    return { type: 'Feature', properties: { kind, hv }, geometry: { type: 'MultiPolygon', coordinates: coords } };
  };
  out.push(quads('top'), quads('bot'));
  return out;
}

function updateRim(key) {
  S.rimKey = key && S.view.mode === '3d' ? key : null;
  const src = map.getSource('rim'); if (!src) return;
  if (!S.rimKey) { src.setData(EMPTY_FC); return; }
  const geom = key.source === 'uf' ? S.ufGeom[key.id] : S.geom[key.id];
  const hv = (key.source === 'uf' ? S.hvUf[key.id] : S.hvMun[key.id]) || 0;
  if (!geom || !hv) { src.setData(EMPTY_FC); return; }
  const w = (360 / (512 * 2 ** map.getZoom())) * 1.5;           // ~1,5 px de meia-largura em qualquer zoom
  src.setData({ type: 'FeatureCollection', features: rimFeatures(geom, hv, w) });
}

function bindMapEvents() {
  let last = null;                                   // { source, id } do bloco/polígono com hover
  const setH = (k, v) => k && map.setFeatureState({ source: k.source, id: k.id }, { h: v });
  const hoverTo = (key) => {
    if (last && key && last.source === key.source && last.id === key.id) return;
    setH(last, false); last = key; setH(key, true); updateRim(key);
  };
  window.trackerHover = (source, id) => hoverTo(source ? { source, id } : null);   // útil para testes
  const ufMode = () => S.view.mode === '3d' && S.view.grain === 'uf';
  for (const L of ['fill', 'cols3d', 'uf3d']) {
    map.on('mousemove', L, (e) => {
      if (isMobile()) return;
      if (L === 'fill' && ufMode()) return;          // no 3D por estado, só os blocos dos estados respondem
      const f = e.features[0];
      if (!f) return;
      hoverTo({ source: L === 'uf3d' ? 'uf' : 'mun', id: f.id });
      showTip(L === 'uf3d' ? 'uf:' + UF_BY_COD[f.id] : String(f.id), e.originalEvent.clientX, e.originalEvent.clientY);
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', L, () => { hoverTo(null); hideTip(); map.getCanvas().style.cursor = ''; });
  }
  map.on('zoomend', () => { if (S.rimKey) updateRim(S.rimKey); });   // refaz a espessura do contorno
  map.on('click', (e) => {
    const layers = S.view.mode !== '3d' ? ['fill'] : S.view.grain === 'uf' ? ['uf3d'] : ['cols3d', 'fill'];
    const f = map.queryRenderedFeatures(e.point, { layers })[0];
    if (!f) { hideTip(); return; }
    if (f.layer.id === 'uf3d') { openState(UF_BY_COD[f.id], { zoom: false }); return; }
    if (isMobile()) { showTip(String(f.id), e.originalEvent.clientX, e.originalEvent.clientY); hoverTo({ source: 'mun', id: f.id }); }   // toque: cartão + contorno
    else { const r = S.r1.rows[f.id]; if (r) pick({ kind: 'mun', id: String(f.id), nome: r.nome, uf: r.uf }, { fly: false }); }
  });
  map.on('movestart', () => { if (!isMobile()) hideTip(); });
}

/* ================= tooltip ================= */
const tip = $('#tip');
const pct1 = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

// 1º turno: todos os candidatos, brancos, nulos e abstenção
function tipR1(r) {
  const order = S.cands.map((c, i) => ({ c, v: r.vs[i] })).sort((a, b) => b.v - a.v);
  const rows = order.map(({ c, v }, i) => {
    const info = cand(c.n);
    return `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${info.color}">${info.short}</b><span>${pct1(r.val ? v / r.val : 0)} · ${fmtInt(v)}</span></div>`;
  }).join('');
  const abst = r.aptos ? (r.aptos - r.comp) / r.aptos : 0;
  const foot = r.replay ? `Totalização parcial · ${fmtPct(r.sec ? r.ap / r.sec : 0, 0)} das seções` : `Brancos ${fmtInt(r.vb)} · Nulos ${fmtInt(r.vn)}<br>Abstenção ${pct1(abst)} de ${fmtInt(r.aptos)} eleitores`;
  return `<h4>${r.nome}</h4><div class="sub">${UF_NOME[r.uf] || r.uf} · 1º turno · ${fmtInt(r.val)} votos válidos</div>${rows}
    <div class="cmp">${foot}</div>`;
}
function hideTip() { tip.hidden = true; if (isMobile()) window.trackerHover?.(null); }   // celular: o contorno do município some junto com o cartão

// html do card de um município, conforme a visão atual
function tipHtml(id) {
  const r2 = S.r2?.rows[id], r1 = (mapView() === 'r1' ? S.r1 : S.r1f)?.rows[id];   // fora do 1º turno, compara com o resultado final
  const r = r2 || r1;
  if (!r) return null;
  const showR2 = mapView() !== 'r1' && r2 && r2.ap > 0;
  const cur = showR2 ? r2 : r1;
  const turno = showR2 ? '2º turno' : '1º turno';
  const val = cur.val || 1;
  const m = margin(cur);
  const t = cur.l + cur.f || 1;
  const full = !showR2 && mapView() === 'r1' && r1?.vs;
  let html = full ? tipR1(r1) : `<h4>${r.nome}</h4><div class="sub">${UF_NOME[r.uf] || r.uf} · ${turno}${showR2 ? ` · ${fmtPct(cur.ap / Math.max(cur.sec, 1), 0)} apurado` : ''}</div>
    <div class="tsplit"><i style="width:${(cur.l / t) * 100}%"></i><i style="width:${(cur.f / t) * 100}%"></i></div>
    <div class="tr l"><b>Lula ${fmtPct(cur.l / val)}</b><span>${fmtInt(cur.l)} votos</span></div>
    <div class="tr f"><b>Flávio ${fmtPct(cur.f / val)}</b><span>${fmtInt(cur.f)} votos</span></div>`;
  if (!full && showR2 && r1) {
    const m1 = margin(r1);
    if (m != null && m1 != null) {
      const d = (m - m1) * 100;
      html += `<div class="cmp">1º turno: Lula ${fmtPct(r1.l / r1.val, 1)} · Flávio ${fmtPct(r1.f / r1.val, 1)}<br>Variação de margem: ${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pts ${d >= 0 ? 'para Lula' : 'para Flávio'}</div>`;
    }
  }
  return { html, wide: !!full };
}

// card de um estado (3D por estado): totais do estado na visão atual
function tipUFHtml(sg) {
  const r1v = mapView() === 'r1';
  const u = (r1v ? S.agg1 : S.agg2)?.U[sg];
  if (!u || !u.val) return null;
  if (r1v && u.vs) {
    const rows = S.cands.map((c, i) => ({ c, v: u.vs[i] })).sort((x, y) => y.v - x.v).map(({ c, v }, i) => {
      const info = cand(c.n);
      return `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${info.color}">${info.short}</b><span>${pct1(v / u.val)} · ${fmtInt(v)}</span></div>`;
    }).join('');
    return { html: `<h4>${UF_NOME[sg]}</h4><div class="sub">Estado · 1º turno · ${fmtInt(u.val)} votos válidos</div>${rows}`, wide: true };
  }
  const t = u.l + u.f || 1, m = margin(u), m1 = S.agg1f?.U[sg] ? margin(S.agg1f.U[sg]) : null;
  let html = `<h4>${UF_NOME[sg]}</h4><div class="sub">Estado · 2º turno · ${fmtPct(u.ap / Math.max(u.sec, 1), 0)} apurado</div>
    <div class="tsplit"><i style="width:${(u.l / t) * 100}%"></i><i style="width:${(u.f / t) * 100}%"></i></div>
    <div class="tr l"><b>Lula ${fmtPct(u.l / u.val)}</b><span>${fmtInt(u.l)} votos</span></div>
    <div class="tr f"><b>Flávio ${fmtPct(u.f / u.val)}</b><span>${fmtInt(u.f)} votos</span></div>`;
  if (m != null && m1 != null) { const d = (m - m1) * 100; html += `<div class="cmp">Variação de margem vs 1º turno: ${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pts ${d >= 0 ? 'para Lula' : 'para Flávio'}</div>`; }
  return { html, wide: false };
}

function showTip(id, x, y) {
  const t = id.startsWith('uf:') ? tipUFHtml(id.slice(3)) : tipHtml(id);
  if (!t) { hideTip(); return; }
  tip.classList.toggle('wide', t.wide);
  tip.innerHTML = t.html;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 16, top = y + 16;
  if (isMobile()) { left = clamp(x - w / 2, 8, innerWidth - w - 8); top = clamp(y - h - 24, 8, innerHeight - h - 8); }
  else { if (left + w > innerWidth - 8) left = x - w - 16; if (top + h > innerHeight - 8) top = y - h - 16; }
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}

/* ================= pintura do mapa ================= */
function viewValue(id) {
  const d = mapView();
  const r1 = (d === 'r1' ? S.r1 : S.r1f)?.rows[id], r2 = S.r2?.rows[id];
  if (d === 'r1') return r1 ? margin(r1) : null;
  if (!r2 || r2.ap === 0) return null;
  const a = margin(r2);
  if (d === 'r2') return a;
  const b = r1 ? margin(r1) : null;
  return a == null || b == null ? null : a - b;
}

function setView() {
  if (!S.ready) return;
  const swing = mapView() === 'swing';
  const stops = swing ? RAMP_SWING : RAMP_MARGIN;
  const r1v = mapView() === 'r1';
  const expr = r1v ? r1Expr(false) : ['case', ['==', ['feature-state', 'c'], 1], rampExpr(stops), COL.empty];
  map.setPaintProperty('fill', 'fill-color', expr);
  map.setPaintProperty('bubbles', 'circle-color', r1v ? r1Expr(true) : ['case', ['==', ['feature-state', 'c'], 1], rampExpr(swing ? RAMP_BUBBLE_SWING : RAMP_BUBBLE), 'rgba(0,0,0,0)']);
  $('#lgRamp').hidden = r1v; $('#lgR1').hidden = !r1v;
  if (r1v) renderLegendR1();
  const bub = S.view.mode === 'bubbles', d3 = S.view.mode === '3d';
  map.setLayoutProperty('bubbles', 'visibility', bub ? 'visible' : 'none');
  const ufg = d3 && S.view.grain === 'uf';
  map.setLayoutProperty('cols3d', 'visibility', d3 && !ufg ? 'visible' : 'none');
  map.setLayoutProperty('uf3d', 'visibility', ufg ? 'visible' : 'none');
  map.setPaintProperty('fill', 'fill-opacity', bub ? 0.18 : ufg ? 0.2 : d3 ? 0.3 : 1);
  const colorExpr = r1v ? r1Expr(true) : ['case', ['==', ['feature-state', 'c'], 1], rampExpr(swing ? RAMP_BUBBLE_SWING : RAMP_BUBBLE), COL.empty];
  map.setPaintProperty('hover', 'line-width', d3 ? 0 : ['case', ['boolean', ['feature-state', 'h'], false], 1.8, 0]);   // no 3D o contorno vem das faixas
  if (!d3 && S.rimKey) updateRim(null);
  map.setPaintProperty('cols3d', 'fill-extrusion-color', colorExpr);
  map.setPaintProperty('uf3d', 'fill-extrusion-color', colorExpr);
  document.body.classList.toggle('mode3d', d3);
  $('#grainRow').hidden = !d3;
  $('#hNote').textContent = `Altura do bloco = ${mapView() === 'r1' ? 'votos válidos' : 'votos apurados'}${ufg ? ' no estado' : ' no município'}`;
  document.querySelectorAll('#grainSeg button').forEach((b) => b.classList.toggle('on', b.dataset.grain === S.view.grain));
  const sig = S.view.mode + S.view.data + S.view.grain;
  if (d3 && sig !== S.lastSig) grow();
  S.lastSig = sig;
  if (S.camMode !== S.view.mode) {          // trocou de modo: inclina/endireita a câmera
    const first = S.camMode === undefined;
    S.camMode = S.view.mode;
    if (d3) { map.dragRotate.enable(); map.touchPitch.enable(); map.keyboard.enableRotation(); }
    else { map.dragRotate.disable(); map.touchPitch.disable(); map.keyboard.disableRotation(); }
    if (!first && !S.uf && !S.sel) fitTo(BR_BOUNDS, { duration: 1200 });
    else if (!first) map.easeTo({ ...camOf(S.view.mode), duration: 1000 });
    // saindo do 3D: ao fim do movimento garante mapa plano e com o norte para cima
    if (!d3) map.once('moveend', () => { if (S.view.mode !== '3d' && (map.getPitch() || map.getBearing())) map.jumpTo({ pitch: 0, bearing: 0 }); });
  }
  $('#ramp').style.background = rampCss(stops);
  $('#lgL').textContent = swing ? 'Mais Flávio' : 'Flávio';
  $('#lgR').textContent = swing ? 'Mais Lula' : 'Lula';
  document.querySelectorAll('#dataSeg button').forEach((b) => b.classList.toggle('on', b.dataset.data === S.view.data));
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.view.mode));
  paintMap();
  updateThumbs();
}

function renderLegendR1() {
  const won = {};
  for (const [id, r] of Object.entries(S.r1.rows)) { if (!r.vs || !r.val || !(+id > 1000000)) continue; const n = top2(r.vs).n1; won[n] = (won[n] || 0) + 1; }
  const chips = Object.entries(won).sort((a, b) => b[1] - a[1]).map(([n, k]) => `<span class="chip"><i class="dot" style="background:${cand(n).color}"></i><b>${cand(n).short}</b> ${fmtInt(k)} mun.</span>`).join('');
  // barra: do tom forte de Flávio (esquerda) ao neutro e ao tom forte de Lula (direita), igual à do 2º turno
  const f = leadStops(T.cand['22'], false), l = leadStops(T.cand['13'], false);
  const grad = `linear-gradient(90deg, ${f[3][1]} 0%, ${f[2][1]} 17%, ${f[1][1]} 34%, ${f[0][1]} 49%, ${l[0][1]} 51%, ${l[1][1]} 66%, ${l[2][1]} 83%, ${l[3][1]} 100%)`;
  const note = S.view.data !== 'r1' ? 'Mapa do 1º turno até a apuração do 2º começar · tom = tamanho da vantagem' : 'Cor = candidato mais votado · tom = tamanho da vantagem';
  $('#lgR1').innerHTML = `<div class="lg-bar"><span>Flávio</span><div class="ramp" style="background:${grad}"></div><span>Lula</span></div><div class="lg-note">${note}</div>${chips}`;
}

// votos que definem a altura da coluna no modo 3D
function viewVotes(id) {
  if (mapView() === 'r1') return S.r1.rows[id]?.val || 0;
  return S.r2?.rows[id]?.val || 0;
}

// aplica estados de feição; mudanças pequenas (≤500) são interpoladas em 700 ms, grandes entram direto
const curSt = {};
let twActive = null;
const lerp = (x, y, k) => x + (y - x) * k;
function commitStates(items) {
  if (twActive) twActive.finish();
  const moving = [];
  for (const [source, id, st] of items) {
    const key = source + id, p = curSt[key];
    curSt[key] = st;
    if (!REDUCED && p && p.c === 1 && st.c === 1 && p.w === st.w && (p.v !== st.v || p.hv !== st.hv)) moving.push([source, id, p, st]);
    else map.setFeatureState({ source, id }, st);
  }
  if (!moving.length) return;
  if (moving.length > 500) { for (const [source, id, , st] of moving) map.setFeatureState({ source, id }, st); return; }
  let done = false, raf = 0;
  const apply = (k) => { for (const [source, id, p, st] of moving) {
    const s = { ...st, v: lerp(p.v, st.v, k) };
    if (st.hv !== undefined) s.hv = lerp(p.hv || 0, st.hv, k);
    map.setFeatureState({ source, id }, s);
  } };
  const t0 = performance.now(), dur = 700;
  const step = (t) => { if (done) return; const k = clamp((t - t0) / dur, 0, 1); apply(1 - Math.pow(1 - k, 3)); if (k < 1) raf = requestAnimationFrame(step); else done = true; };
  twActive = { finish() { if (!done) { done = true; cancelAnimationFrame(raf); apply(1); } } };
  raf = requestAnimationFrame(step);
}

function paintMap() {
  if (!S.ready) return;
  const ids = Object.keys(S.r1.rows);
  const extra = S.view.mode === 'bubbles' ? 'pts' : null, d3 = S.view.mode === '3d' && S.view.grain === 'mun';
  const items = [];
  for (const id of ids) {
    let st;
    if (mapView() === 'r1') {
      const r = S.r1.rows[id];
      if (r?.vs && r.val) { const t = top2(r.vs); st = { c: 1, w: +t.n1, v: (t.v1 - t.v2) / r.val }; } else st = { c: 0 };
    } else {
      const v = viewValue(id);
      st = v == null ? { c: 0 } : { c: 1, v };
    }
    const n = +id;
    if (!Number.isFinite(n) || !(n > 1000000)) continue; // exterior não está no mapa
    const hv = d3 && st.c ? Math.pow(viewVotes(id), H3D_EXP) * H3D : 0;
    if (d3) S.hvMun[n] = hv;
    items.push(['mun', n, d3 ? { ...st, hv } : st]);
    if (extra === 'pts') map.setFeatureState({ source: 'pts', id: n }, st);
  }
  if (S.view.mode === '3d' && S.view.grain === 'uf') { commitStates(items.map(([s, id, st]) => [s, id, st.c ? { ...st } : st])); paintUF(); }
  else commitStates(items);
  if (S.rimKey) updateRim(S.rimKey);          // alturas mudaram (dados novos): refaz o contorno
}

// 3D por estado: cor pelo líder do estado, altura pelos votos do estado
function paintUF() {
  const d = mapView(), U = (d === 'r1' ? S.agg1 : S.agg2)?.U || {};
  const ufItems = [];
  for (const [sg, cod] of Object.entries(COD_BY_UF)) {
    const u = U[sg];
    let st = { c: 0, hv: 0 };
    if (u && u.val > 0) {
      const hv = Math.sqrt(u.val) * H3D_UF;
      if (d === 'r1' && u.vs) { const t = top2(u.vs); st = { c: 1, w: +t.n1, v: (t.v1 - t.v2) / u.val, hv }; }
      else if (d === 'r2' && u.ap > 0) { const m = margin(u); if (m != null) st = { c: 1, v: m, hv }; }
      else if (d === 'swing' && u.ap > 0) { const m = margin(u), m1 = S.agg1f.U[sg] ? margin(S.agg1f.U[sg]) : null; if (m != null && m1 != null) st = { c: 1, v: m - m1, hv }; }
    }
    S.hvUf[cod] = st.hv;
    ufItems.push(['uf', cod, st]);
  }
  commitStates(ufItems);
}

/* ================= placar ================= */
function status() {
  if (S.at != null) return 'replay';
  const a = S.agg2?.T;
  if (!a || a.ap === 0) return 'waiting';
  if (a.ap >= a.sec) return 'done';
  const age = Date.now() / 1000 - (S.r2.meta.fetched_at || 0);
  return age > 600 ? 'stale' : 'live';
}

const PILL = { replay: 'Replay', waiting: 'Aguardando', live: 'Ao vivo', done: 'Apuração encerrada', stale: 'Atualização atrasada' };

function tween(el, from, to, fmt) {
  if (document.body.classList.contains('og')) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => {
    const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ================= números com dígitos que rolam ================= */
const DIGITS = '<b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b><b>7</b><b>8</b><b>9</b>';
function setRoll(el, text) {
  const chars = [...text], digits = chars.filter((c) => /\d/.test(c));
  const sig = chars.map((c) => (/\d/.test(c) ? '#' : c)).join('');
  const bump = () => { if (REDUCED) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  if (el._sig !== sig) {                              // estrutura mudou (ou primeira vez): reconstrói e rola a partir do zero
    const first = el._sig === undefined;
    el._sig = sig; el._text = text;
    el.innerHTML = chars.map((c) => (/\d/.test(c) ? `<span class="dg" aria-hidden="true"><i style="--d:0">${DIGITS}</i></span>` : `<span class="ch" aria-hidden="true">${c}</span>`)).join('');
    void el.offsetWidth;
    el.querySelectorAll('.dg i').forEach((i, k) => i.style.setProperty('--d', digits[k]));
    if (!first) bump();
  } else if (el._text !== text) {                     // só mudaram os dígitos: cada coluna rola até o novo valor
    el._text = text;
    el.querySelectorAll('.dg i').forEach((i, k) => i.style.setProperty('--d', digits[k]));
    bump();
  }
  el.setAttribute('aria-label', text);
}
const pctNum = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderScore() {
  if (pollMode()) {                                // sem apuração: manchete + média das pesquisas
    $('#pill').dataset.s = 'waiting'; $('#pill span').textContent = 'Aguardando';
    $('#eyebrow').textContent = 'Presidente · 2º turno';
    $('#liveBack').hidden = S.at1 == null; $('#liveBackTxt').textContent = 'Resultado final';
    renderSoon();
    return;
  }
  const st = status();
  const liveData = st !== 'waiting';
  const r1v = S.view.data === 'r1';
  const empty = !r1v && !liveData;             // 2º turno selecionado, mas a apuração ainda não começou
  const agg = r1v ? S.agg1 : liveData ? S.agg2 : S.agg1f;
  const T = agg.T;
  const meta = r1v ? S.r1.meta : liveData ? S.r2.meta : S.r1.meta;

  $('#liveBack').hidden = S.at == null && S.at1 == null;
  $('#liveBackTxt').textContent = r1v && S.at1 != null ? 'Resultado final' : 'Ao vivo';
  if (r1v) {
    const rep1 = S.at1 != null;
    $('#pill').dataset.s = rep1 ? 'replay' : liveData ? 'done' : 'waiting';
    $('#pill span').textContent = rep1 ? `Replay · ${tFmt(S.at1)}` : liveData ? '1º turno encerrado' : 'Resultado final';
    $('#eyebrow').textContent = 'Presidente · 1º turno';
  } else {
    $('#pill').dataset.s = st;
    $('#pill span').textContent = st === 'replay' ? `Replay · ${tFmt(S.at)}` : PILL[st];
    $('#eyebrow').textContent = 'Tracker da votação · 2º turno';
  }

  const pL = !empty && T.val ? T.l / T.val : 0, pF = !empty && T.val ? T.f / T.val : 0;
  $('#pcLbox').classList.toggle('empty', empty); $('#pcFbox').classList.toggle('empty', empty);
  setRoll($('#pcL'), empty ? '–' : pctNum(pL)); setRoll($('#pcF'), empty ? '–' : pctNum(pF));
  setRoll($('#vtL'), empty ? '' : fmtInt(T.l)); setRoll($('#vtF'), empty ? '' : fmtInt(T.f));
  $('#vtLu').hidden = $('#vtFu').hidden = empty;

  const two = T.l + T.f || 1;
  $('#barL').style.width = (empty ? 50 : (T.l / two) * 100) + '%';
  $('#barF').style.width = (empty ? 50 : (T.f / two) * 100) + '%';

  const diff = T.l - T.f, lead = $('#lead');
  const pts = Math.abs(pL - pF) * 100;
  lead.className = 'lead ' + (empty ? '' : diff > 0 ? 'l' : diff < 0 ? 'f' : '');
  lead.textContent = empty ? 'Aguardando as primeiras urnas' : diff === 0 ? 'Empate' : `${diff > 0 ? 'Lula' : 'Flávio'} à frente por ${fmtInt(Math.abs(diff))} votos (${pts.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} pts)`;

  const apPct = T.sec && !empty ? T.ap / T.sec : 0;
  $('#progBar').style.width = apPct * 100 + '%';
  if (r1v) {
    $('#apTxt').textContent = S.at1 != null ? `Seções apuradas ${fmtPct(apPct)}` : `Seções ${fmtPct(apPct)} · 4 de outubro`;
    $('#updTxt').textContent = S.at1 != null ? `Replay · ${tFmt(S.at1)} (Brasília)` : liveData ? 'Totalização final' : '2º turno: 25/10, 8h–17h';
  } else if (empty) {
    $('#apTxt').textContent = 'Seções apuradas –';
    $('#updTxt').textContent = 'Votação: 25/10, 8h–17h';
  } else {
    $('#apTxt').textContent = `Seções apuradas ${fmtPct(apPct)}`;
    $('#updTxt').textContent = S.at != null ? `Replay · ${tFmt(S.at)} (Brasília)` : `Atualizado ${(meta.updated || '').slice(0, 19)} (Brasília)`.replace(/\s+/g, ' ');
  }

  renderRank(r1v, T);

  // estados à frente
  const U = agg.U, won = {};
  if (!empty) for (const [sg, u] of Object.entries(U)) {
    if (sg === 'ZZ' || !u.ap) continue;
    const n = r1v && u.vs ? top2(u.vs).n1 : u.l > u.f ? '13' : u.f > u.l ? '22' : null;
    if (n) won[n] = (won[n] || 0) + 1;
  }
  const ranked = Object.entries(won).sort((a, b) => b[1] - a[1]);
  $('#won').innerHTML = ranked.map(([n, k], i) => `<span><i class="dot" style="background:${cand(n).color}"></i><b>${k}</b> ${i === 0 ? 'estados com ' : 'com '}${cand(n).short.split(' ')[0]}</span>`).join('');
}

// 1º turno: demais candidatos, brancos, nulos e abstenção
function renderRank(show, T) {
  $('#rank').hidden = !show || !T.vs;
  if (!show || !T.vs) return;
  const rows = S.cands.map((c, i) => ({ c, v: T.vs[i] })).filter((x) => x.c.n !== '13' && x.c.n !== '22').sort((a, b) => b.v - a.v);
  const top = rows[0]?.v || 1;
  $('#rankList').innerHTML = rows.map(({ c, v }) => {
    const info = cand(c.n);
    return `<li style="--c:${info.color}"><img src="img/c${c.n}.jpg" alt="" onerror="this.style.visibility='hidden'">
      <span class="rn">${info.short} <small>${c.sg}</small><i class="rb"><b style="width:${Math.max(v / top, 0.02) * 100}%;background:${info.color}"></b></i></span>
      <span class="rp">${pct1(T.val ? v / T.val : 0)}</span><span class="rv">${fmtInt(v)}</span></li>`;
  }).join('');
  const base = T.comp || 1, abst = T.aptos ? (T.aptos - T.comp) / T.aptos : 0;
  if (S.at1 != null) { $('#rankFoot').innerHTML = `Válidos ${fmtInt(T.val)} · totalização parcial`; return; }
  $('#rankFoot').innerHTML = `Válidos ${fmtInt(T.val)} · Brancos ${fmtInt(T.vb)} (${pct1(T.vb / base)}) · Nulos ${fmtInt(T.vn)} (${pct1(T.vn / base)}) · Abstenção ${pct1(abst)}`;
}

/* ================= lista de estados ================= */
// cartão do Exterior: entrada à parte, fora da lista de estados
function renderExtCard(row, u) {
  const btn = $('#extBtn');
  btn.hidden = !row || !!S.uf;
  if (!row) return;
  const n = (S.byUf.ZZ || []).length;
  const v = u.val >= 1e6 ? `${(u.val / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : u.val >= 1e3 ? `${Math.round(u.val / 1e3)} mil` : fmtInt(u.val);
  $('#extSub').textContent = `${fmtInt(n)} cidades · ${v} votos`;
  const res = $('#extRes');
  res.style.color = row.color;
  res.textContent = row.side === 'n' ? 'empate' : `${row.name} +${(row.lead * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
}

function renderStates() {
  const list = $('#ufList');
  const r1v = S.view.data === 'r1';              // a lista segue o turno escolhido (o mapa é que usa o 1º turno de fundo)
  const live = status() !== 'waiting';
  if (!r1v && !live) { list.innerHTML = '<li class="empty">Aguardando as primeiras urnas</li>'; list._rows = null; $('#extBtn').hidden = true; return; }
  list.querySelector('.empty')?.remove();
  const U = (r1v ? S.agg1 : S.agg2).U;
  let arr = Object.entries(U).filter(([, u]) => u.l + u.f > 0).map(([sg, u]) => {
    if (r1v && u.vs) {                         // 1º turno: mais votado do estado e vantagem sobre o 2º
      const t = top2(u.vs), lead = (t.v1 - t.v2) / (u.val || 1);
      return { sg, m: t.n1 === '22' ? -lead : lead, lead, name: cand(t.n1).short.split(' ')[0], color: cand(t.n1).color, side: lead < 0.00005 ? 'n' : t.n1 === '22' ? 'f' : 'l' };
    }
    const m = margin(u);
    return { sg, m, lead: Math.abs(m), name: m >= 0 ? 'Lula' : 'Flávio', color: m >= 0 ? COL.lula : COL.flavio, side: m > 0.0005 ? 'l' : m < -0.0005 ? 'f' : 'n' };
  });
  renderExtCard(arr.find((x) => x.sg === 'ZZ'), U.ZZ);
  arr = arr.filter((x) => x.sg !== 'ZZ');
  if (S.sort === 'margin') arr.sort((a, b) => b.m - a.m);
  else arr.sort((a, b) => UF_NOME[a.sg].localeCompare(UF_NOME[b.sg], 'pt-BR'));

  const rows = (list._rows ||= new Map());
  const before = new Map([...rows].map(([sg, li]) => [sg, li.getBoundingClientRect().top]));   // posições antes (FLIP)
  const keep = new Set(arr.map((x) => x.sg));
  for (const [sg, li] of rows) if (!keep.has(sg)) { li.remove(); rows.delete(sg); }
  const fresh = [];
  for (const { sg, lead, color, side } of arr) {
    let li = rows.get(sg);
    if (!li) {
      li = document.createElement('li'); li.dataset.sg = sg; li.title = UF_NOME[sg];
      li.innerHTML = '<span class="sg"></span><span class="bar"><i></i></span><span class="mg"></span>';
      li.firstChild.textContent = sg === 'ZZ' ? 'EXT' : sg;
      rows.set(sg, li); fresh.push(li);
    }
    li.classList.toggle('on', S.uf === sg);
    const bar = li.querySelector('.bar i'), w = clamp(lead / 0.5, 0, 1) * 50;
    bar.style.background = color;
    bar.style.left = side === 'f' ? 'auto' : '50%'; bar.style.right = side === 'f' ? '50%' : 'auto';
    li._w = w;
    if (!fresh.includes(li)) bar.style.width = w + '%';
    const mg = li.querySelector('.mg');
    mg.style.color = color;
    mg.textContent = side === 'n' ? 'empate' : `${(lead * 100).toLocaleString('pt-BR', { maximumFractionDigits: lead < 0.01 ? 2 : 1 })} pts`;
  }
  for (const { sg } of arr) list.appendChild(rows.get(sg));                // reordena (move os nós existentes)
  void list.offsetWidth;
  for (const li of fresh) li.querySelector('.bar i').style.width = li._w + '%';   // barras novas crescem do zero
  if (!REDUCED) for (const [sg, li] of rows) {                                  // FLIP: linhas deslizam para a nova posição
    const t0 = before.get(sg); if (t0 == null) continue;
    const dy = t0 - li.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/* ================= detalhe do estado / exterior ================= */
function syncSide() {
  const d = !!S.uf;
  $('#side').classList.toggle('in-detail', d);
  $('#detail').hidden = !d; $('#ufList').hidden = d; $('#sortSeg').hidden = d; $('#sideBack').hidden = !d; if (d) $('#extBtn').hidden = true;
  $('#sideTitle').textContent = d ? UF_NOME[S.uf] : 'Estados';
  if (!d) $('#detail').innerHTML = '';
  updateThumbs();
}
function openState(sg, { zoom = true, openSheet = true } = {}) {
  captureEvent('results_location_opened', { location_type: sg === 'ZZ' ? 'exterior' : 'state' });
  S.uf = sg;
  if (zoom && ufBounds[sg]) fitTo(ufBounds[sg], { padding: { ...padding(), left: isMobile() ? 20 : padding().left }, duration: 900 });
  syncSide(); renderStates(); renderDetail();
  if (isMobile() && openSheet) setSheet(sheet.state === 'closed' ? 'half' : sheet.state);
}
function closeState() { S.uf = null; syncSide(); renderStates(); refit(true); }

function renderDetail() {
  const sg = S.uf, box = $('#detail');
  if (!sg) return;
  const d = S.view.data, r1v = d === 'r1', ext = sg === 'ZZ';   // antes da apuração do 2º turno o detalhe mostra o 1º turno (igual ao mapa)
  const u1 = (r1v ? S.agg1 : S.agg1f).U[sg], u2 = S.agg2?.U[sg], u = r1v ? u1 : u2;
  const rows1 = (r1v ? S.r1 : S.r1f).rows, rows2 = S.r2?.rows;
  const ids = S.byUf[sg] || [];
  const unit = ext ? 'cidades' : 'municípios';
  let html = '';

  // 1) resultado do estado na visão atual
  if (r1v && u?.vs) {
    const items = S.cands.map((c, i) => ({ c, v: u.vs[i] })).sort((x, y) => y.v - x.v), top = items[0].v || 1;
    html += `<div class="sec"><h3>Resultado · 1º turno</h3>${items.map(({ c, v }) => {
      const info = cand(c.n);
      return `<div class="d-cand"><div class="top"><b style="color:${info.color}">${info.short}</b><span>${pct1(u.val ? v / u.val : 0)} · ${fmtInt(v)}</span></div><i class="rb"><b style="width:${Math.max(v / top, 0.015) * 100}%;background:${info.color}"></b></i></div>`;
    }).join('')}</div>`;
  } else if (u && u.val > 0) {
    const m = margin(u), m1 = u1 ? margin(u1) : null;
    const ttl = d === 'swing' ? 'Variação vs 1º turno' : '2º turno';
    html += `<div class="sec"><h3>${ttl} · ${fmtPct(u.ap / Math.max(u.sec, 1), 0)} apurado</h3>
      <div class="d-duel"><div class="c l"><span class="nm">Lula</span><div class="big">${pctNum(u.l / u.val)}<small>%</small></div><span class="v">${fmtInt(u.l)} votos</span></div>
      <div class="c f"><span class="nm">Flávio Bolsonaro</span><div class="big">${pctNum(u.f / u.val)}<small>%</small></div><span class="v">${fmtInt(u.f)} votos</span></div></div>
      <div class="tsplit"><i style="width:${(u.l / (u.l + u.f)) * 100}%"></i><i style="width:${(u.f / (u.l + u.f)) * 100}%"></i></div>`;
    if (m != null && m1 != null) { const dd = (m - m1) * 100; html += `<p class="d-note">Margem vs 1º turno: ${dd >= 0 ? '+' : '−'}${Math.abs(dd).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pts para ${dd >= 0 ? 'Lula' : 'Flávio'}</p>`; }
    html += '</div>';
  } else html += '<div class="sec"><p class="d-note">A apuração do 2º turno ainda não começou aqui.</p></div>';

  // 2) números do estado
  if (r1v && u1 && S.at1 == null) {
    const abst = u1.aptos ? (u1.aptos - u1.comp) / u1.aptos : 0, base = u1.comp || 1;
    html += `<div class="sec"><h3>Participação</h3><div class="d-stats"><div><b>${fmtInt(u1.aptos)}</b><span>eleitores</span></div><div><b>${pct1(abst)}</b><span>abstenção</span></div><div><b>${pct1((u1.vb + u1.vn) / base)}</b><span>brancos e nulos</span></div></div></div>`;
  } else if (u2) {
    html += `<div class="sec"><h3>Apuração</h3><div class="d-stats"><div><b>${fmtPct(u2.ap / Math.max(u2.sec, 1), 1)}</b><span>das seções</span></div><div><b>${fmtInt(u2.val)}</b><span>votos válidos</span></div><div><b>${fmtInt(u2.aptos)}</b><span>eleitores</span></div></div></div>`;
  }

  // 3) quem lidera em cada município/cidade + maiores
  const lead = {}, list = [];
  for (const id of ids) {
    const r1 = rows1[id], r2 = rows2?.[id];
    let n = null, val = 0, txt = '', color = T.muted;
    if (r1v) {
      if (!r1.vs || !r1.val) continue;
      const t = top2(r1.vs); n = t.n1; val = r1.val; color = cand(n).color;
      txt = `${cand(n).short.split(' ')[0]} +${((t.v1 - t.v2) / r1.val * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
    } else {
      if (!r2 || !r2.ap || !(r2.l + r2.f)) continue;
      const m = margin(r2); val = r2.val; n = m >= 0 ? '13' : '22'; color = cand(n).color;
      if (d === 'swing' && r1) { const dd = (m - margin(r1)) * 100; txt = `${dd >= 0 ? '+' : '−'}${Math.abs(dd).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${dd >= 0 ? 'Lula' : 'Flávio'}`; color = dd >= 0 ? COL.lula : COL.flavio; }
      else txt = `${cand(n).short.split(' ')[0]} +${(Math.abs(m) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
    }
    lead[n] = (lead[n] || 0) + 1;
    list.push({ id, nome: r1.nome, val, txt, color });
  }
  const chips = Object.entries(lead).sort((x, y) => y[1] - x[1]).map(([n, k]) => `<span><i class="dot" style="background:${cand(n).color}"></i><b>${fmtInt(k)}</b> ${cand(n).short.split(' ')[0]}</span>`).join('');
  if (chips) html += `<div class="sec"><h3>Quem lidera nas ${unit} (${fmtInt(list.length)})</h3><div class="d-chips">${chips}</div></div>`;
  list.sort((x, y) => y.val - x.val);
  if (list.length) html += `<div class="sec"><h3>Maiores ${unit}</h3><ul class="d-list">${list.slice(0, ext ? 12 : 8).map((c) => `<li data-id="${c.id}"><span class="cn">${c.nome}</span><span class="cm" style="color:${c.color}">${c.txt}</span><span class="cv">${fmtInt(c.val)}</span></li>`).join('')}</ul></div>`;
  if (ext) html += '<p class="d-note" style="margin-top:16px">Votos de brasileiros no exterior, por cidade de votação (consulados e embaixadas).</p>';
  const keep = box.scrollTop;
  box.innerHTML = html;
  box.scrollTop = keep;
}

/* ================= evolução / linha do tempo (1º e 2º turno) ================= */
const tFmt = (ts) => new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const tl = () => (S.view.data === 'r1' ? 1 : 2);                       // qual turno a linha do tempo mostra agora
const histPts = () => ((tl() === 1 ? S.hist1 : S.history) || []).filter((p) => p[1] + p[2] > 0);
const atNow = () => (tl() === 1 ? S.at1 : S.at);
const canTravel = () => (tl() === 1 ? S.snap1Ts.length >= 2 : (S.snapTs && S.snapTs.length >= 2));

function renderEvo() {
  const box = $('#evo'), pts = histPts(), t1v = tl() === 1;
  if (pts.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  $('#evoTitle').textContent = 'Linha do tempo';
  const svg = $('#spark'), W = Math.max(svg.clientWidth || 280, 200), H = Math.max(svg.clientHeight || 132, 52), m = { l: 32, r: 8, t: H < 90 ? 6 : 8, b: H < 90 ? 16 : 20 };
  const t0 = pts[0][0], t1 = Math.max(pts[pts.length - 1][0], t0 + 1);
  const sx = (t) => m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r);
  // 1º turno: % sobre todos os votos válidos (como no painel do TSE); 2º turno: % entre os dois candidatos
  const sa = pts.map((p) => p[1] / (t1v ? p[5] : p[1] + p[2])), sb = pts.map((p) => p[2] / (t1v ? p[5] : p[1] + p[2]));
  const vals = [...sa, ...sb, ...(t1v ? [] : [0.5])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const step = [0.01, 0.02, 0.05, 0.1].find((s) => (hi - lo + 0.01) / s <= (H < 90 ? 2 : 4)) || 0.1;   // gráfico baixo (celular): menos linhas de grade
  lo = Math.floor((lo - 0.002) / step) * step; hi = Math.ceil((hi + 0.002) / step) * step;
  const sy = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${sx(pts[i][0]).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  let grid = '';
  for (let v = lo; v <= hi + 1e-9; v += step) { const mid = !t1v && Math.abs(v - 0.5) < 1e-6; grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" style="stroke:var(${mid ? '--chart-mid' : '--chart-grid'})" ${mid ? 'stroke-dasharray="3 3"' : ''}/><text x="${m.l - 6}" y="${sy(v) + 3}" text-anchor="end">${Math.round(v * 100)}%</text>`; }
  const nT = 3;
  for (let i = 0; i <= nT; i++) { const t = t0 + ((t1 - t0) * i) / nT; grid += `<text x="${sx(t)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === nT ? 'end' : 'middle'}">${tFmt(t)}</text>`; }
  const last = pts.length - 1, shown = atNow() != null ? atNow() : pts[last][0];
  let idx = 0; pts.forEach((p, i) => { if (p[0] <= shown) idx = i; });
  const dot = (i, arr, color) => `<circle cx="${sx(pts[i][0])}" cy="${sy(arr[i])}" r="3.4" fill="${color}" style="stroke:var(--panel-solid)" stroke-width="1.5"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `${grid}
    <path d="${path(sb)}" fill="none" stroke="${COL.flavio}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${path(sa)}" fill="none" stroke="${COL.lula}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${sx(pts[idx][0])}" x2="${sx(pts[idx][0])}" y1="${m.t}" y2="${H - m.b}" style="stroke:var(${atNow() != null ? '--chart-sel' : '--chart-cur'})" stroke-width="1"/>
    ${dot(idx, sa, COL.lula)}${dot(idx, sb, COL.flavio)}
    <g id="evoHover" opacity="0"><line y1="${m.t}" y2="${H - m.b}" style="stroke:var(--chart-hov)"/></g>`;
  S.evo = { pts, sx, W, H, m, sa, sb, t0, t1 };
  $('#evoWhen').textContent = atNow() != null ? `${t1v ? '1º turno · ' : ''}Replay · ${tFmt(atNow())}` : t1v ? `1º turno · final ${tFmt(pts[last][0])}` : `Ao vivo · ${tFmt(pts[last][0])}`;
  $('#evoPlay').hidden = !canTravel();
  $('#evoChart').style.cursor = canTravel() ? 'pointer' : 'default';
}

function evoIndexAt(clientX) {
  const e = S.evo; if (!e) return null;
  const x = clientX - $('#spark').getBoundingClientRect().left;
  const t = e.t0 + ((x - e.m.l) / (e.W - e.m.l - e.m.r)) * (e.t1 - e.t0);
  let best = 0; for (let i = 1; i < e.pts.length; i++) if (Math.abs(e.pts[i][0] - t) < Math.abs(e.pts[best][0] - t)) best = i;
  return { i: best, x };
}
{
  const chart = $('#evoChart'), tipEl = $('#evoTip'); let down = false;
  const hover = (ev) => {
    const r = evoIndexAt(ev.clientX); if (!r) return;
    const e = S.evo, p = e.pts[r.i], g = $('#evoHover'); if (!g) return;
    const px = e.sx(p[0]);
    g.setAttribute('opacity', 1); g.querySelector('line').setAttribute('x1', px); g.querySelector('line').setAttribute('x2', px);
    tipEl.innerHTML = `<b>${tFmt(p[0])}</b> · ${fmtPct(p[3] / Math.max(p[4], 1), 0)} apurado<br><span class="l">Lula ${pctNum(e.sa[r.i])}%</span> · <span class="f">Flávio ${pctNum(e.sb[r.i])}%</span>`;
    tipEl.hidden = false;
    tipEl.style.left = clamp(px, tipEl.offsetWidth / 2, chart.clientWidth - tipEl.offsetWidth / 2) + 'px';
  };
  const choose = (ev) => { if (!canTravel()) return; stopPlay(); const r = evoIndexAt(ev.clientX); if (r) setTime(S.evo.pts[r.i][0]); };
  chart.addEventListener('pointermove', (ev) => { hover(ev); if (down) choose(ev); });
  chart.addEventListener('pointerdown', (ev) => { down = true; hover(ev); choose(ev); });
  addEventListener('pointerup', () => { down = false; });
  chart.addEventListener('pointerleave', () => { tipEl.hidden = true; const g = $('#evoHover'); if (g) g.setAttribute('opacity', 0); });
}

/* ---- viagem no tempo ----
   2º turno: "fotos" gravadas pelo coletor (snaps/).  1º turno: fotos reconstituídas dos boletins de urna (data/snaps1/). */
const setTime = (ts) => (tl() === 1 ? setTime1(ts) : setTime2(ts));

async function rowsAt2(ts) {
  const snaps = S.snapTs; if (!snaps.length || !S.liveR2) return null;
  let pick = snaps[0]; for (const t of snaps) if (t <= ts) pick = t;
  let snap = S.snapCache.get(pick);
  if (!snap) {
    try { snap = await getJSON(`${LIVE_BASE}snaps/${pick}.json`); } catch (e) { return null; }
    S.snapCache.set(pick, snap);
    if (S.snapCache.size > 40) S.snapCache.delete(S.snapCache.keys().next().value);
  }
  const base = S.liveR2.rows, ids = (S.ids2 ||= Object.keys(base).sort());
  if (snap.l.length !== ids.length) return null;
  const rows = {};
  ids.forEach((id, i) => { rows[id] = { ...base[id], l: snap.l[i], f: snap.f[i], ap: snap.a[i], val: snap.l[i] + snap.f[i] }; });
  return { rows, ts: pick };
}
async function setTime2(ts) {
  if (ts == null) {
    S.at = null;
    if (S.liveR2) { S.r2 = S.liveR2; S.agg2 = S.liveAgg2; }
    renderAll(); return;
  }
  const got = await rowsAt2(ts);
  if (!got) return;
  S.at = got.ts;                                       // encaixa no horário da foto realmente exibida
  S.r2 = { meta: { ...(S.liveR2?.meta || {}), fetched_at: Date.now() / 1000, updated: '' }, rows: got.rows };
  S.agg2 = aggregate(got.rows);
  if (S.view.data === 'r1') { S.view.data = 'r2'; S.userPicked = true; }
  renderAll();
}

async function rowsAt1(ts) {
  const snaps = S.snap1Ts; if (!snaps.length) return null;
  let pick = snaps[0]; for (const t of snaps) if (t <= ts) pick = t;
  const ck = '1:' + pick;
  let snap = S.snapCache.get(ck);
  if (!snap) {
    try { snap = await getJSON(`data/snaps1/${pick}.json`); } catch (e) { return null; }
    S.snapCache.set(ck, snap);
    if (S.snapCache.size > 40) S.snapCache.delete(S.snapCache.keys().next().value);
  }
  const base = S.r1f.rows, ids = (S.ids1 ||= Object.keys(base).sort()), nc = S.cands.length;
  if (!snap.a || snap.a.length !== ids.length) return null;
  const i13 = S.cands.findIndex((c) => c.n === '13'), i22 = S.cands.findIndex((c) => c.n === '22');
  const rows = {};
  ids.forEach((id, i) => {
    const vs = new Array(nc); let val = 0;
    for (let k = 0; k < nc; k++) { vs[k] = snap.v[k][i]; val += vs[k]; }
    rows[id] = { ...base[id], vs, l: vs[i13], f: vs[i22], val, ap: snap.a[i], vb: 0, vn: 0, comp: 0, bn: 0, replay: true };
  });
  return { rows, ts: pick };
}
async function setTime1(ts) {
  if (ts == null) {
    S.at1 = null; S.r1 = S.r1f; S.agg1 = S.agg1f;
    renderAll(); return;
  }
  const got = await rowsAt1(ts);
  if (!got) return;
  S.at1 = got.ts;
  S.r1 = { meta: S.r1f.meta, rows: got.rows };
  S.agg1 = aggregate(got.rows);
  renderAll();
}

let playing = null;
function setPlayUi(on) { $('#evoPlayTxt').textContent = on ? 'Pausar' : 'Replay'; $('#evoPlayIcon').setAttribute('d', on ? 'M3 2.2h2.2v7.6H3zM6.8 2.2H9v7.6H6.8z' : 'M3.5 2.2v7.6L9.8 6z'); }
function stopPlay() { if (playing) { playing.stop = true; playing = null; setPlayUi(false); } }
async function playReplay() {
  if (playing) { stopPlay(); return; }
  const which = tl();
  const times = which === 1 ? S.snap1Ts.slice() : S.snapTs.slice();
  if (times.length < 2) return;
  const token = (playing = { stop: false });
  captureEvent('results_replay_started', { election_round: which });
  setPlayUi(true);
  const cur = which === 1 ? S.at1 : S.at;
  let i = cur != null ? Math.max(0, times.findIndex((t) => t >= cur)) : 0;
  if (i >= times.length - 1) i = 0;
  const pace = clamp(22000 / times.length, 220, 900);
  for (; i < times.length && !token.stop; i++) { await setTime(times[i]); await new Promise((r) => setTimeout(r, pace)); }
  if (!token.stop) { playing = null; setPlayUi(false); await setTime(null); }
}
$('#evoPlay').addEventListener('click', playReplay);
$('#liveBack').addEventListener('click', async () => { stopPlay(); if (S.at1 != null) await setTime1(null); if (S.at != null && S.view.data !== 'r1') await setTime2(null); });

/* ================= pesquisas de 2º turno (enquanto a apuração não começa) ================= */
const R1_DATE = '2026-10-04';
const VOTE_START = Date.UTC(2026, 9, 25, 11, 0, 0), VOTE_END = Date.UTC(2026, 9, 25, 20, 0, 0);   // 8h e 17h de Brasília
const mapView = () => (S.view.data !== 'r1' && status() === 'waiting' ? 'r1' : S.view.data);
const pollMode = () => false;                    // sem tela "em breve": o placar aparece sempre, vazio até o TSE publicar votos

function updateCountdown() {
  const el = $('#soonCount span'); if (!el) return;
  const now = Date.now();
  if (now < VOTE_START) {
    const s = Math.floor((VOTE_START - now) / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    el.textContent = `Faltam ${d} d ${h} h ${m} min para a votação`;
  } else el.textContent = now < VOTE_END ? 'Votação em andamento · a apuração começa às 17h' : 'Votação encerrada · aguardando as primeiras urnas';
}
setInterval(updateCountdown, 30000);
const renderSoon = updateCountdown;

// 2º turno antes da apuração: mapa do 1º turno ao fundo e o placar vira "Apuração em breve"
function syncPollMode() {
  const on = pollMode();
  $('#score').classList.toggle('is-soon', on);
  applyScoreMin();
  if (on) updateScoreVar();
}


function updateScoreVar() { document.documentElement.style.setProperty('--score-b', Math.round($('#score').getBoundingClientRect().bottom) + 'px'); }
new ResizeObserver(updateScoreVar).observe($('#score'));
// celular: o placar tem versão resumida (só os dois percentuais), retrátil arrastando em qualquer ponto dele.
// Em "Apuração em breve" (is-soon) ele fica sempre aberto e sem alça.
let scoreMin = matchMedia('(max-width: 900px)').matches;
function applyScoreMin() {
  const sc = $('#score'), soon = sc.classList.contains('is-soon');
  sc.classList.toggle('min', scoreMin && !soon);
  $('#scoreGrab').setAttribute('aria-expanded', String(!(scoreMin && !soon)));
}
{
  const sc = $('#score'), g = $('#scoreGrab');
  const set = (min) => { if (sc.classList.contains('is-soon')) return; scoreMin = min; applyScoreMin(); };
  applyScoreMin();
  swipePanel(sc, () => set(true), () => set(false));                     // painel no topo: arrastar para cima recolhe, para baixo expande
  g.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') set(true); else if (e.key === 'ArrowDown') set(false); });
}

/* ================= render geral ================= */
function renderAll() {
  if (!S.r1) return;
  if (!S.userPicked) S.view.data = 'r2';
  syncPollMode();
  renderScore();
  renderStates();
  if (S.uf) renderDetail();
  renderEvo();
  setView();
  if (S.sel) renderPin();
}

/* ================= dados ao vivo ================= */
// Poupa leitura de arquivos (cada visitante gera requisições): só com a aba visível, intervalo com variação,
// 60 s enquanto não há votos, history/snaps só a cada 3ª rodada e para de vez quando a apuração termina.
let pulls = 0, lastPull = 0;
async function pull() {
  lastPull = Date.now();
  const full = pulls++ % 3 === 0;
  try {
    const j = await getJSON(LIVE_BASE + 'live.json', true);
    S.liveR2 = normalize(j);
    S.liveAgg2 = aggregate(S.liveR2.rows);
    if (S.at == null) { S.r2 = S.liveR2; S.agg2 = S.liveAgg2; }   // em replay, o instante escolhido continua na tela
  } catch (e) { /* sem arquivo ainda: segue em "aguardando" */ }
  if (full) {
    try { S.history = await getJSON(LIVE_BASE + 'history.json', true); } catch (e) { /* opcional */ }
    try { S.snapTs = await getJSON(LIVE_BASE + 'snaps/index.json', true); } catch (e) { /* fotos opcionais */ }
  }
  renderAll();
}
function schedulePull() {
  if (status() === 'done') return;                                   // apuração encerrada: nada mais muda
  const delay = (status() === 'waiting' ? 2 * POLL_MS : POLL_MS) * (0.85 + Math.random() * 0.3);
  setTimeout(async () => { if (!document.hidden) await pull(); schedulePull(); }, delay);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.ready && Date.now() - lastPull > POLL_MS) pull(); });

/* ================= interações ================= */
document.querySelectorAll('#dataSeg button').forEach((b) => b.addEventListener('click', async () => {
  stopPlay();
  if (b.dataset.data !== 'r1' && S.at1 != null) await setTime1(null);     // as outras visões comparam com o 1º turno final
  S.view.data = b.dataset.data;
  captureEvent('results_data_view_changed', { election_round: S.view.data });
  S.userPicked = true; renderAll();
}));
document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
  S.view.mode = b.dataset.mode;
  captureEvent('results_visualization_changed', { visualization: S.view.mode });
  setView();
}));
document.querySelectorAll('#grainSeg button').forEach((b) => b.addEventListener('click', () => {
  S.view.grain = b.dataset.grain;
  captureEvent('results_granularity_changed', { granularity: S.view.grain });
  hideTip(); updateRim(null); setView();
}));
document.querySelectorAll('#sortSeg button').forEach((b) => b.addEventListener('click', () => {
  S.sort = b.dataset.sort;
  document.querySelectorAll('#sortSeg button').forEach((x) => x.classList.toggle('on', x === b));
  placeThumb($('#sortSeg'));
  renderStates();
}));
$('#ufList').addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li || !li.dataset.sg) return;
  openState(li.dataset.sg, { zoom: li.dataset.sg !== 'ZZ' });
});
$('#sideBack').addEventListener('click', closeState);
$('#extBtn').addEventListener('click', () => openState('ZZ', { zoom: false }));
$('#detail').addEventListener('click', (e) => {              // maiores municípios/cidades do estado
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const id = li.dataset.id, r = S.r1.rows[id];
  pick({ kind: id.startsWith('zz') ? 'ext' : 'mun', id, nome: r.nome, uf: r.uf });
});
$('#rankToggle').addEventListener('click', () => {
  const open = $('#score').classList.toggle('rank-open');
  $('#rankToggleTxt').textContent = open ? 'Ocultar' : 'Ver todos';
  $('#rankToggle').setAttribute('aria-expanded', String(open));
});
$('#btnStates').addEventListener('click', () => setSheet('half'));
$('#sideClose').addEventListener('click', () => setSheet('closed'));
$('#scrim').addEventListener('click', () => setSheet('closed'));

/* ================= alternar tema ================= */
function applyThemeToMap() {
  if (!S.ready) return;
  map.setPaintProperty('mun-line', 'line-color', T.munLine[0]); map.setPaintProperty('mun-line', 'line-opacity', T.munLine[1]);
  map.setPaintProperty('uf-line', 'line-color', T.ufLine[0]);
  map.setPaintProperty('uf-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 3, T.ufLine[1], 7, T.ufLine[2]]);
  map.setPaintProperty('hover', 'line-color', T.ink); map.setPaintProperty('sel', 'line-color', T.ink);
  map.setPaintProperty('rimTop', 'fill-extrusion-color', T.ink); map.setPaintProperty('rimBot', 'fill-extrusion-color', T.ink);
  map.setPaintProperty('bubbles', 'circle-stroke-color', T.circleStroke);
  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: T.lightI, position: [1.5, 205, 52] });
  renderAll();                                   // repinta cores, legenda, listas e gráfico no novo tema
}
function setTheme(name) {
  useTheme(name);
  try { localStorage.setItem('theme', THEME); } catch (e) { /* sem storage */ }
  applyThemeToMap();
}
$('#themeBtn').addEventListener('click', () => setTheme(THEME === 'dark' ? 'light' : 'dark'));

/* ================= segmentados com indicador deslizante ================= */
function placeThumb(seg) {
  const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
  if (!on || !th || !seg.offsetWidth) return;
  const first = !th._placed;
  if (first) th.style.transition = 'none';
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft}px)`;
  if (first) { void th.offsetWidth; th.style.transition = ''; th._placed = true; }
}
function updateThumbs() { document.querySelectorAll('.seg').forEach(placeThumb); }
const segRO = new ResizeObserver((es) => es.forEach((e) => placeThumb(e.target)));
document.querySelectorAll('.seg').forEach((s) => segRO.observe(s));
document.fonts?.ready.then(updateThumbs);

/* ================= gavetas (celular) ================= */
const sideEl = $('#side'), scrimEl = $('#scrim');
const sheet = { state: 'closed', y: 0 };
const snapY = { closed: () => sideEl.offsetHeight + 24, half: () => sideEl.offsetHeight * 0.46, full: () => 0 };
function setSheet(state, animate = true) {
  sheet.state = state; sheet.y = snapY[state]();
  sideEl.classList.toggle('dragging', !animate);
  sideEl.style.setProperty('--y', sheet.y + 'px');
  scrimEl.classList.toggle('on', state !== 'closed');
}
{
  const grab = $('#sideGrab'); let d = null;
  grab.addEventListener('pointerdown', (e) => {
    if (!isMobile() || e.target.closest('button, .seg')) return;
    d = { y0: e.clientY, s0: sheet.y, last: e.clientY, lt: e.timeStamp, v: 0, cur: sheet.y };
    try { grab.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
    sideEl.classList.add('dragging');
  });
  grab.addEventListener('pointermove', (e) => {
    if (!d) return;
    d.cur = clamp(d.s0 + (e.clientY - d.y0), 0, snapY.closed());
    d.v = (e.clientY - d.last) / Math.max(e.timeStamp - d.lt, 1); d.last = e.clientY; d.lt = e.timeStamp;
    sideEl.style.setProperty('--y', d.cur + 'px');
  });
  const end = () => {
    if (!d) return;
    sideEl.classList.remove('dragging');
    const order = ['full', 'half', 'closed'];
    let idx = order.reduce((best, s, i) => (Math.abs(snapY[s]() - d.cur) < Math.abs(snapY[order[best]]() - d.cur) ? i : best), 0);
    if (Math.abs(d.v) > 0.5) idx = clamp(idx + (d.v > 0 ? 1 : -1), 0, 2);       // um gesto rápido avança uma posição
    d = null; setSheet(order[idx]);
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
}

/* painel de controles: recolhe/expande (toque ou arraste) */
{
  const ctl = $('#controls'), g = $('#ctlGrab');
  const setCtl = (collapsed) => {
    ctl.classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('ctlCollapsed', collapsed ? '1' : '0'); } catch (e) { /* sem storage */ }
    setTimeout(() => { if (!S.uf && !S.sel && isMobile()) refit(true); }, 520);
  };
  try { const sv = localStorage.getItem('ctlCollapsed'); if (sv === '1' || (sv == null && matchMedia('(max-width: 900px)').matches)) ctl.classList.add('collapsed'); } catch (e) { /* sem storage */ }   // celular: legenda recolhida por padrão
  swipePanel(ctl, () => setCtl(false), () => setCtl(true));            // painel embaixo: arrastar para baixo recolhe, para cima expande
  g.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') setCtl(true); else if (e.key === 'ArrowUp') setCtl(false); });
}
addEventListener('resize', () => { if (S.ready) { map.resize(); if (!S.uf) refit(false); renderEvo(); } });

/* ================= busca de cidades ================= */
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const qEl = $('#q'), resEl = $('#sres'), pinEl = $('#pin');
let hits = [], active = -1, index = null;

function buildIndex() {
  index = [];
  for (const [id, r] of Object.entries(S.r1.rows)) {
    if (!(+id > 1000000)) continue;
    index.push({ kind: 'mun', id, nome: r.nome, uf: r.uf, key: norm(r.nome), pop: r.aptos });
  }
  for (const [id, r] of Object.entries(S.r1.rows)) if (id.startsWith('zz')) index.push({ kind: 'ext', id, nome: r.nome, uf: 'ZZ', key: norm(r.nome), pop: r.aptos / 4 });
  for (const [sg, nome] of Object.entries(UF_NOME)) index.push({ kind: 'uf', sg, nome, uf: sg, key: norm(nome), pop: 1e9 });
}

function runSearch(raw) {
  if (!index) buildIndex();
  let q = norm(raw.trim()), uf = null;
  if (!q) return { list: [], q };
  const m = q.match(/^(.*?)[\s,\-/]+([a-z]{2})$/);          // "campinas sp" / "campinas, sp"
  if (m && UF_NOME[m[2].toUpperCase()] && m[1]) { uf = m[2].toUpperCase(); q = m[1].trim(); }
  const out = [];
  for (const e of index) {
    if (uf && e.uf !== uf) continue;
    const i = e.key.indexOf(q);
    if (i < 0) continue;
    out.push({ e, i, score: i === 0 ? 0 : e.key[i - 1] === ' ' ? 1 : 2 });
  }
  out.sort((a, b) => a.score - b.score || b.e.pop - a.e.pop);
  return { list: out.slice(0, 8), q };
}

function renderResults() {
  const { list, q } = runSearch(qEl.value);
  hits = list.map((x) => x.e); active = hits.length ? 0 : -1;
  $('#qclear').hidden = !qEl.value;
  if (!list.length) {
    resEl.innerHTML = qEl.value.trim() ? '<li class="none">Nada encontrado</li>' : '';
    resEl.hidden = !qEl.value.trim(); qEl.setAttribute('aria-expanded', String(!resEl.hidden)); return;
  }
  resEl.innerHTML = list.map(({ e, i }, k) => {
    const nm = e.nome.slice(0, i) + '<mark>' + e.nome.slice(i, i + q.length) + '</mark>' + e.nome.slice(i + q.length);
    const r = e.kind === 'mun' ? S.r1.rows[e.id] : null;
    const dot = r?.vs ? `<i class="dot" style="background:${cand(top2(r.vs).n1).color}"></i>` : '';
    return `<li role="option" data-k="${k}" class="${k === 0 ? 'on' : ''}">${dot}<span class="nm">${nm}</span><span class="uf">${e.kind === 'ext' || e.sg === 'ZZ' ? 'exterior' : e.kind === 'uf' ? 'estado' : e.uf}</span></li>`;
  }).join('');
  resEl.hidden = false; qEl.setAttribute('aria-expanded', 'true');
}

function closeResults() { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); }

function moveActive(d) {
  if (!hits.length) return;
  active = (active + d + hits.length) % hits.length;
  resEl.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === active));
  resEl.querySelector('li.on')?.scrollIntoView({ block: 'nearest' });
}

function clearSel() {
  if (S.sel && /^\d+$/.test(S.sel)) map.setFeatureState({ source: 'mun', id: +S.sel }, { s: false });
  S.sel = null; pinEl.hidden = true; pinEl.classList.remove('open');
}

function pick(e, { fly = true } = {}) {
  if (pollMode()) { S.view.data = 'r1'; S.userPicked = true; renderAll(); }   // cidade/estado só existem no mapa: volta ao 1º turno
  closeResults(); qEl.blur();
  hideTip(); clearSel();
  if (e.kind === 'uf') {
    qEl.value = e.nome;
    openState(e.sg, { zoom: e.sg !== 'ZZ', openSheet: false });
    return;
  }
  if (S.uf && S.uf !== e.uf) { S.uf = null; syncSide(); }
  captureEvent('results_location_opened', { location_type: e.kind === 'ext' ? 'exterior' : 'municipality' });
  S.sel = e.id; qEl.value = e.kind === 'ext' ? `${e.nome} · Exterior` : `${e.nome} · ${e.uf}`; $('#qclear').hidden = false;
  if (e.kind === 'mun') {
    map.setFeatureState({ source: 'mun', id: +e.id }, { s: true });
    if (fly) fitTo(S.bbox[e.id], { maxZoom: 9.5, duration: 1300 });
  } else if (e.kind === 'ext' && S.uf !== 'ZZ') openState('ZZ', { zoom: false, openSheet: false });
  renderPin();
  renderStates();
}

function renderPin() {
  const t = tipHtml(S.sel);
  if (!t) { pinEl.hidden = true; return; }
  $('#pinBody').innerHTML = t.html;
  pinEl.classList.toggle('wide', t.wide);
  pinEl.hidden = false;
}

qEl.addEventListener('input', renderResults);
qEl.addEventListener('focus', () => { qEl.select(); if (qEl.value.trim()) renderResults(); });
qEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); moveActive(1); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveActive(-1); }
  else if (ev.key === 'Enter') { ev.preventDefault(); if (hits[active]) pick(hits[active]); }
  else if (ev.key === 'Escape') { closeResults(); qEl.blur(); }
});
resEl.addEventListener('mousedown', (ev) => {         // mousedown: roda antes do blur do input
  const li = ev.target.closest('li[data-k]'); if (!li) return;
  ev.preventDefault(); pick(hits[+li.dataset.k]);
});
$('#qclear').addEventListener('click', () => { qEl.value = ''; closeResults(); clearSel(); $('#qclear').hidden = true; if (S.uf) closeState(); else refit(true); qEl.focus(); });
pinEl.addEventListener('click', (ev) => { if (isMobile() && !ev.target.closest('#pinClose')) pinEl.classList.toggle('open'); });
$('#pinClose').addEventListener('click', () => { clearSel(); qEl.value = ''; $('#qclear').hidden = true; });
document.addEventListener('click', (ev) => { if (!ev.target.closest('#search')) closeResults(); });
addEventListener('keydown', (ev) => { if (ev.key === '/' && document.activeElement !== qEl && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); qEl.focus(); } });

// em telas estreitas a busca vai para dentro do painel de controles; em telas largas fica solta no topo
function placeSearch() {
  const host = innerWidth > 1150 ? document.body : $('#controls');
  const s = $('#search');
  if (s.parentElement !== host) { if (host === document.body) host.prepend(s); else host.insertBefore(s, $('#ctlGrab').nextSibling); s.classList.toggle('inpanel', host !== document.body); }
  document.documentElement.style.setProperty('--ctl-h', $('#controls').offsetHeight + 'px');
}
function placeEvo() {                                  // celular: a linha do tempo vive no painel de controles (aparece só expandido)
  const e = $('#evo'), host = isMobile() ? $('#controls') : $('#side');
  if (e.parentElement === host) return;
  if (host.id === 'controls') host.insertBefore(e, host.querySelector('.ctl-row.actions')); else host.appendChild(e);
  if (S.ready) renderEvo();
}
placeSearch(); placeEvo();
addEventListener('resize', () => { placeSearch(); placeEvo(); });
{ let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (S.ready) renderEvo(); }); }).observe($('#evoChart')); }
new ResizeObserver(placeSearch).observe($('#controls'));

/* ================= compartilhar ================= */

function buildShareCanvas() {
  const W = 1600, H = 900;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = T.canvas.bg; g.fillRect(0, 0, W, H);

  const mc = map.getCanvas();
  // recorta o canvas do mapa na área do Brasil e encaixa à direita
  const dpr = mc.width / mc.clientWidth;
  const nw = map.project([BR_BOUNDS[0][0], BR_BOUNDS[1][1]]), se = map.project([BR_BOUNDS[1][0], BR_BOUNDS[0][1]]);
  let sx = Math.max(0, nw.x * dpr), sy = Math.max(0, nw.y * dpr);
  let sw = Math.min(mc.width, se.x * dpr) - sx, sh = Math.min(mc.height, se.y * dpr) - sy;
  if (sw < 50 || sh < 50 || map.getPitch() > 1) { sx = 0; sy = 0; sw = mc.width; sh = mc.height; }   // inclinado: usa a tela inteira
  const k = Math.min(860 / sw, 800 / sh);
  const dw = sw * k, dh = sh * k;
  g.drawImage(mc, sx, sy, sw, sh, W - dw - 70, (H - dh) / 2, dw, dh);

  const grad = g.createLinearGradient(0, 0, W * 0.62, 0);
  grad.addColorStop(0, rgbaOf(T.canvas.bg, 1)); grad.addColorStop(0.65, rgbaOf(T.canvas.bg, 0.92)); grad.addColorStop(1, rgbaOf(T.canvas.bg, 0));
  g.fillStyle = grad; g.fillRect(0, 0, W * 0.62, H);

  const st = status();
  const useR1 = S.view.data === 'r1' || st === 'waiting';
  const TT = (useR1 ? S.agg1 : S.agg2).T;
  const pL = TT.val ? TT.l / TT.val : 0, pF = TT.val ? TT.f / TT.val : 0;
  const font = '"Geist", ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';

  g.fillStyle = T.canvas.muted; g.font = `600 26px ${font}`;
  g.fillText((useR1 ? 'PRESIDENTE · 1º TURNO · RESULTADO FINAL' : 'PRESIDENTE · 2º TURNO').split('').join(String.fromCharCode(8202)), 80, 110);
  if (!useR1 && st === 'live') { g.fillStyle = '#ff5d6c'; g.fillText('● AO VIVO', 80, 150); }
  if (!useR1 && st === 'done') { g.fillStyle = '#5fe0a0'; g.fillText('APURAÇÃO ENCERRADA', 80, 150); }

  const block = (y, name, pct, votes, color) => {
    g.fillStyle = T.canvas.text; g.font = `600 40px ${font}`; g.fillText(name, 80, y);
    const nf = getComputedStyle(document.documentElement).getPropertyValue('--num') || font;
    g.fillStyle = color; g.font = `400 160px ${nf}`; g.fillText(pctNum(pct), 76, y + 140);
    const wnum = g.measureText(pctNum(pct)).width; g.globalAlpha = .6; g.font = `400 70px ${nf}`; g.fillText('%', 76 + wnum + 6, y + 70); g.globalAlpha = 1;
    g.fillStyle = T.canvas.muted; g.font = `500 30px ${font}`; g.fillText(`${fmtInt(votes)} votos`, 80, y + 190);
  };
  block(290, 'Lula', pL, TT.l, COL.lula);
  block(540, 'Flávio Bolsonaro', pF, TT.f, COL.flavio);

  const two = TT.l + TT.f || 1, bx = 80, bw = 640, by = useR1 ? 765 : 780;
  g.fillStyle = COL.lula; g.fillRect(bx, by, bw * (TT.l / two), 14);
  g.fillStyle = COL.flavio; g.fillRect(bx + bw * (TT.l / two), by, bw * (TT.f / two), 14);
  g.fillStyle = T.canvas.text; g.font = `500 26px ${font}`;
  if (useR1 && TT.vs) {
    const others = S.cands.map((c, i) => ({ n: c.n, v: TT.vs[i] })).filter((x) => x.n !== '13' && x.n !== '22').sort((a, b) => b.v - a.v);
    const top3 = others.slice(0, 3).map((x) => `${cand(x.n).tag || cand(x.n).short} ${pct1(x.v / TT.val)}`);
    const rest = others.slice(3).reduce((s, x) => s + x.v, 0);
    g.fillStyle = T.canvas.soft; g.font = `500 24px ${font}`;
    g.fillText(`${top3.join(' · ')} · demais ${pct1(rest / TT.val)}`, 80, 822);
    g.fillStyle = T.canvas.soft; g.font = `500 22px ${font}`;
    g.fillText(`${fmtPct(TT.sec ? TT.ap / TT.sec : 0)} das seções apuradas`, 80, 860);
  } else g.fillText(`${fmtPct(TT.sec ? TT.ap / TT.sec : 0)} das seções apuradas`, 80, 840);
  g.fillStyle = T.canvas.foot; g.font = `500 22px ${font}`;
  g.textAlign = 'right'; g.fillText('Fonte: TSE', W - 40, H - 36); g.textAlign = 'left';
  return c;
}

$('#btnShare').addEventListener('click', () => {
  // espera o mapa terminar de desenhar (ou 1,5 s) e captura no mesmo quadro
  let done = false;
  const capture = () => {
    if (done) return; done = true;
    const c = buildShareCanvas();
    const url = c.toDataURL('image/png');
    $('#sharePrev').src = url;
    $('#shareDl').href = url;
    const useR1 = S.view.data === 'r1' || status() === 'waiting';
    const TT = (useR1 ? S.agg1 : S.agg2).T;
    const txt = `${useR1 ? 'Resultado do 1º turno' : 'Apuração ao vivo do 2º turno'}: Lula ${fmtPct(TT.l / TT.val)} × Flávio Bolsonaro ${fmtPct(TT.f / TT.val)}\nMapa município a município:`;
    const link = location.origin + location.pathname;
    $('#shareX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(link)}`;
    $('#shareDlg').showModal();
    captureEvent('results_share_dialog_opened', { election_round: useR1 ? 'r1' : 'r2' });
  };
  map.once('idle', capture);
  setTimeout(capture, 1500);
  map.triggerRepaint();
});
$('#shareCopy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(location.origin + location.pathname);
    captureEvent('results_share_link_copied');
    e.target.textContent = 'Link copiado ✓';
  }
  catch (err) { e.target.textContent = 'Copie da barra de endereço'; }
  setTimeout(() => (e.target.textContent = 'Copiar link'), 2000);
});

/* ================= boot ================= */
let landed = false;
function landing() {                                   // a câmera "pousa" no Brasil e os painéis entram em sequência
  if (landed) return; landed = true;
  fitTo(BR_BOUNDS, { duration: REDUCED ? 0 : 1800 });
  $('#loading').classList.add('done');
  document.body.classList.add('ready');
}
(async function boot() {
  await initMap();
  setTimeout(landing, 3000);                           // rede de segurança: nunca deixa o carregando preso
  updateThumbs();
  // linha do tempo do 1º turno (reconstituída dos boletins de urna): arquivos pequenos e opcionais
  Promise.all([getJSON('data/history1.json').catch(() => []), getJSON('data/snaps1/index.json').catch(() => [])]).then(([h, idx]) => { S.hist1 = h; S.snap1Ts = idx; renderEvo(); });
  await pull();
  setTimeout(landing, 30);
  schedulePull();
})();
})();
