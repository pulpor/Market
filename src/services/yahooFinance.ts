import { Asset, CalculateResponse } from "@/types/asset";

export async function calculateAssets(assets: Asset[]): Promise<CalculateResponse> {
  const response = await fetch('/api/calculate-assets', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ativos: assets }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao calcular ativos");
  }

  const result = await response.json();
  return result as CalculateResponse;
}
