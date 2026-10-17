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

export function queries(hours) {
  const W = `timestamp > NOW() - INTERVAL '${hours}' HOUR`;
  return {
    totals: `SELECT COUNT(DISTINCT index1) AS uniques, COUNT(DISTINCT blob11) AS visits, SUM(IF(blob1 = 'pageview', _sample_interval, 0)) AS pageviews, ${BEAT} AS secs FROM ${T} WHERE ${W}`,
    scale: `SELECT MAX(double3) AS k FROM ${T} WHERE ${W}`,
    series: `SELECT toStartOfInterval(timestamp, INTERVAL '5' MINUTE) AS t, COUNT(DISTINCT blob11) AS n FROM ${T} WHERE ${W} GROUP BY t ORDER BY t`,
    tvs: `SELECT COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob4 = 'tv'`,
    devices: `SELECT blob4 AS device, COUNT(DISTINCT blob11) AS visits, ${BEAT} AS secs FROM ${T} WHERE ${W} GROUP BY device`,
    states: `SELECT blob7 AS uf, COUNT(DISTINCT blob11) AS n FROM ${T} WHERE ${W} AND blob6 = 'BR' AND blob7 != '' GROUP BY uf ORDER BY n DESC LIMIT 30`,
    cities: `SELECT blob8 AS city, blob7 AS uf, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob6 = 'BR' AND blob8 != '' GROUP BY city, uf ORDER BY n DESC LIMIT 24`,
    countries: `SELECT blob6 AS country, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} GROUP BY country ORDER BY n DESC LIMIT 24`,
    orgs: `SELECT blob9 AS org, blob6 AS country, SUM(_sample_interval) AS sinais, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} AND blob9 != '' GROUP BY org, country ORDER BY sinais DESC LIMIT 300`,
    sources: `SELECT blob3 AS source, COUNT(DISTINCT index1) AS n FROM ${T} WHERE ${W} GROUP BY source ORDER BY n DESC LIMIT 20`,
    pages: `SELECT blob2 AS page, SUM(IF(blob1 = 'pageview', _sample_interval, 0)) AS pageviews, ${BEAT} AS secs FROM ${T} WHERE ${W} GROUP BY page ORDER BY pageviews DESC`,
    clicks: `SELECT blob10 AS label, SUM(_sample_interval) AS n FROM ${T} WHERE ${W} AND blob1 = 'click' GROUP BY label ORDER BY n DESC LIMIT 12`,
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
    const q = queries(hours), keys = Object.keys(q);
    const [res, ph] = await Promise.all([Promise.allSettled(keys.map((k) => sql(env, q[k]))), fromPostHog(env, hours).catch((e) => ({ data: null, errors: [`posthog: ${String(e.message || e).slice(0, 200)}`] }))]);
    const out = {}, errors = [];
    keys.forEach((k, i) => { if (res[i].status === 'fulfilled') out[k] = res[i].value; else { out[k] = []; errors.push(`${k}: ${String(res[i].reason?.message || res[i].reason).slice(0, 220)}`); } });
    if (ph?.errors) errors.push(...ph.errors);
    return new Response(JSON.stringify({ hours, generated: new Date().toISOString(), errors, ph: ph?.data || null, ...out }), { headers: head });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: head });
  }
}
