// Resumo do analytics para o painel (/analytics.html). Protegido por token (STATS_TOKEN).
// Lê o Analytics Engine pela API SQL da Cloudflare (precisa de CF_ACCOUNT_ID e CF_API_TOKEN com "Account Analytics: Read").
import { fromPostHog } from '../_lib/posthog.js';

const T = 'apuracao';
const BEAT = "SUM(IF(blob1 = 'beat', double1 * _sample_interval, 0.0))";   // 0.0: o IF() exige o mesmo tipo (Double) nos dois ramos

async function sql(env, q) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: `${q} FORMAT JSON`,
  });
  if (!r.ok) throw new Error(`AE ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data || [];
}

// `cut` = instante do 1º evento do PostHog (UTC, 'YYYY-MM-DD HH:MM:SS') ou null. Antes dele só o Cloudflare viu os visitantes;
// depois dele os dois veem. Para contagens, o Cloudflare sempre vê todos (é o coletor que não depende do navegador aceitar o script do PostHog).
export function queries(hours, cut = null) {
  const W = `timestamp > NOW() - INTERVAL '${hours}' HOUR`;
  const before = cut ? ` AND timestamp < toDateTime('${cut}')` : '';
  return {
    totals: `SELECT COUNT(DISTINCT index1) AS uniques, COUNT(DISTINCT blob11) AS visits, SUM(IF(blob1 = 'pageview', _sample_interval, 0)) AS pageviews, SUM(IF(blob1 = 'beat'${before}, double1 * _sample_interval, 0.0)) AS secs FROM ${T} WHERE ${W}`,
    devs: `SELECT COUNT(DISTINCT blob12) AS n FROM ${T} WHERE ${W} AND blob12 != ''`,
    now: `SELECT COUNT(DISTINCT index1) AS n FROM ${T} WHERE timestamp > NOW() - INTERVAL '3' MINUTE`,
    series: `SELECT toStartOfInterval(timestamp, INTERVAL '2' MINUTE) AS t, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W}${before} GROUP BY t ORDER BY t`,
    tvs: `SELECT COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob4 = 'tv'`,
    devices: `SELECT blob4 AS device, COUNT(DISTINCT blob11) AS visits FROM ${T} WHERE ${W} GROUP BY device`,
    states: `SELECT blob7 AS uf, COUNT(DISTINCT blob11) AS n FROM ${T} WHERE ${W} AND blob6 = 'BR' AND blob7 != '' GROUP BY uf ORDER BY n DESC LIMIT 30`,
    cities: `SELECT blob8 AS city, blob7 AS uf, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob6 = 'BR' AND blob8 != '' GROUP BY city, uf ORDER BY n DESC LIMIT 24`,
    countries: `SELECT blob6 AS country, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} GROUP BY country ORDER BY n DESC LIMIT 24`,
    orgs: `SELECT blob9 AS org, blob6 AS country, SUM(_sample_interval) AS sinais, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob9 != '' GROUP BY org, country ORDER BY sinais DESC LIMIT 300`,
    sources: `SELECT blob3 AS source, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} GROUP BY source ORDER BY n DESC LIMIT 20`,
    pages: `SELECT blob2 AS page, SUM(IF(blob1 = 'pageview', _sample_interval, 0)) AS pageviews FROM ${T} WHERE ${W} GROUP BY page ORDER BY pageviews DESC`,
    clicks: `SELECT blob10 AS label, SUM(_sample_interval) AS n FROM ${T} WHERE ${W} AND blob1 = 'click' GROUP BY label ORDER BY n DESC LIMIT 12`,
  };
}

const num = (x) => +x || 0;
const toSql = (t) => { const d = new Date(String(t).includes('Z') || /[+-]\d\d:?\d\d$/.test(String(t)) ? t : `${t}Z`); return Number.isNaN(+d) ? null : d.toISOString().slice(0, 19).replace('T', ' '); };

// Números únicos do painel: contagens vêm do Cloudflare (vê todos os navegadores, inclusive os que bloqueiam o PostHog) ou do
// PostHog se ele contar mais; presença e tempo de tela somam o Cloudflare (antes do PostHog) com o PostHog (depois).
export function unify(cf, ph, cut) {
  const ct = cf.totals?.[0] || {}, pt = ph?.totals?.[0] || {};
  const ts = (t) => new Date(typeof t === 'string' && !/Z|[+-]\d\d:?\d\d$/.test(t) ? `${t.replace(' ', 'T')}Z` : t);   // o AE devolve UTC sem fuso
  const series = [...(cf.series || []), ...(ph?.series || [])].map((r) => ({ d: ts(r.t), n: num(r.n) })).filter((p) => !Number.isNaN(+p.d))
    .map((p) => ({ t: p.d.toISOString(), n: p.n })).sort((a, b) => a.t.localeCompare(b.t));
  const peak = series.reduce((m, p) => (p.n > (m?.n || 0) ? p : m), null);
  return {
    now: Math.max(num(cf.now?.[0]?.n), num(ph?.now?.[0]?.n)),
    peak, series,
    uniques: Math.max(num(ct.uniques), num(pt.uniques)), visits: Math.max(num(ct.visits), num(pt.visits)), pageviews: Math.max(num(ct.pageviews), num(pt.pageviews)),
    devices: num(cf.devs?.[0]?.n),          // piso: aparelhos distintos por país + rede + navegador (só eventos novos)
    secs: num(ct.secs) + num(ph?.secs?.[0]?.secs),
    cutoff: cut, posthog: !!ph,
    detail: { cf: { uniques: num(ct.uniques), visits: num(ct.visits), pageviews: num(ct.pageviews) }, ph: ph ? { uniques: num(pt.uniques), visits: num(pt.visits), pageviews: num(pt.pageviews) } : null },
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), head = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!env.STATS_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return new Response(JSON.stringify({ error: 'não configurado' }), { status: 503, headers: head });
  const tok = url.searchParams.get('token') || request.headers.get('x-token') || '';
  if (tok.length !== env.STATS_TOKEN.length || [...tok].reduce((a, c, i) => a | (c.charCodeAt(0) ^ env.STATS_TOKEN.charCodeAt(i)), 0) !== 0) return new Response(JSON.stringify({ error: 'token inválido' }), { status: 401, headers: head });
  const hours = Math.min(720, Math.max(1, parseInt(url.searchParams.get('hours'), 10) || 48));
  try {
    // cada consulta é independente: se uma falhar, as outras seções continuam e o erro vai em `errors`
    const errors = [];
    const ph = await fromPostHog(env, hours).catch((e) => ({ data: null, errors: [`posthog: ${String(e.message || e).slice(0, 200)}`] }));
    if (ph?.errors) errors.push(...ph.errors);
    const cut = ph?.data?.first?.[0]?.t ? toSql(ph.data.first[0].t) : null;
    const q = queries(hours, cut), keys = Object.keys(q), res = await Promise.allSettled(keys.map((k) => sql(env, q[k])));
    const out = {};
    keys.forEach((k, i) => { if (res[i].status === 'fulfilled') out[k] = res[i].value; else { out[k] = []; errors.push(`${k}: ${String(res[i].reason?.message || res[i].reason).slice(0, 220)}`); } });
    const unified = unify(out, ph?.data || null, cut);
    return new Response(JSON.stringify({ hours, generated: new Date().toISOString(), errors, unified, ...out }), { headers: head });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: head });
  }
}
