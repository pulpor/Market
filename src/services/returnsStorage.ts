import { ReturnsForecastState } from "@/types/returns";

const LOCAL_KEY = "dashboard-b3-returns";

interface StoredReturnsMap {
  [month: string]: ReturnsForecastState;
}

export async function loadReturns(month: string): Promise<ReturnsForecastState> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed: StoredReturnsMap = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed[month]) return parsed[month];
      }
    }
  } catch (e) {
    console.warn("Não foi possível carregar previsão de retornos", e);
  }
  // default state
  return { month, salary: undefined, freelas: [], dividends: [], receivables: [] };
}

export async function saveReturns(state: ReturnsForecastState): Promise<boolean> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: StoredReturnsMap = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') map = parsed;
    }
    map[state.month] = state;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    console.error("Erro ao salvar previsão de retornos", e);
    return false;
  }
}
