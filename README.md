# Market (Dashboard B3)

Aplicação React + Vite + Tailwind que calcula e exibe sua carteira de ativos da B3 (alocação, DY e P/L da posição), usando Supabase Edge Functions para buscar cotações no Yahoo Finance. Em ambiente de desenvolvimento, há fallback automático para um mock local que funciona sem nenhuma configuração externa.

**✨ Novidade:** Sistema de persistência local em arquivo JSON (privado, não vai pro Git).

## Requisitos

- Node.js 18+ (recomendado LTS)
- npm 8+

## Como rodar (Windows PowerShell)

### 1. Instale as dependências

```
npm install
```

### 2. (Opcional) Configure variáveis de ambiente no arquivo `.env` na raiz do projeto

```
VITE_SUPABASE_URL="https://<seu-project-id>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<sua-anon-key>"
```

Sem essas variáveis, o app usa automaticamente o mock local (sem chamadas externas) e funciona normalmente para testes.

### 3. Inicie o servidor de armazenamento local (em um terminal)

```
npm run storage
```

Este servidor roda na porta **3001** e gerencia o arquivo `assets.json` (seus ativos salvos localmente).

### 4. Inicie o app React (em outro terminal)

```
npm run dev
```

Abra o navegador em http://localhost:8080.

## 💾 Como funciona o salvamento de ativos

- **Arquivo:** `assets.json` na raiz do projeto (ignorado pelo `.gitignore`)
- **Servidor local:** Node.js/Express na porta 3001 (script `server/storage-server.js`)
- **Fluxo:**
  1. Ao abrir o app, os ativos são carregados automaticamente do `assets.json`
  2. Você adiciona/remove ativos na interface
  3. Clica no botão **"Salvar Carteira"** para gravar no arquivo
  4. O servidor grava em `assets.json` de forma segura

**Importante:** O arquivo `assets.json` NÃO é commitado no Git (privacidade). Há um `assets.json.example` vazio como referência.

## Como funciona o fallback (mock)

O serviço `src/services/yahooFinance.ts` tenta chamar a função Edge `calculate-assets` no Supabase. Se as variáveis `VITE_SUPABASE_URL` ou `VITE_SUPABASE_PUBLISHABLE_KEY` não estiverem definidas, ou se a chamada falhar, ele usa o `src/services/mockYahooFinance.ts`, gerando cotações e DY verossímeis (com cache em memória) para rodar sem dependências externas.

## Deploy da função no Supabase (opcional)

Com o CLI do Supabase instalado e autenticado:

1. Ajuste `supabase/config.toml` e confirme o `project_id`.
2. Faça o deploy da função Edge:

```
supabase functions deploy calculate-assets --project-ref <seu-project-id>
```

3. Nas variáveis do `.env`, coloque a `VITE_SUPABASE_URL` do seu projeto e a `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) para que o app consuma a função em produção/preview.

## Scripts disponíveis

- `npm run dev` — inicia o Vite em http://localhost:8080
- `npm run storage` — inicia o servidor de armazenamento local (porta 3001)
- `npm run build` — build de produção
- `npm run preview` — preview do build
- `npm run lint` — lints

## Estrutura principal

- `src/pages/Index.tsx` — tela principal (formulário, lista e gráficos)
- `src/services/yahooFinance.ts` — integração Supabase + fallback para mock
- `src/services/mockYahooFinance.ts` — mock local de cotações/DY
- `src/services/fileStorage.ts` — funções de carga/salvamento do assets.json
- `server/storage-server.js` — servidor Express para persistência local
- `assets.json` — seus ativos (ignorado pelo Git, privado)
- `supabase/functions/calculate-assets` — função Edge que consulta Yahoo Finance

## Observações

- O tema e componentes UI usam Tailwind e shadcn/ui.
- Porta de desenvolvimento configurada em 8080 no `vite.config.ts`.
- **Dois terminais necessários:** um para `npm run dev`, outro para `npm run storage`.
