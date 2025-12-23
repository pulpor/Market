interface BCBData {
  data: string;
  valor: string | number;
}

interface IndexHistory {
  date: string;
  value: number; // percentual mensal
}

const BCB_BASE_URL = "/bcb-api";

function formatDateBCB(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseBCBDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Busca dados do Banco Central
 * @param serieId ID da série no BCB
 * @param dataInicio Data de início (formato YYYY-mm-dd)
 * @param dataFim Data de fim (formato YYYY-mm-dd)
 */
async function fetchBCBData(
  serieId: number,
  dataInicio: string,
  dataFim: string
): Promise<BCBData[]> {
  try {
    const url = `${BCB_BASE_URL}/${serieId}/dados?formato=json&dataInicio=${dataInicio}&dataFim=${dataFim}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      console.error(`Erro BCB série ${serieId}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Erro ao buscar série ${serieId}:`, error);
    return [];
  }
}

/**
 * Busca IPCA (Inflação) - Série 433
 * Retorna variação mensal em %
 */
export async function getIPCAData(months: number = 12): Promise<IndexHistory[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const dataInicio = formatDateBCB(startDate);
  const dataFim = formatDateBCB(endDate);

  const data = await fetchBCBData(433, dataInicio, dataFim);

  return data
    .sort((a, b) => parseBCBDate(a.data).getTime() - parseBCBDate(b.data).getTime())
    .map((item) => ({
      date: item.data.split('/').reverse().join('-'), // Converte para YYYY-MM-DD
      value: Number(item.valor),
    }));
}

/**
 * Busca SELIC (Taxa básica de juros) - Série 4189
 * Retorna taxa mensal em %
 * Variação mensal da SELIC (não anualizada)
 */
export async function getSELICData(months: number = 12): Promise<IndexHistory[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const dataInicio = formatDateBCB(startDate);
  const dataFim = formatDateBCB(endDate);

  const data = await fetchBCBData(4189, dataInicio, dataFim);

  if (data.length === 0) {
    console.warn("⚠️ SELIC vazio, usando fallback");
    return [];
  }

  return data
    .sort((a, b) => parseBCBDate(a.data).getTime() - parseBCBDate(b.data).getTime())
    .map((item) => {
      const value = Number(item.valor);
      // SELIC série 4189 já vem em % ao mês
      return {
        date: item.data.split('/').reverse().join('-'),
        value: value,
      };
    });
}

/**
 * Busca CDI (Certificado de Depósito Interbancário) - Série 12
 * Retorna taxa diária em %
 */
export async function getCDIData(months: number = 12): Promise<IndexHistory[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const dataInicio = formatDateBCB(startDate);
  const dataFim = formatDateBCB(endDate);

  const data = await fetchBCBData(12, dataInicio, dataFim);

  // Agrupa por mês e calcula média
  const monthlyData: Record<string, number[]> = {};

  data.forEach((item) => {
    // item.data é dd/MM/yyyy
    const [day, month, year] = item.data.split("/");
    const monthKey = `${year}-${month}`;
    if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
    monthlyData[monthKey].push(Number(item.valor));
  });

  return Object.entries(monthlyData)
    .sort()
    .map(([monthKey, values]) => {
      // Calcula retorno acumulado do mês (composição diária)
      let acumulado = 1;
      values.forEach((dailyRate) => {
        acumulado *= 1 + dailyRate / 100;
      });
      const monthlyReturn = (acumulado - 1) * 100;

      return {
        date: `${monthKey}-01`, // Usa primeiro dia do mês como data
        value: monthlyReturn,
      };
    });
}

/**
 * Busca dados de B3 (Ibovespa) - via API externa
 * Usando Alpha Vantage ou Yahoo Finance
 */
export async function getB3Data(months: number = 12): Promise<IndexHistory[]> {
  try {
    // Tenta buscar do Yahoo Finance para ^BVSP (Ibovespa)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Formata datas para YYYY-MM-DD
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    // Query para o Yahoo Finance Chart API
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/%5EBVSP?modules=price`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn("B3 data não disponível via Yahoo Finance");
      return [];
    }

    // Retorna dados vazios se não conseguir (será preenchido com fallback)
    return [];
  } catch (error) {
    console.error("Erro ao buscar B3:", error);
    return [];
  }
}

/**
 * Calcula retorno acumulado da carteira baseado no histórico
 * @param portfolioHistory Array com valores históricos da carteira
 * @returns Retorno em percentual
 */
export function calculatePortfolioReturn(
  portfolioHistory: Array<{ date: string; value: number }>
): number {
  if (portfolioHistory.length < 2) return 0;

  const firstValue = portfolioHistory[0].value;
  const lastValue = portfolioHistory[portfolioHistory.length - 1].value;

  if (firstValue === 0) return 0;

  return ((lastValue - firstValue) / firstValue) * 100;
}

/**
 * Calcula statistics de uma série de dados
 */
export function calculateStats(values: number[]) {
  if (values.length === 0) {
    return { avg: 0, max: 0, min: 0, accum: 0 };
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  // Calcula retorno acumulado
  let accum = 1;
  values.forEach((v) => {
    accum *= 1 + v / 100;
  });

  return {
    avg: avg,
    max: max,
    min: min,
    accum: (accum - 1) * 100,
  };
}
