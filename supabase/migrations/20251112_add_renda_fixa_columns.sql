-- ===================================================
-- MIGRATION: Adicionar colunas de Renda Fixa
-- Data: 2025-11-12
-- Descrição: Adiciona suporte para títulos de renda fixa
-- ===================================================

-- Adicionar colunas de Renda Fixa à tabela assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS tipo_ativo_manual TEXT,
  ADD COLUMN IF NOT EXISTS indice_referencia TEXT,
  ADD COLUMN IF NOT EXISTS taxa_contratada NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS valor_atual_rf NUMERIC(15,2);

-- Adicionar comentários nas colunas para documentação
COMMENT ON COLUMN public.assets.tipo_ativo_manual IS 'Tipo de renda fixa: Previdência, Tesouro Direto, CDB, LCI/LCA, Debêntures, etc.';
COMMENT ON COLUMN public.assets.indice_referencia IS 'Índice de referência: CDI, IPCA, Pré-fixado, Selic, IGP-M, etc.';
COMMENT ON COLUMN public.assets.taxa_contratada IS 'Taxa contratada em % a.a. (ex: 110 para 110% do CDI, ou 5.5 para IPCA + 5,5%)';
COMMENT ON COLUMN public.assets.data_vencimento IS 'Data de vencimento do título';
COMMENT ON COLUMN public.assets.valor_atual_rf IS 'Valor atual do título de renda fixa (para cálculo de rentabilidade)';

-- Criar índice para melhorar performance em queries de renda fixa
CREATE INDEX IF NOT EXISTS idx_assets_tipo_ativo_manual 
  ON public.assets(tipo_ativo_manual) 
  WHERE tipo_ativo_manual IS NOT NULL;

-- Verificar estrutura final da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'assets'
ORDER BY ordinal_position;

-- ===================================================
-- RESULTADO ESPERADO:
-- A tabela agora deve ter as seguintes colunas:
-- - id (uuid, PK)
-- - user_id (uuid, FK para auth.users)
-- - ticker (text)
-- - quantidade (numeric)
-- - preco_medio (numeric)
-- - setor (text)
-- - corretora (text)
-- - tipo_ativo_manual (text) [NOVA]
-- - indice_referencia (text) [NOVA]
-- - taxa_contratada (numeric) [NOVA]
-- - data_vencimento (date) [NOVA]
-- - valor_atual_rf (numeric) [NOVA]
-- - created_at (timestamp)
-- - updated_at (timestamp)
-- ===================================================
