# Tracker do 2º turno 2026 (mapa ao vivo)

Mapa interativo e escuro da apuração presidencial, município a município, com dados oficiais do TSE.
Lula = vermelho, Flávio Bolsonaro = azul.

```
collector/collect.py   busca o TSE e gera site/data/live.json (um único arquivo, ~290 KB / 86 KB gzip)
collector/cargos.py    governador, senador, deputado federal/estadual (1º turno e 2º turno de governador) → site/data/{gov1,sen1,depfed1,depest1}/
collector/tse.py       cliente do portal do TSE (usado por cargos.py)
collector/geo.py       (já rodado) gera a malha simplificada a partir do IBGE
collector/serve.js     servidor local de teste
site/                  o site estático: index.html, apuracao.html (presidente), cargo.html (demais cargos), data/, vendor/, img/
tests/                 testes do coletor e conferência dos dados (python3 -m unittest discover -s tests)
docs/                  dados.md (formato dos arquivos), plano-cargos.md (plano e decisões)
```

## Ver agora (antes do 2º turno)

```bash
node collector/serve.js 8765
```

- http://localhost:8765/ → hoje mostra **"Apuração em breve"** com a contagem regressiva e as pesquisas de 2º turno; as abas "1º turno" etc. continuam disponíveis

## No dia 25/10

1. Deixe o coletor rodando (a cada ~1,5 min ele baixa os 5.757 municípios e regrava o arquivo):

```bash
caffeinate -i python3 collector/collect.py --election 6258 \
  --out site/data/live.json --history site/data/history.json \
  --snapshots site/data/snaps --loop 45
```

2. O site faz polling de `live.json` a cada 30 s. Antes de o TSE publicar votos ele mostra "Aguardando";
   com votos vira "Ao vivo"; em 100% das seções vira "Apuração encerrada".

3. **Publicação (importante para viralizar).** O site é 100% estático. Duas partes:
   - **Site** (html/js/css/malha): Cloudflare Pages, Netlify ou Vercel. Gratuito e aguenta pico. `site/_headers` já traz o cache.
   - **Dados ao vivo** (`live.json`, `history.json`): como mudam a cada rodada, coloque num bucket com CDN
     (Cloudflare R2, S3 + CloudFront, ou Supabase/Backblaze público) com **CORS liberado**, e aponte o site para ele em
     `site/config.js` (`window.TRACKER_LIVE_BASE = 'https://dados.seudominio.com/'`). O coletor pode enviar sozinho a cada rodada:

```bash
python3 collector/collect.py --election 6258 --out site/data/live.json --history site/data/history.json \
  --snapshots site/data/snaps --loop 45 \
  --after "rclone copy site/data/live.json r2:meu-bucket/ && rclone copy site/data/history.json r2:meu-bucket/ && rclone copy site/data/snaps r2:meu-bucket/snaps/"
```

   O site pede o arquivo com uma janela de 15 s no parâmetro, então o CDN atende todo mundo com 1 pedido a cada 15 s.

4. Antes de postar: troque as URLs de `og.png` em `index.html` por URL absoluta do seu domínio
   (o Twitter exige URL absoluta para o card de preview) e teste em https://cards-dev.twitter.com/validator.

## Recursos do mapa

- **Busca** (`/` foca o campo): cidades e estados, com ou sem acento, ordenadas por tamanho ("campinas", "rio de janeiro rj"). Foca no município, contorna e abre o card com todos os números.
- **Mapa / Bolhas / 3D**: no 3D cada município (ou, em *Estados*, cada UF) vira um bloco com o próprio formato e altura crescente com os votos (válidos no 1º turno; apurados no 2º, então os blocos crescem ao vivo). Ao passar o mouse o bloco sobe e fica branco. Arraste com o botão direito (ou dois dedos) para girar e inclinar; ao voltar para Mapa/Bolhas a câmera volta plana. `?mode=3d` e `?mode=3d&grain=uf` abrem direto.
- **1º turno**: cor = candidato mais votado, tom = vantagem; lista com os 12 candidatos, brancos, nulos e abstenção.

## Linha do tempo e replay

O gráfico "Linha do tempo" mostra % de Lula e Flávio ao longo da noite (eixos com horário de Brasília). **Clique ou arraste nele para voltar a qualquer momento**: mapa, placar, estados e cidades mostram a apuração naquele instante; o botão "Ao vivo" (no placar) volta ao presente e "Replay" reproduz a noite em ~20 s.
O TSE só publica o estado atual, então o replay depende das *fotos* que o coletor grava (`--snapshots`, uma a cada ~2,5 min só quando algo mudou, ~75 KB cada). Sem esse histórico o gráfico aparece mas o clique fica desativado. **Deixe o coletor rodando desde o início da apuração.**

### Replay do 1º turno (reconstituído)

O TSE não guardou o histórico do 1º turno, mas publica o **Boletim de Urna** (dado aberto) com a hora em que cada urna foi recebida. `collector/boletim.py` lê os 28 zips em fluxo (sem gravá-los em disco), soma as seções recebidas a cada ~5 min e gera `site/data/snaps1/` (fotos) e `site/data/history1.json`. Conferido contra o resultado oficial. No site, com a visão "1º turno" ativa, a linha do tempo mostra essa noite e o botão "Replay" a reproduz. É uma reconstituição pela hora de recebimento, então pode diferir em minutos do painel da época.
Para **tirar o recurso do site** (versão mais leve): apague `site/data/snaps1/` e `site/data/history1.json`. O resto continua funcionando.

## Detalhe do estado e Exterior

Clique num estado (lista, mapa 3D por estado ou busca) para ver o resultado dele, participação, quem lidera nos municípios e os maiores municípios. A linha **EXT** (e a busca por "exterior", "lisboa"…) mostra a votação no exterior por cidade.

## Design e interação

- Fonte **Geist** hospedada em `site/fonts/` (sem depender de CDN). Números leves com `%` pequeno; dígitos que rolam quando mudam.
- Animações: câmera que "pousa" no Brasil, painéis entrando em sequência, lista de estados que se reordena deslizando, blocos 3D que crescem do chão, cores que interpolam a cada atualização. Respeita `prefers-reduced-motion`.
- Celular: o placar fica compacto, o painel de controles recolhe com a alça, e os estados abrem numa gaveta arrastável (fechada / meia / cheia).
- `collector/shot.js` captura screenshots do site via DevTools (útil para conferir o visual): `node collector/shot.js "http://localhost:8765/?mode=3d" saida.png 1440 900`.

## Notas

- Os arquivos do TSE são `.jws` (JSON assinado). O coletor só decodifica o conteúdo; não valida a assinatura.
- Dados com a participação do exterior ficam só na lista "Estados" (EXT), não no mapa.
- Projeto não oficial. A fonte é sempre o TSE; não há projeção nem "vencedor declarado" na tela, só o que está apurado.
- Botão **Compartilhar** gera uma imagem 1600×900 do estado atual (com marca "DEMO" quando em simulação).


## Pesquisas de 2º turno (tela "Apuração em breve")

Enquanto o TSE não publica votos do 2º turno, a aba **2º turno** mostra uma manchete grande, a contagem regressiva para a votação (25/10, 8h–17h de Brasília), a **média das pesquisas após o 1º turno** (última pesquisa de cada instituto) e, no painel lateral, um **gráfico da evolução** das pesquisas (pontos = cada pesquisa, linha = tendência suavizada), filtros por instituto e período e a lista da última pesquisa de cada instituto, com a variação desde a anterior e o link da matéria.
Os dados ficam em `site/data/pesquisas.json`, gerados por:

```bash
python3 collector/pesquisas.py --out site/data/pesquisas.json   # rode de novo para atualizar
```

Fonte: tabelas da Wikipedia ("Opinion polling for the 2026 Brazilian presidential election"), que cita a matéria original de cada pesquisa (Datafolha, Quaest, AtlasIntel, Nexus/BTG, Futura, PoderData, MDA, Paraná Pesquisas, Veritá, etc.). Conferi uma amostra contra a imprensa. Quando a apuração começa (`live.json` com votos), a tela troca sozinha para o placar ao vivo.

## Governador, senador e deputados (`cargo.html`)

Mesmo visual do presidente, com seletor de cargo (Governador · Senador · Dep. Federal · Dep. Estadual), de turno (governador) e de estado. `?c=senador&uf=SP&mode=3d` abre direto.
Visão do Brasil: estados coloridos pelo partido do mais votado (ou com mais cadeiras). Visão do estado: municípios coloridos; nos deputados, também o mapa de votos de um candidato.

```bash
# 1º turno (resultado final; roda uma vez, ~2 min por cargo) e fotos dos candidatos majoritários
for c in governador senador dep_federal dep_estadual; do python3 collector/cargos.py --cargo $c --turno 1 --out site/data --photos site/img; done
python3 collector/nomes.py        # índice de nomes dos municípios (busca)

# 2º turno de governador ao vivo (AC, AM, DF, ES, RN, TO) em 25/10, junto com o coletor do presidente
caffeinate -i python3 collector/cargos.py --cargo governador --turno 2 --out data-worker/public --loop 45 --after "collector/publish_live.sh"
```

Formato dos arquivos: [docs/dados.md](docs/dados.md). Conferência: `python3 -m unittest discover -s tests`.
