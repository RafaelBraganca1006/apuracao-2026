#!/usr/bin/env python3
"""Gera debate.json (transcrição rotulada + contadores) para a página /debate.

  .venv/bin/python build_debate.py --out ../site/data/debate.json [--loop 20] [--start 0]
Lê out/labeled.jsonl (com quem fala) ou, se ainda não existir, out/segments.jsonl.
--start = segundo da gravação em que o debate começou (descarta a pré-estreia).
"""
import argparse
import json
import os
import re
import time
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

TERMS = ["Bolsonaro", "Lula", "Dilma", "corrupção", "imposto", "emprego", "inflação", "saúde", "educação", "segurança", "Pix", "Deus",
         "democracia", "pobre", "dívida", "fome", "armas", "aborto", "Petrobras", "Banco Central", "mentira", "STF", "povo", "futuro"]


def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


# preposições, artigos, pronomes, conjunções, advérbios e verbos auxiliares comuns (sem acento, minúsculos): ficam de fora do top 10
STOP = set("""
a o as os um uma uns umas de do da dos das no na nos nas ao aos em por para pra pro com sem sob sobre entre ate desde apos perante contra
e ou mas porem pois porque que se como quando onde enquanto embora quanto qual quais quem cujo cuja
eu tu ele ela nos vos eles elas me te lhe lhes mim ti si meu minha meus minhas teu tua seu sua seus suas nosso nossa nossos nossas dele dela deles delas
este esta isto esse essa isso aquele aquela aquilo estes estas esses essas aqueles aquelas aqui ali la ca aí ai
nao sim ja so tambem ainda mesmo muito muita muitos muitas mais menos tao tanto tanta bem mal assim entao agora hoje sempre nunca todo toda todos todas
cada outro outra outros outras algum alguma alguns algumas nenhum nenhuma nada tudo algo ninguem alguem qualquer
ser sou es e eh somos sao era eram foi foram fui sera serao seria seja sejam sendo sido
estar estou esta estao estava estavam estive esteve estiver estando
ter tenho tem temos tem tinha tinham teve tiver tendo tido
haver ha havia houve
ir vou vai vamos vao ia iam foi fui indo
fazer faco faz fazemos fazem fez fizemos fizeram fazendo feito
poder posso pode podemos podem podia pode
dizer digo diz dizem disse dito querer quero quer quer queremos
ne tá ta pois entao veja olha olhe bom boa dia noite obrigado obrigada candidato candidata presidente
voce voces senhor senhora falar ver saber dar ficar passar deixar chegar pessoal
dois duas tres quatro cinco um uma primeiro primeira segundo segunda ano anos vez vezes coisa coisas gente
""".split())
TOKEN = re.compile(r"[A-Za-zÀ-ÿ]+")
NUM = re.compile(r"\d|\b(milhao|milhoes|bilhao|bilhoes|mil|por cento|reais|dolares?)\b")
CAND = re.compile(r"lula|flavio|bolsonaro")


def is_cand(who):
    return bool(CAND.search(norm(who)))


def build(start):
    path = os.path.join(OUT, "labeled.jsonl")
    if not os.path.exists(path):
        path = os.path.join(OUT, "segments.jsonl")
    segs = [json.loads(l) for l in open(path)]
    segs = [s for s in segs if s["start"] >= start]
    people = {}
    lines = []
    checks = []
    prev = None
    for s in segs:
        who = s.get("speaker", "?")
        p = people.setdefault(who, {"secs": 0.0, "words": 0, "terms": {}, "turns": 0, "interrupts": 0, "questions": 0, "numbers": 0, "_c": {}})
        if prev is not None and prev["who"] != who:
            p["turns"] += 1
            # corte: candidato começa a falar quase colado (<0.4 s) no trecho do outro, que ficou sem fecho de frase
            if is_cand(who) and is_cand(prev["who"]) and s["start"] - prev["end"] < 0.4 and not prev["text"].rstrip().endswith((".", "?", "!")):
                p["interrupts"] += 1
        prev = {"who": who, "end": s["end"], "text": s["text"]}
        if s["text"].rstrip().endswith("?"):
            p["questions"] += 1
        if is_cand(who) and NUM.search(norm(s["text"])):
            p["numbers"] += 1
            checks.append({"t": round(s["start"] - start), "who": who, "text": s["text"]})
        p["secs"] += s["end"] - s["start"]
        n = norm(s["text"])
        p["words"] += len(n.split())
        for w in TOKEN.findall(s["text"].lower()):
            k = norm(w)
            if len(k) < 3 or k in STOP:
                continue
            c = p["_c"].setdefault(k, {})
            c[w] = c.get(w, 0) + 1
        lines.append({"t": round(s["start"] - start), "who": who, "text": s["text"]})
    for p in people.values():                          # top 10 palavras de cada um (forma mais usada de cada palavra)
        top = sorted(p.pop("_c").items(), key=lambda kv: -sum(kv[1].values()))[:10]
        p["terms"] = {max(forms, key=forms.get): sum(forms.values()) for _, forms in top}
    return {"updated": int(time.time()), "people": people, "lines": lines[-400:], "total_lines": len(lines), "checkables": checks[-40:]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--loop", type=int, default=0)
    ap.add_argument("--start", type=float, default=0)
    a = ap.parse_args()
    while True:
        d = build(a.start)
        tmp = a.out + ".tmp"
        with open(tmp, "w") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, a.out)
        print(f"[{time.strftime('%H:%M:%S')}] {d['total_lines']} trechos", flush=True)
        if not a.loop:
            break
        time.sleep(a.loop)
