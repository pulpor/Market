import { Asset, CalculateResponse } from "@/types/asset";
import { calculateAssets as calculateAssetsMock } from "./mockYahooFinance";

export async function calculateAssets(assets: Asset[]): Promise<CalculateResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  // Fallback para mock quando variáveis de ambiente não estiverem configuradas
  if (!supabaseUrl || !supabaseKey) {
    console.warn("VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY ausentes. Usando mock de Yahoo Finance.");
    return calculateAssetsMock(assets);
  }

  try {
    const functionUrl = `${supabaseUrl}/functions/v1/calculate-assets`;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ ativos: assets }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Erro ao calcular ativos");
    }

    return await response.json();
  } catch (err) {
    console.warn("Falha ao chamar função do Supabase. Usando mock local.", err);
    return calculateAssetsMock(assets);
  }
}
