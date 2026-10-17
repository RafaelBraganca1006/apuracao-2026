#!/usr/bin/env python3
"""Coleta a apuração do TSE por município e gera um único results.json compacto.

Uso:
  python3 collect.py --election 6257 --out ../site/data/turno1.json
  python3 collect.py --election 6258 --out ../site/data/live.json --loop 60
"""
import argparse, base64, json, os, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://resultados.tse.jus.br/oficial/ele2026"
CANDS = {"13": "LULA", "22": "FLAVIO BOLSONARO"}


SMALL = {"de", "da", "do", "das", "dos", "e"}


def pt_title(name):
    """Capitaliza nomes de município em português ('Rio do Pires', não 'Rio Do Pires')."""
    words = name.title().split(" ")
    return " ".join(w.lower() if i and w.lower() in SMALL else w for i, w in enumerate(words))


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 live-tracker"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                return None
            time.sleep(1 + i)


def jws(raw):
    p = raw.decode().split(".")[1]
    p += "=" * (-len(p) % 4)
    return json.loads(base64.urlsafe_b64decode(p))


def municipios(election):
    raw = get(f"{BASE}/{election}/config/mun-e{int(election):06d}-cm.json")
    out = []
    for uf in json.loads(raw)["abr"]:
        for m in uf["mu"]:
            out.append((uf["cd"], m["cd"], m["cdi"], m["nm"]))
    return out


def fetch_one(args):
    election, uf, cd, ibge, nm = args
    raw = get(f"{BASE}/{election}/dados/{uf}/{uf}{cd}-c0001-e{int(election):06d}-u.jws")
    if raw is None:
        return None
    try:
        d = jws(raw)
    except Exception:
        return None
    s, e, v = d["s"], d["e"], d["v"]
    votes, cands = {}, []
    for a in d["carg"][0]["agr"]:
        for p in a["par"]:
            for c in p["cand"]:
                votes[c["n"]] = int(c["vap"])
                cands.append({"n": c["n"], "nome": c["nmu"].title(), "sg": p["sg"], "sq": c["sqcand"]})
    ibge = ibge or f"zz{cd}"  # exterior não tem código IBGE
    row = [uf.upper(), pt_title(nm), int(s["ts"]), int(s["st"]), int(e["te"]),
           int(v["vv"]), votes.get("13", 0), votes.get("22", 0),
           int(v["vb"]) + int(v["vn"]), int(v["vb"]), int(v["vn"]), int(e["c"])]
    return ibge, row, d["hg"], d["dg"], votes, cands


def append_history(path, ok):
    """Acrescenta um ponto [ts, lula, flavio, secoes_apuradas, secoes] ao histórico (se mudou)."""
    l = sum(r[1][6] for r in ok); f = sum(r[1][7] for r in ok)
    ap = sum(r[1][3] for r in ok); sec = sum(r[1][2] for r in ok)
    try:
        hist = json.load(open(path))
    except Exception:
        hist = []
    if ap > 0 and (not hist or hist[-1][3:4] != [ap] or hist[-1][1:3] != [l, f]):
        hist.append([int(time.time()), l, f, ap, sec])
        hist = hist[-3000:]
        tmp = path + ".tmp"
        json.dump(hist, open(tmp, "w"), separators=(",", ":"))
        os.replace(tmp, path)


SNAP_STATE = {"last_ts": 0, "last_ap": -1}


def save_snapshot(dirpath, ok, every):
    """Grava uma "foto" compacta da apuração (votos de cada candidato e seções apuradas por município).
    É o que permite o seletor de horário do site. Só grava se algo mudou e a cada `every` segundos (e na última)."""
    ap = sum(r[1][3] for r in ok)
    sec = sum(r[1][2] for r in ok)
    now = int(time.time())
    if ap == 0 or ap == SNAP_STATE["last_ap"]:
        return
    if now - SNAP_STATE["last_ts"] < every and ap < sec:
        return
    os.makedirs(dirpath, exist_ok=True)
    byid = {r[0]: r[1] for r in ok}
    ids = sorted(byid)                                   # mesma ordem que o site usa (ordenação de strings)
    snap = {"l": [byid[i][6] for i in ids], "f": [byid[i][7] for i in ids], "a": [byid[i][3] for i in ids]}
    path = os.path.join(dirpath, f"{now}.json")
    with open(path + ".tmp", "w") as f:
        json.dump(snap, f, separators=(",", ":"))
    os.replace(path + ".tmp", path)
    idx_path = os.path.join(dirpath, "index.json")
    try:
        idx = json.load(open(idx_path))
    except Exception:
        idx = []
    idx.append(now)
    with open(idx_path + ".tmp", "w") as f:
        json.dump(sorted(set(idx)), f, separators=(",", ":"))
    os.replace(idx_path + ".tmp", idx_path)
    SNAP_STATE.update(last_ts=now, last_ap=ap)
    print(f"  foto {now}.json ({os.path.getsize(path) // 1024} KB)", flush=True)


def run(election, out, workers=48, history=None, prev=None, snapshots=None, snap_every=150):
    muns = municipios(election)
    jobs = [(election, uf, cd, ibge, nm) for uf, cd, ibge, nm in muns]
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(fetch_one, jobs))
    got_all = [r for r in res if r]
    cands = sorted(got_all[0][5], key=lambda c: int(c["n"])) if got_all else []
    order = [c["n"] for c in cands]
    ok = []
    for ibge, row, hg, dg, votes, _ in got_all:
        ok.append((ibge, row + [[votes.get(n, 0) for n in order]], hg, dg))
    # se algum município falhar nesta rodada, mantém o último valor bom em vez de "sumir" do mapa
    if prev:
        got = {r[0] for r in ok}
        for k, v in prev.items():
            if k not in got:
                ok.append((k, v, "", ""))
    data = {
        "meta": {
            "election": election,
            "turno": 2 if election == "6258" else 1,
            "updated": max((f"{r[3]} {r[2]}" for r in ok if r[3]), default=None),
            "fetched_at": int(time.time()),
            "municipios_ok": len(ok),
            "municipios_total": len(jobs),
            "cols": ["uf", "nome", "secoes", "secoes_apuradas", "aptos", "validos", "lula", "flavio",
                     "brancos_nulos", "brancos", "nulos", "comparecimento", "votos"],
            "candidatos": cands,  # "votos" (última coluna) segue a ordem desta lista
        },
        "mun": {r[0]: r[1] for r in ok},
    }
    tmp = out + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out)  # escrita atômica: o site nunca lê arquivo pela metade
    if history:
        append_history(history, ok)
    if snapshots:
        save_snapshot(snapshots, ok, snap_every)
    tot = sum(r[1][3] for r in ok), sum(r[1][2] for r in ok)
    print(f"[{time.strftime('%H:%M:%S')}] {election}: {len(ok)}/{len(jobs)} municípios, seções {tot[0]}/{tot[1]}", flush=True)
    return data["mun"]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--election", default="6258")
    ap.add_argument("--out", required=True)
    ap.add_argument("--loop", type=int, default=0, help="repetir a cada N segundos")
    ap.add_argument("--snapshots", help="pasta das fotos da apuração para o seletor de horário (ex.: ../site/data/snaps)")
    ap.add_argument("--snap-every", type=int, default=150, help="intervalo mínimo entre fotos, em segundos")
    ap.add_argument("--after", help="comando shell executado após cada rodada bem-sucedida (ex.: upload para o bucket)")
    ap.add_argument("--history", help="arquivo JSON com a evolução da apuração (ex.: ../site/data/history.json)")
    a = ap.parse_args()
    prev = None
    while True:
        try:
            prev = run(a.election, a.out, history=a.history, prev=prev, snapshots=a.snapshots, snap_every=a.snap_every)
            if a.after:
                subprocess.run(a.after, shell=True, check=False, timeout=120)
        except Exception as e:  # uma rodada ruim não derruba o loop
            print(f"[erro] {e}", flush=True)
        if not a.loop:
            break
        time.sleep(a.loop)
