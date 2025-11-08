import { Asset } from "@/types/asset";

/**
 * Mescla ativos apenas quando o par (ticker normalizado, corretora) for igual.
 * - Tickers são comparados em uppercase e trim
 * - Corretora faz parte da chave de merge (não cruza corretoras diferentes)
 * - Soma quantidades e calcula preço médio ponderado
 * - Mantém setor mais recente se informado
 */
export function mergeAssetsByTicker(assets: Asset[]): Asset[] {
  const keyMap = new Map<string, Asset>();

  for (const asset of assets) {
    const normalizedTicker = asset.ticker.toUpperCase().trim();
    const key = `${normalizedTicker}__${asset.corretora}`; // chave inclui corretora

    if (keyMap.has(key)) {
      const existing = keyMap.get(key)!;

      // Calcula preço médio ponderado
      const totalQuantity = existing.quantidade + asset.quantidade;
      const weightedPrice =
        (existing.preco_medio * existing.quantidade + asset.preco_medio * asset.quantidade) /
        totalQuantity;

      keyMap.set(key, {
        ...existing,
        quantidade: totalQuantity,
        preco_medio: parseFloat(weightedPrice.toFixed(2)),
        setor: asset.setor || existing.setor,
      });
    } else {
      keyMap.set(key, { ...asset, ticker: normalizedTicker });
    }
  }

  return Array.from(keyMap.values());
}
