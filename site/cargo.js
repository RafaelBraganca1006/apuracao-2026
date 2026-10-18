/* Governador, senador, deputado federal e estadual — mapa por estado e município.
   Mesma estrutura visual de apuracao.html (presidente); formato dos dados em docs/dados.md. */
(() => {
'use strict';

const TK = window.TK;
const { params, REDUCED, $, $$, isMobile, clamp, fmtInt, fmtPct, pctNum, esc, norm, captureEvent, UF_COD, UF_NOME, UF_BY_COD, mixHex, rgbaOf, dist, getJSON, swipePanel, setRoll, placeThumb, updateThumbs } = TK;
const T = () => TK.T;
const isDark = () => TK.THEME === 'dark';
const LIVE_BASE = window.TRACKER_LIVE_BASE || 'data/';
const POLL_MS = 30000;
const BR_BOUNDS = [[-74.5, -34.5], [-33.5, 5.8]];
const CAM3D = { pitch: 58, bearing: -18 };
const ZSTOPS = [[3, 2.6], [5, 0.95], [7, 0.25], [9, 0.06], [11, 0.016]];   // fator da altura por zoom (os blocos são em metros)
const H3D = 700, H3D_EXP = 0.45, H3D_UF = 160, LIFT = 1.12;
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const CARGOS = {
  governador: { label: 'Governador', dir: 'gov', kind: 'maj' },
  senador: { label: 'Senador', dir: 'sen', kind: 'maj' },
  dep_federal: { label: 'Deputado federal', dir: 'depfed', kind: 'prop' },
  dep_estadual: { label: 'Deputado estadual', dir: 'depest', kind: 'prop' },
};
const GOV2 = new Set(['AC', 'AM', 'DF', 'ES', 'RN', 'TO']);      // únicos estados com 2º turno de governador
const cargoLabel = (c, uf) => (c === 'dep_estadual' && uf === 'DF' ? 'Deputado distrital' : CARGOS[c].label);
const MAJ_SCALE = { governador: 1, senador: 2.5 };               // senador: duas vagas, as parcelas são menores
const PROP_SCALE = 2;

/* ================= cores por partido ================= */
const PARTY = {
  PT: ['#ff4a5c', '#d93025'], PL: ['#4d8dff', '#1a73e8'], PP: ['#f5a524', '#e37400'], 'UNIÃO': ['#22d3ee', '#12a4af'],
  REPUBLICANOS: ['#34d399', '#188038'], MDB: ['#a78bfa', '#8430ce'], PSD: ['#fb923c', '#f06a00'], PSB: ['#f472b6', '#d01884'],
  PSDB: ['#facc15', '#b8860b'], PDT: ['#e879f9', '#b31dc7'], PODE: ['#a3e635', '#5f8f1a'], PSOL: ['#ff8a5c', '#c2410c'],
  NOVO: ['#38bdf8', '#0b7fc0'], 'MISSÃO': ['#2dd4bf', '#0f766e'], PCDOB: ['#f87171', '#b91c1c'], PV: ['#4ade80', '#15803d'],
  REDE: ['#86efac', '#2f855a'], AVANTE: ['#fcd34d', '#a16207'], SOLIDARIEDADE: ['#fdba74', '#c2570c'], PRD: ['#93c5fd', '#2563eb'],
  DEMOCRATA: ['#c4b5fd', '#6d28d9'], MOBILIZA: ['#fda4af', '#be123c'], DC: ['#7dd3fc', '#0369a1'],
};
const FALLBACK = [['#94a3b8', '#64748b'], ['#fca5a5', '#9f1239'], ['#86efac', '#166534'], ['#fde68a', '#92400e'], ['#c7d2fe', '#3730a3'], ['#fbcfe8', '#9d174d'], ['#a5f3fc', '#155e75'], ['#d9f99d', '#3f6212']];
const ci = () => (isDark() ? 0 : 1);
function partyColor(sg) {
  const p = PARTY[String(sg).toUpperCase()];
  if (p) return p[ci()];
  let h = 0; for (const ch of String(sg)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length][ci()];
}
// dois candidatos do mesmo estado nunca ficam com cores parecidas
function colorize(cands) {
  const used = [];
  for (const c of cands) {
    let col = partyColor(c.sg);
    if (used.some((u) => dist(u, col) < 70)) col = FALLBACK.map((f) => f[ci()]).find((f) => used.every((u) => dist(u, f) >= 70)) || col;
    c.color = col; used.push(col);
  }
}
const PKEYS = new Map();                       // sigla -> número usado no estado de feição do mapa
const pk = (sg) => { if (!PKEYS.has(sg)) PKEYS.set(sg, PKEYS.size + 1); return PKEYS.get(sg); };

/* ================= estado ================= */
const S = {
  cargo: CARGOS[params.get('c')] ? params.get('c') : 'governador',
  turno: params.get('t') === '2' ? 2 : 1,
  uf: null, mode: params.get('mode') === '3d' ? '3d' : 'map', view: 'party', sort: 'margin',
  idx: {},            // `${cargo}${turno}` -> { ufs: { UF: { vagas, updated, total, cands | parties } } }
  st: {},             // `${cargo}${turno}${UF}` -> estado normalizado (com municípios)
  cmap: {},           // `${cargo}-${UF}` -> votos dos candidatos mais votados por município (deputados)
  uni: null, uniAt: 0,
  cand: null,         // número do candidato escolhido (deputados, visão por candidato)
  sel: null, ready: false, bbox: {}, geom: {}, hv: {},
  names: null,
};
if (!GOV2.has((params.get('uf') || '').toUpperCase()) && S.turno === 2) S.turno = 2;
const key = () => `${S.cargo}${S.turno}`;
const kind = () => CARGOS[S.cargo].kind;
const curIdx = () => S.idx[key()] || null;
const curSt = () => (S.uf ? S.st[key() + S.uf] || null : null);

/* ================= dados ================= */
const dataUrl = (cargo, turno, file) => `data/${CARGOS[cargo].dir}${turno}/${file}`;

function normMaj(raw, uf) {
  const cands = raw.cands.map((c, i) => ({ ...c, i }));
  colorize(cands);
  const mun = {};
  for (const [id, a] of Object.entries(raw.mun)) mun[id] = { nome: a[0], sec: a[1], ap: a[2], aptos: a[3], comp: a[4], val: a[5], vb: a[6], vn: a[7], vs: a[8] };
  return { uf, vagas: raw.vagas, updated: raw.updated, total: raw.total, cands, mun };
}
function normProp(raw, uf) {
  const parties = raw.parties.map(([sg, n, tv, seats], i) => ({ sg, n, tv, seats, i, color: partyColor(sg) }));
  const cands = raw.cands.map(([n, nome, sg, votos, st]) => ({ n, nome, sg, votos, st }));
  const mun = {};
  for (const [id, a] of Object.entries(raw.mun)) mun[id] = { nome: a[0], sec: a[1], ap: a[2], aptos: a[3], comp: a[4], val: a[5], vb: a[6], vn: a[7], pv: a[8] };
  return { uf, vagas: raw.vagas, updated: raw.updated, total: raw.total, parties, cands, mun };
}
const normAny = (raw, uf) => (kind() === 'maj' ? normMaj(raw, uf) : normProp(raw, uf));

async function loadUni() {
  try {
    const j = await getJSON(LIVE_BASE + 'gov2.json', true);
    S.uni = j; S.uniAt = j.meta?.fetched_at || 0;
  } catch (e) { /* o arquivo só existe quando o coletor do 2º turno está rodando */ }
}

async function loadIndex() {
  const k = key();
  if (S.turno === 2) {
    if (!S.uni) await loadUni();
    S.idx[k] = { ufs: S.uni ? Object.fromEntries(Object.entries(S.uni.ufs).map(([uf, d]) => [uf, { vagas: d.vagas, updated: d.updated, total: d.total, cands: d.cands }])) : {} };
    return;
  }
  if (S.idx[k]) return;
  const ix = await getJSON(dataUrl(S.cargo, S.turno, 'index.json'));
  if (kind() === 'prop') for (const u of Object.values(ix.ufs)) u.parties = u.parties.map(([sg, n, tv, seats]) => ({ sg, n, tv, seats }));
  S.idx[k] = ix;
}

async function loadState(uf) {
  const k = key() + uf;
  if (S.turno === 2) {
    const d = S.uni?.ufs[uf];
    if (d) S.st[k] = normMaj(d, uf);
    return;
  }
  if (S.st[k]) return;
  const raw = await getJSON(dataUrl(S.cargo, S.turno, `${uf}.json`));
  S.st[k] = normAny({ ...raw, vagas: raw.meta.vagas, updated: raw.meta.updated, total: raw.meta.total }, uf);
}

async function loadCmap(uf) {
  const k = `${S.cargo}-${uf}`;
  if (S.cmap[k]) return S.cmap[k];
  const raw = await getJSON(dataUrl(S.cargo, 1, `${uf}-c.json`));
  const idx = new Map(raw.ids.map((n, i) => [n, i]));
  const mun = {};
  for (const [id, flat] of Object.entries(raw.mun)) { const m = new Map(); for (let i = 0; i < flat.length; i += 2) m.set(flat[i], flat[i + 1]); mun[id] = m; }
  return (S.cmap[k] = { idx, mun });
}

/* ================= quem lidera ================= */
const sumVotes = (cs) => cs.reduce((s, c) => s + c.votos, 0);
// maj: candidato mais votado do estado e vantagem sobre o 2º (como fração dos votos)
function majLead(u) {
  const den = sumVotes(u.cands);
  if (!den) return null;
  const [a, b] = u.cands;
  return { c: a, v: ((a.votos - (b ? b.votos : 0)) / den) * MAJ_SCALE[S.cargo], den };
}
// prop: partido com mais cadeiras no estado
function propLead(u) {
  const ps = [...u.parties].sort((a, b) => b.seats - a.seats || b.tv - a.tv);
  if (!ps[0] || !ps[0].seats) return null;
  return { p: ps[0], v: ((ps[0].seats - (ps[1]?.seats || 0)) / u.vagas) * PROP_SCALE, ps };
}
function ufIndex(sg) { const ix = curIdx(); return ix?.ufs[sg] || null; }

/* ================= mapa ================= */
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [], light: { anchor: 'viewport', color: '#ffffff', intensity: T().lightI, position: [1.5, 205, 52] } },
  bounds: BR_BOUNDS, minZoom: 2, maxZoom: 11, maxBounds: [[-140, -70], [30, 50]],
  attributionControl: false, dragRotate: false, pitchWithRotate: true, maxPitch: 70, preserveDrawingBuffer: true,
});
map.touchZoomRotate.disableRotation();
window.trackerMap = map;

function padding() {
  const sc = $('#score').getBoundingClientRect(), ct = $('#controls').getBoundingClientRect(), sd = $('#side').getBoundingClientRect();
  if (isMobile()) {
    let top = sc.bottom + 6 + (S.mode === '3d' ? 50 : 0), bottom = innerHeight - ct.top + 6;
    const cap = innerHeight * 0.58;
    if (top + bottom > cap) { const k = cap / (top + bottom); top *= k; bottom *= k; }
    return { top, bottom, left: 8, right: 8 };
  }
  const extra = S.mode === '3d' ? 70 : 0;
  return { top: 30 + extra, bottom: 30, left: Math.min(Math.max(sc.right, ct.right) + 10, innerWidth * 0.36) + extra, right: Math.min(innerWidth - sd.left + 10, innerWidth * 0.26) + extra };
}
const camOf = (mode) => (mode === '3d' ? CAM3D : { pitch: 0, bearing: 0 });
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
const unMercX = (x) => x * 360 - 180;
const unMercY = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
function flatCamera(bounds, pad, maxZoom = 18) {
  const c = map.getCanvas(), W = c.clientWidth - pad.left - pad.right, H = c.clientHeight - pad.top - pad.bottom;
  const [[w, s], [e, n]] = bounds;
  const dx = Math.abs(mercX(e) - mercX(w)) || 1e-9, dy = Math.abs(mercY(s) - mercY(n)) || 1e-9;
  const zoom = clamp(Math.min(Math.log2(Math.max(W, 40) / (512 * dx)), Math.log2(Math.max(H, 40) / (512 * dy))), map.getMinZoom(), maxZoom);
  const px = 512 * 2 ** zoom;
  const cx = (mercX(w) + mercX(e)) / 2 - (pad.left - pad.right) / 2 / px;
  const cy = (mercY(s) + mercY(n)) / 2 - (pad.top - pad.bottom) / 2 / px;
  return { center: [unMercX(cx), unMercY(cy)], zoom };
}
function fitTo(bounds, { padding: pad, duration = 800, maxZoom } = {}) {
  const cam = flatCamera(bounds, pad || padding(), maxZoom);
  map.easeTo({ center: cam.center, zoom: cam.zoom + (S.mode === '3d' && !isMobile() ? 0.1 : 0), ...camOf(S.mode), duration });
}
const refit = (animate) => fitTo(BR_BOUNDS, { duration: animate ? 800 : 0 });
function boundsOf(geom) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const poly of geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}
const ufBounds = {};

function munFilter() { return S.uf ? ['==', ['floor', ['/', ['id'], 100000]], UF_COD[S.uf]] : ['==', ['id'], -1]; }
const outFilter = () => (S.uf ? ['!=', ['id'], UF_COD[S.uf]] : ['!=', ['id'], -1]);

async function initMap(mun, ufs) {
  for (const f of ufs.features) {
    const sg = UF_BY_COD[+f.properties.cod]; if (!sg) continue;
    f.properties.sg = sg; f.id = +f.properties.cod; ufBounds[sg] = boundsOf(f.geometry);
  }
  for (const f of mun.features) { S.bbox[f.id] = boundsOf(f.geometry); S.geom[f.id] = f.geometry; }
  await new Promise((res) => (map.loaded() ? res() : map.once('load', res)));
  const t = T();
  map.addSource('mun', { type: 'geojson', data: mun, tolerance: 0.08, buffer: 16 });
  map.addSource('uf', { type: 'geojson', data: ufs });
  map.addLayer({ id: 'uf-fill', type: 'fill', source: 'uf', filter: outFilter(), paint: { 'fill-color': t.empty, 'fill-opacity': 1, 'fill-antialias': false } });
  map.addLayer({ id: 'mun-fill', type: 'fill', source: 'mun', filter: munFilter(), paint: { 'fill-color': t.empty, 'fill-opacity': 1, 'fill-antialias': false } });
  map.addLayer({ id: 'mun-line', type: 'line', source: 'mun', minzoom: 5.5, filter: munFilter(), paint: { 'line-color': t.munLine[0], 'line-opacity': t.munLine[1], 'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 0.2, 9, 0.8] } });
  map.addLayer({ id: 'uf-line', type: 'line', source: 'uf', paint: { 'line-color': t.ufLine[0], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, t.ufLine[1], 7, t.ufLine[2]], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.4] } });
  map.addLayer({ id: 'hover', type: 'line', source: 'mun', paint: { 'line-color': t.ink, 'line-width': ['case', ['boolean', ['feature-state', 'h'], false], isMobile() ? 2.6 : 1.8, 0] } });
  map.addLayer({ id: 'sel', type: 'line', source: 'mun', paint: { 'line-color': t.ink, 'line-width': ['case', ['boolean', ['feature-state', 's'], false], 2.6, 0] } });
  for (const [id, source, filter] of [['cols3d', 'mun', munFilter()], ['uf3d', 'uf', null]]) {
    map.addLayer({ id, type: 'fill-extrusion', source, layout: { visibility: 'none' }, ...(filter ? { filter } : {}), paint: {
      'fill-extrusion-color': t.empty, 'fill-extrusion-height': extrusionHeight(1), 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95, 'fill-extrusion-vertical-gradient': true,
    } });
  }
  for (const [sg, b] of Object.entries(ufBounds)) {
    const el = document.createElement('div'); el.className = 'uf-label'; el.textContent = sg;
    new maplibregl.Marker({ element: el }).setLngLat([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]).addTo(map);
  }
  map.on('sourcedata', (e) => { if (e.sourceId === 'mun' && e.isSourceLoaded && !S.synced) { S.synced = true; paintMap(); map.triggerRepaint(); } });
  bindMapEvents();
  S.ready = true;
}

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
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const k = clamp((t - t0) / dur, 0, 1); setHeights(Math.max(1 - Math.pow(1 - k, 3), 0.001)); if (k < 1) growRaf = requestAnimationFrame(step); };
  setHeights(0.001); growRaf = requestAnimationFrame(step);
  growTimer = setTimeout(() => setHeights(1), dur + 250);
}

/* ---------- expressões de cor ---------- */
function leadInterp(color) {
  const t = T();
  return ['interpolate', ['linear'], ['feature-state', 'v'], 0, mixHex(color, t.leadBase, t.leadK[0]), 0.12, mixHex(color, t.leadBase, t.leadK[1]), 0.3, mixHex(color, t.leadBase, t.leadK[2]), 0.5, color];
}
function matchExpr(pairs) {
  const arms = pairs.flatMap(([k, c]) => [k, leadInterp(c)]);
  return ['case', ['==', ['feature-state', 'c'], 1], arms.length ? ['match', ['feature-state', 'w'], ...arms, leadInterp('#94a3b8')] : T().empty, T().empty];
}
function candRampExpr(color) {
  const t = T();
  return ['case', ['==', ['feature-state', 'c'], 1], ['interpolate', ['linear'], ['feature-state', 'v'], 0, mixHex(color, t.leadBase, 0.1), 0.35, mixHex(color, t.leadBase, 0.5), 1, color], t.empty];
}

// pares [chave, cor] do que está pintado agora, para municípios e para estados
function munPairs() {
  const st = curSt();
  if (!st) return [];
  if (kind() === 'maj') return st.cands.map((c) => [c.i, c.color]);
  return st.parties.map((p) => [pk(p.sg), p.color]);
}
function ufPairs() {
  const ix = curIdx(), seen = new Map();
  if (ix) for (const u of Object.values(ix.ufs)) {
    if (kind() === 'maj') { const l = majLead(u); if (l) seen.set(pk(l.c.sg), partyColor(l.c.sg)); }
    else { const l = propLead(u); if (l) seen.set(pk(l.p.sg), partyColor(l.p.sg)); }
  }
  return [...seen];
}
function applyColors() {
  if (!S.ready) return;
  const t = T();
  const munExpr = kind() === 'prop' && S.view === 'cand' && S.cand ? candRampExpr(candColor()) : matchExpr(munPairs());
  const ufExpr = matchExpr(ufPairs());
  map.setPaintProperty('mun-fill', 'fill-color', munExpr);
  map.setPaintProperty('uf-fill', 'fill-color', ufExpr);
  map.setPaintProperty('cols3d', 'fill-extrusion-color', munExpr);
  map.setPaintProperty('uf3d', 'fill-extrusion-color', ufExpr);
  map.setPaintProperty('mun-line', 'line-color', t.munLine[0]); map.setPaintProperty('mun-line', 'line-opacity', t.munLine[1]);
  map.setPaintProperty('uf-line', 'line-color', t.ufLine[0]);
  map.setPaintProperty('uf-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 3, t.ufLine[1], 7, t.ufLine[2]]);
  map.setPaintProperty('hover', 'line-color', t.ink); map.setPaintProperty('sel', 'line-color', t.ink);
  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: t.lightI, position: [1.5, 205, 52] });
}
const candColor = () => { const st = curSt(); const c = st?.cands.find((x) => x.n === S.cand); return partyColor(c?.sg || ''); };

/* ---------- pintura ---------- */
const painted = { mun: new Set(), uf: new Set() };
function setStates(source, items, store) {
  const next = new Set();
  for (const [id, st] of items) { map.setFeatureState({ source, id }, st); if (st.c) next.add(id); }
  for (const id of store) if (!next.has(id)) map.setFeatureState({ source, id }, { c: 0, hv: 0 });
  return next;
}
function paintMap() {
  if (!S.ready) return;
  // estados (visão do Brasil e fundo da visão do estado)
  const ix = curIdx(), ufItems = [];
  for (const [sg, cod] of Object.entries(UF_COD)) {
    const u = ix?.ufs[sg];
    let st = { c: 0, hv: 0 };
    if (u) {
      if (kind() === 'maj') { const l = majLead(u); if (l) st = { c: 1, w: pk(l.c.sg), v: l.v, hv: Math.sqrt(l.den) * H3D_UF }; }
      else { const l = propLead(u); if (l) st = { c: 1, w: pk(l.p.sg), v: l.v, hv: Math.sqrt(u.total.val) * H3D_UF }; }
    }
    ufItems.push([cod, st]);
  }
  painted.uf = setStates('uf', ufItems, painted.uf);
  // municípios do estado aberto
  const st = curSt(), items = [];
  S.hv = {};
  if (st) {
    const cm = kind() === 'prop' && S.view === 'cand' && S.cand ? S.cmap[`${S.cargo}-${S.uf}`] : null;
    const ci2 = cm ? cm.idx.get(S.cand) : null;
    let maxShare = 0;
    if (cm && ci2 != null) for (const [id, r] of Object.entries(st.mun)) maxShare = Math.max(maxShare, (cm.mun[id]?.get(ci2) || 0) / (r.val || 1));
    for (const [id, r] of Object.entries(st.mun)) {
      let s = { c: 0, hv: 0 };
      if (kind() === 'maj') {
        const t = top2(r.vs), den = r.vs.reduce((a, b) => a + b, 0);
        if (den) s = { c: 1, w: t.i1, v: ((r.vs[t.i1] - (t.i2 >= 0 ? r.vs[t.i2] : 0)) / den) * MAJ_SCALE[S.cargo], hv: Math.pow(den, H3D_EXP) * H3D };
      } else if (cm && ci2 != null) {
        const share = (cm.mun[id]?.get(ci2) || 0) / (r.val || 1);
        s = { c: r.val ? 1 : 0, v: maxShare ? share / maxShare : 0, hv: Math.pow(r.val, H3D_EXP) * H3D };
      } else {
        const t = top2(r.pv), den = r.pv.reduce((a, b) => a + b, 0);
        if (den) s = { c: 1, w: pk(st.parties[t.i1].sg), v: ((r.pv[t.i1] - (t.i2 >= 0 ? r.pv[t.i2] : 0)) / den) * PROP_SCALE, hv: Math.pow(den, H3D_EXP) * H3D };
      }
      S.hv[id] = s.hv;
      items.push([+id, s]);
    }
  }
  painted.mun = setStates('mun', items, painted.mun);
}
function top2(vs) {
  let i1 = -1, i2 = -1;
  for (let i = 0; i < vs.length; i++) { if (i1 < 0 || vs[i] > vs[i1]) { i2 = i1; i1 = i; } else if (i2 < 0 || vs[i] > vs[i2]) i2 = i; }
  return { i1, i2 };
}

function setView() {
  if (!S.ready) return;
  const d3 = S.mode === '3d';
  applyColors();
  map.setFilter('mun-fill', munFilter()); map.setFilter('mun-line', munFilter()); map.setFilter('cols3d', munFilter());
  map.setFilter('uf-fill', outFilter());
  map.setLayoutProperty('cols3d', 'visibility', d3 && S.uf ? 'visible' : 'none');
  map.setLayoutProperty('uf3d', 'visibility', d3 && !S.uf ? 'visible' : 'none');
  map.setPaintProperty('mun-fill', 'fill-opacity', d3 ? 0.3 : 1);
  map.setPaintProperty('uf-fill', 'fill-opacity', S.uf ? (d3 ? 0.12 : 0.28) : d3 ? 0.2 : 1);
  map.setPaintProperty('hover', 'line-width', d3 ? 0 : ['case', ['boolean', ['feature-state', 'h'], false], isMobile() ? 2.6 : 1.8, 0]);
  document.body.classList.toggle('mode3d', d3);
  const sig = S.mode + key() + (S.uf || '') + S.view;
  if (d3 && sig !== S.lastSig) grow();
  S.lastSig = sig;
  if (S.camMode !== S.mode) {
    const first = S.camMode === undefined;
    S.camMode = S.mode;
    if (d3) { map.dragRotate.enable(); map.touchPitch.enable(); map.keyboard.enableRotation(); }
    else { map.dragRotate.disable(); map.touchPitch.disable(); map.keyboard.disableRotation(); }
    if (!first) { if (S.uf) fitTo(ufBounds[S.uf], { duration: 1000 }); else fitTo(BR_BOUNDS, { duration: 1200 }); }
    if (!d3) map.once('moveend', () => { if (S.mode !== '3d' && (map.getPitch() || map.getBearing())) map.jumpTo({ pitch: 0, bearing: 0 }); });
  }
  $$('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  paintMap();
  updateThumbs();
}

/* ================= tooltip e cartões ================= */
const tip = $('#tip');
const pct1 = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const firstName = (c) => (c.nome.length > 14 ? c.nome.split(' ')[0] : c.nome);

function munCard(id) {
  const st = curSt(), r = st?.mun[id];
  if (!r) return null;
  const sub = `${UF_NOME[S.uf]} · ${S.turno}º turno`;
  if (kind() === 'maj') {
    const den = r.vs.reduce((a, b) => a + b, 0);
    if (!den) return { html: `<h4>${esc(r.nome)}</h4><div class="sub">${sub} · sem votos apurados</div>` };
    const rows = st.cands.map((c, i) => ({ c, v: r.vs[i] })).sort((a, b) => b.v - a.v).slice(0, 5).map(({ c, v }, i) =>
      `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${c.color}">${esc(firstName(c))}</b><span>${pct1(v / den)} · ${fmtInt(v)}</span></div>`).join('');
    return { html: `<h4>${esc(r.nome)}</h4><div class="sub">${sub} · ${fmtInt(den)} votos</div>${rows}<div class="cmp">Brancos ${fmtInt(r.vb)} · Nulos ${fmtInt(r.vn)}</div>`, wide: true };
  }
  const den = r.pv.reduce((a, b) => a + b, 0);
  const rows = st.parties.map((p, i) => ({ p, v: r.pv[i] })).sort((a, b) => b.v - a.v).slice(0, 5).map(({ p, v }, i) =>
    `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${p.color}">${esc(p.sg)}</b><span>${den ? pct1(v / den) : '–'} · ${fmtInt(v)}</span></div>`).join('');
  let extra = '';
  const cm = S.view === 'cand' && S.cand ? S.cmap[`${S.cargo}-${S.uf}`] : null;
  if (cm) {
    const c = st.cands.find((x) => x.n === S.cand), v = cm.mun[id]?.get(cm.idx.get(S.cand)) || 0;
    extra = `<div class="cl lead1"><b style="color:${partyColor(c.sg)}">${esc(c.nome)}</b><span>${r.val ? pct1(v / r.val) : '–'} · ${fmtInt(v)}</span></div><div class="sub" style="margin-top:6px">Partidos mais votados</div>`;
  }
  return { html: `<h4>${esc(r.nome)}</h4><div class="sub">${sub} · ${fmtInt(r.val)} votos válidos</div>${extra}${rows}`, wide: true };
}
function ufCard(sg) {
  const u = ufIndex(sg);
  if (!u) return { html: `<h4>${UF_NOME[sg]}</h4><div class="sub">${S.turno}º turno · ${S.turno === 2 ? 'sem 2º turno neste estado' : 'sem dados'}</div>` };
  if (kind() === 'maj') {
    const den = sumVotes(u.cands);
    if (!den) return { html: `<h4>${UF_NOME[sg]}</h4><div class="sub">Aguardando a apuração</div>` };
    const cs = [...u.cands]; colorize(cs);
    const rows = cs.slice(0, 5).map((c, i) => `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${c.color}">${esc(firstName(c))}</b><span>${pct1(c.votos / den)} · ${fmtInt(c.votos)}</span></div>`).join('');
    return { html: `<h4>${UF_NOME[sg]}</h4><div class="sub">${cargoLabel(S.cargo, sg)} · ${S.turno}º turno</div>${rows}`, wide: true };
  }
  const rows = [...u.parties].sort((a, b) => b.seats - a.seats || b.tv - a.tv).slice(0, 6)
    .map((p, i) => `<div class="cl${i === 0 ? ' lead1' : ''}"><b style="color:${partyColor(p.sg)}">${esc(p.sg)}</b><span>${p.seats} ${p.seats === 1 ? 'vaga' : 'vagas'} · ${fmtInt(p.tv)}</span></div>`).join('');
  return { html: `<h4>${UF_NOME[sg]}</h4><div class="sub">${cargoLabel(S.cargo, sg)} · ${u.vagas} vagas</div>${rows}`, wide: true };
}
function hideTip() { tip.hidden = true; if (isMobile()) window.trackerHover?.(null); }
function showTip(card, x, y) {
  if (!card) { hideTip(); return; }
  tip.classList.toggle('wide', !!card.wide);
  tip.innerHTML = card.html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 16, top = y + 16;
  if (isMobile()) { left = clamp(x - w / 2, 8, innerWidth - w - 8); top = clamp(y - h - 24, 8, innerHeight - h - 8); }
  else { if (left + w > innerWidth - 8) left = x - w - 16; if (top + h > innerHeight - 8) top = y - h - 16; }
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}

function bindMapEvents() {
  let last = null;
  const setH = (k, v) => k && map.setFeatureState({ source: 'mun', id: k }, { h: v });
  const hoverTo = (id) => { if (last === id) return; setH(last, false); last = id; setH(id, true); };
  window.trackerHover = (source, id) => hoverTo(source ? id : null);
  const cardOf = (f) => (f.layer.id === 'uf-fill' || f.layer.id === 'uf3d' ? ufCard(UF_BY_COD[f.id]) : munCard(String(f.id)));
  for (const L of ['uf-fill', 'mun-fill', 'cols3d', 'uf3d']) {
    map.on('mousemove', L, (e) => {
      if (isMobile()) return;
      const f = e.features[0]; if (!f) return;
      hoverTo(L === 'mun-fill' || L === 'cols3d' ? f.id : null);
      showTip(cardOf(f), e.originalEvent.clientX, e.originalEvent.clientY);
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', L, () => { hoverTo(null); hideTip(); map.getCanvas().style.cursor = ''; });
  }
  map.on('click', (e) => {
    const layers = S.mode === '3d' ? (S.uf ? ['cols3d', 'mun-fill', 'uf-fill'] : ['uf3d']) : (S.uf ? ['mun-fill', 'uf-fill'] : ['uf-fill']);
    const f = map.queryRenderedFeatures(e.point, { layers })[0];
    if (!f) { hideTip(); return; }
    if (f.layer.id === 'uf-fill' || f.layer.id === 'uf3d') {
      const sg = UF_BY_COD[f.id];
      if (S.turno === 2 && !GOV2.has(sg)) { showTip(ufCard(sg), e.originalEvent.clientX, e.originalEvent.clientY); return; }
      openUF(sg); return;
    }
    if (isMobile()) { showTip(munCard(String(f.id)), e.originalEvent.clientX, e.originalEvent.clientY); hoverTo(f.id); }
    else pickMun(String(f.id), { fly: false });
  });
  map.on('movestart', () => { if (!isMobile()) hideTip(); });
}

/* ================= placar ================= */
function status() {
  if (S.turno === 1) return 'done';
  const ix = curIdx(); if (!ix) return 'waiting';
  let ap = 0, sec = 0;
  for (const u of Object.values(ix.ufs)) { ap += u.total.ap; sec += u.total.secoes; }
  if (!ap) return 'waiting';
  if (ap >= sec) return 'done';
  return Date.now() / 1000 - (S.uniAt || 0) > 600 ? 'stale' : 'live';
}
const PILL = { waiting: 'Aguardando', live: 'Ao vivo', done: 'Apuração encerrada', stale: 'Atualização atrasada' };
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const photo = (c) => `<img class="ph" src="img/c/${c.sq}.jpg" alt="" data-i="${esc(initials(c.nome))}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph blank',textContent:this.dataset.i}))">`;
const tagOf = (c) => (c.st === 1 ? '<span class="tag t1">Eleito</span>' : c.st === 2 ? '<span class="tag t2">2º turno</span>' : '');

function skeletonDuel(st) {
  const [a, b] = st.cands;
  const card = (c, k) => `<div class="cand ${k}" style="--c:${c.color}">${photo(c)}
    <div class="who"><span class="nm">${esc(c.nome)}</span><small>${esc(c.sg)}</small>${tagOf(c)}</div>
    <div class="pc"><span class="roll" data-r="pc${k}"></span><span class="pct">%</span></div>
    <div class="vt"><span class="roll" data-r="vt${k}"></span><span data-r="vu${k}">votos</span></div></div>`;
  return `<div class="duel">${card(a, 'k1')}${b ? card(b, 'k2') : '<div></div>'}</div>
    <div class="split two" style="--c1:${a.color};--c2:${b ? b.color : a.color}"><b class="a" data-r="barA"></b><b class="b" data-r="barB"></b><u></u></div>
    <div class="lead" id="lead">&nbsp;</div>
    <div class="rank" id="rank"><div class="rank-head"><span>Demais candidatos</span>
      <button class="link" id="rankToggle" type="button" aria-expanded="false"><span id="rankToggleTxt">Ver todos</span><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></button></div>
      <div class="rank-wrap"><ul id="rankList"></ul></div><div class="rank-foot" id="rankFoot"></div></div>
    <div class="prog"><i id="progBar"></i></div>
    <div class="row meta"><span id="apTxt"></span><span id="updTxt"></span></div>`;
}
function skeletonSum(rankTitle, gov = false) {
  const head = gov
    ? `<div class="sum"><div class="sum-n"><div class="pc"><span class="roll" data-r="sa"></span></div><span class="cap">governadores eleitos</span></div>
       <div class="sum-n"><div class="pc"><span class="roll" data-r="sb"></span></div><span class="cap" id="capB"></span></div></div>
       <div class="pbar" id="pbar"></div>`
    : `<div class="hemi"><svg id="hemi" viewBox="-106 -106 212 114" role="img" aria-label="Cadeiras por partido"></svg>
       <div class="hemi-c"><div class="pc"><span class="roll" data-r="sa"></span></div></div></div>
       <div class="hemi-sub" id="hemiSub"></div>`;
  return `${head}<div class="chips" id="chips"></div>
    ${rankTitle ? `<div class="rank" id="rank"><div class="rank-head"><span>${rankTitle}</span>
      <button class="link" id="rankToggle" type="button" aria-expanded="false"><span id="rankToggleTxt">Ver todos</span><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></button></div>
      <div class="rank-wrap"><ul id="rankList"></ul></div><div class="rank-foot" id="rankFoot"></div></div>` : ''}
    <div class="prog"><i id="progBar"></i></div>
    <div class="row meta"><span id="apTxt"></span><span id="updTxt"></span></div>
    <div class="note" id="note"></div>`;
}
const R = (name) => $(`[data-r="${name}"]`, $('#scoreBody'));

function chipsHtml(entries, total) {
  // entries: [sigla, quantidade]
  const top = entries.slice(0, 7), rest = entries.slice(7).reduce((s, e) => s + e[1], 0);
  return top.map(([sg, n]) => `<span><i class="dot" style="background:${partyColor(sg)}"></i>${esc(sg)} <b>${n}</b></span>`).join('') + (rest ? `<span class="more">+${rest} de outros</span>` : '');
}
function pbarHtml(entries) {
  return entries.map(([sg, n]) => `<i style="flex-grow:${n};background:${partyColor(sg)}" title="${esc(sg)} ${n}"></i>`).join('');
}
// hemiciclo: uma bolinha por cadeira, partidos em fatias da esquerda para a direita
function hemiSvg(entries) {
  const n = entries.reduce((t, e) => t + e[1], 0);
  if (!n) return '';
  const rows = clamp(Math.round(Math.sqrt(n / 3.4)), 2, 18), R0 = 100, r0 = rows > 2 ? 46 : 58;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((R0 - r0) * i) / (rows - 1));
  const sumR = radii.reduce((a, b) => a + b, 0);
  const per = radii.map((r) => Math.max(1, Math.round((n * r) / sumR)));
  per[rows - 1] += n - per.reduce((a, b) => a + b, 0);
  const pts = [];
  radii.forEach((r, i) => { for (let j = 0; j < per[i]; j++) { const th = per[i] === 1 ? Math.PI / 2 : Math.PI * (1 - j / (per[i] - 1)); pts.push({ th, r, x: r * Math.cos(th), y: -r * Math.sin(th) }); } });
  pts.sort((a, b) => b.th - a.th || a.r - b.r);
  const gap = Math.min((R0 - r0) / (rows - 1), ...radii.map((r, i) => (Math.PI * r) / Math.max(per[i] - 1, 1)));
  const rad = Math.min(gap * 0.34, 4.2).toFixed(2);
  const colors = entries.flatMap(([sg, k]) => Array(k).fill(partyColor(sg)));
  return pts.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad}" fill="${colors[i] || '#94a3b8'}" style="--i:${i}"/>`).join('');
}
function setHemi(entries, num, label, sub) {
  const svg = $('#hemi'), sig = entries.map((e) => e.join(':')).join(',') + TK.THEME;
  if (svg._sig !== sig) {
    svg.innerHTML = hemiSvg(entries); svg._sig = sig;
    svg.style.setProperty('--step', (1100 / Math.max(num, 1)).toFixed(2) + 'ms');   // a animação dura ~1,1 s qualquer que seja o número de cadeiras
  }
  setRoll(R('sa'), String(num));
  $('#hemiSub').textContent = [label, sub].filter(Boolean).join(' · ');
  $('#chips').innerHTML = chipsHtml(entries);
}

function setProgress(total, upd) {
  const ap = total.secoes ? total.ap / total.secoes : 0;
  $('#progBar').style.width = ap * 100 + '%';
  $('#apTxt').textContent = total.secoes ? `Seções apuradas ${fmtPct(ap)}` : 'Seções apuradas –';
  $('#updTxt').textContent = upd;
}
function updText(u) {
  if (S.turno === 1) return 'Totalização final · 4 de outubro';
  if (status() === 'waiting') return 'Votação: 25/10, 8h–17h';
  return `Atualizado ${(u || '').slice(0, 19)} (Brasília)`.replace(/\s+/g, ' ');
}

function renderScore() {
  const body = $('#scoreBody'), ix = curIdx(), st = curSt();
  const s = status();
  $('#pill').dataset.s = s;
  $('#pill span').textContent = S.turno === 1 ? 'Resultado final' : PILL[s];
  $('#eyebrow').textContent = `${cargoLabel(S.cargo, S.uf)} · ${S.uf ? UF_NOME[S.uf] : 'Brasil'} · ${S.turno}º turno`;
  $('#score').classList.toggle('has-rank', true);

  if (!ix || (S.turno === 2 && !Object.keys(ix.ufs).length)) {
    body.innerHTML = `<div class="sum"><div class="sum-n"><div class="pc">–</div><span class="cap">A apuração do 2º turno de governador começa em 25/10, às 17h.</span></div></div>`;
    body._sig = 'empty';
    return;
  }
  if (S.uf && kind() === 'maj' && st) return renderDuel(body, st);
  if (S.uf && kind() === 'prop' && st) return renderPropState(body, st);
  if (kind() === 'maj') return renderMajOverview(body, ix);
  return renderPropOverview(body, ix);
}

function renderDuel(body, st) {
  const [a, b] = st.cands, den = sumVotes(st.cands);
  const sig = ['duel', S.cargo, S.turno, S.uf, a.n, b?.n, TK.THEME, a.st, b?.st].join('|');
  if (body._sig !== sig) { body.innerHTML = skeletonDuel(st); body._sig = sig; bindRank(); }
  const wait = !den;
  const p = (c) => (wait ? '–' : pctNum(c.votos / den));
  setRoll(R('pck1'), p(a)); setRoll(R('vtk1'), wait ? '' : fmtInt(a.votos));
  if (b) { setRoll(R('pck2'), p(b)); setRoll(R('vtk2'), wait ? '' : fmtInt(b.votos)); }
  $$('.pc', body).forEach((e) => e.classList.toggle('empty', wait));
  R('vuk1').hidden = wait; if (b) R('vuk2').hidden = wait;
  const two = a.votos + (b ? b.votos : 0) || 1;
  R('barA').style.width = (wait ? 50 : (a.votos / two) * 100) + '%';
  if (b) R('barB').style.width = (wait ? 50 : (b.votos / two) * 100) + '%';
  const lead = $('#lead');
  if (wait) { lead.className = 'lead'; lead.textContent = 'Aguardando o início da apuração'; }
  else if (S.cargo === 'senador') { lead.className = 'lead'; lead.textContent = `${st.vagas} vagas · cada eleitor vota em até 2 candidatos`; }
  else {
    const diff = a.votos - (b ? b.votos : 0);
    lead.className = 'lead c1'; lead.style.setProperty('--c1', a.color);
    lead.textContent = diff === 0 ? 'Empate' : `${firstName(a)} à frente por ${fmtInt(diff)} votos (${((diff / den) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} pts)`;
  }
  const rest = st.cands.slice(2), top = rest[0]?.votos || 1;
  $('#rank').hidden = !rest.length;
  $('#rankList').innerHTML = rest.map((c) => `<li style="--c:${c.color}">${photo(c)}
    <span class="rn">${esc(c.nome)} <small>${esc(c.sg)}</small><i class="rb"><b style="width:${Math.max(c.votos / top, 0.02) * 100}%;background:${c.color}"></b></i></span>
    <span class="rp">${wait ? '–' : pct1(c.votos / den)}</span><span class="rv">${wait ? '' : fmtInt(c.votos)}</span></li>`).join('');
  const t = st.total, base = t.comp || 1, abst = t.aptos ? (t.aptos - t.comp) / t.aptos : 0;
  $('#rankFoot').innerHTML = !t.ap ? '' : `Válidos ${fmtInt(t.val)} · Brancos ${fmtInt(t.vb)} (${pct1(t.vb / base)}) · Nulos ${fmtInt(t.vn)} (${pct1(t.vn / base)}) · Abstenção ${pct1(abst)}`;
  setProgress(t, updText(st.updated));
}

function bindRank() {
  const tg = $('#rankToggle'); if (!tg) return;
  tg.addEventListener('click', () => {
    const open = $('#score').classList.toggle('rank-open');
    $('#rankToggleTxt').textContent = open ? 'Ocultar' : 'Ver todos';
    tg.setAttribute('aria-expanded', String(open));
  });
}

function renderMajOverview(body, ix) {
  const turno1 = S.turno === 1, sen = S.cargo === 'senador';
  const sig = ['sum-maj', S.cargo, S.turno, TK.THEME].join('|');
  if (body._sig !== sig) {
    body.innerHTML = skeletonSum('', !sen); body._sig = sig;
  }
  const us = Object.values(ix.ufs);
  let elected = 0, runoff = 0, vagas = 0;
  const lead = {};
  for (const u of us) {
    vagas += u.vagas;
    const el = u.cands.filter((c) => c.st === 1).length;
    elected += el;
    if (!sen && !el && sumVotes(u.cands)) runoff++;
    const l = sen ? null : majLead(u);
    if (!sen && l) lead[l.c.sg] = (lead[l.c.sg] || 0) + 1;
    if (sen) for (const c of u.cands.slice(0, 2)) if (sumVotes(u.cands)) lead[c.sg] = (lead[c.sg] || 0) + 1;
  }
  const entries = Object.entries(lead).sort((a, b) => b[1] - a[1]);
  if (sen) setHemi(entries, entries.reduce((t, e) => t + e[1], 0), 'senadores', `${elected} de ${vagas} eleitos`);
  else {
    setRoll(R('sa'), String(elected)); setRoll(R('sb'), String(runoff));
    $('#capB').textContent = turno1 ? 'estados vão ao 2º turno' : 'estados ainda em disputa';
    $('#pbar').innerHTML = pbarHtml(entries); $('#chips').innerHTML = chipsHtml(entries);
  }
  const tot = us.reduce((a, u) => ({ secoes: a.secoes + u.total.secoes, ap: a.ap + u.total.ap }), { secoes: 0, ap: 0 });
  setProgress(tot, updText(us[0]?.updated));
  $('#note').textContent = sen ? 'Os dois mais votados de cada estado ocupam as vagas. Cor = partido do mais votado.' : 'Cor = partido do candidato mais votado em cada estado · tom = tamanho da vantagem. Toque num estado para ver os municípios.';
}

function renderPropOverview(body, ix) {
  const sig = ['sum-prop', S.cargo, S.turno, TK.THEME].join('|');
  if (body._sig !== sig) { body.innerHTML = skeletonSum(''); body._sig = sig; }
  const seats = {};
  let tot = 0;
  for (const u of Object.values(ix.ufs)) for (const p of u.parties) if (p.seats) { seats[p.sg] = (seats[p.sg] || 0) + p.seats; tot += p.seats; }
  const entries = Object.entries(seats).sort((a, b) => b[1] - a[1]);
  setHemi(entries, tot, S.cargo === 'dep_federal' ? 'deputados federais' : 'deputados estaduais', `${entries.length} partidos com cadeira`);
  const sum = Object.values(ix.ufs).reduce((a, u) => ({ secoes: a.secoes + u.total.secoes, ap: a.ap + u.total.ap }), { secoes: 0, ap: 0 });
  setProgress(sum, updText(Object.values(ix.ufs)[0]?.updated));
  $('#note').textContent = 'Cor = partido com mais cadeiras em cada estado · tom = tamanho da vantagem. Toque num estado para ver os eleitos.';
}

function renderPropState(body, st) {
  const sig = ['prop-state', S.cargo, S.uf, TK.THEME].join('|');
  if (body._sig !== sig) {
    body.innerHTML = skeletonSum('Mais votados'); body._sig = sig; bindRank();
  }
  const entries = st.parties.filter((p) => p.seats).sort((a, b) => b.seats - a.seats || b.tv - a.tv).map((p) => [p.sg, p.seats]);
  setHemi(entries, st.vagas, `vagas · ${cargoLabel(S.cargo, S.uf).toLowerCase()}`, `${entries.length} partidos com cadeira`);
  const top = st.cands.slice(0, 12), max = top[0]?.votos || 1, den = st.total.val || 1;
  $('#rankList').innerHTML = top.map((c) => {
    const col = partyColor(c.sg);
    return `<li class="go${S.cand === c.n ? ' on' : ''}" data-n="${c.n}" style="--c:${col}"><span class="pdot">${esc(initials(c.nome))}</span>
      <span class="rn">${esc(c.nome)} <small>${esc(c.sg)}${c.st === 1 ? ' · eleito' : ''}</small><i class="rb"><b style="width:${Math.max(c.votos / max, 0.02) * 100}%;background:${col}"></b></i></span>
      <span class="rp">${pct1(c.votos / den)}</span><span class="rv">${fmtInt(c.votos)}</span></li>`;
  }).join('');
  const t = st.total, abst = t.aptos ? (t.aptos - t.comp) / t.aptos : 0;
  $('#rankFoot').innerHTML = `Válidos ${fmtInt(t.val)} · Brancos ${fmtInt(t.vb)} · Nulos ${fmtInt(t.vn)} · Abstenção ${pct1(abst)}. Toque num candidato para ver onde ele foi votado.`;
  setProgress(t, updText(st.updated));
  $('#note').textContent = '';
}

/* ================= lista de estados e detalhe ================= */
const sideEl = $('#side'), scrimEl = $('#scrim');
const sheet = { state: 'closed', y: 0 };
const snapY = { closed: () => sideEl.offsetHeight + 24, half: () => sideEl.offsetHeight * 0.46, full: () => 0 };
function setSheet(state, animate = true) {
  sheet.state = state; sheet.y = snapY[state]();
  sideEl.classList.toggle('dragging', !animate);
  sideEl.style.setProperty('--y', sheet.y + 'px');
  scrimEl.classList.toggle('on', state !== 'closed');
}

function renderStates() {
  const list = $('#ufList'), ix = curIdx();
  if (!ix) { list.innerHTML = '<li class="empty">Carregando…</li>'; return; }
  let arr = [];
  for (const sg of Object.keys(UF_COD)) {
    const u = ix.ufs[sg];
    if (S.turno === 2 && !GOV2.has(sg)) continue;
    if (!u) { arr.push({ sg, m: -1, lead: 0, name: '–', color: '', none: true }); continue; }
    if (kind() === 'maj') {
      const l = majLead(u), den = sumVotes(u.cands);
      if (!l) { arr.push({ sg, m: -1, lead: 0, name: 'aguardando', color: '', none: true }); continue; }
      const c0 = [...u.cands]; colorize(c0);
      const st = c0[0].st === 1 ? '' : c0[0].st === 2 ? ' · 2º turno' : '';
      arr.push({ sg, m: l.v, lead: Math.min(l.v / MAJ_SCALE[S.cargo] / 0.5, 1), name: `${firstName(c0[0])} ${((c0[0].votos / den) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%${st}`, color: c0[0].color });
    } else {
      const l = propLead(u);
      if (!l) { arr.push({ sg, m: -1, lead: 0, name: '–', color: '', none: true }); continue; }
      arr.push({ sg, m: l.v, lead: clamp(l.v / PROP_SCALE / 0.5 * 2, 0.08, 1), name: `${l.p.sg} ${l.p.seats}/${u.vagas}`, color: partyColor(l.p.sg) });
    }
  }
  if (S.sort === 'margin') arr.sort((a, b) => b.m - a.m || UF_NOME[a.sg].localeCompare(UF_NOME[b.sg], 'pt-BR'));
  else arr.sort((a, b) => UF_NOME[a.sg].localeCompare(UF_NOME[b.sg], 'pt-BR'));
  list.innerHTML = arr.map((x) => `<li data-sg="${x.sg}" class="${S.uf === x.sg ? 'on' : ''}${x.none ? ' dim' : ''}" title="${UF_NOME[x.sg]}"><span class="sg">${x.sg}</span>
    <span class="bar"><i style="background:${x.color};left:0;width:${(x.lead * 100).toFixed(0)}%"></i></span><span class="mg" style="color:${x.color}">${esc(x.name)}</span></li>`).join('');
  $$('#ufList .bar::after');
}

function syncSide() {
  const d = !!S.uf;
  sideEl.classList.toggle('in-detail', d);
  $('#detail').hidden = !d; $('#ufList').hidden = d; $('#sortSeg').hidden = d; $('#sideBack').hidden = !d;
  $('#sideTitle').textContent = d ? UF_NOME[S.uf] : 'Estados';
  if (!d) $('#detail').innerHTML = '';
  updateThumbs();
}

function renderDetail() {
  const st = curSt(), box = $('#detail');
  if (!S.uf || !st) return;
  const t = st.total, abst = t.aptos ? (t.aptos - t.comp) / t.aptos : 0, base = t.comp || 1, none = !t.ap;
  let html = '';
  if (kind() === 'maj') {
    const den = sumVotes(st.cands), top = st.cands[0]?.votos || 1;
    html += `<div class="sec"><h3>Resultado · ${S.turno}º turno</h3>${st.cands.map((c) => `<div class="d-cand"><div class="top"><b style="color:${c.color}">${esc(c.nome)}<small>${esc(c.sg)}</small></b><span>${den ? pct1(c.votos / den) + ' · ' : ''}${fmtInt(c.votos)}</span></div>
      <i class="rb"><b style="width:${Math.max(c.votos / top, 0.015) * 100}%;background:${c.color}"></b></i></div>`).join('')}</div>`;
  } else {
    const elected = st.cands.filter((c) => c.st === 1);
    html += `<div class="sec"><h3>Eleitos · ${elected.length} de ${st.vagas}</h3><ul class="d-list" id="elected">${elected.map((c) => `<li data-n="${c.n}" class="${S.cand === c.n ? 'on' : ''}"><span class="cn" style="color:${partyColor(c.sg)}">${esc(c.nome)} <small style="color:var(--muted);font-weight:400">${esc(c.sg)}</small></span><span class="cm"></span><span class="cv">${fmtInt(c.votos)}</span></li>`).join('')}</ul></div>`;
    html += `<div class="sec"><h3>Partidos</h3>${st.parties.filter((p) => p.tv).sort((a, b) => b.seats - a.seats || b.tv - a.tv).slice(0, 12).map((p) => `<div class="d-cand"><div class="top"><b style="color:${p.color}">${esc(p.sg)}</b><span>${p.seats} ${p.seats === 1 ? 'vaga' : 'vagas'} · ${fmtInt(p.tv)}</span></div></div>`).join('')}</div>`;
  }
  html += `<div class="sec"><h3>Participação</h3><div class="d-stats"><div><b>${fmtInt(t.aptos)}</b><span>eleitores</span></div><div><b>${none ? '–' : pct1(abst)}</b><span>abstenção</span></div><div><b>${none ? '–' : pct1((t.vb + t.vn) / base)}</b><span>brancos e nulos</span></div></div></div>`;
  const rows = Object.entries(st.mun).sort((a, b) => b[1].aptos - a[1].aptos).slice(0, 10).map(([id, r]) => {
    let nm, color, txt;
    if (kind() === 'maj') {
      const tt = top2(r.vs), den = r.vs.reduce((a, b) => a + b, 0);
      if (!den) return '';
      const c = st.cands[tt.i1]; nm = firstName(c); color = c.color;
      txt = `+${(((r.vs[tt.i1] - (tt.i2 >= 0 ? r.vs[tt.i2] : 0)) / den) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
    } else {
      const tt = top2(r.pv), den = r.pv.reduce((a, b) => a + b, 0);
      if (!den) return '';
      const p = st.parties[tt.i1]; nm = p.sg; color = p.color; txt = pct1(r.pv[tt.i1] / den);
    }
    return `<li data-id="${id}"><span class="cn">${esc(r.nome)}</span><span class="cm" style="color:${color}">${esc(nm)} ${txt}</span><span class="cv">${fmtInt(r.aptos)}</span></li>`;
  }).join('');
  if (rows) html += `<div class="sec"><h3>Maiores cidades</h3><ul class="d-list" id="biggest">${rows}</ul></div>`;
  box.innerHTML = html;
}

/* ================= legenda ================= */
function renderLegend() {
  const lg = $('#legend'), st = curSt();
  let html = '';
  if (kind() === 'prop' && S.view === 'cand' && st) {
    const c = st.cands.find((x) => x.n === S.cand);
    html = c ? `<div class="cand-pick"><span class="dot" style="background:${partyColor(c.sg)}"></span><span>Votos de <b>${esc(c.nome)}</b> (${esc(c.sg)}) em cada município</span></div>
      <div class="lg-ramp"><span>0</span><div class="ramp" style="background:linear-gradient(90deg,${mixHex(partyColor(c.sg), T().leadBase, 0.1)},${partyColor(c.sg)})"></div><span>mais votos</span></div>`
      : '<div class="legend-note">Escolha um candidato na lista para ver onde ele teve voto.</div>';
  } else if (S.uf && st) {
    const items = kind() === 'maj' ? st.cands : st.parties.filter((p) => p.seats).sort((a, b) => b.seats - a.seats).slice(0, 10);
    html = items.map((x) => `<span class="lchip"><i class="dot" style="background:${x.color}"></i><b>${esc(kind() === 'maj' ? firstName(x) : x.sg)}</b>${kind() === 'maj' ? esc(x.sg) : ''}</span>`).join('')
      + `<div class="legend-note">${kind() === 'maj' ? 'Cor = candidato mais votado no município' : 'Cor = partido mais votado no município'} · tom = tamanho da vantagem</div>`;
  } else {
    html = '<div class="legend-note">Cor = partido do candidato mais votado' + (kind() === 'prop' ? ' (mais cadeiras)' : '') + ' em cada estado · tom = tamanho da vantagem</div>';
  }
  lg.innerHTML = html;
}

/* ================= navegação ================= */
function syncUrl() {
  const q = new URLSearchParams();
  if (S.cargo !== 'governador') q.set('c', S.cargo);
  if (S.turno === 2) q.set('t', '2');
  if (S.uf) q.set('uf', S.uf);
  if (S.mode === '3d') q.set('mode', '3d');
  const s = q.toString();
  try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* sem history */ }
}

function renderControls() {
  $$('#cargoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.cargo === S.cargo));
  $$('#turnoSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.turno === S.turno));
  $('#backBr').hidden = !S.uf;
  $('#turnoSeg').hidden = S.cargo !== 'governador';
  $('#viewSeg').hidden = !(kind() === 'prop' && S.uf);
  $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view));
  $$('#sortSeg button').forEach((b) => b.classList.toggle('on', b.dataset.sort === S.sort));
  updateThumbs();
}

function renderAll() {
  if (!S.ready) return;
  renderControls();
  renderScore();
  renderStates();
  if (S.uf) renderDetail();
  renderLegend();
  setView();
  if (S.sel) renderPin();
  syncUrl();
}

async function openUF(sg, { zoom = true, openSheet = true } = {}) {
  captureEvent('cargo_state_opened', { cargo: S.cargo, turno: S.turno });
  hideTip(); clearSel();
  S.uf = sg; S.cand = null; S.view = 'party';
  try { await loadState(sg); } catch (e) { /* estado sem dados neste cargo */ }
  if (S.uf !== sg) return;
  if (!curSt()) { S.uf = null; syncSide(); renderAll(); return; }
  syncSide();
  if (zoom && ufBounds[sg]) fitTo(ufBounds[sg], { padding: { ...padding(), left: isMobile() ? 20 : padding().left }, duration: 900 });
  renderAll();
  if (isMobile() && openSheet) setSheet(sheet.state === 'closed' ? 'half' : sheet.state);
}
function closeUF() {
  S.uf = null; S.cand = null; S.view = 'party'; clearSel(); hideTip();
  syncSide(); renderAll(); refit(true);
}

async function setCargo(c) {
  if (c === S.cargo) return;
  S.cargo = c; S.cand = null; S.view = 'party';
  if (c !== 'governador') S.turno = 1;
  captureEvent('cargo_changed', { cargo: c });
  clearSel(); hideTip();
  await loadIndex();
  if (S.uf) {
    if (S.turno === 2 && !GOV2.has(S.uf)) S.uf = null;
    else { try { await loadState(S.uf); } catch (e) { S.uf = null; } }
  }
  if (!S.uf) { syncSide(); refit(true); }
  renderAll();
}
async function setTurno(t) {
  if (t === S.turno) return;
  S.turno = t; captureEvent('cargo_turno_changed', { turno: t });
  clearSel(); hideTip();
  await loadIndex();
  if (S.uf) {
    if (t === 2 && !GOV2.has(S.uf)) S.uf = null;
    else { try { await loadState(S.uf); } catch (e) { S.uf = null; } }
  }
  if (!S.uf) { syncSide(); refit(true); }
  renderAll();
}

async function pickCand(n) {
  S.cand = n; S.view = 'cand';
  await loadCmap(S.uf).catch(() => null);
  captureEvent('cargo_candidate_picked', { cargo: S.cargo });
  renderAll();
}

$$('#cargoSeg button').forEach((b) => b.addEventListener('click', () => setCargo(b.dataset.cargo)));
$$('#turnoSeg button').forEach((b) => b.addEventListener('click', () => setTurno(+b.dataset.turno)));
$$('#modeSeg button').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.mode; captureEvent('results_visualization_changed', { visualization: S.mode }); renderAll(); }));
$$('#viewSeg button').forEach((b) => b.addEventListener('click', async () => {
  if (b.dataset.view === 'cand' && !S.cand) { S.view = 'cand'; renderAll(); return; }
  S.view = b.dataset.view;
  if (S.view === 'cand') await loadCmap(S.uf).catch(() => null);
  renderAll();
}));
$$('#sortSeg button').forEach((b) => b.addEventListener('click', () => { S.sort = b.dataset.sort; renderAll(); }));
$('#ufList').addEventListener('click', (e) => { const li = e.target.closest('li[data-sg]'); if (li && !li.classList.contains('dim')) openUF(li.dataset.sg); });
$('#sideBack').addEventListener('click', closeUF);
$('#backBr').addEventListener('click', closeUF);
$('#detail').addEventListener('click', (e) => {
  const c = e.target.closest('li[data-n]'); if (c) { pickCand(c.dataset.n); return; }
  const m = e.target.closest('li[data-id]'); if (m) pickMun(m.dataset.id);
});
$('#scoreBody').addEventListener('click', (e) => { const c = e.target.closest('li.go[data-n]'); if (c) pickCand(c.dataset.n); });
$('#btnStates').addEventListener('click', () => setSheet('half'));
$('#sideClose').addEventListener('click', () => setSheet('closed'));
scrimEl.addEventListener('click', () => setSheet('closed'));

/* ---------- tema ---------- */
$('#themeBtn').addEventListener('click', () => {
  TK.useTheme(TK.THEME === 'dark' ? 'light' : 'dark');
  try { localStorage.setItem('theme', TK.THEME); } catch (e) { /* sem storage */ }
  for (const s of Object.values(S.st)) { if (s.cands && s.parties === undefined) colorize(s.cands); else if (s.parties) s.parties.forEach((p) => { p.color = partyColor(p.sg); }); }
  renderAll();
});

/* ---------- gavetas e painéis (celular) ---------- */
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
    if (Math.abs(d.v) > 0.5) idx = clamp(idx + (d.v > 0 ? 1 : -1), 0, 2);
    d = null; setSheet(order[idx]);
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
}
{
  const ctl = $('#controls'), g = $('#ctlGrab');
  const setCtl = (collapsed) => {
    ctl.classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('ctlCollapsed', collapsed ? '1' : '0'); } catch (e) { /* sem storage */ }
    setTimeout(() => { if (!S.uf && !S.sel && isMobile()) refit(true); }, 520);
  };
  try { const sv = localStorage.getItem('ctlCollapsed'); if (sv === '1' || (sv == null && isMobile())) ctl.classList.add('collapsed'); } catch (e) { /* sem storage */ }
  swipePanel(ctl, () => setCtl(false), () => setCtl(true));
  g.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') setCtl(true); else if (e.key === 'ArrowUp') setCtl(false); });
}
{
  const sc = $('#score'), g = $('#scoreGrab');
  let scoreMin = isMobile();
  const apply = () => { sc.classList.toggle('min', scoreMin); g.setAttribute('aria-expanded', String(!scoreMin)); };
  apply();
  swipePanel(sc, () => { scoreMin = true; apply(); }, () => { scoreMin = false; apply(); });
  g.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { scoreMin = true; apply(); } else if (e.key === 'ArrowDown') { scoreMin = false; apply(); } });
}
function updateScoreVar() { document.documentElement.style.setProperty('--score-b', Math.round($('#score').getBoundingClientRect().bottom) + 'px'); }
new ResizeObserver(updateScoreVar).observe($('#score'));
addEventListener('resize', () => { if (S.ready) { map.resize(); if (!S.uf) refit(false); } });

/* ================= busca ================= */
const qEl = $('#q'), resEl = $('#sres'), pinEl = $('#pin');
let hits = [], active = -1, index = null;
function buildIndex() {
  index = [];
  for (const [id, [uf, nome, pop]] of Object.entries(S.names || {})) index.push({ kind: 'mun', id, nome, uf, key: norm(nome), pop });
  for (const [sg, nome] of Object.entries(UF_NOME)) index.push({ kind: 'uf', sg, nome, uf: sg, key: norm(nome), pop: 1e9 });
}
function runSearch(raw) {
  if (!index) buildIndex();
  let q = norm(raw.trim()), uf = null;
  if (!q) return { list: [], q };
  const m = q.match(/^(.*?)[\s,\-/]+([a-z]{2})$/);
  if (m && UF_NOME[m[2].toUpperCase()] && m[1]) { uf = m[2].toUpperCase(); q = m[1].trim(); }
  const out = [];
  for (const e of index) {
    if (uf && e.uf !== uf) continue;
    const i = e.key.indexOf(q); if (i < 0) continue;
    out.push({ e, i, score: i === 0 ? 0 : e.key[i - 1] === ' ' ? 1 : 2 });
  }
  out.sort((a, b) => a.score - b.score || b.e.pop - a.e.pop);
  return { list: out.slice(0, 8), q };
}
function renderResults() {
  const { list, q } = runSearch(qEl.value);
  hits = list.map((x) => x.e); active = hits.length ? 0 : -1;
  $('#qclear').hidden = !qEl.value;
  if (!list.length) { resEl.innerHTML = qEl.value.trim() ? '<li class="none">Nada encontrado</li>' : ''; resEl.hidden = !qEl.value.trim(); qEl.setAttribute('aria-expanded', String(!resEl.hidden)); return; }
  resEl.innerHTML = list.map(({ e, i }, k) => {
    const nm = esc(e.nome.slice(0, i)) + '<mark>' + esc(e.nome.slice(i, i + q.length)) + '</mark>' + esc(e.nome.slice(i + q.length));
    return `<li role="option" data-k="${k}" class="${k === 0 ? 'on' : ''}"><span class="nm">${nm}</span><span class="uf">${e.kind === 'uf' ? 'estado' : e.uf}</span></li>`;
  }).join('');
  resEl.hidden = false; qEl.setAttribute('aria-expanded', 'true');
}
const closeResults = () => { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); };
function moveActive(d) {
  if (!hits.length) return;
  active = (active + d + hits.length) % hits.length;
  $$('#sres li').forEach((li, k) => li.classList.toggle('on', k === active));
  $('#sres li.on')?.scrollIntoView({ block: 'nearest' });
}
function clearSel() {
  if (S.sel && S.ready) map.setFeatureState({ source: 'mun', id: +S.sel }, { s: false });
  S.sel = null; pinEl.hidden = true; pinEl.classList.remove('open');
}
async function pickMun(id, { fly = true } = {}) {
  closeResults(); qEl.blur(); hideTip();
  const uf = S.names?.[id]?.[0] || (S.uf);
  if (S.uf !== uf) { if (S.turno === 2 && !GOV2.has(uf)) return; await openUF(uf, { zoom: false, openSheet: false }); }
  if (!curSt()?.mun[id]) return;
  clearSel();
  S.sel = id; qEl.value = `${curSt().mun[id].nome} · ${uf}`; $('#qclear').hidden = false;
  map.setFeatureState({ source: 'mun', id: +id }, { s: true });
  if (fly) fitTo(S.bbox[id], { maxZoom: 9.5, duration: 1300 });
  renderPin();
}
async function pick(e) {
  if (e.kind === 'uf') {
    closeResults(); qEl.blur(); qEl.value = e.nome;
    if (S.turno === 2 && !GOV2.has(e.sg)) return;
    await openUF(e.sg, { openSheet: false }); return;
  }
  await pickMun(e.id);
}
function renderPin() {
  const t = S.sel ? munCard(S.sel) : null;
  if (!t) { pinEl.hidden = true; return; }
  $('#pinBody').innerHTML = t.html; pinEl.classList.toggle('wide', !!t.wide); pinEl.hidden = false;
}
qEl.addEventListener('input', renderResults);
qEl.addEventListener('focus', () => { qEl.select(); if (qEl.value.trim()) renderResults(); });
qEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); moveActive(1); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveActive(-1); }
  else if (ev.key === 'Enter') { ev.preventDefault(); if (hits[active]) pick(hits[active]); }
  else if (ev.key === 'Escape') { closeResults(); qEl.blur(); }
});
resEl.addEventListener('mousedown', (ev) => { const li = ev.target.closest('li[data-k]'); if (!li) return; ev.preventDefault(); pick(hits[+li.dataset.k]); });
$('#qclear').addEventListener('click', () => { qEl.value = ''; closeResults(); clearSel(); $('#qclear').hidden = true; qEl.focus(); });
pinEl.addEventListener('click', (ev) => { if (isMobile() && !ev.target.closest('#pinClose')) pinEl.classList.toggle('open'); });
$('#pinClose').addEventListener('click', () => { clearSel(); qEl.value = ''; $('#qclear').hidden = true; });
document.addEventListener('click', (ev) => { if (!ev.target.closest('#search')) closeResults(); });
addEventListener('keydown', (ev) => { if (ev.key === '/' && document.activeElement !== qEl && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); qEl.focus(); } });
function placeSearch() {
  const host = innerWidth > 1150 ? document.body : $('#controls');
  const s = $('#search');
  if (s.parentElement !== host) { if (host === document.body) host.prepend(s); else host.insertBefore(s, $('#ctlGrab').nextSibling); s.classList.toggle('inpanel', host !== document.body); }
  document.documentElement.style.setProperty('--ctl-h', $('#controls').offsetHeight + 'px');
}
placeSearch();
addEventListener('resize', placeSearch);
new ResizeObserver(placeSearch).observe($('#controls'));

/* ================= compartilhar ================= */
function buildShareCanvas() {
  const W = 1600, H = 900, t = T();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = t.canvas.bg; g.fillRect(0, 0, W, H);
  const mc = map.getCanvas(), dpr = mc.width / mc.clientWidth;
  let sx, sy, sw, sh;
  if (S.uf || map.getPitch() > 1) {          // estado (ou 3D): a área do mapa que não está sob os painéis
    const pad = padding();
    sx = pad.left * dpr; sy = pad.top * dpr; sw = (mc.clientWidth - pad.left - pad.right) * dpr; sh = (mc.clientHeight - pad.top - pad.bottom) * dpr;
  } else {                                   // Brasil: recorta nos limites do país
    const nw = map.project([BR_BOUNDS[0][0], BR_BOUNDS[1][1]]), se = map.project([BR_BOUNDS[1][0], BR_BOUNDS[0][1]]);
    sx = Math.max(0, nw.x * dpr); sy = Math.max(0, nw.y * dpr);
    sw = Math.min(mc.width, se.x * dpr) - sx; sh = Math.min(mc.height, se.y * dpr) - sy;
  }
  if (sw < 50 || sh < 50) { sx = 0; sy = 0; sw = mc.width; sh = mc.height; }
  const k = Math.min(860 / sw, 800 / sh), dw = sw * k, dh = sh * k;
  g.drawImage(mc, sx, sy, sw, sh, W - dw - 70, (H - dh) / 2, dw, dh);
  const grad = g.createLinearGradient(0, 0, W * 0.62, 0);
  grad.addColorStop(0, rgbaOf(t.canvas.bg, 1)); grad.addColorStop(0.65, rgbaOf(t.canvas.bg, 0.92)); grad.addColorStop(1, rgbaOf(t.canvas.bg, 0));
  g.fillStyle = grad; g.fillRect(0, 0, W * 0.62, H);
  const font = '"Geist", ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.fillStyle = t.canvas.muted; g.font = `600 26px ${font}`;
  g.fillText(`${cargoLabel(S.cargo, S.uf)} · ${S.uf ? UF_NOME[S.uf] : 'Brasil'} · ${S.turno}º turno`.toUpperCase().split('').join(String.fromCharCode(8202)), 80, 110);
  const st = curSt(), nf = getComputedStyle(document.documentElement).getPropertyValue('--num') || font;
  let y = 250;
  const line = (label, sub, value, color) => {
    g.fillStyle = color; g.font = `400 88px ${nf}`; g.textAlign = 'right'; g.fillText(value, 720, y + 34); g.textAlign = 'left';
    const room = 720 - g.measureText(value).width - 100;          // o nome encolhe até caber ao lado do número
    let size = 38; g.font = `600 ${size}px ${font}`;
    while (size > 22 && g.measureText(label).width > room) { size -= 2; g.font = `600 ${size}px ${font}`; }
    g.fillStyle = t.canvas.text; g.fillText(label, 80, y);
    g.fillStyle = t.canvas.muted; g.font = `500 24px ${font}`; g.fillText(sub, 80, y + 34);
    y += 150;
  };
  if (S.uf && st && kind() === 'maj') {
    const den = sumVotes(st.cands) || 1;
    for (const c of st.cands.slice(0, 4)) line(c.nome, `${c.sg}${c.st === 1 ? ' · eleito' : c.st === 2 ? ' · 2º turno' : ''}`, pctNum(c.votos / den) + '%', c.color);
  } else if (S.uf && st) {
    const parts = st.parties.filter((p) => p.seats).sort((a, b) => b.seats - a.seats).slice(0, 4);
    for (const p of parts) line(p.sg, `${p.seats} de ${st.vagas} vagas`, String(p.seats), p.color);
  } else {
    const ix = curIdx(), counts = {};
    for (const u of Object.values(ix?.ufs || {})) {
      if (kind() === 'maj') { const l = majLead(u); if (l) counts[l.c.sg] = (counts[l.c.sg] || 0) + 1; }
      else for (const p of u.parties) if (p.seats) counts[p.sg] = (counts[p.sg] || 0) + p.seats;
    }
    for (const [sg, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)) line(sg, kind() === 'maj' ? 'estados à frente' : 'cadeiras', String(n), partyColor(sg));
  }
  g.fillStyle = t.canvas.foot; g.font = `500 22px ${font}`; g.textAlign = 'right'; g.fillText('Fonte: TSE', W - 40, H - 36); g.textAlign = 'left';
  return c;
}
$('#btnShare').addEventListener('click', () => {
  let done = false;
  const capture = () => {
    if (done) return; done = true;
    const url = buildShareCanvas().toDataURL('image/png');
    $('#sharePrev').src = url; $('#shareDl').href = url;
    const where = S.uf ? UF_NOME[S.uf] : 'Brasil';
    $('#shareX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${cargoLabel(S.cargo, S.uf)} · ${where} · ${S.turno}º turno. Mapa município a município:`)}&url=${encodeURIComponent(location.href)}`;
    $('#shareDlg').showModal();
    captureEvent('results_share_dialog_opened', { cargo: S.cargo });
  };
  map.once('idle', capture); setTimeout(capture, 1500); map.triggerRepaint();
});
$('#shareCopy').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copiado ✓'; }
  catch (err) { e.target.textContent = 'Copie da barra de endereço'; }
  setTimeout(() => (e.target.textContent = 'Copiar link'), 2000);
});

/* ================= 2º turno ao vivo ================= */
let lastPull = 0;
async function pull() {
  lastPull = Date.now();
  await loadUni();
  if (S.turno !== 2) return;
  S.idx[key()] = null; await loadIndex();
  if (S.uf) { try { await loadState(S.uf); } catch (e) { /* mantém */ } }
  renderAll();
}
function schedulePull() {
  const delay = POLL_MS * (0.85 + Math.random() * 0.3);
  setTimeout(async () => { if (!document.hidden && S.turno === 2 && status() !== 'done') await pull(); schedulePull(); }, delay);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.ready && S.turno === 2 && Date.now() - lastPull > POLL_MS) pull(); });

/* ================= boot ================= */
let landed = false;
function landing() {
  if (landed) return; landed = true;
  if (S.uf && ufBounds[S.uf]) fitTo(ufBounds[S.uf], { duration: REDUCED ? 0 : 1200 }); else fitTo(BR_BOUNDS, { duration: REDUCED ? 0 : 1800 });
  $('#loading').classList.add('done');
  document.body.classList.add('ready');
}
(async function boot() {
  const [mun, ufs, names] = await Promise.all([getJSON('data/municipios.geojson'), getJSON('data/ufs.geojson'), getJSON('data/municipios-nomes.json').catch(() => ({}))]);
  S.names = names;
  await Promise.all([initMap(mun, ufs), loadIndex().catch(() => { S.idx[key()] = { ufs: {} }; })]);
  setTimeout(landing, 3000);
  const want = (params.get('uf') || '').toUpperCase();
  if (UF_COD[want] && !(S.turno === 2 && !GOV2.has(want))) { S.uf = want; try { await loadState(want); } catch (e) { S.uf = null; } if (!curSt()) S.uf = null; }
  syncSide();
  renderAll();
  setTimeout(landing, 30);
  watchSegsOnce();
  schedulePull();
})();
function watchSegsOnce() { TK.watchSegs(); updateThumbs(); }
})();
