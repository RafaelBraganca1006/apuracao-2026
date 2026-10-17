#!/usr/bin/env python3
"""Gera site/data/brasil-pontos.json: um ponto por município (lon, lat, votos válidos, margem Lula-Flávio) para o fundo da home."""
import json, pathlib
D = pathlib.Path(__file__).resolve().parent.parent / 'site' / 'data'
cent = json.load(open(D / 'centroides.json'))
mun = json.load(open(D / 'turno1.json'))['mun']
out = []
for cod, r in mun.items():
    c = cent.get(cod)
    if not c or r[0] == 'ZZ':
        continue
    val, lula, flavio = r[5], r[6], r[7]
    if val <= 0:
        continue
    out.append([round(c[0], 2), round(c[1], 2), val, round((lula - flavio) / val, 3)])
json.dump(out, open(D / 'brasil-pontos.json', 'w'), separators=(',', ':'))
print(len(out), 'pontos')
