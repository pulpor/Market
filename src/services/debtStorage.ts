import { DebtsState } from "@/types/debt";

const LOCAL_STORAGE_KEY = "dashboard-b3-debts";

export async function loadDebts(): Promise<DebtsState> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          financing: parsed.financing,
          cardSpending: Array.isArray(parsed.cardSpending) ? parsed.cardSpending : [],
          monthlyTarget: typeof parsed.monthlyTarget === 'number' ? parsed.monthlyTarget : undefined,
          others: Array.isArray(parsed.others) ? parsed.others : [],
        };
      }
    }
  } catch (e) {
    console.warn("Não foi possível carregar dívidas do localStorage", e);
  }
  return { financing: undefined, cardSpending: [], others: [] };
}

export async function saveDebts(state: DebtsState): Promise<boolean> {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("Erro ao salvar dívidas no localStorage", e);
    return false;
  }
}
