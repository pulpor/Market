import { ReturnsForecastState } from "@/types/returns";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BASE_LOCAL_KEY = "dashboard-b3-returns";

interface StoredReturnsMap {
  [month: string]: ReturnsForecastState;
}

const hasFirebase = isFirebaseConfigured;

function getStorageKey(userId: string) {
  return `${BASE_LOCAL_KEY}-${userId}`;
}

export async function loadReturns(month: string): Promise<ReturnsForecastState> {
  try {
    const uid = firebaseAuth?.currentUser?.uid;
    if (!uid) {
      return { month, salary: undefined, freelas: [], dividends: [], receivables: [], expenses: [] };
    }

    const storageKey = getStorageKey(uid);

    // 1. Try Firestore
    if (hasFirebase && firestoreDb) {
      try {
        const ref = doc(firestoreDb, 'users', uid, 'returns', month);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const content = (snap.data() as { content?: unknown })?.content;
          if (content) {
            const typed = content as ReturnsForecastState;
            updateLocalCache(storageKey, month, typed);
            return typed;
          }
        }
      } catch (e) {
        console.warn("Erro ao carregar returns do Firestore", e);
      }
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
  } catch (e) {
    console.error("Erro geral em loadReturns:", e);
  }

  // default state
  return { month, salary: undefined, freelas: [], dividends: [], receivables: [], expenses: [] };
}

export async function saveReturns(state: ReturnsForecastState): Promise<boolean> {
  try {
    const uid = firebaseAuth?.currentUser?.uid;
    if (!uid) return false;

    const storageKey = getStorageKey(uid);

    // 1. Save local
    updateLocalCache(storageKey, state.month, state);

    // 2. Save Firestore
    if (hasFirebase && firestoreDb) {
      try {
        const ref = doc(firestoreDb, 'users', uid, 'returns', state.month);
        await setDoc(ref, {
          content: state,
          updated_at: new Date().toISOString(),
        }, { merge: true });
        return true;
      } catch (e) {
        console.error("Erro ao salvar returns no Firestore", e);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar returns", e);
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
