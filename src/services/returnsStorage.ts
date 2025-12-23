import { ReturnsForecastState } from "@/types/returns";
import { supabase } from "@/lib/supabase";

const BASE_LOCAL_KEY = "dashboard-b3-returns";

interface StoredReturnsMap {
  [month: string]: ReturnsForecastState;
}

// Untyped alias
const sb: any = supabase;

function getStorageKey(userId: string) {
  return `${BASE_LOCAL_KEY}-${userId}`;
}

export async function loadReturns(month: string): Promise<ReturnsForecastState> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const storageKey = getStorageKey(session.user.id);

      // 1. Try Supabase
      try {
        const { data } = await sb
          .from('returns_forecast')
          .select('content')
          .eq('user_id', session.user.id)
          .eq('month', month)
          .maybeSingle();

        if (data?.content) {
          // Update local cache for this month
          updateLocalCache(storageKey, month, data.content);
          return data.content;
        }
      } catch (e) {
        console.warn("Erro ao carregar returns do Supabase", e);
      }

      // 2. Fallback localStorage (User Specific)
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed: StoredReturnsMap = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed[month]) return parsed[month];
          }
        }
      } catch (e) {
        console.warn("Não foi possível carregar previsão de retornos", e);
      }
    }
  } catch (e) {
    console.error("Erro geral em loadReturns:", e);
  }

  // default state
  return { month, salary: undefined, freelas: [], dividends: [], receivables: [], expenses: [] };
}

export async function saveReturns(state: ReturnsForecastState): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const storageKey = getStorageKey(session.user.id);

      // 1. Save local
      updateLocalCache(storageKey, state.month, state);

      // 2. Save Supabase
      const { error } = await sb
        .from('returns_forecast')
        .upsert({
          user_id: session.user.id,
          month: state.month,
          content: state,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,month' });

      if (error) {
        console.error("Erro ao salvar returns no Supabase", error);
      } else {
        return true;
      }
    }
  } catch (e) {
    console.error("Erro ao conectar com Supabase", e);
  }
  return false;
}

function updateLocalCache(storageKey: string, month: string, data: ReturnsForecastState) {
  try {
    const raw = localStorage.getItem(storageKey);
    let map: StoredReturnsMap = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') map = parsed;
    }
    map[month] = data;
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch (e) {
    console.error("Erro ao atualizar cache local", e);
  }
}
