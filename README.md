# Market (Dashboard B3)

Aplicação React + Vite + Tailwind que calcula e exibe sua carteira de ativos da B3 (alocação, DY e P/L da posição). A função de cálculo/consulta do Yahoo Finance roda como Function no Vercel em `/api/calculate-assets`.

**✨ Novidade:**
- IDs de ativos normalizados para UUID v4 (compatível entre dispositivos)
- Persistência local opcional em `assets.json` (privado, não vai pro Git)

## Requisitos

- Node.js 18+ (recomendado LTS)
- npm 8+

## Como rodar (Windows PowerShell)

### 1. Instale as dependências

```
npm install
```

### 2. Configure variáveis de ambiente no arquivo `.env` na raiz do projeto (Firebase)

O app usa Firebase Auth (login) + Firestore (persistência). Crie um projeto no Firebase e copie as chaves do Web App:

```
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
```

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

## Cálculo de ativos (Yahoo Finance)

O serviço `src/services/yahooFinance.ts` chama a rota `/api/calculate-assets`, que é uma Function em `api/calculate-assets.ts` (runtime edge). Isso elimina dependência de Supabase para as cotações.

## Scripts disponíveis

- `npm run dev` — inicia o Vite em http://localhost:8080
- `npm run storage` — inicia o servidor de armazenamento local (porta 3001)
- `npm run build` — build de produção
- `npm run preview` — preview do build
- `npm run lint` — lints

## Estrutura principal

- `src/pages/Index.tsx` — tela principal (formulário, lista e gráficos)
- `src/services/yahooFinance.ts` — client da rota `/api/calculate-assets`
- `src/services/fileStorage.ts` — persistência de ativos no Firestore + backup localStorage
- `server/storage-server.js` — servidor Express para persistência local
- `assets.json` — seus ativos (ignorado pelo Git, privado)
- `api/calculate-assets.ts` — Function (Vercel) que consulta Yahoo Finance

## Observações

- O tema e componentes UI usam Tailwind e shadcn/ui.
- Porta de desenvolvimento configurada em 8080 no `vite.config.ts`.
- **Dois terminais necessários:** um para `npm run dev`, outro para `npm run storage`.
