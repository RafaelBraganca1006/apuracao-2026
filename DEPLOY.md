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

## 3. Dados ao vivo no R2

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
  --out site/data/live.json --history site/data/history.json \
  --snapshots site/data/snaps --loop 45 \
  --after "collector/upload_r2.sh apuracao-dados"
```

Teste antes com o 1º turno ou um `live.json` qualquer: rode `collector/upload_r2.sh apuracao-dados` e abra
`https://dados.seudominio.com/live.json`.

## 5. Antes de divulgar

- `site/index.html`, `pesquisas.html` e `apuracao.html`: troque `og:image` por URL absoluta
  (`https://seudominio.com/og.png`). O X/Twitter exige URL absoluta.
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
