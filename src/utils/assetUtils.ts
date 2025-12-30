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

    // Para renda fixa (tipo_ativo_manual definido) NÃO agregamos posições
    // Cada lançamento representa um contrato/título separado mesmo que o "ticker" coincida.
    // Mantemos o objeto como está apenas normalizando ticker.
    if (asset.tipo_ativo_manual) {
      keyMap.set(`${normalizedTicker}__${asset.id}`, { ...asset, ticker: normalizedTicker });
      continue;
    }

    const key = `${normalizedTicker}__${asset.corretora}`; // chave inclui corretora

    if (keyMap.has(key)) {
      const existing = keyMap.get(key)!;

      // Combina movimentos para ativos multiaportes
      const mergedMovs = [
        ...(existing.movimentos || []),
        ...(asset.movimentos || []),
      ];
      const hasMovements = mergedMovs.length > 0;

      const totalMovCotas = hasMovements ? mergedMovs.reduce((sum, m) => sum + m.cotas, 0) : 0;
      const totalMovValor = hasMovements ? mergedMovs.reduce((sum, m) => sum + m.valor, 0) : 0;

      // Calcula preço médio ponderado para renda variável
      const totalQuantity = hasMovements
        ? totalMovCotas
        : existing.quantidade + asset.quantidade;

      const weightedPrice = hasMovements
        ? totalMovValor / (totalMovCotas || 1)
        : (existing.preco_medio * existing.quantidade + asset.preco_medio * asset.quantidade) / totalQuantity;

      keyMap.set(key, {
        ...existing,
        quantidade: totalQuantity,
        preco_medio: parseFloat(weightedPrice.toFixed(2)),
        setor: asset.setor || existing.setor,
        is_international: asset.is_international || existing.is_international,
        movimentos: hasMovements ? mergedMovs : existing.movimentos,
      });
    } else {
      keyMap.set(key, { ...asset, ticker: normalizedTicker });
    }
  }

  return Array.from(keyMap.values());
}
