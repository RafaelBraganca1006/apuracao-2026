// Dados do PostHog (HogQL) para o painel. Precisa de POSTHOG_API_KEY (chave pessoal phx_, escopo "query:read").
// Opcionais: POSTHOG_PROJECT_ID (padrão 217733) e POSTHOG_HOST (padrão https://eu.posthog.com).
const DEFAULT_PROJECT = '217733', DEFAULT_HOST = 'https://eu.posthog.com';

export function hogql(hours) {
  const H = Math.min(720, Math.max(1, Math.round(+hours) || 48));
  const W = `timestamp > now() - INTERVAL ${H} HOUR`;
  // uma linha por sessão, com a duração da sessão: base para visitas, tempo de tela, aparelho e estado
  const S = `SELECT properties.$session_id AS sid, max(session.$session_duration) AS dur, any(properties.$device_type) AS dev, any(properties.$geoip_country_code) AS c, any(properties.$geoip_subdivision_1_code) AS uf FROM events WHERE event = '$pageview' AND ${W} GROUP BY sid`;
  return {
    totals: `SELECT count() AS pageviews, uniq(distinct_id) AS uniques, uniq(properties.$session_id) AS visits FROM events WHERE event = '$pageview' AND ${W}`,
    secs: `SELECT sum(dur) AS secs FROM (${S})`,
    now: `SELECT uniq(distinct_id) AS n FROM events WHERE event IN ('$pageview', '$pageleave') AND timestamp > now() - INTERVAL 5 MINUTE`,
    series: `SELECT toStartOfInterval(timestamp, INTERVAL 5 MINUTE) AS t, uniq(distinct_id) AS n FROM events WHERE event IN ('$pageview', '$pageleave') AND ${W} GROUP BY t ORDER BY t`,
    devices: `SELECT dev AS device, count() AS visits, sum(dur) AS secs FROM (${S}) GROUP BY dev`,
    states: `SELECT uf, count() AS n, sum(dur) AS secs FROM (${S}) WHERE c = 'BR' AND uf != '' GROUP BY uf ORDER BY secs DESC LIMIT 30`,
    cities: `SELECT properties.$geoip_city_name AS city, any(properties.$geoip_subdivision_1_code) AS uf, uniq(distinct_id) AS n FROM events WHERE event = '$pageview' AND ${W} AND properties.$geoip_country_code = 'BR' AND properties.$geoip_city_name != '' GROUP BY city ORDER BY n DESC LIMIT 24`,
    countries: `SELECT properties.$geoip_country_code AS country, uniq(distinct_id) AS n FROM events WHERE event = '$pageview' AND ${W} GROUP BY country ORDER BY n DESC LIMIT 24`,
    sources: `SELECT coalesce(nullIf(properties.utm_source, ''), nullIf(properties.$referring_domain, ''), '$direct') AS source, uniq(properties.$session_id) AS n FROM events WHERE event = '$pageview' AND ${W} GROUP BY source ORDER BY n DESC LIMIT 20`,
  };
}

const rowsOf = (j) => (j.results || []).map((r) => Object.fromEntries((j.columns || []).map((c, i) => [c, r[i]])));

export async function fromPostHog(env, hours) {
  if (!env.POSTHOG_API_KEY) return null;
  const base = (env.POSTHOG_HOST || DEFAULT_HOST).replace(/\/$/, ''), pid = env.POSTHOG_PROJECT_ID || DEFAULT_PROJECT, q = hogql(hours), keys = Object.keys(q);
  const res = await Promise.allSettled(keys.map(async (k) => {
    const r = await fetch(`${base}/api/projects/${pid}/query/`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.POSTHOG_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: q[k] }, name: `painel-${k}` }),
    });
    if (!r.ok) throw new Error(`PostHog ${r.status}: ${(await r.text()).slice(0, 160)}`);
    return rowsOf(await r.json());
  }));
  const out = {}, errors = [];
  keys.forEach((k, i) => { if (res[i].status === 'fulfilled') out[k] = res[i].value; else { out[k] = []; errors.push(`posthog.${k}: ${String(res[i].reason?.message || res[i].reason).slice(0, 200)}`); } });
  // junta "totals" e "secs" no formato que o painel espera
  out.totals = [{ ...(out.totals?.[0] || {}), secs: +out.secs?.[0]?.secs || 0 }]; delete out.secs;
  return { data: out, errors };
}
