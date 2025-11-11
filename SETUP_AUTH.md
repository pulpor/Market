# Setup Rápido - Sistema de Autenticação

## 1. Criar Projeto no Supabase

1. Acesse https://app.supabase.com
2. Clique em "New Project"
3. Escolha nome e senha (anote tudo!)
4. Aguarde 2 minutos (setup automático)

## 2. Configurar Database

1. No dashboard Supabase, vá em **SQL Editor**
2. Clique em "New Query"
3. Cole o conteúdo de `supabase/migrations/001_create_assets_table.sql`
4. Clique em "Run" (cria tabela + policies)

## 3. Habilitar Autenticação

No dashboard Supabase:
- **Authentication** → **Providers**
  - Email: ✅ (já vem habilitado)
  - Google (opcional): adicione Client ID/Secret

## 4. Configurar Variáveis Locais

```powershell
# Copie o exemplo
copy .env.example .env.local

# Edite .env.local com suas credenciais:
# Settings → API → Project URL e anon/public key
```

## 5. Testar Localmente

```powershell
npm run dev
```

- Acesse http://localhost:8080
- Será redirecionado para /login
- Crie uma conta
- Confirme email (check inbox)
- Faça login

## 6. Deploy

### Vercel/Netlify

Adicione as variáveis de ambiente no dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

```powershell
vercel --prod
```

## Segurança

✅ `.env*` no .gitignore (nunca commitado)
✅ Row Level Security habilitado (isolamento por usuário)
✅ Apenas anon key exposta (público, sem risco)
✅ Dados sensíveis no backend Supabase

## Fallback

Sem Supabase configurado:
- ✅ App funciona normalmente
- ✅ Usa localStorage (dados locais)
- ❌ Não sincroniza entre dispositivos
