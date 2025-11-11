import { Asset } from "@/types/asset";
import { supabase } from "@/lib/supabase";

const API_URL = "http://localhost:3001/api/assets";
const LOCAL_STORAGE_KEY = "dashboard-b3-assets";

// Detecta se está em produção (sem servidor local disponível)
const isProduction = import.meta.env.PROD;

// Check if Supabase is configured
const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Carrega os ativos do usuário logado no Supabase (se configurado),
 * ou fallback para servidor local (dev) ou localStorage (prod)
 */
export async function loadAssets(): Promise<Asset[]> {
  // Tenta Supabase primeiro se configurado
  if (hasSupabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("⚠️ Usuário não autenticado");
        return [];
      }

      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('ticker');

      if (error) {
        console.error("❌ Erro ao carregar do Supabase:", error);
        return [];
      }

      console.log(`✅ ${data.length} ativo(s) carregado(s) do Supabase`);
      return data.map(asset => ({
        id: asset.id,
        ticker: asset.ticker,
        quantidade: asset.quantidade,
        preco_medio: parseFloat(asset.preco_medio),
        setor: asset.setor,
        corretora: asset.corretora,
      }));
    } catch (error) {
      console.error("❌ Erro ao acessar Supabase:", error);
    }
  }

  // Fallback: Em produção, usa localStorage
  if (isProduction) {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        const assets = JSON.parse(data);
        console.log(`✅ ${assets.length} ativo(s) carregado(s) do localStorage`);
        return assets;
      }
      console.log("ℹ️ Nenhum ativo salvo ainda no localStorage.");
      return [];
    } catch (error) {
      console.error("❌ Erro ao carregar do localStorage:", error);
      return [];
    }
  }

  // Fallback: Em desenvolvimento, usa servidor local
  try {
    console.log("🔄 Carregando ativos do servidor...");
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      console.warn("❌ Erro ao carregar assets.json do servidor local.");
      return [];
    }

    const data = await response.json();
    console.log("📦 Dados recebidos do servidor:", data);
    
    if (!Array.isArray(data.assets)) {
      console.warn("⚠️ Formato inválido no assets.json. Esperado: { assets: [...] }");
      return [];
    }

    if (data.assets.length === 0) {
      console.log("ℹ️ Nenhum ativo salvo ainda. Arquivo vazio.");
    } else {
      console.log(`✅ ${data.assets.length} ativo(s) carregado(s) do arquivo assets.json`);
    }
    
    return data.assets;
  } catch (error) {
    console.error("❌ Erro ao carregar assets:", error);
    console.warn("⚠️ Servidor local não está rodando. Execute 'npm run storage' em outro terminal.");
    return [];
  }
}

/**
 * Salva os ativos no Supabase (se configurado),
 * ou fallback para servidor local (dev) ou localStorage (prod)
 */
export async function saveAssets(assets: Asset[]): Promise<boolean> {
  // Tenta Supabase primeiro se configurado
  if (hasSupabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error("❌ Usuário não autenticado");
        return false;
      }

      // Delete all existing assets for this user
      const { error: deleteError } = await supabase
        .from('assets')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error("❌ Erro ao deletar ativos antigos:", deleteError);
        return false;
      }

      // Insert new assets
      if (assets.length > 0) {
        const { error: insertError } = await supabase
          .from('assets')
          .insert(
            assets.map(asset => ({
              user_id: user.id,
              ticker: asset.ticker,
              quantidade: asset.quantidade,
              preco_medio: asset.preco_medio,
              setor: asset.setor,
              corretora: asset.corretora,
            }))
          );

        if (insertError) {
          console.error("❌ Erro ao inserir ativos:", insertError);
          return false;
        }
      }

      console.log(`✅ ${assets.length} ativo(s) salvo(s) no Supabase`);
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
      return false;
    }
  }

  // Fallback: Em produção, usa localStorage
  if (isProduction) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assets));
      console.log(`✅ ${assets.length} ativo(s) salvo(s) no localStorage`);
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar no localStorage:", error);
      return false;
    }
  }

  // Fallback: Em desenvolvimento, usa servidor local
  try {
    console.log(`💾 Salvando ${assets.length} ativo(s)...`, assets);
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assets }),
    });

    if (!response.ok) {
      throw new Error("Falha ao salvar");
    }

    const result = await response.json();
    console.log("✅ Ativos salvos com sucesso no arquivo assets.json");
    return true;
  } catch (error) {
    console.error("❌ Erro ao salvar ativos:", error);
    console.warn("⚠️ Certifique-se de que o servidor local está rodando: 'npm run storage'");
    return false;
  }
}
