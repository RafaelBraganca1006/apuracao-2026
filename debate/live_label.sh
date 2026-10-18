#!/usr/bin/env bash
# Rotula as falas novas e regera debate.json (local e no projeto de dados), em loop. Uso: ./live_label.sh
cd "$(dirname "$0")"
while true; do
  MIN_START=540 .venv/bin/python speakers.py assign > out/assign.log 2>&1 \
    && .venv/bin/python build_debate.py --start 540 --out ../data-worker/public/debate.json >> out/build.log 2>&1 \
    && cp ../data-worker/public/debate.json ../site/data/debate.json
  sleep 10
done
