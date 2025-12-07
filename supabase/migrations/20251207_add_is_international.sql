-- ===================================================
-- MIGRATION: Adicionar coluna is_international
-- Data: 2025-12-07
-- Descrição: Adiciona suporte para ativos internacionais
-- ===================================================

-- Adicionar coluna is_international à tabela assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN public.assets.is_international IS 'Indica se o ativo é internacional (não adiciona .SA ao ticker)';

-- Criar índice para melhorar performance em queries de ativos internacionais
CREATE INDEX IF NOT EXISTS idx_assets_is_international 
  ON public.assets(is_international) 
  WHERE is_international = TRUE;

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
