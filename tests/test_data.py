"""Confere os arquivos de dados gerados (site/data): a soma dos municípios fecha com o total do estado.

Os testes são ignorados se a pasta do cargo ainda não foi gerada (python3 collector/cargos.py ...).
"""
import glob
import json
import os
import unittest

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "data")


def states(folder):
    return sorted(glob.glob(os.path.join(DATA, folder, "[A-Z][A-Z].json")))


class MajoritarioFecha(unittest.TestCase):
    def check(self, folder):
        files = states(folder)
        if not files:
            self.skipTest(f"{folder} não gerado")
        for f in files:
            with open(f) as fh:
                j = json.load(fh)
            sums = [0] * len(j["cands"])
            for r in j["mun"].values():
                for i, v in enumerate(r[8]):
                    sums[i] += v
            self.assertEqual(sums, [c["votos"] for c in j["cands"]], os.path.basename(f))

    def test_governador(self):
        self.check("gov1")

    def test_senador(self):
        self.check("sen1")


class ProporcionalFecha(unittest.TestCase):
    def check(self, folder):
        files = states(folder)
        if not files:
            self.skipTest(f"{folder} não gerado")
        for f in files:
            with open(f) as fh:
                j = json.load(fh)
            sums = [0] * len(j["parties"])
            for r in j["mun"].values():
                for i, v in enumerate(r[8]):
                    sums[i] += v
            self.assertEqual(sums, [p[2] for p in j["parties"]], os.path.basename(f))
            self.assertEqual(sum(p[3] for p in j["parties"]), j["meta"]["vagas"], os.path.basename(f))

    def test_dep_federal(self):
        self.check("depfed1")

    def test_dep_estadual(self):
        self.check("depest1")


if __name__ == "__main__":
    unittest.main()
