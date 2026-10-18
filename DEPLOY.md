# Publicar: Cloudflare Workers (site + API) + R2 (dados ao vivo)

O site (`site/`) é estático. Só o `live.json`/`history.json` mudam durante a apuração, então eles ficam
num bucket R2 com CDN, atualizado pelo coletor. Assim nenhum commit/deploy acontece na noite da eleição.

## 1. Repositório no GitHub

```bash
git add -A && git commit -m "Primeira versão"
git remote add origin git@github.com:SEU_USUARIO/apuracao-2026.git
git push -u origin main
```

`.gitignore` já deixa de fora `live.json`, `history.json` e `snaps/` (gerados pelo coletor).

## 2. Site no Cloudflare (Workers com arquivos estáticos)

Dashboard → Workers & Pages → **Create application → Import a repository** → GitHub → `apuracao-2026`.

- Project name: `apuracao-2026` (igual ao `name` do `wrangler.toml`)
- Build command: (vazio)
- Deploy command: `npx wrangler deploy` (já vem preenchido)

O `wrangler.toml` diz tudo: os arquivos estáticos vêm de `site/` (o `_headers` é lido automaticamente), `worker/index.js`
atende só `/api/*` (coleta e painel do analytics) e o Analytics Engine fica ligado como `AE`. Cada push em `main` publica.
O site abre em `https://apuracao-2026.SEU_SUBDOMINIO.workers.dev`; domínio próprio em Settings → Domains & Routes.

## 3. Dados ao vivo sem R2 e sem cartão (recomendado)

Os dados ao vivo ficam num **projeto próprio**, `apuracao-dados` (`data-worker/`), que só serve arquivos estáticos
(`live.json`, `history.json`, `snaps/`) com CORS liberado e cache de 15 s. Arquivos estáticos não têm custo por requisição.
O coletor republica esse projeto a cada rodada (~13 s; só sobem os arquivos que mudaram). Como é separado do site,
**um `git push` nunca apaga os dados**. O `site/config.js` já aponta para `https://apuracao-dados.rbranganca.workers.dev/`
(em localhost usa `site/data/`).

Uma vez, no Mac: `npx wrangler login` (já feito). Teste:

```bash
collector/publish_live.sh        # publica data-worker/public/live.json
curl -I https://apuracao-dados.rbranganca.workers.dev/live.json
```

Na noite da apuração o coletor escreve direto em `data-worker/public/` (veja o passo 4).

Cuidados: não confirmei se a Cloudflare limita deploys por dia (testei vários seguidos, sem erro). Se aparecer erro, aumente o `--loop`.

## 3b. (Opcional) Dados ao vivo no R2

Só vale se você quiser CDN própria para o `live.json` (exige cartão cadastrado, sem cobrança dentro do grátis). 

1. R2 → Create bucket (ex.: `apuracao-dados`) → Settings → **Public access** (domínio `r2.dev` ou domínio próprio,
   ex.: `dados.seudominio.com`) e **CORS policy** (cole `collector/r2-cors.json`).
2. R2 → Manage API tokens → crie um token com permissão de *Object Read & Write* nesse bucket.
3. No Mac:

```bash
brew install rclone
rclone config      # n (novo) → nome: r2 → tipo: s3 → provider: Cloudflare → cole Access Key / Secret
                   # endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

4. Aponte o site para o bucket em `site/config.js`:

```js
window.TRACKER_LIVE_BASE = 'https://dados.seudominio.com/';   // ou https://pub-xxxx.r2.dev/
```

(faça commit; o Pages republica sozinho). Localmente, deixe `'data/'`.

## 4. Na noite da apuração (25/10)

```bash
caffeinate -i python3 collector/collect.py --election 6258 \
  --out data-worker/public/live.json --history data-worker/public/history.json \
  --snapshots data-worker/public/snaps --loop 45 \
  --after "collector/publish_live.sh"
```

Teste antes com o 1º turno ou um `live.json` qualquer: rode `collector/publish_live.sh` e abra `https://SEU_SITE/data/live.json`.
(Com R2: troque o `--after` por `collector/upload_r2.sh apuracao-dados`.)

## 5. Antes de divulgar

- `site/index.html`, `pesquisas.html` e `apuracao.html`: troque `og:image` por URL absoluta
  (`https://seudominio.com/og.jpg?v=2`). O X/Twitter e o WhatsApp exigem URL absoluta. A imagem é gerada por
  `NOWAIT=1 FORMAT=jpeg ... node collector/shot.js` (veja o início do arquivo); o WhatsApp guarda a prévia de cada link, então
  para ver a nova imagem compartilhe o link com `?v=2` (ou outro valor) no final.
- Analytics: Cloudflare → Web Analytics → Add site; cole o snippet antes de `</body>` nas três páginas.
- Fonte Petrona: hoje vem do Google Fonts (`<link>` nas páginas). Para hospedar no próprio site,
  baixe o `.woff2` para `site/fonts/` e troque o `<link>` por um `@font-face`.

## 6. Analytics próprio (painel `/analytics.html`)

O site manda eventos anônimos (`site/beacon.js` → `POST /api/e`) para uma Pages Function
(`functions/api/e.js`) que grava no **Workers Analytics Engine** (dataset `apuracao`, já declarado no `wrangler.toml`).
O painel privado (`site/analytics.html`) lê o resumo em `functions/api/stats.js`.

O que é guardado por evento: id aleatório do navegador (localStorage), id da sessão, página, origem (referrer/`utm_source`),
aparelho (celular/computador/tablet/TV), sistema, país, UF, cidade e nome da organização da rede (ASN). **Sem IP, sem cookies.**
O beacon respeita "Não rastrear" e não envia nada em `localhost`.

Configuração (uma vez):

1. **Plano pago dos Workers** (US$ 5/mês): o grátis (100 mil requisições de Worker por dia) acaba em minutos na noite da apuração.
   Só `/api/*` conta; os arquivos estáticos não. Dashboard → Workers & Pages → Plans.
2. Crie um **API token** (My Profile → API Tokens → Create Token → Custom) com `Account → Account Analytics → Read`.
3. Worker `apuracao-2026` → Settings → **Variables and Secrets** → Add, tipo *Secret*:
   - `CF_ACCOUNT_ID` — o ID da conta (barra lateral direita do dashboard)
   - `CF_API_TOKEN` — o token do passo 2
   - `STATS_TOKEN` — uma senha longa que você inventa (ex.: `openssl rand -hex 24`)
4. Faça um novo deploy (qualquer push) e abra `https://SEU_SITE/analytics.html`. Cole o `STATS_TOKEN`.

O binding `AE` (dataset `apuracao`) vem do `wrangler.toml`; confira em Settings → Bindings.

Pré-visualizar o painel sem dados: `analytics.html?demo`. Testar o beacon local: `LOG_BEACON=1 node collector/serve.js 8765` e abrir
`http://localhost:8765/?beacon`.

Observações:
- O Analytics Engine amostra quando o volume é alto; as contagens de pessoas são aproximadas.
- "Redes" mostra só organizações de interesse (justiça eleitoral, poder público, imprensa, bancos, tecnologia). Google/Microsoft/Amazon
  incluem robôs e nuvens, então leia como presença, não como pessoas.
- Cidade pode ser imprecisa em 4G (costuma acertar o estado). Links em apps de celular muitas vezes não mandam referrer: use
  `?utm_source=whatsapp` (ou `x`, `instagram`, `twitch`...) nos links que divulgar.
- Cloudflare Web Analytics (grátis) pode ser ligado também, em paralelo, para ter uma segunda fonte.

### Como o painel unifica Cloudflare e PostHog

- **Contagens** (visitas, pessoas diferentes, páginas vistas, estados, cidades, países, aparelhos, origem): o Cloudflare vê todos os navegadores,
  inclusive os que bloqueiam o script do PostHog; o painel mostra o maior dos dois, sem somar (somar contaria o mesmo visitante duas vezes).
- **Vendo agora e máximo ao mesmo tempo:** o PostHog manda um evento `viewing` a cada 60 s com a aba visível (até 4 h por navegador).
  Antes do primeiro evento do PostHog, a série vem dos batimentos antigos do Cloudflare; depois, do PostHog.
- **Tempo de tela:** soma dos batimentos do Cloudflare (antes do PostHog) com a duração das sessões do PostHog (depois).
- **Cota do PostHog:** 1 milhão de eventos por mês no plano grátis. Os batimentos de 60 s são o maior consumo: cerca de 60 eventos por
  pessoa por hora (5 mil pessoas ao mesmo tempo por 3 h já chegam a ~900 mil).
