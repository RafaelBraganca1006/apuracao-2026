# Plano: apuração de todos os cargos (governador, senador, deputados)

Objetivo: além de presidente, o site mostra governador, senador, deputado federal e deputado estadual (e distrital, no DF)
do **1º turno** (resultado final) e o **2º turno de governador ao vivo** em 25/10. Mesmo visual e mesma lógica do mapa de presidente.

## O que o TSE publica (verificado em 18/10)

| Eleição | Código | Conteúdo |
|---|---|---|
| 6257 | 1º turno presidente | já usado (`cargo 0001`) |
| 6258 | 2º turno presidente | já usado |
| **6259** | 1º turno estadual | governador `c0003`, senador `c0005`, dep. federal `c0006`, dep. estadual `c0007`, dep. distrital `c0008` (só DF) |
| **6260** | 2º turno governador | só **AC, AM, DF, ES, RN, TO** (RJ e PR **não** têm 2º turno) |
| 6261 | eleição municipal isolada | Fernando de Noronha: ignorar |

- Mesmo padrão de URL do presidente: `/oficial/ele2026/{código}/dados/{uf}/{uf}{município}-c000{cargo}-e00{código}-u.jws`.
- Existe também o arquivo agregado do **estado**: `{uf}-c000{cargo}-e00{código}-u.jws` (sem código de município). Serve para o placar do estado e para a lista de eleitos, sem somar município a município.
- Estrutura: `carg[0].agr[]` (coligação/federação/partido) → `par[]` → `cand[]` com `vap` (votos), `st` (Eleito / Não eleito / Eleito por QP), `n` (número). Governador e senador trazem também vice/suplentes (`vs`).
- Tamanhos: governador ~7 KB por município; **dep. federal ~365 KB e dep. estadual ~470 KB só para a cidade de São Paulo** (1.045 e 1.346 candidatos). Isso decide o desenho dos dados.

## Decisões de produto

1. **Presidente continua como está.** Nada do que já funciona é tocado antes de 25/10.
2. **Seletor de cargo** no topo do painel (Presidente · Governador · Senador · Dep. Federal · Dep. Estadual), com **seletor de estado** para os cargos estaduais. Governador abre pelo estado, com o mapa dos municípios daquele estado (zoom automático); "Brasil" mostra o vencedor de cada estado.
3. **Governador**: igual ao presidente (candidato mais votado por município, tom = vantagem, placar, ranking de cidades, linha do tempo). No 2º turno dos 6 estados + DF, ao vivo.
4. **Senador**: cada eleitor vota em 2, então o placar mostra % dos votos válidos por candidato (soma ~200%) e destaca os 2 eleitos. Mapa: mais votado por município.
5. **Deputados**: não há "vencedor" único. Três visões:
   - **Eleitos** do estado (lista com votos, partido, "eleito por QP / média"), com bancada por partido.
   - **Mapa por partido**: partido mais votado em cada município.
   - **Mapa por candidato**: clicou num candidato, o mapa mostra onde ele teve voto (muito compartilhável: "a base eleitoral do Kim Kataguiri").
6. Ordem de entrega pensando em 25/10: **governador primeiro** (é o único cargo ao vivo), depois senador, depois deputados (só 1º turno, sem pressa de pico).

## Dados (como manter leve e rápido)

- Coletor gera **arquivos por cargo e por estado**, carregados sob demanda ao escolher o estado:

```
site/data/
  gov/{uf}.json        # 1º turno: candidatos + linha por município [votos por candidato]   (~10–60 KB cada)
  sen/{uf}.json        # idem
  depfed/{uf}.json     # eleitos + votos por partido por município + top-N candidatos por município
  depest/{uf}.json
  depfed/{uf}-cand/{numero}.json   # só dos eleitos e dos ~30 mais votados: voto do candidato por município
  index.json           # cargos, estados, candidatos, eleitos (para busca e para o seletor)
data-worker/public/    # só o 2º turno de governador ao vivo: gov2/live.json (6 estados + DF, ~470 municípios, 1 arquivo)
```

- Deputados guardam **votos por partido por município** (barato) e **votos por candidato por município só para eleitos + top-N**, em arrays esparsos. O resto do candidato aparece só no total do estado.
- Formato compacto igual ao do presidente (arrays posicionais + `meta.cols`), documentado em `docs/dados.md`.
- 1º turno é estático (dado final): coleta uma vez, commit dos arquivos (ou publicar no projeto `apuracao-dados`). Só o 2º turno de governador roda em loop (~470 municípios, ~25 s por rodada).
- Malha: já temos `municipios.geojson` e `ufs.geojson`. Recorte por estado é feito no cliente (filtrar por prefixo do IBGE), sem novo arquivo.

## Código e organização do repositório

Hoje: `collector/` com scripts soltos e `site/app.js` com 1.547 linhas, tudo sobre presidente. Mudanças, sem reescrever o que funciona:

**Coletor (Python)**
- Extrair `collector/tse.py` (cliente HTTP com retry, `jws()`, URLs) usado por `collect.py` e pelos novos coletores.
- `collector/cargos/{governador,senador,deputados}.py`, cada um com `parse(raw) -> linha` e `build(uf) -> arquivo`. Um CLI único: `python -m collector.run --cargo governador --election 6259`.
- **Testes com fixtures reais** (`tests/fixtures/*.jws`, 1 por cargo, já baixadas acima) com `pytest`: parsing, somas = total do estado, ordenação.
- `ruff` para lint/format; `requirements.txt`/`pyproject.toml`.

**Site (JS)**
- Páginas novas sem tocar em `app.js`: `cargo.html` + módulos ES em `site/js/` (`state.js`, `data.js`, `map.js`, `panels/`). Reaproveitar tema, legenda, tooltip e `swipePanel` extraindo para `site/js/shared/` **copiando** a lógica primeiro e só depois substituir em `app.js` (pós-25/10).
- URL por estado e cargo: `/cargo?c=governador&uf=SP` (compartilhável; cada combinação com imagem OG própria).
- Mesma estética (Geist/Petrona, painéis, dithering) e mesmos eventos de analytics (PostHog/Cloudflare) com a propriedade `cargo`.

**Repositório**
- `README.md` curto na raiz + `docs/` (`dados.md`, `deploy.md` — mover `DEPLOY.md`, este plano).
- GitHub Actions: `pytest` + `ruff` + checagem de JSON dos dados. Sem deploy novo (Cloudflare já faz).
- `.gitignore` já cobre os arquivos ao vivo; dados de 1º turno entram no git (são fixos).
- Commits pequenos por cargo, uma branch por entrega (governador, senador, deputados), PR com print do site.

## Etapas e estimativa

| # | Entrega | Tempo | Pronto quando |
|---|---|---|---|
| 0 | Spike: baixar 1 estado de cada cargo, confirmar campos (eleito/QP), salvar fixtures | 1–2 h | fixtures + `docs/dados.md` |
| 1 | `tse.py` + coletor de **governador** 1º turno (27 UFs) | 3–4 h | `gov/{uf}.json` conferem com o total oficial do estado |
| 2 | Página `cargo.html`: seletor de cargo/estado, mapa por município, placar, ranking | 1 dia | governador de SP igual em qualidade ao presidente |
| 3 | **2º turno de governador ao vivo** (6260): coletor em loop + publicação + estado "aguardando/ao vivo" | 4–6 h | testar com 1º turno como simulação (replay) |
| 4 | **Senador** (1º turno) | 3–4 h | 2 eleitos destacados, % correta |
| 5 | **Dep. federal e estadual** (eleitos, partido, mapa por candidato) | 1,5–2 dias | arquivos < 100 KB por estado, mapa por candidato funcionando |
| 6 | Compartilhamento: OG por cargo/estado, textos para X | 3 h | link de SP governador gera card correto |
| 7 | Refatoração de `app.js` para os módulos compartilhados | **após 25/10** | presidente usa os mesmos módulos |

Caminho crítico até 25/10: **0 → 1 → 2 → 3**. Senador e deputados entram se sobrar tempo; não atrasam o pico.

## Riscos

- **Prazo**: faltam 7 dias. Recomendo congelar o presidente e entregar governador (etapas 0–3) até quinta (22/10) para testar com tráfego antes do domingo.
- **Volume dos deputados**: SP tem 1.346 candidatos a estadual. Sem o recorte "eleitos + top-N", os arquivos explodem.
- **Dados ao vivo do 2º turno de governador usam outro código (6260)** e outra lista de municípios: o coletor não pode assumir os 5.757 do presidente.
- **Janela de publicação do TSE**: governador pode estar 100% antes do presidente; o site precisa mostrar "encerrada" por estado, não global.
- **Divisão de atenção**: a página de presidente é o produto que viraliza; uma regressão nela custa mais que qualquer cargo novo.

## Decisões para você

1. Aprova a ordem governador → senador → deputados e congelar o presidente?
2. Deputados: ficar só com "eleitos + mapa por partido + mapa por candidato (top-N)" ou querer todos os candidatos (arquivos bem maiores)?
3. Nova página `cargo.html` (mais seguro) ou integrar no `apuracao.html` desde já (mais coeso, mais arriscado)?
