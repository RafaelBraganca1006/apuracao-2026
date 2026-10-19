// Redireciona o endereço antigo (apuracao-2026.rbranganca.workers.dev) para o atual, mantendo caminho e parâmetros.
const DESTINO = 'https://apuracao-2026.brlabs.workers.dev';

export default {
  fetch(request) {
    const u = new URL(request.url);
    return Response.redirect(DESTINO + u.pathname + u.search, 302);
  },
};
