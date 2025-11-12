/**
 * Formata números no padrão brasileiro
 * @param value - Valor numérico a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada com vírgula para decimais e ponto para milhares
 */
export const formatBRL = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formata valores monetários no padrão brasileiro
 * @param value - Valor numérico
 * @param showSign - Se deve mostrar sinal + para valores positivos
 * @returns String formatada "R$ X.XXX,XX" ou "R$ +X.XXX,XX"
 */
export const formatCurrency = (value: number, showSign: boolean = false): string => {
  const formatted = formatBRL(value, 2);
  const sign = showSign && value >= 0 ? '+' : '';
  return `R$ ${sign}${formatted}`;
};

/**
 * Formata percentuais no padrão brasileiro
 * @param value - Valor percentual
 * @param decimals - Número de casas decimais (padrão: 2)
 * @param showSign - Se deve mostrar sinal + para valores positivos
 * @returns String formatada "X,XX%" ou "+X,XX%"
 */
export const formatPercent = (value: number, decimals: number = 2, showSign: boolean = false): string => {
  const formatted = formatBRL(value, decimals);
  const sign = showSign && value >= 0 ? '+' : '';
  return `${sign}${formatted}%`;
};
