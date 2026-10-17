// Coleta de eventos. Chamado por site/beacon.js (POST /api/e). Não guarda IP nem cookies.
import { device, os, source } from '../_lib/classify.js';

const EVENTS = new Set(['pageview', 'beat', 'click']);
const clip = (s, n = 64) => String(s ?? '').slice(0, n);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  if (!b || !EVENTS.has(b.e) || !b.v || !b.s) return new Response(null, { status: 400 });

  const cf = request.cf || {}, ua = request.headers.get('user-agent') || '';
  const own = new URL(request.url).hostname;
  const secs = b.e === 'beat' ? Math.min(60, Math.max(0, +b.t || 0)) : 0;

  env.AE?.writeDataPoint({
    indexes: [clip(b.v, 32)],                                   // visitante anônimo (id aleatório do navegador)
    blobs: [
      b.e,                                                      // 1 evento
      clip(b.p, 32),                                            // 2 página
      source(clip(b.r, 80), clip(b.u, 40), own),                // 3 origem
      device(ua),                                               // 4 aparelho
      os(ua),                                                   // 5 sistema
      clip(cf.country || '??', 2),                              // 6 país
      clip(cf.regionCode || '', 8),                             // 7 estado (UF)
      clip(cf.city || '', 48),                                  // 8 cidade
      clip(cf.asOrganization || '', 64),                        // 9 organização da rede
      clip(b.x || '', 24),                                      // 10 detalhe (ex.: qual botão)
      clip(b.s, 32),                                            // 11 sessão
    ],
    doubles: [secs, +cf.asn || 0],                              // 1 segundos de tela · 2 ASN
  });
  return new Response(null, { status: 204 });
}

export const onRequestOptions = () => new Response(null, { status: 204 });
