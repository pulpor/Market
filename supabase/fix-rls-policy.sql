-- Corrigir política RLS para permitir INSERT/UPDATE quando user_id corresponde ao usuário logado
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard/project/wgxiddsxmoldeqqvgcqc/sql

-- 1. Remover políticas existentes
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;

-- 2. Recriar política INSERT com USING e WITH CHECK corretos
CREATE POLICY "Users can insert own assets"
ON assets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Recriar política UPDATE com USING e WITH CHECK
CREATE POLICY "Users can update own assets"
ON assets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Verificar se políticas foram criadas corretamente
SELECT 
  policyname,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies
WHERE tablename = 'assets'
ORDER BY cmd;
