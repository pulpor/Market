# 🚀 Guia de Deploy para Produção

## Resumo
Seu projeto já está configurado com:
- ✅ Autenticação Supabase (login/registro)
- ✅ Banco de dados cloud (PostgreSQL no Supabase)
- ✅ Sincronização automática de ativos
- ✅ Row Level Security (RLS) - cada usuário vê apenas seus dados
- ✅ Backup redundante (Supabase + localStorage)

## 📋 Pré-requisitos Verificados

### Supabase (Banco de Dados + Auth)
- ✅ Projeto criado: `arswitzyykmjfjkuby.supabase.co`
- ✅ Credenciais configuradas no `.env`
- ✅ Tabela `assets` com RLS policies
- ✅ Autenticação ativada

### Vercel (Hospedagem)
- ✅ Arquivo `vercel.json` configurado
- ✅ Build funcional (`npm run build`)

## 🎯 Como Funciona em Produção

### Fluxo de Dados
```
Usuário faz login → Supabase Auth
     ↓
Carrega ativos → Supabase Database (PostgreSQL)
     ↓
Backup local → localStorage (navegador)
     ↓
Salva alterações → Supabase (UPSERT seguro) + localStorage
```

### Segurança
- **Row Level Security (RLS)**: Cada usuário só acessa seus próprios ativos
- **Backup automático**: Antes de cada salvamento
- **UPSERT seguro**: Nunca deleta dados acidentalmente
- **Sincronização cross-device**: Mesma conta = mesmos dados em qualquer dispositivo

## 🚀 Deploy no Vercel

### Opção 1: Via Interface Web (Mais Fácil)

1. **Acesse**: https://vercel.com
2. **Faça login** com GitHub
3. **Novo Projeto**: 
   - Clique em "Add New..." → "Project"
   - Selecione o repositório `pulpor/Market`
   - Branch: `copilot/fix-index-data-fetching` (ou `main` depois do merge)
4. **Configure variáveis de ambiente**:
   ```
   VITE_SUPABASE_URL=https://arswitzyykmjfjkuby.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. **Deploy**: Clique em "Deploy"

### Opção 2: Via CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer login
vercel login

# Deploy (primeira vez)
vercel

# Deploy para produção
vercel --prod
```

Durante o setup:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Adicione as variáveis do Supabase

## 🔐 Configurar Autenticação no Supabase

### 1. Configurar URL do Site no Supabase

Acesse: https://app.supabase.com/project/arswitzyykmjfjkuby/auth/url-configuration

Configure:
```
Site URL: https://seu-projeto.vercel.app
Redirect URLs: 
  - https://seu-projeto.vercel.app
  - https://seu-projeto.vercel.app/**
  - http://localhost:8080 (para desenvolvimento)
```

### 2. Ativar Provedores de Autenticação

Acesse: https://app.supabase.com/project/arswitzyykmjfjkuby/auth/providers

Ative:
- ✅ **Email** (já deve estar ativo)
- ✅ **Google OAuth** (opcional, já tem código)

Para Google OAuth:
1. Crie projeto no Google Cloud Console
2. Configure OAuth 2.0
3. Adicione credenciais no Supabase

## 📊 Verificar Database

Execute no Supabase SQL Editor:

```sql
-- Ver todos os ativos
SELECT * FROM public.assets ORDER BY created_at DESC;

-- Contar ativos por usuário
SELECT user_id, COUNT(*) as total 
FROM public.assets 
GROUP BY user_id;

-- Verificar estrutura
\d public.assets
```

## ✅ Checklist Antes do Deploy

- [x] Supabase configurado e funcionando
- [x] Variáveis de ambiente no `.env`
- [x] Build local funciona (`npm run build`)
- [x] Autenticação testada localmente
- [ ] Deploy no Vercel realizado
- [ ] Variáveis de ambiente adicionadas no Vercel
- [ ] Site URL configurado no Supabase
- [ ] Teste: Criar conta no site em produção
- [ ] Teste: Adicionar ativos
- [ ] Teste: Fazer logout e login em outro dispositivo
- [ ] Teste: Verificar se ativos aparecem corretamente

## 🧪 Testar em Produção

### Teste 1: Criar Conta
1. Acesse seu site: `https://seu-projeto.vercel.app`
2. Clique em "Criar Conta" / "Sign Up"
3. Use email real (você receberá email de confirmação)
4. Confirme email clicando no link

### Teste 2: Adicionar Ativos
1. Faça login
2. Adicione alguns ativos (ex: PETR4, VALE3)
3. Clique em "Salvar Carteira"
4. Verifique console: deve mostrar "✅ salvos no Supabase"

### Teste 3: Cross-Device
1. Abra navegador em modo anônimo (ou outro dispositivo)
2. Acesse o site
3. Faça login com mesma conta
4. Verifique se seus ativos aparecem
5. Adicione novo ativo
6. Volte no primeiro navegador, recarregue
7. Novo ativo deve aparecer

## 🐛 Troubleshooting

### Problema: "Usuário não autenticado"
**Solução**: Configure Site URL no Supabase corretamente

### Problema: "Erro ao salvar no Supabase"
**Solução**: 
1. Verifique variáveis de ambiente no Vercel
2. Verifique RLS policies no Supabase
3. Veja console do navegador para erros específicos

### Problema: Ativos não aparecem em outro dispositivo
**Solução**:
1. Confirme que está usando mesma conta
2. Verifique se salvou no Supabase (não só localStorage)
3. Veja logs no console: "✅ salvos no Supabase"

### Problema: Build falha no Vercel
**Solução**:
1. Teste build local: `npm run build`
2. Verifique erros no log do Vercel
3. Adicione variáveis de ambiente no Vercel

## 📱 Features Prontas para Produção

### ✅ Autenticação
- Login com email/senha
- Registro de novos usuários
- Confirmação por email
- Logout
- Google OAuth (código já implementado)

### ✅ Sincronização de Dados
- Salva automaticamente no Supabase
- Backup redundante no localStorage
- UPSERT seguro (não perde dados)
- Cross-device sync
- Funciona offline (com localStorage)

### ✅ Segurança
- Row Level Security (RLS)
- Cada usuário vê só seus dados
- Políticas do Supabase protegem contra acesso indevido
- Backup automático antes de salvar

### ✅ Performance
- Market indicators com fallback (brapi + stooq)
- Cache de cotações
- Build otimizado

## 🎉 Próximos Passos

1. ✅ Fazer deploy no Vercel
2. ✅ Configurar Site URL no Supabase
3. ✅ Testar criação de conta
4. ✅ Testar sincronização cross-device
5. 🎯 Compartilhar link com usuários
6. 📊 Monitorar uso no Supabase Dashboard
7. 🚀 Migrar para branch `main` depois de testar

## 📞 Suporte

Se encontrar problemas:
1. Verifique console do navegador (F12)
2. Verifique logs do Vercel
3. Verifique logs do Supabase (SQL Editor)
4. Compartilhe erro específico para análise

## 🔗 Links Úteis

- **Seu Supabase**: https://app.supabase.com/project/arswitzyykmjfjkuby
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Documentação Supabase**: https://supabase.com/docs
- **Documentação Vercel**: https://vercel.com/docs
