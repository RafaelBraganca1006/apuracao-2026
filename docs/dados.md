# Formato dos dados dos cargos (governador, senador, deputados)

Gerados por `collector/cargos.py` a partir do portal do TSE (`resultados.tse.jus.br`). Todos os arquivos são JSON compactos.
Chaves de município = código **IBGE** (7 dígitos, o mesmo de `municipios.geojson`). Votos são inteiros; `st` é a situação do candidato.

| Cargo | `--cargo` | Pasta (1º turno, em `site/data/`) | Cargo no TSE |
|---|---|---|---|
| Governador | `governador` | `gov1/` | `c0003` |
| Senador | `senador` | `sen1/` | `c0005` |
| Deputado federal | `dep_federal` | `depfed1/` | `c0006` |
| Deputado estadual (distrital no DF) | `dep_estadual` | `depest1/` | `c0007` (`c0008` no DF) |

Eleições do TSE: `6259` = 1º turno estadual, `6260` = 2º turno de governador (só AC, AM, DF, ES, RN e TO).

## Situação do candidato (`st`)

`0` não eleito ou suplente · `1` eleito (inclui "por QP" e "por média") · `2` vai ao 2º turno.

## Majoritários (governador, senador)

`{pasta}/index.json` (visão do Brasil):

```json
{ "meta": { "cargo": "governador", "turno": 1, "election": "6259", "fetched_at": 1792339583 },
  "ufs": { "SP": { "vagas": 1, "updated": "04/10/2026 21:08:18",
                    "total": { "secoes": 26683, "ap": 26683, "aptos": 34081699, "comp": 26388000, "val": 22000000, "vb": 0, "vn": 0 },
                    "cands": [ { "n": "10", "nome": "Tarcísio", "sg": "REPUBLICANOS", "sq": "250002541303", "votos": 14491874, "st": 1, "vice": "Felício Ramuth" } ] } } }
```

`{pasta}/{UF}.json` (estado, carregado ao abrir o estado):

```json
{ "meta": { ..., "uf": "AC", "vagas": 1, "updated": "...", "total": { ... } },
  "cands": [ ... ],                      // mais votado primeiro; a ordem é a dos vetores abaixo
  "mun": { "1200013": [ "Acrelândia", secoes, secoes_apuradas, aptos, comparecimento, validos, brancos, nulos, [votos por candidato, na ordem de "cands"] ] } }
```

`total`: `secoes` (total), `ap` (apuradas), `aptos` (eleitores), `comp` (comparecimento), `val` (válidos), `vb` (brancos), `vn` (nulos).
No senador cada eleitor vota em até 2, então a soma dos votos dos candidatos é ~2× os votantes; a % do candidato é votos ÷ soma dos votos (igual ao TSE).

## Proporcionais (deputados)

Um candidato tem centenas de milhares de linhas possíveis (SP tem 1.346 candidatos a estadual), então o arquivo do estado guarda **votos por partido por município** e os votos por candidato ficam num arquivo à parte, só para os eleitos + os mais votados (até 150 por estado).

`{pasta}/index.json`: igual ao majoritário, mas cada UF traz `"parties": [ { "sg": "PL", "n": "22", "tv": 5000000, "seats": 19 } ]` em vez de `cands`.
(No arquivo, `parties` são arrays `[sg, n, tv, seats]`; o site converte.) `tv` = votos nominais + de legenda do partido.
Votos de legenda dados a uma **federação** (e não a um partido dela) não entram na soma por partido (cerca de 3%).

`{pasta}/{UF}.json`:

```json
{ "meta": { ... },
  "parties": [ ["PL", "22", 5000000, 19], ... ],                   // sigla, número, votos, cadeiras; mais votado primeiro
  "cands": [ ["2222", "Lucas Pavanato", "PL", 3038438, 1], ... ],  // número, nome, partido, votos, st; TODOS os candidatos, mais votado primeiro
  "mun": { "1200013": [ "Acrelândia", secoes, ap, aptos, comp, validos, brancos, nulos, [votos por partido, na ordem de "parties"] ] } }
```

`{pasta}/{UF}-c.json` (carregado ao escolher um candidato):

```json
{ "ids": ["2222", "1313", ...],                                   // números dos candidatos incluídos (eleitos + top por votos)
  "mun": { "1200013": [ 0, 1553, 7, 83, ... ] } }                  // pares [índice em "ids", votos] por município (só os não zerados)
```

## 2º turno de governador ao vivo (`gov2.json`)

Um único arquivo (poucos estados), regravado a cada rodada do coletor e lido pelo site a cada ~30 s:

```json
{ "meta": { "cargo": "governador", "turno": 2, "election": "6260", "fetched_at": 1792340041 },
  "ufs": { "AC": { "vagas": 1, "updated": "...", "total": { ... }, "cands": [ ... ], "mun": { ... } } } }
```

Fica em `data-worker/public/gov2.json` (projeto `apuracao-dados`, mesmo do `live.json`). Antes de a votação começar o arquivo já existe com votos zerados,
e o site mostra "Aguardando". Sem o arquivo, o site mostra "A apuração do 2º turno começa em 25/10".

## Conferência

`python3 -m unittest discover -s tests` verifica, em todos os estados, que a soma dos municípios é igual ao total do estado e que as cadeiras somam as vagas.
