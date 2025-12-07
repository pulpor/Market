-- ===================================================
-- MIGRATION: Corrigir tipo da coluna quantidade
-- Data: 2025-12-07
-- Descrição: Altera quantidade de INTEGER para NUMERIC para suportar frações de ações
-- ===================================================

-- Alterar tipo da coluna quantidade para suportar decimais
ALTER TABLE public.assets
  ALTER COLUMN quantidade TYPE NUMERIC(15,8);

-- Atualizar constraint para aceitar valores maiores que 0
ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_quantidade_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_quantidade_check CHECK (quantidade > 0);

-- Comentário explicativo
COMMENT ON COLUMN public.assets.quantidade IS 'Quantidade de ativos (suporta frações para ações fracionadas)';
