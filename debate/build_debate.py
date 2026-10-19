#!/usr/bin/env python3
"""Gera debate.json (transcrição rotulada + estatísticas) para a página /debate.

  .venv/bin/python build_debate.py --out ../data-worker/public/debate.json [--loop 20] [--start 540] [--final]
Lê out/labeled.jsonl (com quem fala) ou, se ainda não existir, out/segments.jsonl.
--start = segundo da gravação em que o debate começou (descarta a pré-estreia).
"""
import argparse
import json
import math
import os
import re
import time
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

# preposições, artigos, pronomes, conjunções, advérbios e verbos auxiliares comuns (sem acento, minúsculos): ficam de fora das palavras mais usadas
STOP = set("""
a o as os um uma uns umas de do da dos das no na nos nas ao aos em por para pra pro com sem sob sobre entre ate desde apos perante contra
e ou mas porem pois porque que se como quando onde enquanto embora quanto qual quais quem cujo cuja
eu tu ele ela nos vos eles elas me te lhe lhes mim ti si meu minha meus minhas teu tua seu sua seus suas nosso nossa nossos nossas dele dela deles delas
este esta isto esse essa isso aquele aquela aquilo estes estas esses essas aqueles aquelas aqui ali la ca ai
nao sim ja so tambem ainda mesmo muito muita muitos muitas mais menos tao tanto tanta bem mal assim entao agora hoje sempre nunca todo toda todos todas
cada outro outra outros outras algum alguma alguns algumas nenhum nenhuma nada tudo algo ninguem alguem qualquer
ser sou es e eh somos sao era eram foi foram fui sera serao seria seja sejam sendo sido
estar estou esta estao estava estavam estive esteve estiver estando
ter tenho tem temos tem tinha tinham teve tiver tendo tido
haver ha havia houve
ir vou vai vamos vao ia iam foi fui indo
fazer faco faz fazemos fazem fez fizemos fizeram fazendo feito
poder posso pode podemos podem podia
dizer digo diz dizem disse dito querer quero quer queremos
ne ta pois veja olha olhe bom boa dia noite obrigado obrigada candidato candidata presidente
voce voces senhor senhora falar ver saber dar ficar passar deixar chegar pessoal
estamos depois nesse nessa neste nesta dessa desse disso nisso pelo pela pelos pelas queria estava fazendo vamos podemos precisamos
dois duas tres quatro cinco primeiro primeira segundo segunda ano anos vez vezes coisa coisas gente
""".split())
TOKEN = re.compile(r"[A-Za-zÀ-ÿ]+")

# assuntos: cada um é um conjunto de radicais (sem acento); uma palavra conta se começa com o radical
THEMES = {
    "Economia": ["econom", "empreg", "desempreg", "inflac", "juros", "divid", "pib", "imposto", "tribut", "salari", "renda", "crescimento", "orcament", "=fiscal", "reserva", "dolar", "preco", "mercado", "emprest", "investiment", "industri", "empresa", "mei", "meis"],
    "Segurança": ["seguranc", "crime", "faccao", "facoes", "policia", "bandid", "prisa", "preso", "presos", "violenc", "arma", "armas", "assassin", "milici", "trafico", "narco", "penitenc", "maioridade", "pcc"],
    "Saúde": ["saude", "sus", "medic", "hospital", "remedio", "vacina", "doenc", "cancer", "covid", "paciente"],
    "Educação": ["educac", "escola", "universid", "professor", "ensino", "creche", "alfabet", "estudante", "faculdade"],
    "Corrupção e ética": ["corrup", "roub", "ladr", "mentir", "mentira", "mentiu", "propina", "desvio", "quadrilha", "inss", "fraude", "lavagem", "impun"],
    "Programas sociais": ["bolsa", "fome", "pobre", "pobreza", "miseri", "aposentad", "beneficio", "auxilio", "cesta", "desigual"],
    "Família e vida pessoal": ["filho", "filha", "pai", "mae", "mulher", "mulheres", "familia", "janja", "esposa", "crianca"],
    "Instituições e democracia": ["stf", "congresso", "=senado", "democra", "constitui", "eleic", "partido", "tribunal", "justica", "ditadura", "golpe", "anistia", "impeach"],
    "Energia e meio ambiente": ["petrobras", "energia", "amazon", "clima", "ambient", "agro", "petroleo", "gasolina", "combustiv", "desmat", "mineral"],
    "Exterior": ["eua", "estados unidos", "trump", "china", "russia", "israel", "venezuel", "argentin", "europa", "internacion", "brics", "tarifa"],
}

# erros recorrentes do reconhecimento de voz (nomes próprios e termos): corrigidos antes de contar palavras e montar o texto
FIX = [(r"\b(?:Bocaro|Borcaro|Borcário|Vocaro|Vocalo)\b", "Vorcaro"), (r"\bMedonça\b", "Mendonça"), (r"\bLussinger\b|\bLussing\b|\bLuxinger\b", "Luchsinger"),
       (r"\bLetrobras\b", "Petrobras"), (r"\bBandelhantes\b", "Bandeirantes"), (r"\bFreixir\b", "Frei Chico"), (r"\bLothenberg\b", "Lottenberg"),
       (r"\bEineg\b|\bOineg\b", "Oinegue"), (r"\bMillen\b|\bMilley\b", "Milei"), (r"\b[Mm]oto[cs]erra\b|\b[Mm]ototerra\b", "motosserra"),
       (r"\bJax Wagner\b", "Jaques Wagner"), (r"\bSupre Simples\b", "Super Simples"), (r"\bGeral da Albuquer Empresa\b", "Geral da Micro e Pequena Empresa"),
       (r"\bLua\b(?=\.|,)", "Lula"), (r"passado, Lino\b", "passado, Lula"), (r"\bSegundário\b", "segundo turno")]


def fix(text):
    for a, b in FIX:
        text = re.sub(a, b, text)
    return text


SPK = {"Mediador": 0, "Flavio Bolsonaro": 1, "Lula": 2}
NUM = re.compile(r"\d|\b(milhao|milhoes|bilhao|bilhoes|mil|por cento|reais|dolares?)\b")
CAND = re.compile(r"lula|flavio|bolsonaro")


def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def is_cand(who):
    return bool(CAND.search(norm(who)))


def theme_hits(text):
    """Palavras do texto que contam para cada assunto: [(assunto, radical, palavra)]. Radicais curtos (até 4 letras) só valem
    como palavra inteira; os longos valem como início de palavra (ex.: 'empreg' pega 'emprego', 'empregos'); expressões ('estados unidos') valem inteiras."""
    out = []
    norm_text = " " + norm(text) + " "
    for theme, stems in THEMES.items():
        for st in stems:
            if " " in st:
                for _ in re.finditer(r"(?<![a-z])" + re.escape(st) + r"(?![a-z])", norm_text):
                    out.append((theme, st, st))
    for w in TOKEN.findall(text.lower()):
        k = norm(w)
        for theme, stems in THEMES.items():
            for st in stems:
                if " " in st:
                    continue
                exact = st.startswith("=") or len(st) <= 4
                if (k == st.lstrip("=")) if exact else k.startswith(st):
                    out.append((theme, st, w))
                    break
    return out


def theme_info(theme_words, stem_hits):
    """Para a página: palavras ditas em cada assunto (com contagem por pessoa) e radicais que contam mas ninguém disse."""
    out = {}
    for th, stems in THEMES.items():
        found = sorted(([w, c.get("Lula", 0), c.get("Flavio Bolsonaro", 0), c.get("Mediador", 0)] for w, c in theme_words.get(th, {}).items()),
                       key=lambda r: -(r[1] + r[2] + r[3]))
        hit = stem_hits.get(th, set())
        show = lambda st: st.lstrip("=") if (" " in st or len(st) <= 4 or st.startswith("=")) else st + "…"
        unused = [show(st) for st in stems if st not in hit]
        listed = [show(st) for st in stems]
        out[th] = {"found": found, "unused": unused, "rules": listed}
    return out


def build(start, final=False):
    path = os.path.join(OUT, "labeled.jsonl")
    if not os.path.exists(path):
        path = os.path.join(OUT, "segments.jsonl")
    segs = [json.loads(l) for l in open(path)]
    segs = [{**s, "text": fix(s["text"])} for s in segs if s["start"] >= start]
    people, lines, checks, runs = {}, [], [], []
    theme_words, stem_hits = {}, {}
    prev = None
    for s in segs:
        who = s.get("speaker", "?")
        p = people.setdefault(who, {"secs": 0.0, "words": 0, "terms": {}, "themes": {}, "turns": 0, "interrupts": 0, "questions": 0, "numbers": 0, "_c": {}})
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
        for th, st, w in theme_hits(s["text"]):
            p["themes"][th] = p["themes"].get(th, 0) + 1
            tw = theme_words.setdefault(th, {}).setdefault(w, {})
            tw[who] = tw.get(who, 0) + 1
            stem_hits.setdefault(th, set()).add(st)
        lines.append({"t": round(s["start"] - start), "who": who, "text": s["text"]})
        # trechos seguidos do mesmo falante (lacuna < 3 s) formam um bloco da linha do tempo
        a, b, k = s["start"] - start, s["end"] - start, SPK.get(who, 0)
        if runs and runs[-1][2] == k and a - runs[-1][1] < 3:
            runs[-1][1] = round(b, 1)
        else:
            runs.append([round(a, 1), round(b, 1), k])
    # palavras características: razão de chances suavizada entre os dois candidatos (só palavras com 8+ usos somados)
    cand_names = [w for w in people if is_cand(w)]
    distinct = {}
    if len(cand_names) == 2:
        A, B = cand_names
        cnt = {w: {k: sum(v.values()) for k, v in people[w]["_c"].items()} for w in (A, B)}
        tot = {w: sum(cnt[w].values()) + 1 for w in (A, B)}
        score = {}
        for k in set(cnt[A]) | set(cnt[B]):
            x, y = cnt[A].get(k, 0), cnt[B].get(k, 0)
            if x + y >= 8:
                score[k] = math.log((x + 0.5) / tot[A]) - math.log((y + 0.5) / tot[B])

        def pick(me, other, sign):
            ks = sorted(score, key=lambda k: -sign * score[k])[:12]
            def form(k):
                f = people[me]["_c"].get(k) or people[other]["_c"].get(k) or {k: 1}
                return max(f, key=f.get)
            return [[form(k), cnt[me].get(k, 0), cnt[other].get(k, 0)] for k in ks]
        distinct = {A: pick(A, B, 1), B: pick(B, A, -1)}
    for p in people.values():                          # top 30 palavras de cada um (forma mais usada de cada palavra)
        top = sorted(p.pop("_c").items(), key=lambda kv: -sum(kv[1].values()))[:30]
        p["terms"] = {max(forms, key=forms.get): sum(forms.values()) for _, forms in top}
    dur = round(segs[-1]["end"] - start) if segs else 0
    return {"updated": int(time.time()), "final": final, "duration": dur, "people": people, "lines": lines, "total_lines": len(lines),
            "runs": runs, "distinct": distinct, "checkables": checks, "spk": SPK, "theme_words": theme_info(theme_words, stem_hits)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--loop", type=int, default=0)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--final", action="store_true", help="marca o debate como encerrado")
    a = ap.parse_args()
    while True:
        d = build(a.start, a.final)
        tmp = a.out + ".tmp"
        with open(tmp, "w") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, a.out)
        print(f"[{time.strftime('%H:%M:%S')}] {d['total_lines']} trechos", flush=True)
        if not a.loop:
            break
        time.sleep(a.loop)
