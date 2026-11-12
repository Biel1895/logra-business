# Logra Business

Projeto único para publicar o caixa na Vercel com autenticação e dados no Supabase. A página inicial, o caixa, o histórico, as estatísticas e a exportação ficam em `public/`. O visual é o do Logra Business, com menu superior, fontes Inter e ícones próprios.

## 1. Configurar o Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard), crie um projeto e aguarde a configuração.
2. No projeto, abra **SQL Editor → New query**. Copie todo o conteúdo de `supabase/001_caixa.sql`, cole e clique em **Run**. Execute uma vez. O script cria as tabelas `caixa_*`, as regras de acesso por conta e o histórico automático. Se essas tabelas já existirem em outro projeto, confira a estrutura antes de executar.
   Em novas consultas, execute as migrações na ordem: `supabase/002_servicos_sem_pagamento.sql` e `supabase/003_valor_pendente.sql`. Se o projeto já tem o 001 e o 002, execute apenas o 003 para liberar o valor pendente em vendas e serviços.
3. Em **Authentication → Users**, use a opção de criar um usuário com e-mail e senha. Use uma conta real para entrar no Logra Business. Se a conta exigir confirmação de e-mail, confirme-a antes do primeiro login. Para restringir o caixa às contas que você cria, desative **Allow new users to sign up** nas configurações de autenticação.
4. No painel **Connect** do projeto, copie a **Project URL** e a chave **Publishable**, que começa com `sb_publishable_`. O site usa essa chave pública com a sessão do usuário. Nenhuma chave `service_role` ou `sb_secret_` é necessária.

## 2. Enviar o projeto ao GitHub

Crie um repositório **privado** e vazio, por exemplo `logra-business`. Envie o conteúdo da pasta que contém este README e o `vercel.json`. O `vercel.json` deve ficar na raiz do repositório, junto com `package.json`, `public/`, `api/`, `lib/`, `src/`, `scripts/` e `supabase/`.

Com o Git instalado, abra o terminal na pasta do projeto e execute, trocando `SEU-USUARIO` pelo usuário do GitHub:

```powershell
git init -b main
git add .
git commit -m "Publicar Logra Business"
git remote add origin https://github.com/SEU-USUARIO/logra-business.git
git push -u origin main
```

O arquivo `.env.example` contém exemplos. Coloque as chaves reais diretamente nas variáveis de ambiente da Vercel. A [documentação do GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) mostra a configuração da conta e o envio.

## 3. Publicar na Vercel

1. Acesse [Vercel](https://vercel.com/new), clique em **Add New → Project**, conecte o GitHub e importe `logra-business`.
2. Use **Other** como preset se a Vercel pedir um. Mantenha a raiz do repositório como **Root Directory**. O `vercel.json` define o build (`npm run build`) e a pasta de saída (`dist`). O `package.json` seleciona Node.js 24.
3. Em **Environment Variables**, adicione as variáveis abaixo para **Production** antes de clicar em **Deploy**.

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL HTTPS do projeto Supabase, por exemplo `https://seu-projeto.supabase.co`. |
| `SUPABASE_PUBLISHABLE_KEY` | A chave Publishable copiada do Supabase. |
| `SITE_URL` | O endereço público HTTPS do site, por exemplo `https://seu-projeto.vercel.app`, sem caminho. |

Se você ainda não souber o domínio final, a compilação aceita `VERCEL_PROJECT_PRODUCTION_URL` quando a Vercel expõe as variáveis de sistema. Se precisar, defina `SITE_URL` explicitamente em **Settings → Environment Variables** com o domínio confirmado em **Settings → Domains** e faça **Redeploy**. Alterar uma variável só afeta novos deploys. [Variáveis da Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables) · [Variáveis de sistema](https://vercel.com/docs/environment-variables/system-environment-variables)

O plano Hobby da Vercel é para uso pessoal e não comercial. Para operar o caixa de uma loja, use um plano que permita uso comercial. [Regras de uso da Vercel](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)

## 4. Conferir o site no ar

1. Abra o domínio de produção e clique em **Entrar**.
2. Entre com a conta criada no Supabase. Registre uma venda de teste, recarregue a página e confira se ela aparece em **Vendas do dia** e no **Histórico**.
3. No celular, abra o domínio HTTPS. No Chrome ou Edge, use **Instalar aplicativo** ou a opção do menu. No Safari do iPhone, use **Compartilhar → Adicionar à Tela de Início**.
4. Compartilhe o endereço da página inicial no WhatsApp para conferir a prévia. O domínio e a imagem precisam estar acessíveis publicamente. Se o domínio mudar, atualize `SITE_URL` e publique novamente.

O caixa online consulta e grava no Supabase. Os lançamentos da antiga versão local ficam no navegador em que foram criados e não são importados automaticamente.

## IA opcional

A interpretação por regras já funciona sem chaves de IA. Para complementar o assistente, configure somente os provedores que deseja em **Settings → Environment Variables** da Vercel e faça um novo deploy. A função valida a sessão do Supabase e tenta os provedores configurados nesta ordem:

| Ordem | Provedor | Variáveis |
|---|---|---|
| 1 | Gemini | `GEMINI_API_KEY` |
| 2 | Groq | `GROQ_API_KEY` |
| 3 | Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` |
| 4 | OpenRouter | `OPENROUTER_API_KEY` |

Os modelos podem ser definidos com `GEMINI_MODEL`, `GROQ_MODEL`, `CLOUDFLARE_MODEL` e `OPENROUTER_MODEL`. Cotas e cobranças dependem de cada conta. Quando as regras não bastam, a frase digitada é enviada ao provedor consultado. A resposta volta como rascunho para revisão.

## Testar antes de publicar

O Live Server apenas lista ou serve arquivos. Para testar este projeto com login e a função de IA no computador, use `vercel dev` com as variáveis do projeto. Na Vercel, a configuração já compila a versão de produção automaticamente.
