import { Asset } from "@/types/asset";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from "uuid";

const BASE_STORAGE_KEY = "dashboard-b3-assets";

const hasFirebase = isFirebaseConfigured;

function getStorageKey(userId: string) {
  return `${BASE_STORAGE_KEY}-${userId}`;
}

/**
 * Carrega os ativos do usuário logado no Firestore (se configurado),
 * com fallback para localStorage do usuário.
 */
export async function loadAssets(): Promise<Asset[]> {
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid) return [];

  const storageKey = getStorageKey(uid);

  // Tentativa 1: Firestore
  if (hasFirebase && firestoreDb) {
    try {
      const q = query(
        collection(firestoreDb, 'users', uid, 'assets'),
        orderBy('ticker')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: Asset[] = snap.docs.map(d => {
          const asset = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            ticker: String(asset.ticker ?? ''),
            quantidade: Number(asset.quantidade ?? 0),
            preco_medio:
              typeof asset.preco_medio === 'string'
                ? parseFloat(asset.preco_medio)
                : (asset.preco_medio as number),
            setor: (asset.setor as string | undefined) ?? undefined,
            corretora: asset.corretora as Asset['corretora'],
            tipo_ativo_manual: (asset.tipo_ativo_manual as string | undefined) ?? undefined,
            indice_referencia: (asset.indice_referencia as string | undefined) ?? undefined,
            taxa_contratada: (asset.taxa_contratada as number | undefined) ?? undefined,
            data_vencimento: (asset.data_vencimento as string | undefined) ?? undefined,
            data_aplicacao: (asset.data_aplicacao as string | undefined) ?? undefined,
            valor_atual_rf: (asset.valor_atual_rf as number | undefined) ?? undefined,
            is_international: Boolean(asset.is_international ?? false),
            movimentos: (asset.movimentos as Asset['movimentos'] | undefined) ?? undefined,
          } as Asset;
        });

        // Preserva movimentos armazenados apenas no localStorage (se existirem)
        try {
          const localData = localStorage.getItem(storageKey);
          if (localData) {
            const localAssets = JSON.parse(localData) as Asset[];
            const localMap = new Map(localAssets.map(a => [a.id, a.movimentos]));
            list.forEach(a => {
              const movs = localMap.get(a.id);
              if (movs && movs.length > 0) {
                (a as Asset).movimentos = movs;
              }
            });
          }
        } catch {
          /* ignore */
        }

        // Valida UUID v4 por segurança
        const fixed = list.map(a => (uuidValidate(a.id) && uuidVersion(a.id) === 4) ? a : { ...a, id: uuidv4() });
        try {
          localStorage.setItem(storageKey, JSON.stringify(fixed));
        } catch {
          /* ignore */
        }
        return fixed;
      }
    } catch (error) {
      console.warn("⚠️ Erro ao carregar do Firestore, usando fallback local:", error);
    }
  }

  // Fallback: localStorage DO USUÁRIO
  try {
    const data = localStorage.getItem(storageKey);
    if (data) {
      const assets = JSON.parse(data);
      if (Array.isArray(assets) && assets.length > 0) {
        const fixed = assets.map((a: Asset) => {
          const ok = typeof a.id === 'string' && uuidValidate(a.id) && uuidVersion(a.id) === 4;
          return ok ? a : { ...a, id: uuidv4() };
        });
        return fixed;
      }
    }
  } catch (error) {
    console.error("❌ Erro ao carregar do localStorage:", error);
  }

  return [];
}

/**
 * Salva os ativos no Firestore (atualiza/insere e remove os que não existem mais)
 * Inclui backup automático em localStorage e validação de segurança
 */
export async function saveAssets(assets: Asset[]): Promise<boolean> {
  let savedSomewhere = false;
  // Garante que todos os IDs são UUID v4 antes de qualquer persistência
  const normalizeIds = (list: Asset[]): { normalized: Asset[]; changed: boolean } => {
    let changed = false;
    const normalized = list.map((a) => {
      const isV4 = typeof a.id === 'string' && uuidValidate(a.id) && uuidVersion(a.id) === 4;
      if (!isV4) {
        changed = true;
        return { ...a, id: uuidv4() };
      }
      return a;
    });
    return { normalized, changed };
  };

  const { normalized: assetsWithUuid, changed: idsChanged } = normalizeIds(assets);

  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid) return false;
  const storageKey = getStorageKey(uid);
  const BACKUP_KEY = `${storageKey}_backup`;

  // PROTEÇÃO: Backup automático no localStorage ANTES de qualquer operação remota
  try {
    const currentData = localStorage.getItem(storageKey);
    if (currentData) {
      localStorage.setItem(BACKUP_KEY, currentData);
    }
  } catch {
    // ignore
  }

  // Sempre salva no localStorage como backup redundante
  try {
    const toPersist = idsChanged ? assetsWithUuid : assets;
    localStorage.setItem(storageKey, JSON.stringify(toPersist));
    savedSomewhere = true;
  } catch (error) {
    console.error("❌ Erro ao salvar no localStorage:", error);
  }

  // Persistência remota (Firestore)
  if (hasFirebase && firestoreDb) {
    try {
      const assetsCol = collection(firestoreDb, 'users', uid, 'assets');
      const existingSnap = await getDocs(assetsCol);
      const existingIds = new Set(existingSnap.docs.map(d => d.id));
      const currentIds = new Set(assetsWithUuid.map(a => a.id));
      const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));

      const batch = writeBatch(firestoreDb);
      for (const id of idsToDelete) {
        batch.delete(doc(firestoreDb, 'users', uid, 'assets', id));
      }

      for (const asset of assetsWithUuid) {
        batch.set(doc(firestoreDb, 'users', uid, 'assets', asset.id), {
          ticker: asset.ticker,
          quantidade: asset.quantidade,
          preco_medio: asset.preco_medio,
          setor: asset.setor ?? null,
          corretora: asset.corretora,
          tipo_ativo_manual: asset.tipo_ativo_manual ?? null,
          indice_referencia: asset.indice_referencia ?? null,
          taxa_contratada: asset.taxa_contratada ?? null,
          data_vencimento: asset.data_vencimento ?? null,
          data_aplicacao: asset.data_aplicacao ?? null,
          valor_atual_rf: asset.valor_atual_rf ?? null,
          is_international: asset.is_international ?? false,
          movimentos: asset.movimentos ?? null,
          updated_at: new Date().toISOString(),
        });
      }

      await batch.commit();
      savedSomewhere = true;
    } catch (error) {
      console.error("❌ Erro ao salvar no Firestore:", error);
      // Restaura backup em caso de erro remoto (sem apagar o que o usuário já tem local)
      try {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup) {
          localStorage.setItem(storageKey, backup);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return savedSomewhere;
}
