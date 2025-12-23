import { DebtsState, FinancingDebt } from "@/types/debt";
import { supabase } from "@/lib/supabase";

const BASE_STORAGE_KEY = "dashboard-b3-debts";

// Untyped alias to avoid TS errors with non-existent tables in generated types
const sb: any = supabase;

function getStorageKey(userId: string) {
  return `${BASE_STORAGE_KEY}-${userId}`;
}

export async function loadDebts(): Promise<DebtsState> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const storageKey = getStorageKey(session.user.id);

      // 1. Tenta carregar do Supabase
      try {
        const { data, error } = await sb
          .from('debts')
          .select('content')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data?.content) {
          // Atualiza cache local do usuário
          localStorage.setItem(storageKey, JSON.stringify(data.content));
          return parseDebts(data.content);
        }
      } catch (e) {
        console.warn("Erro ao carregar dívidas do Supabase:", e);
      }

      // 2. Fallback para localStorage DO USUÁRIO
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parseDebts(parsed);
        }
      } catch (e) {
        console.warn("Não foi possível carregar dívidas do localStorage", e);
      }
    }
  } catch (e) {
    console.error("Erro geral em loadDebts:", e);
  }

  return { financings: [], cardSpending: [], others: [] };
}

function parseDebts(parsed: any): DebtsState {
  if (parsed && typeof parsed === 'object') {
    // Migration: if 'financing' exists (old format), move it to 'financings' array
    let financings: FinancingDebt[] = [];
    if (Array.isArray(parsed.financings)) {
      financings = parsed.financings;
    } else if (parsed.financing) {
      financings = [parsed.financing];
    }

    return {
      financings,
      cardSpending: Array.isArray(parsed.cardSpending) ? parsed.cardSpending : [],
      monthlyTarget: typeof parsed.monthlyTarget === 'number' ? parsed.monthlyTarget : undefined,
      others: Array.isArray(parsed.others) ? parsed.others : [],
    };
  }
  return { financings: [], cardSpending: [], others: [] };
}

export async function saveDebts(state: DebtsState): Promise<boolean> {
  let saved = false;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const storageKey = getStorageKey(session.user.id);

      // 1. Salva no localStorage (cache/backup) do usuário
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        saved = true;
      } catch (e) {
        console.error("Erro ao salvar dívidas no localStorage", e);
      }

      // 2. Salva no Supabase
      const { error } = await sb
        .from('debts')
        .upsert({
          user_id: session.user.id,
          content: state,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error("Erro ao salvar dívidas no Supabase:", error);
      } else {
        console.log("✅ Dívidas salvas no Supabase");
        saved = true;
      }
    }
  } catch (e) {
    console.error("Erro ao conectar com Supabase para salvar dívidas:", e);
  }

  return saved;
}
