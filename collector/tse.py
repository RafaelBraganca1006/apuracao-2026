"""Cliente mínimo do portal de resultados do TSE (arquivos .jws públicos).

Os arquivos são JWTs sem assinatura relevante: o miolo (payload) é um JSON. O padrão de URL é

  {BASE}/{eleição}/dados/{uf}/{uf}{município}-c{cargo:04d}-e{eleição:06d}-u.jws   (município)
  {BASE}/{eleição}/dados/{uf}/{uf}-c{cargo:04d}-e{eleição:06d}-u.jws              (estado inteiro)
  {BASE}/{eleição}/fotos/{uf}/{sqcand}.jpeg                                        (foto do candidato)

Eleições de 2026: 6257 presidente 1º turno · 6258 presidente 2º turno · 6259 estaduais 1º turno
(governador, senador, deputados) · 6260 governador 2º turno (AC, AM, DF, ES, RN, TO).
"""
import base64
import json
import time
import urllib.request

BASE = "https://resultados.tse.jus.br/oficial/ele2026"
SMALL = {"de", "da", "do", "das", "dos", "e"}


def pt_title(name):
    """Capitaliza nomes em português ('Rio do Pires', não 'Rio Do Pires')."""
    words = name.title().split(" ")
    return " ".join(w.lower() if i and w.lower() in SMALL else w for i, w in enumerate(words))


def get(url, tries=4):
    """GET com tentativas; devolve bytes ou None (404 também vira None)."""
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
    """Payload JSON de um arquivo .jws."""
    p = raw.decode().split(".")[1]
    p += "=" * (-len(p) % 4)
    return json.loads(base64.urlsafe_b64decode(p))


def municipios(election):
    """[(uf, código TSE do município, código IBGE ou '', nome)] da eleição."""
    raw = get(f"{BASE}/{election}/config/mun-e{int(election):06d}-cm.json")
    out = []
    for uf in json.loads(raw)["abr"]:
        for m in uf["mu"]:
            out.append((uf["cd"], m["cd"], m["cdi"], m["nm"]))
    return out


def url_mun(election, uf, cd, cargo):
    return f"{BASE}/{election}/dados/{uf}/{uf}{cd}-c{cargo:04d}-e{int(election):06d}-u.jws"


def url_uf(election, uf, cargo):
    return f"{BASE}/{election}/dados/{uf}/{uf}-c{cargo:04d}-e{int(election):06d}-u.jws"


def url_foto(election, uf, sq):
    return f"{BASE}/{election}/fotos/{uf}/{sq}.jpeg"
