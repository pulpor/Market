import { DebtsState, FinancingDebt, CardSpendingEntry, OtherDebt } from "@/types/debt";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BASE_STORAGE_KEY = "dashboard-b3-debts";

const hasFirebase = isFirebaseConfigured;

function getStorageKey(userId: string) {
  return `${BASE_STORAGE_KEY}-${userId}`;
}

export async function loadDebts(): Promise<DebtsState> {
  try {
    const uid = firebaseAuth?.currentUser?.uid;
    if (!uid) return { financings: [], cardSpending: [], others: [] };

    const storageKey = getStorageKey(uid);

    // 1. Tenta carregar do Firestore
    if (hasFirebase && firestoreDb) {
      try {
        const ref = doc(firestoreDb, 'users', uid, 'debts', 'state');
        const snap = await getDoc(ref);
        const content = snap.exists() ? (snap.data() as { content?: unknown })?.content : null;
        if (content) {
          localStorage.setItem(storageKey, JSON.stringify(content));
          return parseDebts(content);
        }
      } catch (e) {
        console.warn("Erro ao carregar dívidas do Firestore:", e);
      }
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
  } catch (e) {
    console.error("Erro geral em loadDebts:", e);
  }

  return { financings: [], cardSpending: [], others: [] };
}

function parseDebts(parsed: unknown): DebtsState {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    // Migration: if 'financing' exists (old format), move it to 'financings' array
    let financings: FinancingDebt[] = [];
    if (Array.isArray(obj.financings)) {
      financings = obj.financings as FinancingDebt[];
    } else if (obj.financing) {
      financings = [obj.financing as FinancingDebt];
    }

    return {
      financings,
      cardSpending: Array.isArray(obj.cardSpending) ? (obj.cardSpending as CardSpendingEntry[]) : [],
      monthlyTarget: typeof obj.monthlyTarget === 'number' ? (obj.monthlyTarget as number) : undefined,
      others: Array.isArray(obj.others) ? (obj.others as OtherDebt[]) : [],
    };
  }
  return { financings: [], cardSpending: [], others: [] };
}

export async function saveDebts(state: DebtsState): Promise<boolean> {
  let saved = false;

  try {
    const uid = firebaseAuth?.currentUser?.uid;
    if (!uid) return false;
    const storageKey = getStorageKey(uid);

    // 1. Salva no localStorage (cache/backup) do usuário
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      saved = true;
    } catch (e) {
      console.error("Erro ao salvar dívidas no localStorage", e);
    }

    // 2. Salva no Firestore
    if (hasFirebase && firestoreDb) {
      try {
        const ref = doc(firestoreDb, 'users', uid, 'debts', 'state');
        await setDoc(ref, {
          content: state,
          updated_at: new Date().toISOString(),
        }, { merge: true });
        saved = true;
      } catch (e) {
        console.error("Erro ao salvar dívidas no Firestore:", e);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar dívidas:", e);
  }

  return saved;
}
