#!/usr/bin/env bash
# Envia os dados ao vivo para o bucket do Cloudflare R2 (use como --after do collect.py).
# Pré-requisito: `rclone config` com um remote do tipo S3 / Cloudflare R2 chamado "r2" (veja DEPLOY.md).
# Uso:  collector/upload_r2.sh [bucket]     (padrão: apuracao-dados)
set -euo pipefail
BUCKET="${1:-${R2_BUCKET:-apuracao-dados}}"
cd "$(dirname "$0")/../site/data"
H='Cache-Control: public, max-age=15, s-maxage=15'
rclone copyto live.json    "r2:$BUCKET/live.json"    --header-upload "$H" --header-upload 'Content-Type: application/json'
rclone copyto history.json "r2:$BUCKET/history.json" --header-upload "$H" --header-upload 'Content-Type: application/json'
if [ -d snaps ]; then
  rclone copy snaps "r2:$BUCKET/snaps" --header-upload 'Cache-Control: public, max-age=86400' --header-upload 'Content-Type: application/json'
fi
