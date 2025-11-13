-- Ensure assets table has all required columns used by the app
-- Safe ALTERs with IF NOT EXISTS patterns using DO blocks

-- data_vencimento
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'data_vencimento'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN data_vencimento date;
  END IF;
END $$;

-- data_aplicacao
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'data_aplicacao'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN data_aplicacao date;
  END IF;
END $$;

-- valor_atual_rf
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'valor_atual_rf'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN valor_atual_rf numeric;
  END IF;
END $$;

-- tipo_ativo_manual
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'tipo_ativo_manual'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN tipo_ativo_manual text;
  END IF;
END $$;

-- indice_referencia
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'indice_referencia'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN indice_referencia text;
  END IF;
END $$;

-- taxa_contratada
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'taxa_contratada'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN taxa_contratada numeric;
  END IF;
END $$;
