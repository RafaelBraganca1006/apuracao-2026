// Roteador do Worker: /api/e (coleta), /api/stats (painel) e, para o resto, os arquivos de site/.
import { onRequestPost as collect, onRequestOptions as collectOptions } from '../functions/api/e.js';
import { onRequestGet as stats } from '../functions/api/stats.js';

const no = (status, allow) => new Response(null, { status, headers: allow ? { Allow: allow } : {} });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url), m = request.method;
    if (pathname === '/api/e') {
      if (m === 'POST') return collect({ request, env, ctx });
      if (m === 'OPTIONS') return collectOptions();
      return no(405, 'POST, OPTIONS');
    }
    if (pathname === '/api/stats') return m === 'GET' ? stats({ request, env, ctx }) : no(405, 'GET');
    if (pathname.startsWith('/api/')) return no(404);
    return env.ASSETS.fetch(request);
  },
};
