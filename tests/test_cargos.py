"""Testes do coletor de cargos (governador, senador, deputados) com arquivos reais do TSE (AC, 1º turno).

Rodar:  python3 -m unittest discover -s tests -v
"""
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "collector"))
import cargos  # noqa: E402
import tse  # noqa: E402

FIX = os.path.join(HERE, "fixtures")


def fixture(name):
    with open(os.path.join(FIX, name + ".jws"), "rb") as f:
        return f.read()


def doc(name):
    return tse.jws(fixture(name))


def fake_get(url, tries=4):
    """Serve os arquivos de tests/fixtures no lugar da rede (só o AC e a cidade de Acrelândia)."""
    name = url.rsplit("/", 1)[-1].replace(".jws", "")
    path = os.path.join(FIX, name + ".jws")
    return open(path, "rb").read() if os.path.exists(path) else None


class Parsing(unittest.TestCase):
    def test_status_of(self):
        self.assertEqual(cargos.status_of("Eleito"), 1)
        self.assertEqual(cargos.status_of("Eleito por QP"), 1)
        self.assertEqual(cargos.status_of("Eleito por média"), 1)
        self.assertEqual(cargos.status_of("2º turno"), 2)
        self.assertEqual(cargos.status_of("Suplente"), 0)
        self.assertEqual(cargos.status_of("Não eleito"), 0)
        self.assertEqual(cargos.status_of(""), 0)

    def test_cargo_code_distrital(self):
        self.assertEqual(cargos.cargo_code("dep_estadual", "df"), 8)
        self.assertEqual(cargos.cargo_code("dep_estadual", "sp"), 7)
        self.assertEqual(cargos.cargo_code("governador", "df"), 3)

    def test_governador_estado(self):
        d = doc("ac-c0003-e006259-u")
        g = cargos.geral(d)
        self.assertEqual(g["secoes"], 2270)
        self.assertEqual(g["ap"], 2270)
        by = {c["n"]: c for c in cargos.cands_of(d)}
        self.assertEqual(by["11"]["votos"], 218760)
        self.assertEqual(by["11"]["st"], 2)                 # Mailza vai ao 2º turno
        self.assertEqual(by["11"]["vice"], "Jessica Sales")
        self.assertEqual(sum(c["votos"] for c in by.values()), g["val"])

    def test_senador_dois_eleitos(self):
        d = doc("ac-c0005-e006259-u")
        eleitos = {c["nome"] for c in cargos.cands_of(d) if c["st"] == 1}
        self.assertEqual(len(eleitos), 2)
        self.assertIn("Marcio Bittar", eleitos)
        self.assertEqual(int(d["carg"][0]["nv"]), 2)

    def test_deputado_federal_partidos(self):
        d = doc("ac-c0006-e006259-u")
        eleitos = [c for c in cargos.cands_of(d) if c["st"] == 1]
        self.assertEqual(len(eleitos), int(d["carg"][0]["nv"]))   # 8 vagas, 8 eleitos
        ps = cargos.parties_of(d)
        self.assertTrue(all(p["tv"] >= 0 for p in ps))
        # votos de legenda dados à federação (e não a um partido dela) ficam de fora da soma por partido
        total = sum(p["tv"] for p in ps)
        self.assertLessEqual(total, cargos.geral(d)["val"])
        self.assertGreater(total, 0.9 * cargos.geral(d)["val"])


class Collect(unittest.TestCase):
    def run_collect(self, cargo):
        muns = [("ac", "01120", "1200013", "ACRELÂNDIA")]
        with mock.patch.object(tse, "get", fake_get), mock.patch.object(tse, "municipios", lambda e: muns):
            return cargos.collect(cargo, 1, workers=2, only={"ac"})

    def test_governador_vetor_na_ordem_dos_candidatos(self):
        out = self.run_collect("governador")["AC"]
        self.assertEqual(out["vagas"], 1)
        order = [c["n"] for c in out["cands"]]
        self.assertEqual(order, [c["n"] for c in sorted(out["cands"], key=lambda c: (-c["votos"], int(c["n"])))])
        muni = {c["n"]: c["votos"] for c in cargos.cands_of(doc("ac01120-c0003-e006259-u"))}
        row = out["mun"]["1200013"]
        self.assertEqual(row[0], "Acrelândia")
        self.assertEqual(row[8], [muni[n] for n in order])    # votos do município seguem a ordem da lista

    def test_deputado_federal_formato(self):
        out = self.run_collect("dep_federal")["AC"]
        self.assertEqual(out["vagas"], 8)
        self.assertEqual(sum(p[3] for p in out["parties"]), 8)             # cadeiras somam as vagas
        row = out["mun"]["1200013"]
        self.assertEqual(len(row[8]), len(out["parties"]))                  # um valor por partido
        self.assertEqual(len(row[9]) % 2, 0)                                # pares [índice, votos]
        self.assertTrue(set(row[9][::2]) <= set(range(len(out["top"]))))
        self.assertEqual(out["cands"][0][3], max(c[3] for c in out["cands"]))   # mais votado primeiro


if __name__ == "__main__":
    unittest.main()
