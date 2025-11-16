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

export function recordPortfolioSnapshot(value: number, when: Date = new Date()): void {
  try {
    const key = toMonthKey(when);
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[key] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}
}

export function updateMonthValue(month: string, value: number): void {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}
}

export function deleteMonth(month: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    delete map[month];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}
}

export function addMonth(month: string, value: number): void {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    let map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {}
}

export function getPortfolioHistory(): PortfolioMonth[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Object.entries(map)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    return [];
  }
}

// Dados iniciais da planilha fornecida pelo usuário
export function initializeWithUserData(): void {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return; // Já tem dados, não sobrescreve
    
    const initialData: Record<string, number> = {
      '2024-12': 81931.50,
      '2025-01': 92375.06,
      '2025-02': 92770.90,
      '2025-03': 100162.86,
      '2025-04': 105954.32,
      '2025-05': 114079.62,
      '2025-06': 108079.70,
      '2025-07': 107557.29,
      '2025-08': 109296.61,
      '2025-09': 113149.45,
      '2025-10': 119917.81,
      '2025-11': 125983.78,
      '2025-12': 132244.36,
      '2026-01': 137465.41,
      '2026-02': 135638.25,
      '2026-03': 136961.51,
      '2026-04': 143421.50,
      '2026-05': 144442.56,
      '2026-06': 151797.52,
      '2026-07': 161689.82,
      '2026-08': 162628.04,
      '2026-09': 168884.00,
      '2026-10': 176456.94,
      '2026-11': 183411.87,
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
