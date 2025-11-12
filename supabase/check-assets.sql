-- Script para verificar e recuperar ativos do Supabase
-- Execute no SQL Editor do Supabase Dashboard

-- 1. Ver TODOS os registros da tabela assets (para confirmar se há dados)
SELECT 
  id,
  user_id,
  ticker,
  quantidade,
  preco_medio,
  corretora,
  setor,
  tipo_ativo_manual,
  indice_referencia,
  taxa_contratada,
  data_vencimento,
  valor_atual_rf,
  created_at,
  updated_at
FROM public.assets
ORDER BY created_at DESC;

-- 2. Contar total de registros
SELECT COUNT(*) as total_assets FROM public.assets;

-- 3. Ver registros por usuário
SELECT 
  user_id,
  COUNT(*) as num_assets,
  STRING_AGG(ticker, ', ') as tickers
FROM public.assets
GROUP BY user_id;

-- 4. Verificar estrutura da tabela (se tem as colunas de RF)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'assets'
ORDER BY ordinal_position;

-- 5. Se precisar adicionar colunas de Renda Fixa:
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS tipo_ativo_manual TEXT,
  ADD COLUMN IF NOT EXISTS indice_referencia TEXT,
  ADD COLUMN IF NOT EXISTS taxa_contratada NUMERIC,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS valor_atual_rf NUMERIC;
