import { Asset } from "@/types/asset";

const API_URL = "http://localhost:3001/api/assets";

/**
 * Carrega os ativos salvos do servidor local (porta 3001)
 */
export async function loadAssets(): Promise<Asset[]> {
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
 * Salva os ativos no arquivo assets.json via servidor local
 */
export async function saveAssets(assets: Asset[]): Promise<boolean> {
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
