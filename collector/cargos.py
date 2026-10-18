#!/usr/bin/env python3
"""Coleta governador, senador, deputado federal e estadual (distrital no DF) do TSE.

Gera, por cargo, um `index.json` (visão do Brasil) e um arquivo por estado (visão do estado, carregado sob demanda).
Formato dos arquivos: docs/dados.md.

Uso:
  python3 collector/cargos.py --cargo governador --turno 1 --out site/data            # resultado final do 1º turno
  python3 collector/cargos.py --cargo dep_federal --turno 1 --out site/data
  python3 collector/cargos.py --cargo governador --turno 2 --out data-worker/public --loop 45   # ao vivo em 25/10
"""
import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tse  # noqa: E402

ELECTION = {1: "6259", 2: "6260"}          # eleições estaduais por turno (presidente tem outros códigos)
CARGOS = {
    "governador": {"code": 3, "kind": "maj"},
    "senador": {"code": 5, "kind": "maj"},
    "dep_federal": {"code": 6, "kind": "prop"},
    "dep_estadual": {"code": 7, "kind": "prop"},   # no DF o cargo é deputado distrital (código 8)
}
TOP_CANDS = 150      # deputados: votos por município só para os eleitos + os mais votados, até este total por estado


def cargo_code(cargo, uf):
    return 8 if cargo == "dep_estadual" and uf == "df" else CARGOS[cargo]["code"]


def status_of(st):
    """0 = não eleito/suplente · 1 = eleito (inclui QP e média) · 2 = vai ao 2º turno."""
    if st.startswith("Eleito"):
        return 1
    return 2 if st.startswith("2º") else 0


def geral(d):
    s, e, v = d["s"], d["e"], d["v"]
    return {"secoes": int(s["ts"]), "ap": int(s["st"]), "aptos": int(e["te"]), "comp": int(e["c"]),
            "val": int(v["vv"]), "vb": int(v["vb"]), "vn": int(v["vn"])}


def updated(d):
    return f"{d['dg']} {d['hg']}"


def cands_of(d):
    """Candidatos do arquivo (majoritários e proporcionais): dicts com número, nome, partido, votos e situação."""
    out = []
    for a in d["carg"][0]["agr"]:
        for p in a["par"]:
            for c in p["cand"]:
                vs = c.get("vs") or []
                out.append({"n": c["n"], "nome": tse.pt_title(c["nmu"]), "sg": p["sg"], "sq": c["sqcand"],
                            "votos": int(c["vap"]), "st": status_of(c["st"]),
                            "vice": tse.pt_title(vs[0]["nmu"]) if vs else ""})
    return out


def parties_of(d):
    """Partidos do arquivo de um cargo proporcional: número, sigla e total (nominais + legenda)."""
    out = []
    for a in d["carg"][0]["agr"]:
        for p in a["par"]:
            out.append({"n": p["n"], "sg": p["sg"], "tv": int(p["tvtn"])})
    return out


def _fetch(args):
    election, uf, cargo_n, cd = args
    raw = tse.get(tse.url_mun(election, uf, cd, cargo_n))
    if raw is None:
        return None
    try:
        return tse.jws(raw)
    except Exception:
        return None


def _fetch_state(args):
    election, uf, cargo_n = args
    raw = tse.get(tse.url_uf(election, uf, cargo_n))
    if raw is None:
        return None
    try:
        return tse.jws(raw)
    except Exception:
        return None


def collect(cargo, turno, workers=48, only=None, prev=None):
    """Baixa o cargo em todos os estados. Devolve {UF: dados do estado} (formato em docs/dados.md)."""
    election, kind = ELECTION[turno], CARGOS[cargo]["kind"]
    muns = [m for m in tse.municipios(election) if m[0] != "zz" and (not only or m[0] in only)]
    ufs = sorted({m[0] for m in muns})
    with ThreadPoolExecutor(workers) as ex:
        sdocs = dict(zip(ufs, ex.map(_fetch_state, [(election, uf, cargo_code(cargo, uf)) for uf in ufs])))
    ufs = [uf for uf in ufs if sdocs[uf]]
    # estrutura de cada estado, vinda do arquivo agregado do estado
    st = {}
    for uf in ufs:
        d = sdocs[uf]
        cs = cands_of(d)
        if kind == "maj":
            cs.sort(key=lambda c: (-c["votos"], int(c["n"])))        # a ordem do arquivo = ordem dos vetores de votos
            st[uf] = {"cands": cs, "order": [c["n"] for c in cs]}
        else:
            ps = sorted(parties_of(d), key=lambda p: -p["tv"])
            top = sorted(cs, key=lambda c: (-c["st"], -c["votos"]))[:TOP_CANDS]
            st[uf] = {"cands": cs, "parties": ps, "porder": {p["n"]: i for i, p in enumerate(ps)},
                      "sel": {c["n"]: i for i, c in enumerate(top)}, "top": top}
    jobs = [(election, uf, cargo_code(cargo, uf), cd, ibge, nm) for uf, cd, ibge, nm in muns if uf in st]
    with ThreadPoolExecutor(workers) as ex:
        docs = list(ex.map(lambda j: _fetch(j[:4]), jobs))
    mun = {uf: {} for uf in st}
    missing = 0
    for (_, uf, _, cd, ibge, nm), d in zip(jobs, docs):
        key = ibge or f"zz{cd}"
        if d is None:
            missing += 1
            if prev and key in prev.get(uf.upper(), {}).get("mun", {}):
                mun[uf][key] = prev[uf.upper()]["mun"][key]          # mantém o último valor bom
            continue
        g = geral(d)
        base = [tse.pt_title(nm), g["secoes"], g["ap"], g["aptos"], g["comp"], g["val"], g["vb"], g["vn"]]
        if kind == "maj":
            votes = {c["n"]: c["votos"] for c in cands_of(d)}
            mun[uf][key] = base + [[votes.get(n, 0) for n in st[uf]["order"]]]
        else:
            s = st[uf]
            pv = [0] * len(s["parties"])
            for p in parties_of(d):
                if p["n"] in s["porder"]:
                    pv[s["porder"][p["n"]]] = p["tv"]
            cv = []
            for c in cands_of(d):
                i = s["sel"].get(c["n"])
                if i is not None and c["votos"]:
                    cv += [i, c["votos"]]
            mun[uf][key] = base + [pv, cv]
    out = {}
    for uf in st:
        d, s = sdocs[uf], st[uf]
        item = {"vagas": int(d["carg"][0]["nv"]), "updated": updated(d), "total": geral(d), "mun": mun[uf]}
        if kind == "maj":
            item["cands"] = s["cands"]
        else:
            seats = {}
            for c in s["cands"]:
                if c["st"] == 1:
                    seats[c["sg"]] = seats.get(c["sg"], 0) + 1
            item["parties"] = [[p["sg"], p["n"], p["tv"], seats.get(p["sg"], 0)] for p in s["parties"]]
            item["cands"] = [[c["n"], c["nome"], c["sg"], c["votos"], c["st"]] for c in sorted(s["cands"], key=lambda c: -c["votos"])]
            item["top"] = [c["n"] for c in s["top"]]
        out[uf.upper()] = item
    print(f"[{time.strftime('%H:%M:%S')}] {cargo} {turno}º turno: {len(out)} estados, "
          f"{sum(len(v['mun']) for v in out.values())}/{len(jobs)} municípios" + (f" ({missing} falharam)" if missing else ""), flush=True)
    return out


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)               # escrita atômica: o site nunca lê arquivo pela metade


def meta(cargo, turno):
    return {"cargo": cargo, "turno": turno, "election": ELECTION[turno], "fetched_at": int(time.time())}


def write_split(out, cargo, turno, data):
    """Um arquivo por estado + index.json (1º turno: resultado final, carregado sob demanda)."""
    kind = CARGOS[cargo]["kind"]
    base = os.path.join(out, {"governador": "gov", "senador": "sen", "dep_federal": "depfed", "dep_estadual": "depest"}[cargo] + str(turno))
    index = {"meta": meta(cargo, turno), "ufs": {}}
    for uf, d in data.items():
        m = {**meta(cargo, turno), "uf": uf, "vagas": d["vagas"], "updated": d["updated"], "total": d["total"]}
        if kind == "maj":
            cs = [{k: c[k] for k in ("n", "nome", "sg", "sq", "votos", "st", "vice")} for c in d["cands"]]
            write_json(os.path.join(base, f"{uf}.json"), {"meta": m, "cands": cs, "mun": d["mun"]})
            index["ufs"][uf] = {"vagas": d["vagas"], "updated": d["updated"], "total": d["total"], "cands": cs}
        else:
            mun = {k: v[:-1] for k, v in d["mun"].items()}                       # sem os votos de candidatos
            write_json(os.path.join(base, f"{uf}.json"), {"meta": m, "parties": d["parties"], "cands": d["cands"], "mun": mun})
            write_json(os.path.join(base, f"{uf}-c.json"),
                       {"ids": d["top"], "mun": {k: v[-1] for k, v in d["mun"].items() if v[-1]}})
            index["ufs"][uf] = {"vagas": d["vagas"], "updated": d["updated"], "total": d["total"], "parties": d["parties"]}
    write_json(os.path.join(base, "index.json"), index)
    print(f"  gravado em {base}/ ({len(data)} estados)", flush=True)


def write_unified(out, cargo, turno, data):
    """2º turno ao vivo: um único arquivo (poucos estados), lido a cada ~30 s pelo site."""
    ufs = {}
    for uf, d in data.items():
        cs = [{k: c[k] for k in ("n", "nome", "sg", "sq", "votos", "st", "vice")} for c in d["cands"]]
        ufs[uf] = {"vagas": d["vagas"], "updated": d["updated"], "total": d["total"], "cands": cs, "mun": d["mun"]}
    write_json(os.path.join(out, {"governador": "gov", "senador": "sen"}[cargo] + f"{turno}.json"), {"meta": meta(cargo, turno), "ufs": ufs})


def download_photos(out, data, election):
    """Fotos dos candidatos majoritários (cerca de 7 KB cada), em site/img/c/{sq}.jpg."""
    todo = [(uf, c["sq"]) for uf, d in data.items() for c in d["cands"] if not os.path.exists(os.path.join(out, "c", f"{c['sq']}.jpg"))]
    os.makedirs(os.path.join(out, "c"), exist_ok=True)

    def one(t):
        uf, sq = t
        raw = tse.get(tse.url_foto(election, uf.lower(), sq), tries=2)
        if raw and raw[:2] == b"\xff\xd8":
            with open(os.path.join(out, "c", f"{sq}.jpg"), "wb") as f:
                f.write(raw)
            return 1
        return 0
    with ThreadPoolExecutor(16) as ex:
        n = sum(ex.map(one, todo))
    print(f"  fotos: {n}/{len(todo)} baixadas", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cargo", required=True, choices=sorted(CARGOS))
    ap.add_argument("--turno", type=int, default=1, choices=(1, 2))
    ap.add_argument("--out", required=True, help="pasta de saída (ex.: site/data; ao vivo: data-worker/public)")
    ap.add_argument("--loop", type=int, default=0, help="repetir a cada N segundos (2º turno ao vivo)")
    ap.add_argument("--uf", help="só estes estados, separados por vírgula (teste)")
    ap.add_argument("--photos", metavar="IMG_DIR", help="baixa as fotos dos candidatos majoritários para esta pasta (ex.: site/img)")
    ap.add_argument("--after", help="comando shell executado após cada rodada (ex.: publicar o projeto de dados)")
    a = ap.parse_args()
    only = {u.strip().lower() for u in a.uf.split(",")} if a.uf else None
    prev = None
    while True:
        try:
            prev = collect(a.cargo, a.turno, only=only, prev=prev)
            if a.turno == 2:
                write_unified(a.out, a.cargo, a.turno, prev)
            else:
                write_split(a.out, a.cargo, a.turno, prev)
            if a.photos and CARGOS[a.cargo]["kind"] == "maj":
                download_photos(a.photos, prev, ELECTION[1])
            if a.after:
                import subprocess
                subprocess.run(a.after, shell=True, check=False, timeout=120)
        except Exception as e:      # uma rodada ruim não derruba o loop
            print(f"[erro] {e}", flush=True)
            if not a.loop:
                raise
        if not a.loop:
            break
        time.sleep(a.loop)


if __name__ == "__main__":
    main()
