import { supabase } from "@/integrations/supabase/client";

const BASE_LOCAL_KEY = "dashboard-b3-portfolio-history";

function getStorageKey(userId: string) {
  return `${BASE_LOCAL_KEY}-${userId}`;
}

export type PortfolioMonth = {
  month: string; // YYYY-MM
  value: number;
};

function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export async function recordPortfolioSnapshot(value: number, when: Date = new Date()): Promise<void> {
  const key = toMonthKey(when);
  const userId = await getUserId();

  if (userId) {
    const storageKey = getStorageKey(userId);
    try {
      // Local cache for instant UI
      const raw = localStorage.getItem(storageKey);
      let map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[key] = Number.isFinite(value) ? value : 0;
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch { }

    // Persist in Supabase
    try {
      await supabase
        .from("portfolio_history")
        .upsert({ user_id: userId, month: key, value }, { onConflict: "user_id,month" });
    } catch { }
  }
}

export async function updateMonthValue(month: string, value: number): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch { }

  try {
    await supabase
      .from("portfolio_history")
      .upsert({ user_id: userId, month, value }, { onConflict: "user_id,month" });
  } catch { }
}

export async function deleteMonth(month: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    delete map[month];
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch { }

  try {
    await supabase
      .from("portfolio_history")
      .delete()
      .eq("user_id", userId)
      .eq("month", month);
  } catch { }
}

export async function addMonth(month: string, value: number): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch { }

  try {
    await supabase
      .from("portfolio_history")
      .upsert({ user_id: userId, month, value }, { onConflict: "user_id,month" });
  } catch { }
}

export async function getPortfolioHistory(userId?: string): Promise<PortfolioMonth[]> {
  if (!userId) return [];

  // Primeiro tenta sincronizar do Supabase
  await syncHistoryFromDBToLocal();

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Object.entries(map)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch { return []; }
}

export async function syncHistoryFromDBToLocal(): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const storageKey = getStorageKey(userId);
    const { data, error } = await supabase
      .from("portfolio_history")
      .select("month,value")
      .eq("user_id", userId)
      .order("month", { ascending: true });

    if (error || !data) return;

    const map: Record<string, number> = {};
    for (const row of data) { map[row.month] = row.value; }
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch { }
}

// Dados iniciais da planilha fornecida pelo usuário
export async function initializeWithUserData(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);

  // Primeira tentativa: puxar do banco para o cache local
  await syncHistoryFromDBToLocal();

  // Se ainda não houver nada, opcionalmente semear dados iniciais locais
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return; // já tem algo (DB ou local)
    const initialData: Record<string, number> = {
      '2025-01': 92375.06,
      '2025-02': 92770.90,
      '2025-03': 100162.86,
      '2025-04': 105954.32,
    };
    localStorage.setItem(storageKey, JSON.stringify(initialData));
  } catch { }
}

export type PortfolioHistoryWithDiff = PortfolioMonth & { diff?: number; diffPct?: number };

export async function getHistoryWithDiff(userId?: string): Promise<PortfolioHistoryWithDiff[]> {
  const hist = await getPortfolioHistory(userId);
  const out: PortfolioHistoryWithDiff[] = [];
  for (let i = 0; i < hist.length; i++) {
    const cur = hist[i];
    const prev = hist[i - 1];
    const diff = prev ? cur.value - prev.value : undefined;
    const diffPct = prev && prev.value !== 0 ? (diff! / prev.value) * 100 : undefined;
    out.push({ ...cur, diff, diffPct });
  }
  return out;
}
