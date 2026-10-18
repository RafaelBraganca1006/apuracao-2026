(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.search), DEMO = q.has('demo');
const nf = (n) => Math.round(+n || 0).toLocaleString('pt-BR');
const big = (n) => { n = +n || 0; return n >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : n >= 1e4 ? `${Math.round(n / 1e3)} mil` : n >= 1e3 ? `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : nf(n); };
const pct = (x, d = 1) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
const dur = (s) => { const h = s / 3600; return h >= 1000 ? `${Math.round(h / 1000)} mil h` : h >= 1 ? `${nf(h)} h` : `${nf(s / 60)} min`; };
const NOME_PAIS = (() => { try { const d = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); return (c) => d.of(c) || c; } catch { return (c) => c; } })();
const SRC = { direto: 'Direto', interno: 'Interno', outro: 'Outros', x: 'X', youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick', instagram: 'Instagram', reddit: 'Reddit', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp', telegram: 'Telegram', google: 'Google', bing: 'Bing', linkedin: 'LinkedIn' };
const DEV = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', tv: 'TV' };

const GROUPS = [
  ['Justiça eleitoral', /\bTSE\b|Tribunal Superior Eleitoral|\bTRE[ -]|Tribunal Regional Eleitoral/i],
  ['Poder público', /Serpro|Prodesp|Prodam|Dataprev|Prodemge|CIASC|C[aâ]mara d|Senado|\bTRT\b|\bTJ\b|\bTRF\b|Tribunal|Minist[eé]rio|Governo|Prefeitura|Procuradoria|Assembleia|Defensoria|Receita/i],
  ['Imprensa', /Globo|\bSBT\b|Record|Folha|Estad[aã]o|\bUOL\b|\bCNN\b|Band(eirantes)?\b|Editora|Abril|\bR7\b|Jovem Pan/i],
  ['Bancos', /Banco|Ita[uú]|Bradesco|Santander|Daycoval|\bBTG\b|Caixa Econ|Nubank|Sicredi|Sicoob|Safra/i],
  ['Tecnologia', /Google|Microsoft|Amazon|Cloudflare|Meta Platforms|Facebook|Apple Inc|Oracle|\bIBM\b|Akamai/i],
];
const FORA = /Minist|Government|Govern|Bundes|Parliament|Congress|Embassy|Department of|Assembl/i;
const PROV = /vivo|telef[oô]nica|claro|\bnet\b|\btim\b|\boi\b|brisanet|algar|desktop|copel|sky|telecom|telecomunica|internet|banda larga|fibra|cable|wireless|mobile|broadband|comunica[cç]/i;

function groupOrgs(rows) {
  const out = new Map([...GROUPS.map((g) => [g[0], []]), ['Fora do Brasil', []]]);
  for (const r of rows) {
    const br = r.country === 'BR', org = r.org;
    if (!br) { if (FORA.test(org)) out.get('Fora do Brasil').push(r); continue; }
    const hit = GROUPS.find(([, re]) => re.test(org));
    if (hit && !(hit[0] === 'Poder público' && false)) out.get(hit[0]).push(r);
    else if (!PROV.test(org)) continue;
  }
  return [...out].filter(([, v]) => v.length).map(([k, v]) => [k, v.sort((a, b) => b.sinais - a.sinais).slice(0, 8)]);
}

/* ---------- dados ---------- */
function demo(h) {
  const d = demoCF(h), t = d.totals[0];
  d.unified = { now: 2854, peak: { t: d.series[Math.round(d.series.length * 0.72)].t, n: 8120 }, series: d.series.map((p) => ({ t: p.t, n: +p.n })),
    uniques: Math.round(+t.uniques), visits: Math.round(+t.visits), pageviews: Math.round(+t.pageviews), secs: Math.round(+t.secs), cutoff: '2026-10-17 21:43:00', posthog: q.get('demo') !== 'cf' };
  return d;
}
function demoCF(h) {
  const r = (a, b) => a + Math.random() * (b - a), pts = Math.round(h * 12), now = Date.now();
  const L = Math.min(pts, 288), series = Array.from({ length: L }, (_, i) => ({ t: new Date(now - (L - i) * 300000).toISOString(), n: Math.round(8000 * Math.exp(-((i - L * 0.72) ** 2) / (2 * (L * 0.12) ** 2)) + r(80, 400)) }));
  const UFS = 'SP MG RJ PR RS BA SC CE PE GO DF PA MA ES PB RN AL MT MS PI SE AM TO RO AC AP RR'.split(' '), w = [29, 9, 7.6, 6.8, 5.7, 5.1, 5.1, 4.8, 3.8, 2.6, 2.1, 2.2, 1.6, 1.8, 2.1, 1.6, 1.5, 1.2, 1.1, 1.1, 1, .9, .7, .5, .2, .2, .2];
  const V = 143000 * Math.min(1, h / 24) + 20000;
  return {
    totals: [{ uniques: V * 7, visits: V * 25, pageviews: V * 40, secs: V * 1900 }], now: [{ n: Math.round(r(900, 3000)) }], series, peak: [{ t: series[Math.round(series.length * .72)].t, n: 8120 }],
    tvPeak: [{ n: 147 }], tvs: [{ n: 359 }],
    devices: [{ device: 'mobile', visits: V * 22, secs: V * 920 }, { device: 'desktop', visits: V * 3, secs: V * 940 }, { device: 'tablet', visits: V * .3, secs: V * 30 }, { device: 'tv', visits: V * .02, secs: V * 8 }],
    states: UFS.map((uf, i) => ({ uf, n: Math.round(w[i] * V * 2) })), scale: [{ k: 1 }],
    cities: ['São Paulo|SP', 'Rio de Janeiro|RJ', 'Curitiba|PR', 'Fortaleza|CE', 'Belo Horizonte|MG', 'Salvador|BA', 'Brasília|DF', 'Recife|PE', 'Porto Alegre|RS', 'João Pessoa|PB', 'Goiânia|GO', 'Joinville|SC'].map((s, i) => { const [city, uf] = s.split('|'); return { city, uf, n: Math.round(V * 0.9 / (i + 1.5)) }; }),
    countries: [['US', 35.6], ['PT', 11.1], ['AR', 10.8], ['CA', 6.6], ['PY', 3.7], ['GB', 3], ['ES', 2.9], ['CL', 2.6]].map(([country, n]) => ({ country, n: n * 1000 })),
    orgs: [['Tribunal Superior Eleitoral', 80], ['TRE da Paraíba', 50], ['Serpro', 820], ['Prodesp', 740], ['Câmara dos Deputados', 770], ['TRT da 9ª Região', 17060], ['Editora Globo', 480], ['Globo', 210], ['Banco do Brasil', 250], ['Itaú Unibanco', 60], ['Google LLC', 2000], ['Microsoft Corporation', 550]].map(([org, sinais]) => ({ org, country: 'BR', sinais, n: sinais / 3 })).concat([{ org: 'Bundesministerium des Innern', country: 'DE', sinais: 17150, n: 90 }]),
    sources: [['direto', 52], ['x', 21], ['whatsapp', 9], ['youtube', 6], ['instagram', 4], ['twitch', 3], ['kick', 2], ['reddit', 1], ['google', 2]].map(([source, n]) => ({ source, n: n * 1000 })),
    pages: [{ page: 'home', pageviews: V * 14, secs: V * 300 }, { page: 'apuracao:1turno', pageviews: V * 20, secs: V * 1400 }, { page: 'pesquisas', pageviews: V * 6, secs: V * 200 }],
    clicks: [{ label: 'pesquisas', n: V * 5 }, { label: 'apuracao', n: V * 8 }, { label: 'compartilhar', n: V * 1.1 }],
  };
}

/* ---------- desenho ---------- */
function bars(rows, fmt) {
  const m = Math.max(...rows.map((r) => r.v), 1);
  return `<ul class="an-bars">${rows.map((r) => `<li><span class="k">${esc(r.k)}</span><span class="b"><i style="width:${(r.v / m) * 100}%;${r.c ? `background:${r.c}` : ''}"></i></span><span class="v">${fmt(r.v, r)}</span></li>`).join('')}</ul>`;
}
function chart(series) {
  const el = $('#chart');
  if (!series.length) { el.innerHTML = '<p class="an-note">Sem dados no período.</p>'; return; }
  const W = 900, H = 200, m = { l: 44, r: 8, t: 8, b: 22 }, ts = series.map((p) => +new Date(p.t)), t0 = Math.min(...ts), t1 = Math.max(...ts), vmax = Math.max(...series.map((p) => +p.n), 1);
  const x = (t) => m.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - m.l - m.r), y = (v) => m.t + (1 - v / vmax) * (H - m.t - m.b);
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(+new Date(p.t)).toFixed(1)},${y(+p.n).toFixed(1)}`).join('');
  const area = `${d}L${x(t1)},${H - m.b}L${x(t0)},${H - m.b}Z`;
  const grid = [0, .5, 1].map((f) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(vmax * f)}" y2="${y(vmax * f)}" stroke="var(--chart-grid)"/><text x="${m.l - 6}" y="${y(vmax * f) + 4}" text-anchor="end">${big(vmax * f)}</text>`).join('');
  const lab = [0, .5, 1].map((f) => { const t = t0 + (t1 - t0) * f; return `<text x="${x(t)}" y="${H - 5}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</text>`; }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pessoas ao mesmo tempo ao longo do período">${grid}<path d="${area}" fill="var(--accent-soft)"/><path d="${d}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linejoin="round"/>${lab}</svg>`;
}

// origem do tráfego: traduz domínio de referrer / utm_source do PostHog para os nomes usados no painel
const SRC_RE = [['twitch', /twitch\.tv/], ['kick', /kick\.com/], ['youtube', /youtube\.com|youtu\.be/], ['x', /(^|\.)(twitter\.com|x\.com|t\.co)$/], ['instagram', /instagram\.com/], ['reddit', /reddit\.com/], ['facebook', /facebook\.com|fb\.com/], ['tiktok', /tiktok\.com/], ['whatsapp', /whatsapp\.com|wa\.me/], ['telegram', /telegram\.org|t\.me/], ['google', /google\./], ['bing', /bing\.com/], ['linkedin', /linkedin\.com|lnkd\.in/]];
const srcName = (s) => { s = String(s || ''); if (s === '$direct' || !s) return 'direto'; const l = s.toLowerCase(); for (const [n, re] of SRC_RE) if (l === n || re.test(l)) return n; return l.includes('.') ? 'outro' : l; };

// origem do tráfego: o coletor já classifica (twitch, x, whatsapp...); aqui só os nomes
function render(d) {
  const U = d.unified || {}, fmtT = (x) => new Date(x).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const perVisit = U.visits ? (U.secs || 0) / U.visits : 0;
  const key = [
    [nf(U.now), 'vendo agora', 'pessoas ativas nos últimos 3 min', 'live'],
    [big(U.peak?.n), 'máximo ao mesmo tempo', U.peak ? `pico em ${fmtT(U.peak.t)}` : 'sem dados ainda'],
    [big(U.uniques), 'pessoas diferentes', 'navegadores únicos'],
    [big(U.visits), 'visitas', 'sessões distintas'],
  ];
  const minor = [
    [big(U.pageviews), 'páginas vistas'], [dur(U.secs || 0), 'de tela aberta'], [perVisit ? dur(perVisit) : '–', 'por visita'], [nf(+d.tvs?.[0]?.n || 0), 'TVs'],
  ];
  $('#kpis').innerHTML = key.map(([n, l, s, c]) => `<div class="an-kpi key ${c || ''}"><b>${n}</b><span>${l}</span><small>${s}</small></div>`).join('')
    + `<div class="an-minor">${minor.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>`;
  $('#srcNote').textContent = U.posthog
    ? `Soma Cloudflare (desde o início) + PostHog${U.cutoff ? ` (desde ${fmtT(String(U.cutoff).replace(' ', 'T') + 'Z')})` : ''}. Contagens: o maior das duas fontes, sem contar duas vezes. Presença e tempo de tela: Cloudflare antes do PostHog, PostHog depois.`
    : 'Só Cloudflare (PostHog não configurado: faltam presença atual e tempo de tela recentes).';
  chart(U.series || []);

  const dv = (d.devices || []).filter((r) => r.device !== 'tv'), vt = dv.reduce((a, r) => a + +r.visits, 0) || 1, o = ['mobile', 'desktop', 'tablet'];
  dv.sort((x, y) => o.indexOf(x.device) - o.indexOf(y.device));
  $('#devices').innerHTML = bars(dv.map((r) => ({ k: DEV[r.device] || r.device, v: +r.visits })), (v) => pct(v / vt));
  $('#tvs').innerHTML = `<div class="an-two-nums"><div><b>${nf(+d.tvs?.[0]?.n || 0)}</b><span>TVs</span><small>navegadores de smart TV</small></div></div>`;
  const S = d.sources || [], sm = S.reduce((a, r) => a + +r.n, 0) || 1;
  $('#sources').innerHTML = S.map((r) => `<span class="an-chip">${esc(SRC[r.source] || r.source)} <b>${pct(+r.n / sm, 0)}</b></span>`).join('');

  const sts = (d.states || []).map((r) => ({ uf: r.uf, v: +r.n })), tot = sts.reduce((a, r) => a + r.v, 0) || 1, mm = Math.max(...sts.map((r) => r.v), 1);
  $('#states').innerHTML = sts.map((r) => `<div class="row"><span class="uf">${esc(r.uf)}</span><span class="b"><i style="width:${(r.v / mm) * 100}%"></i></span><span class="v">${pct(r.v / tot)}</span></div>`).join('') || '<p class="an-note">Sem dados.</p>';
  $('#cities').innerHTML = (d.cities || []).map((r) => `<span class="an-chip">${esc(r.city)} <small>${esc(r.uf)}</small> <b>${big(+r.n)}</b></span>`).join('') || '<p class="an-note">Sem dados.</p>';
  const cor = d.countries || [], C = cor.filter((r) => r.country && r.country !== 'BR' && r.country !== '??');
  $('#countries').innerHTML = C.map((r) => `<span class="an-chip">${esc(NOME_PAIS(r.country))} <b>${big(+r.n)}</b></span>`).join('') || '<p class="an-note">Sem dados.</p>';
  $('#countriesNote').textContent = cor.length ? `Visitas. ${cor.length} países no total.` : '';

  const G = groupOrgs(d.orgs || []);
  $('#orgs').innerHTML = G.map(([name, rows]) => `<div class="an-grp"><span class="gn">${esc(name)}</span><div class="an-chips">${rows.map((r) => `<span class="an-chip">${esc(r.org)} <b>${big(+r.sinais)}</b> <small>visitas</small></span>`).join('')}</div></div>`).join('') || '<p class="an-note">Nenhuma rede de interesse identificada ainda.</p>';

  const Pg = d.pages || [], pm = Pg.reduce((a, r) => a + +r.pageviews, 0) || 1;
  const PN = { home: 'Início', pesquisas: 'Pesquisas', apuracao: 'Apuração 2º turno', 'apuracao:1turno': 'Apuração 1º turno', analytics: 'Analytics' };
  $('#pages').innerHTML = bars(Pg.map((r) => ({ k: PN[r.page] || r.page, v: +r.pageviews })), (v) => `${big(v)} <small>${pct(v / pm, 0)}</small>`);
  const CL = d.clicks || [], CN = { pesquisas: 'Pesquisas eleitorais', apuracao: 'Apuração do 1º turno', compartilhar: 'Compartilhar' };
  $('#clicks').innerHTML = CL.length ? bars(CL.map((r) => ({ k: CN[r.label] || r.label, v: +r.n })), (v) => big(v)) : '<p class="an-note">Sem cliques ainda.</p>';
}

/* ---------- carregar ---------- */
let hours = 48, timer = 0;
async function load() {
  const err = $('#err');
  try {
    let data;
    if (DEMO) data = demo(hours);
    else {
      const tok = localStorage.getItem('stats_token') || '';
      if (!tok) { $('#login').hidden = false; $('#dash').hidden = true; return; }
      const r = await fetch(`/api/stats?hours=${hours}`, { headers: { 'x-token': tok }, cache: 'no-store' });
      if (r.status === 401) { localStorage.removeItem('stats_token'); err.textContent = 'Token inválido.'; $('#login').hidden = false; $('#dash').hidden = true; return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      data = j;
    }
    $('#login').hidden = true; $('#dash').hidden = false; err.textContent = '';
    $('#anSub').textContent = DEMO ? 'Dados de demonstração (?demo). Nada disso é real.' : `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} · últimas ${hours >= 48 ? Math.round(hours / 24) + ' dias' : hours + ' horas'}.`;
    lastData = data; render(data);
    if (data.errors?.length) { err.textContent = `Algumas seções não carregaram: ${data.errors.join(' | ')}`; }
  } catch (e) { $('#login').hidden = DEMO; err.textContent = `Não foi possível carregar (${e.message}).`; }
}
$('#login').addEventListener('submit', (e) => { e.preventDefault(); localStorage.setItem('stats_token', $('#tok').value.trim()); load(); });
let lastData = null;
$('#hours').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  hours = +b.dataset.h; document.querySelectorAll('#hours button').forEach((x) => x.classList.toggle('on', x === b)); load();
});
$('#themeBtn').addEventListener('click', () => {
  const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n;
  try { localStorage.setItem('theme', n); } catch { /* sem storage */ }
});
load(); timer = setInterval(load, 30000);
})();
