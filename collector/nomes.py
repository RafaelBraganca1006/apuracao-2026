#!/usr/bin/env python3
"""Gera site/data/municipios-nomes.json ({ibge: [uf, nome, eleitores]}) a partir do 1º turno do presidente.

É o índice da busca por cidade nas páginas de cargos (a malha do IBGE não traz nomes). Rodar uma vez.
"""
import json
import os

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "data")
src = json.load(open(os.path.join(root, "turno1.json")))
out = {k: [v[0], v[1], v[4]] for k, v in src["mun"].items() if not k.startswith("zz")}
with open(os.path.join(root, "municipios-nomes.json"), "w") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(len(out), "municípios")
