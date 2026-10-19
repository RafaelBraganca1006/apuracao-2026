# Redirecionamento do endereço antigo

1. Crie uma conta Cloudflare grátis (outro e-mail) e, em Workers & Pages, defina o subdomínio da conta como `rbranganca`.
2. `cd redirect-worker && npx wrangler login` (entre com a conta nova) e depois `npx wrangler deploy`.
3. Teste: `curl -I https://apuracao-2026.rbranganca.workers.dev/debate` deve devolver 302 para `apuracao-2026.brlabs.workers.dev/debate`.

Atenção: `wrangler login` muda a conta ativa da sua máquina; volte a entrar na conta principal antes de deployar o site (`npx wrangler login` de novo).
