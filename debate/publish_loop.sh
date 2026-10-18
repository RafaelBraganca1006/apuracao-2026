#!/usr/bin/env bash
# Publica data-worker/public (debate.json) no Cloudflare a cada ~40 s. Uso: ./publish_loop.sh
cd "$(dirname "$0")/.."
while true; do
  collector/publish_live.sh >> debate/out/publish.log 2>&1
  sleep 40
done
