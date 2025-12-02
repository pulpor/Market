import { ReturnsForecastState } from "@/types/returns";
import { supabase } from "@/lib/supabase";

const LOCAL_KEY = "dashboard-b3-returns";

interface StoredReturnsMap {
  [month: string]: ReturnsForecastState;
}

// Untyped alias
const sb: any = supabase;

export async function loadReturns(month: string): Promise<ReturnsForecastState> {
  // 1. Try Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await sb
        .from('returns_forecast')
        .select('content')
        .eq('user_id', session.user.id)
        .eq('month', month)
        .maybeSingle();

      if (data?.content) {
        // Update local cache for this month
        updateLocalCache(month, data.content);
        return data.content;
      }
    }
  } catch (e) {
    console.warn("Erro ao carregar returns do Supabase", e);
  }

  // 2. Fallback localStorage
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
  // 1. Save local
  updateLocalCache(state.month, state);

  // 2. Save Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
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

function updateLocalCache(month: string, data: ReturnsForecastState) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: StoredReturnsMap = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') map = parsed;
    }
    map[month] = data;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Erro ao atualizar cache local", e);
  }
}
