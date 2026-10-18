// Onde o site busca os dados ao vivo (live.json, history.json, snaps/).
// Produção: projeto "apuracao-dados" (Cloudflare Workers, só arquivos estáticos, sem custo por requisição).
// Local (localhost): a pasta site/data/.
window.TRACKER_LIVE_BASE = /^(localhost|127\.|\[::1\])/.test(location.hostname) ? 'data/' : 'https://apuracao-dados.brlabs.workers.dev/';
