import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "dashboard-b3-portfolio-history";

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
  try {
    // Local cache for instant UI
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[key] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}

  // Persist in Supabase
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from("portfolio_history")
      .upsert({ user_id: userId, month: key, value }, { onConflict: "user_id,month" });
  } catch {}
}

export async function updateMonthValue(month: string, value: number): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}

  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from("portfolio_history")
      .upsert({ user_id: userId, month, value }, { onConflict: "user_id,month" });
  } catch {}
}

export async function deleteMonth(month: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    delete map[month];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}

  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from("portfolio_history")
      .delete()
      .eq("user_id", userId)
      .eq("month", month);
  } catch {}
}

export async function addMonth(month: string, value: number): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}

  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from("portfolio_history")
      .upsert({ user_id: userId, month, value }, { onConflict: "user_id,month" });
  } catch {}
}

export function getPortfolioHistory(): PortfolioMonth[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
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
    const { data, error } = await supabase
      .from("portfolio_history")
      .select("month,value")
      .eq("user_id", userId)
      .order("month", { ascending: true });
    if (error || !data) return;
    const map: Record<string, number> = {};
    for (const row of data) { map[row.month] = row.value; }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}
}

// Dados iniciais da planilha fornecida pelo usuário
export async function initializeWithUserData(): Promise<void> {
  // Primeira tentativa: puxar do banco para o cache local
  await syncHistoryFromDBToLocal();

  // Se ainda não houver nada, opcionalmente semear dados iniciais locais
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return; // já tem algo (DB ou local)
    const initialData: Record<string, number> = {
      '2025-01': 92375.06,
      '2025-02': 92770.90,
      '2025-03': 100162.86,
      '2025-04': 105954.32,
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(initialData));
  } catch {}
}

export type PortfolioHistoryWithDiff = PortfolioMonth & { diff?: number; diffPct?: number };

export function getHistoryWithDiff(): PortfolioHistoryWithDiff[] {
  const hist = getPortfolioHistory();
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
