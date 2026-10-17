#!/usr/bin/env bash
# Publica os dados ao vivo SEM R2 e sem cartão: reenvia o site/ pelo Cloudflare Workers (só sobem os arquivos que mudaram,
# ~10-15 s). Arquivos estáticos são servidos de graça e com cache do edge. Use como --after do collect.py.
# Pré-requisito: `npx wrangler login` uma vez (ou CLOUDFLARE_API_TOKEN no ambiente).
# Atenção: um push no GitHub durante a apuração publica o site SEM os dados (eles são gitignored) até a próxima rodada.
set -euo pipefail
cd "$(dirname "$0")/.."
npx -y wrangler@4 deploy 2>&1 | grep -E "Success|Uploaded|ERROR|error" || true
