-- ===================================================
-- SCRIPT CONSOLIDADO DE MIGRAÇÕES
-- Execute este script completo no SQL Editor do Supabase
-- ===================================================

-- MIGRAÇÃO 1: Adicionar coluna is_international
-- ===================================================
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.assets.is_international IS 'Indica se o ativo é internacional (não adiciona .SA ao ticker)';

CREATE INDEX IF NOT EXISTS idx_assets_is_international 
  ON public.assets(is_international) 
  WHERE is_international = TRUE;


-- MIGRAÇÃO 2: Corrigir tipo da coluna quantidade
-- ===================================================
ALTER TABLE public.assets
  ALTER COLUMN quantidade TYPE NUMERIC(15,8);

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_quantidade_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_quantidade_check CHECK (quantidade > 0);

COMMENT ON COLUMN public.assets.quantidade IS 'Quantidade de ativos (suporta frações para ações fracionadas)';


-- Verificar estrutura final da tabela
-- ===================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'assets'
ORDER BY ordinal_position;
