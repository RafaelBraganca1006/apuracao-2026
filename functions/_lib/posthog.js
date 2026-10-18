// Dados do PostHog (HogQL) para o painel. Precisa de POSTHOG_API_KEY (chave pessoal phx_, escopo "query:read").
// Opcionais: POSTHOG_PROJECT_ID (padrão 217733) e POSTHOG_HOST (padrão https://eu.posthog.com).
const DEFAULT_PROJECT = '217733', DEFAULT_HOST = 'https://eu.posthog.com';

export function hogql(hours) {
  const H = Math.min(720, Math.max(1, Math.round(+hours) || 48));
  const W = `timestamp > now() - INTERVAL ${H} HOUR`;
  const LIVE = "event IN ('$pageview', 'viewing')";       // 'viewing' = batimento enviado a cada 60 s com a aba visível (site/posthog.js)
  return {
    first: "SELECT min(timestamp) AS t FROM events WHERE event IN ('$pageview', 'viewing')",
    totals: `SELECT count() AS pageviews, uniq(distinct_id) AS uniques, uniq(properties.$session_id) AS visits FROM events WHERE event = '$pageview' AND ${W}`,
    secs: `SELECT sum(dur) AS secs FROM (SELECT properties.$session_id AS sid, max(session.$session_duration) AS dur FROM events WHERE ${LIVE} AND ${W} GROUP BY sid)`,
    now: `SELECT uniq(distinct_id) AS n FROM events WHERE ${LIVE} AND timestamp > now() - INTERVAL 3 MINUTE`,
    series: `SELECT toStartOfInterval(timestamp, INTERVAL 2 MINUTE) AS t, uniq(distinct_id) AS n FROM events WHERE ${LIVE} AND ${W} GROUP BY t ORDER BY t`,
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
  return { data: out, errors };
}
