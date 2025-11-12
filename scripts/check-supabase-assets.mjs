import { createClient } from '@supabase/supabase-js';

// Script de diagnóstico: verifica ativos no Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'YOUR_SUPABASE_KEY';

if (supabaseUrl.includes('YOUR_') || supabaseKey.includes('YOUR_')) {
  console.error('❌ Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssets() {
  console.log('🔍 Verificando ativos no Supabase...\n');

  // 1. Verificar usuário autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Erro de autenticação:', authError?.message || 'Usuário não encontrado');
    console.log('\n💡 Você precisa estar logado na aplicação para usar este script.');
    process.exit(1);
  }

  console.log(`✅ Usuário autenticado: ${user.email}`);
  console.log(`   User ID: ${user.id}\n`);

  // 2. Buscar todos os ativos deste usuário
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar ativos:', error.message);
    process.exit(1);
  }

  if (!assets || assets.length === 0) {
    console.log('⚠️  NENHUM ativo encontrado no Supabase para este usuário.');
    console.log('\n🔍 Verificando se a tabela tem registros de outros usuários...\n');
    
    // Verificar se há registros gerais (sem filtro de user_id)
    const { data: allAssets, error: allError } = await supabase
      .from('assets')
      .select('user_id, ticker')
      .limit(10);
    
    if (allError) {
      console.error('❌ Erro ao buscar registros gerais:', allError.message);
    } else if (allAssets && allAssets.length > 0) {
      console.log(`ℹ️  Existem ${allAssets.length} registro(s) na tabela (de outros usuários)`);
      console.log('   Seus ativos podem ter sido deletados ou nunca foram salvos.\n');
    } else {
      console.log('ℹ️  A tabela está completamente vazia.\n');
    }

    console.log('📋 Possíveis causas:');
    console.log('   1. Os ativos foram deletados por uma operação de save com lista vazia');
    console.log('   2. Houve erro ao inserir após deletar (estratégia delete+insert)');
    console.log('   3. Os ativos nunca foram salvos no Supabase (só localStorage)\n');
    
    process.exit(0);
  }

  // 3. Exibir ativos encontrados
  console.log(`✅ Encontrados ${assets.length} ativo(s):\n`);
  
  assets.forEach((asset, i) => {
    console.log(`${i + 1}. ${asset.ticker} (${asset.corretora})`);
    console.log(`   Quantidade: ${asset.quantidade}`);
    console.log(`   Preço Médio: R$ ${asset.preco_medio}`);
    console.log(`   Setor: ${asset.setor || 'N/A'}`);
    
    if (asset.tipo_ativo_manual) {
      console.log(`   🏦 Renda Fixa: ${asset.tipo_ativo_manual}`);
      if (asset.indice_referencia) console.log(`      Índice: ${asset.indice_referencia}`);
      if (asset.taxa_contratada) console.log(`      Taxa: ${asset.taxa_contratada}%`);
      if (asset.valor_atual_rf) console.log(`      Valor Atual: R$ ${asset.valor_atual_rf}`);
    }
    
    console.log(`   Criado em: ${new Date(asset.created_at).toLocaleString('pt-BR')}`);
    console.log('');
  });

  console.log('✅ Verificação completa!');
}

checkAssets().catch(err => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
