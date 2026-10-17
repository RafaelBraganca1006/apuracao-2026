#!/usr/bin/env python3
"""Reconstitui a apuração do 1º turno a partir dos Boletins de Urna (dado aberto do TSE).

Cada linha do boletim traz a hora em que a urna foi recebida (DT_BU_RECEBIDO) e os votos de cada
candidato naquela seção. Somando as seções recebidas até cada horário, obtemos "fotos" da totalização
ao longo da noite, no mesmo formato usado pelo replay do site.

Os zips são lidos em fluxo (curl | funzip | grep) e nunca gravados em disco.

Uso:
  python3 boletim.py --out ../site/data            # gera snaps1/, history1.json
  python3 boletim.py --out ../site/data --only AC,ZZ   # teste rápido com alguns estados
"""
import argparse, csv, io, json, os, subprocess, sys, time, urllib.request
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timedelta, timezone

URL = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb/bweb_1t_{uf}_051020261403.zip"
CFG = "https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json"
UFS = ["SP", "RJ", "MG", "BA", "PR", "RS", "PE", "CE", "GO", "PA", "MA", "SC", "AM", "ES", "PB", "RN", "DF", "PI", "MT", "MS", "SE", "RO", "AL", "TO", "AC", "AP", "RR", "ZZ"]
BRT = timezone(timedelta(hours=-3))
BUCKET = 300  # agrega em janelas de 5 min (a precisão do horário do boletim é de segundos)

# colunas do CSV (ver cabeçalho do arquivo)
C_UF, C_MUN, C_ZONA, C_SECAO, C_CARGO, C_RECEB, C_TIPO, C_VOTAVEL, C_VOTOS = 10, 11, 13, 14, 17, 21, 28, 29, 31


def muni_ids():
    """(UF, código TSE) -> id usado no site (IBGE, ou 'zz'+código no exterior)."""
    cfg = json.load(urllib.request.urlopen(CFG, timeout=60))
    out = {}
    for uf in cfg["abr"]:
        for m in uf["mu"]:
            out[(uf["cd"].upper(), int(m["cd"]))] = m["cdi"] or f"zz{m['cd']}"
    return out


def fetch_zip(uf, dest):
    """Baixa com retomada (-C -) e aborta transferências paradas (<50 KB/s por 30 s), tentando de novo."""
    for attempt in range(8):
        r = subprocess.run(["curl", "-sL", "--fail", "-C", "-", "--speed-time", "30", "--speed-limit", "50000", "-o", dest, URL.format(uf=uf)])
        if r.returncode == 0:
            return
        print(f"  {uf}: tentativa {attempt + 1} falhou (curl {r.returncode}), retomando…", flush=True)
        time.sleep(3)
    raise RuntimeError(f"download de {uf} falhou")


def process_uf(args):
    uf, cand_idx, ids, tmpdir, cache = args
    t0 = time.time()
    cpath = os.path.join(cache, f"{uf}.json")
    if os.path.exists(cpath):                       # já processado numa rodada anterior
        d = json.load(open(cpath))
        return uf, {(b, m): v for b, m, v in d["acc"]}, d["nsec"], 0.0
    dest = os.path.join(tmpdir, f"bweb_1t_{uf}.zip")
    fetch_zip(uf, dest)
    import zipfile                                   # suporta Zip64 (os de SP/RJ/MG são enormes) e confere o CRC ao ler tudo
    with zipfile.ZipFile(dest) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        with z.open(name) as raw:
            txt = io.TextIOWrapper(raw, encoding="latin-1", newline="")
            lines = (ln for ln in txt if '"Presidente"' in ln)       # filtro barato antes de parsear o CSV
            acc, nsec = _read_uf(csv.reader(lines, delimiter=";"), cand_idx, ids)
    os.remove(dest)                                  # não guardamos os zips
    json.dump({"acc": [[b, m, v] for (b, m), v in acc.items()], "nsec": nsec}, open(cpath, "w"))
    return uf, acc, nsec, time.time() - t0


def safe_process(args):
    """Um estado que falha não derruba os outros; a rodada seguinte retoma pelo cache."""
    try:
        return process_uf(args)
    except Exception as e:                           # noqa: BLE001
        return args[0], None, 0, f"{type(e).__name__}: {e}"


def _read_uf(rd, cand_idx, ids):
    ncand = len(cand_idx)
    # as linhas do arquivo NÃO vêm agrupadas por seção: acumula tudo por seção antes de agregar
    secs = {}                                      # (uf, município, zona, seção) -> [horário, {candidato: votos}]
    tcache = {}
    for row in rd:
        if len(row) < 32 or row[C_CARGO] != "Presidente":
            continue
        key = (row[C_UF], int(row[C_MUN]), row[C_ZONA], row[C_SECAO])
        sec = secs.get(key)
        if sec is None:
            s = row[C_RECEB]
            if s not in tcache:
                tcache[s] = int(datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=BRT).timestamp())
            sec = secs[key] = [tcache[s], {}]
        if row[C_TIPO] == "Nominal" and row[C_VOTAVEL] in cand_idx:
            sec[1][cand_idx[row[C_VOTAVEL]]] = int(row[C_VOTOS])      # atribui (não soma): evita contar duas vezes um boletim repetido
    acc = defaultdict(lambda: [0] * (ncand + 1))   # (janela, id do município) -> votos por candidato + nº de seções
    nsec = 0
    for (u, cd, _z, _s), (ts, votes) in secs.items():
        mid = ids.get((u, cd))
        if mid is None:
            continue
        a = acc[(ts // BUCKET * BUCKET, mid)]
        for i, v in votes.items():
            a[i] += v
        a[ncand] += 1
        nsec += 1
    return dict(acc), nsec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="pasta de saída (ex.: ../site/data)")
    ap.add_argument("--only", help="lista de UFs separadas por vírgula (teste)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--tmp", default=None, help="pasta temporária para os zips (apagados após o uso) e cache por estado")
    a = ap.parse_args()

    t1 = json.load(open(os.path.join(a.out, "turno1.json")))
    cands = [c["n"] for c in t1["meta"]["candidatos"]]       # ordem do vetor de votos do site
    cand_idx = {n: i for i, n in enumerate(cands)}
    ids = muni_ids()
    import tempfile
    tmpdir = a.tmp or tempfile.mkdtemp(prefix="boletim_")
    cache = os.path.join(tmpdir, "cache")
    os.makedirs(cache, exist_ok=True)
    ufs = a.only.split(",") if a.only else UFS
    ncand = len(cands)

    merged = defaultdict(lambda: [0] * (ncand + 1))
    t0 = time.time()
    with ProcessPoolExecutor(a.workers) as ex:
        failed = []
        for uf, acc, nsec, dt in ex.map(safe_process, [(u, cand_idx, ids, tmpdir, cache) for u in ufs]):
            if acc is None:
                failed.append(uf); print(f"[{time.time() - t0:6.0f}s] {uf}: FALHOU — {dt}", flush=True); continue
            for k, v in acc.items():
                m = merged[k]
                for i, x in enumerate(v):
                    m[i] += x
            print(f"[{time.time() - t0:6.0f}s] {uf}: {nsec:,} seções em {dt:.0f}s", flush=True)

    if failed:
        sys.exit(f"estados com falha: {','.join(failed)}. Rode de novo: os que deram certo ficam em cache.")

    # ---- fotos cumulativas ----
    order = sorted(t1["mun"])                                  # mesma ordenação (de strings) usada pelo site
    pos = {m: i for i, m in enumerate(order)}
    buckets = sorted({b for b, _ in merged})
    first, last = buckets[0], buckets[-1]
    # passo de 5 min até 21h de Brasília, depois de 15 em 15 min
    cut = int(datetime(2026, 10, 4, 21, 0, tzinfo=BRT).timestamp())
    times, t = [], first + BUCKET
    while t < last:
        times.append(t)
        t += BUCKET if t < cut else 3 * BUCKET
    # corta a linha do tempo quando 99,9% das seções já chegaram: as últimas horas só trazem boletins esparsos
    tot_secs = sum(v[ncand] for v in merged.values())
    acc_s, cutoff = 0, last
    by_b = defaultdict(int)
    for (b, _m), v in merged.items():
        by_b[b] += v[ncand]
    for b in buckets:
        acc_s += by_b[b]
        if acc_s >= 0.999 * tot_secs:
            cutoff = b
            break
    times = [t for t in times if t <= cutoff]
    times.append(cutoff + BUCKET)                             # foto final: inclui tudo o que ainda chegou depois
    by_bucket = defaultdict(list)
    for (b, m), v in merged.items():
        by_bucket[b].append((pos[m], v))

    snapdir = os.path.join(a.out, "snaps1")
    os.makedirs(snapdir, exist_ok=True)
    cum_v = [[0] * len(order) for _ in range(ncand)]
    cum_a = [0] * len(order)
    sec_total = sum(r[2] for r in t1["mun"].values())
    hist, bi = [], 0
    for T in times:
        while bi < len(buckets) and (buckets[bi] < T or T == times[-1]):
            for p, v in by_bucket[buckets[bi]]:
                for i in range(ncand):
                    cum_v[i][p] += v[i]
                cum_a[p] += v[ncand]
            bi += 1
        # na foto final, as seções sem boletim no arquivo (zeradas) entram como apuradas, igual ao painel oficial
        snap = {"v": cum_v, "a": [t1["mun"][m][3] for m in order] if T == times[-1] else cum_a}
        with open(os.path.join(snapdir, f"{T}.json"), "w") as f:
            json.dump(snap, f, separators=(",", ":"))
        l, fl = sum(cum_v[cand_idx["13"]]), sum(cum_v[cand_idx["22"]])
        hist.append([T, l, fl, sum(snap["a"]), sec_total, sum(sum(c) for c in cum_v)])
    json.dump(times, open(os.path.join(snapdir, "index.json"), "w"), separators=(",", ":"))
    json.dump(hist, open(os.path.join(a.out, "history1.json"), "w"), separators=(",", ":"))

    # ---- conferência com o resultado oficial (turno1.json) ----
    if not a.only:
        for n in ("13", "22", "70"):
            off = sum(r[12][cand_idx[n]] for r in t1["mun"].values())
            got = sum(cum_v[cand_idx[n]])
            print(f"conferência candidato {n}: reconstituído {got:,} · oficial {off:,} · {'OK' if got == off else 'DIFERE'}")
        print(f"seções: reconstituído {sum(cum_a):,} · oficial {sec_total:,}")
    print(f"{len(times)} fotos em {snapdir} ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
