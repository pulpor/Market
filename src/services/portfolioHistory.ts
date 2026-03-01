import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

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
  return firebaseAuth?.currentUser?.uid ?? null;
}

export async function recordPortfolioSnapshot(value: number, when: Date = new Date()): Promise<void> {
  const key = toMonthKey(when);
  const userId = await getUserId();

  if (userId) {
    const storageKey = getStorageKey(userId);
    try {
      // Local cache for instant UI
      const raw = localStorage.getItem(storageKey);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[key] = Number.isFinite(value) ? value : 0;
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      /* ignore */
    }

    // Persist in Firestore
    if (isFirebaseConfigured && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', userId, 'portfolio_history', key), {
          month: key,
          value,
          updated_at: new Date().toISOString(),
        }, { merge: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export async function updateMonthValue(month: string, value: number): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, 'users', userId, 'portfolio_history', month), {
        month,
        value,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    } catch {
      /* ignore */
    }
  }
}

export async function deleteMonth(month: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    delete map[month];
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, 'users', userId, 'portfolio_history', month));
    } catch {
      /* ignore */
    }
  }
}

export async function addMonth(month: string, value: number): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[month] = Number.isFinite(value) ? value : 0;
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, 'users', userId, 'portfolio_history', month), {
        month,
        value,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    } catch {
      /* ignore */
    }
  }
}

export async function getPortfolioHistory(userId?: string): Promise<PortfolioMonth[]> {
  if (!userId) return [];

  // Primeiro tenta sincronizar do banco para o cache local
  await syncHistoryFromDBToLocal();

  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Object.entries(map)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    return [];
  }
}

export async function syncHistoryFromDBToLocal(): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const storageKey = getStorageKey(userId);
    if (!isFirebaseConfigured || !firestoreDb) return;

    const q = query(
      collection(firestoreDb, 'users', userId, 'portfolio_history'),
      orderBy('month', 'asc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const map: Record<string, number> = {};
    for (const row of snap.docs) {
      const data = row.data() as { month?: unknown; value?: unknown };
      const month = (typeof data?.month === 'string' ? data.month : row.id);
      const value = data?.value;
      if (typeof month === 'string') {
        map[month] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      }
    }
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }
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
  } catch {
    /* ignore */
  }
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
