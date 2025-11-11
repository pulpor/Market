import { Asset, CalculateResponse } from "@/types/asset";

export async function calculateAssets(assets: Asset[]): Promise<CalculateResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para usar dados reais.");
  }

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

  const result = await response.json();
  console.log(`✅ Dados reais do Yahoo Finance retornados para ${assets.length} ativo(s)`);
  return result as CalculateResponse;
}
