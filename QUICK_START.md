# 🚀 Guia Rápido de Deploy - 5 Minutos

## ✅ Status Atual
Seu projeto JÁ ESTÁ PRONTO para produção! 

- ✅ Autenticação funcionando (Supabase)
- ✅ Banco de dados configurado
- ✅ Build funcional
- ✅ Sincronização cross-device
- ✅ Row Level Security ativa

## 🎯 Deploy em 5 Minutos

### Passo 1: Vercel (2 min)

1. Acesse: https://vercel.com/new
2. Conecte com GitHub
3. Selecione repositório: `pulpor/Market`
4. Adicione variáveis de ambiente:
   ```
   VITE_SUPABASE_URL=https://arswitzyykmjfjkuby.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyc3dpdHp5eWttamZqa3VieSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzMxMjg5OTUwLCJleHAiOjIwNDY4NjU5NTB9.pTT0NXw4gtZ824_5vJfVig_k4d07Mdo
   ```
5. Clique em "Deploy"

### Passo 2: Supabase URL Config (1 min)

1. Acesse: https://app.supabase.com/project/arswitzyykmjfjkuby/auth/url-configuration
2. Após deploy, adicione em "Redirect URLs":
   ```
   https://SEU-PROJETO.vercel.app
   https://SEU-PROJETO.vercel.app/**
   ```
3. Salve

### Passo 3: Testar (2 min)

1. Acesse seu site: `https://SEU-PROJETO.vercel.app`
2. Clique em "Sign Up" (criar conta)
3. Use email real
4. Confirme pelo email
5. Adicione alguns ativos
6. Faça logout
7. Login de novo → ativos devem estar lá ✅

## 🎉 Pronto!

Seu dashboard está no ar e funcionando!

### O que já funciona:
- ✅ Login/Registro
- ✅ Adicionar/Remover ativos
- ✅ Salvar na nuvem (Supabase)
- ✅ Acessar de qualquer lugar
- ✅ Cada usuário vê só seus dados
- ✅ Backup automático
- ✅ Market indicators (Ibovespa, S&P 500, etc)

### Compartilhe:
Envie o link `https://SEU-PROJETO.vercel.app` para quem quiser usar!

## 📋 Verificação Final

Execute este teste:
1. Crie conta no site em produção
2. Adicione 3 ativos
3. Abra em modo anônimo (ou outro PC)
4. Faça login com mesma conta
5. Veja se os 3 ativos aparecem ✅

Se sim: **TUDO FUNCIONANDO!** 🎉

## 🐛 Se der problema:

Veja o `DEPLOY.md` completo para troubleshooting detalhado.

## 📱 Alternativa: GitHub Pages

Se preferir GitHub Pages ao invés de Vercel:

1. Vá em Settings do repositório
2. Pages → Source: GitHub Actions
3. Crie `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 18
         - run: npm ci
         - run: npm run build
           env:
             VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
             VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```
4. Adicione secrets no GitHub (Settings → Secrets)
5. Push para main → auto-deploy!

Mas **Vercel é mais fácil** (zero config!).
