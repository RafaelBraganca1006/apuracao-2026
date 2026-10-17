#!/usr/bin/env python3
"""Coleta as pesquisas de 2º turno (Lula x Flávio Bolsonaro) e grava site/data/pesquisas.json.

Fonte: tabelas da Wikipedia (en) "Opinion polling for the 2026 Brazilian presidential election", seção
"Second round", que reúnem as pesquisas dos institutos com link para a matéria original de cada uma.
Rodar de novo para atualizar:  python3 pesquisas.py --out ../site/data/pesquisas.json
"""
import argparse, json, re, sys, time, urllib.request
from datetime import datetime, timezone

URL = "https://en.wikipedia.org/w/index.php?title=Opinion_polling_for_the_2026_Brazilian_presidential_election&action=raw"
MESES = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def baixar():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (tracker eleicao; leitura de tabela publica)"})
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8")


def limpar(txt):
    """Remove refs, templates, links e formatação do wikitexto de uma célula."""
    txt = re.sub(r"<ref[^>]*?/>", "", txt)
    txt = re.sub(r"<ref[^>]*>.*?</ref>", "", txt, flags=re.S)
    txt = re.sub(r"\{\{efn[^}]*\}\}", "", txt)
    txt = re.sub(r"\{\{n/a\}\}", "", txt, flags=re.I)
    txt = re.sub(r"\{\{[^}]*\}\}", "", txt)
    txt = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", txt)
    txt = txt.replace("''", "").replace("<br />", " ").replace("<br/>", " ")
    txt = re.sub(r"<[^>]+>", "", txt)
    return txt.strip()


def numero(txt):
    m = re.search(r"\d+(?:[.,]\d+)?", txt.replace(",", "") if re.search(r"\d,\d{3}\b", txt) else txt.replace(",", "."))
    return float(m.group(0)) if m else None


REFS = {}


def indexar_refs(wikitext):
    """A Wikipedia define cada <ref name="x">…url…</ref> uma vez e depois só cita <ref name="x" />."""
    for m in re.finditer(r'<ref\s+name\s*=\s*"?([^">/]+?)"?\s*>(.*?)</ref>', wikitext, flags=re.S):
        u = re.search(r"https?://[^\s|}\]]+", m.group(2))
        if u:
            REFS.setdefault(m.group(1).strip(), u.group(0).rstrip(".,"))


def url_ref(celula):
    m = re.search(r"https?://[^\s|}\]]+", celula)
    if m:
        return m.group(0).rstrip(".,")
    n = re.search(r'<ref\s+name\s*=\s*"?([^">/]+?)"?\s*/>', celula)
    return REFS.get(n.group(1).strip()) if n else None


def parse_periodo(txt, ano):
    """'14–16 Oct' | '30 Sep–3 Oct' | '3 Oct' -> (início, fim) como ISO."""
    txt = txt.replace("–", "-").replace("—", "-")
    partes = [p.strip() for p in txt.split("-")]
    fim = partes[-1]
    m = re.match(r"(\d{1,2})\s*([A-Za-z]{3})?", fim)
    if not m:
        return None, None
    # o mês do fim pode vir só na última parte; o início herda
    mes_fim = None
    mm = re.search(r"([A-Za-z]{3})", fim)
    if mm:
        mes_fim = MESES.get(mm.group(1).title())
    if not mes_fim:
        return None, None
    dia_fim = int(m.group(1))
    ini = partes[0]
    mi = re.match(r"(\d{1,2})\s*([A-Za-z]{3})?", ini)
    dia_ini = int(mi.group(1)) if mi else dia_fim
    mes_ini = MESES.get(mi.group(2).title()) if mi and mi.group(2) else mes_fim
    ano_ini = ano if mes_ini <= mes_fim else ano - 1
    try:
        return datetime(ano_ini, mes_ini, dia_ini).date().isoformat(), datetime(ano, mes_fim, dia_fim).date().isoformat()
    except ValueError:
        return None, None


def celulas_da_linha(linhas):
    """Cada linha do wikitexto que começa com '|' (e não '|-') é uma célula; devolve (atributos, conteúdo)."""
    cels = []
    for ln in linhas:
        if ln.startswith("|-") or ln.startswith("|}") or ln.startswith("{|") or not ln.startswith("|"):
            continue
        corpo = ln[1:]
        m = re.match(r"\s*((?:rowspan|colspan|style|class|align|bgcolor)[^|]*)\|(?!\|)(.*)$", corpo)
        if m and not corpo.lstrip().startswith("[["):
            attrs, cont = m.group(1), m.group(2)
        else:
            attrs, cont = "", corpo
        cels.append((attrs, cont))
    return cels


def tabelas(wikitext):
    linhas = wikitext.split("\n")
    i0 = next(i for i, l in enumerate(linhas) if l.strip() == "==Second round==")
    ate = next((i for i in range(i0, len(linhas)) if linhas[i].startswith("==See also")), len(linhas))
    cab, atual, tab = "", None, []
    for ln in linhas[i0:ate]:
        if ln.startswith("="):
            cab = ln.strip("= ").strip()
        if ln.startswith("{|"):
            atual = {"cab": cab, "linhas": []}
        if atual is not None:
            atual["linhas"].append(ln)
        if ln.startswith("|}") and atual is not None:
            tab.append(atual)
            atual = None
    return tab


def parse_tabela(t, ano_padrao):
    txt = "\n".join(t["linhas"])
    # candidatos no cabeçalho
    cands = [m.group(2) for m in re.finditer(r"!\s*\[\[([^\]|]+)\|([^\]]+)\]\]<(?:br|hr)", txt)]
    if "Lula" not in cands or "F. Bolsonaro" not in cands:
        return []
    k = len(cands)
    il, iflv = cands.index("Lula"), cands.index("F. Bolsonaro")
    # corta o cabeçalho (até o terceiro '|-')
    blocos = re.split(r"\n\|-[^\n]*\n", txt)
    n_cab = 3 if 'rowspan="3"' in blocos[0] else 2        # linhas de cabeçalho (tabelas novas: 3; a de 2025: 2)
    dados = blocos[n_cab:]
    pend = {}                                             # coluna -> [restantes, conteúdo]
    out = []
    for b in dados:
        cels = celulas_da_linha(b.split("\n"))
        linha, ci = [], 0
        it = iter(cels)
        total_cols = 2 + k + 5                           # pollster, período, k candidatos, branco, ME, amostra, lead, link
        col = 0
        while col < total_cols:
            if col in pend and pend[col][0] > 0:
                linha.append(pend[col][1]); pend[col][0] -= 1
                col += 1
                continue
            try:
                attrs, cont = next(it)
            except StopIteration:
                linha.append(""); col += 1
                continue
            m = re.search(r'rowspan="?(\d+)', attrs)
            if m and int(m.group(1)) > 1:
                pend[col] = [int(m.group(1)) - 1, cont]
            linha.append(cont)
            col += 1
        out.append(linha)
    res = []
    for ln in out:
        if len(ln) < total_cols:
            continue
        lula, flv = numero(limpar(ln[2 + il])), numero(limpar(ln[2 + iflv]))
        if lula is None or flv is None:
            continue
        # só o confronto direto: os demais candidatos devem estar vazios nesta linha
        outros = [numero(limpar(ln[2 + j])) for j in range(k) if j not in (il, iflv)]
        if any(v is not None for v in outros):
            continue
        res.append({
            "inst": limpar(ln[0]),
            "periodo": limpar(ln[1]),
            "lula": lula, "flavio": flv,
            "indec": numero(limpar(ln[2 + k])),
            "me": numero(limpar(ln[3 + k])),
            "n": int(numero(limpar(ln[4 + k])) or 0) or None,
            "url": url_ref(ln[2 + k + 4]) or url_ref(ln[1]) or url_ref(ln[0]),
            "cab": t["cab"],
        })
    return res


def agregadores(wikitext):
    linhas = wikitext.split("\n")
    i0 = next(i for i, l in enumerate(linhas) if l.strip() == "==Second round==")
    txt = "\n".join(linhas[i0:i0 + 80])
    out = []
    for b in re.split(r"\n\|-[^\n]*\n", txt)[4:]:
        cels = [limpar(c) for _a, c in celulas_da_linha(b.split("\n"))]
        if len(cels) >= 4 and re.search(r"\d", cels[2] or ""):
            out.append({"nome": cels[0], "data": cels[1], "lula": numero(cels[2]), "flavio": numero(cels[3])})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    wt = baixar()
    indexar_refs(wt)
    todas = []
    for t in tabelas(wt):
        if t["cab"] == "Polling aggregation":              # agregadores ficam à parte
            continue
        ano = 2025 if t["cab"] == "2025" else 2026
        for p in parse_tabela(t, ano):
            ini, fim = parse_periodo(p["periodo"], ano)
            if not fim:
                print("período não lido:", p["inst"], p["periodo"], file=sys.stderr)
                continue
            p["ini"], p["fim"] = ini, fim
            todas.append(p)
    # remove duplicatas exatas (mesmo instituto, período e números)
    vistos, uniq = set(), []
    for p in sorted(todas, key=lambda x: (x["fim"], x["inst"])):
        k = (p["inst"], p["fim"], p["lula"], p["flavio"])
        if k not in vistos:
            vistos.add(k); uniq.append(p)
    ags = []
    try:
        ags = [x for x in agregadores(wt) if x["lula"] and x["flavio"]]
    except Exception as e:  # noqa: BLE001
        print("agregadores não lidos:", e, file=sys.stderr)
    saida = {
        "atualizado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fonte": "Wikipedia — Opinion polling for the 2026 Brazilian presidential election (links das matérias originais em cada pesquisa)",
        "primeiro_turno": "2026-10-04",
        "pesquisas": [{k: v for k, v in p.items() if k not in ("cab",)} for p in uniq],
        "agregadores": ags,
    }
    json.dump(saida, open(a.out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(uniq)} pesquisas Lula x Flávio ({uniq[0]['fim']} → {uniq[-1]['fim']}), {len(ags)} agregadores")


if __name__ == "__main__":
    main()
