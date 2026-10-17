#!/usr/bin/env bash
# Publica os dados ao vivo SEM R2 e sem cartão: reenvia data-worker/public/ pelo Cloudflare Workers (projeto "apuracao-dados").
# Só sobem os arquivos que mudaram (~10-13 s). Arquivos estáticos são servidos de graça e com cache do edge. Use como --after do collect.py.
# Pré-requisito: `npx wrangler login` uma vez (ou CLOUDFLARE_API_TOKEN no ambiente).
set -euo pipefail
cd "$(dirname "$0")/../data-worker"
npx -y wrangler@4 deploy 2>&1 | grep -E "Success|Uploaded|ERROR|error|https://" || true
