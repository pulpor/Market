# Configuração do Supabase para funcionar em Localhost

## Problema
Quando você faz login no `localhost:5173`, está sendo redirecionado para `https://pulpor-market.vercel.app`.

## Solução
Configure as URLs permitidas no Supabase Dashboard:

### Passo 1: Acesse o Dashboard do Supabase
1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Authentication** → **URL Configuration**

### Passo 2: Adicione as URLs de desenvolvimento

Na seção **Redirect URLs**, adicione:
```
http://localhost:5173
http://localhost:5173/
http://localhost:4173
http://localhost:4173/
http://localhost:3000
http://localhost:3000/
```

Na seção **Site URL**, certifique-se que está:
```
https://pulpor-market.vercel.app
```

### Passo 3: Adicione as URLs permitidas (Additional Redirect URLs)
No campo **Additional Redirect URLs** (ou **Allowed Redirect URLs**), adicione cada URL em uma linha:
```
http://localhost:5173/**
http://localhost:4173/**
http://localhost:3000/**
https://pulpor-market.vercel.app/**
```

### Passo 4: Salve as configurações
Clique em **Save** no final da página.

## Verificação
Após salvar, tente fazer login novamente no `localhost:5173`. Agora deve permanecer no localhost após o login.

## Portas comuns de desenvolvimento
- `5173` - Vite dev server (padrão)
- `4173` - Vite preview (build de produção local)
- `3000` - Alternativa comum para dev

## Nota sobre Google OAuth
Se você estiver usando login com Google, também precisará adicionar essas URLs no Google Cloud Console:
1. Acesse https://console.cloud.google.com
2. Selecione seu projeto
3. Vá em **APIs & Services** → **Credentials**
4. Edite o OAuth 2.0 Client ID
5. Adicione as URLs de localhost em **Authorized redirect URIs**
