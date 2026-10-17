#!/usr/bin/env python3
"""Prepara a geometria do site a partir das malhas do IBGE (rodar uma vez).
Gera: site/data/municipios.geojson (id numérico), site/data/ufs.geojson, site/data/centroides.json
"""
import json, sys
mun_src, uf_src, out = sys.argv[1:4]

def rnd(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 3), round(c[1], 3)]
    o = [rnd(x) for x in c]
    if isinstance(o[0][0], (int, float)):
        r = [o[0]]
        for p in o[1:]:
            if p != r[-1]:
                r.append(p)
        return r
    return o

def biggest_ring(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    best = max(polys, key=lambda p: len(p[0]))
    return best[0]

def center(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return [round((min(xs) + max(xs)) / 2, 3), round((min(ys) + max(ys)) / 2, 3)]

d = json.load(open(mun_src))
feats, cent = [], {}
for f in d["features"]:
    g = f["geometry"]; g["coordinates"] = rnd(g["coordinates"])
    cod = f["properties"]["codarea"]
    feats.append({"type": "Feature", "id": int(cod), "properties": {}, "geometry": g})
    cent[cod] = center(biggest_ring(g))
json.dump({"type": "FeatureCollection", "features": feats}, open(f"{out}/municipios.geojson", "w"), separators=(",", ":"))
json.dump(cent, open(f"{out}/centroides.json", "w"), separators=(",", ":"))

u = json.load(open(uf_src))
uf = []
for f in u["features"]:
    g = f["geometry"]; g["coordinates"] = rnd(g["coordinates"])
    uf.append({"type": "Feature", "properties": {"cod": f["properties"]["codarea"]}, "geometry": g})
json.dump({"type": "FeatureCollection", "features": uf}, open(f"{out}/ufs.geojson", "w"), separators=(",", ":"))
