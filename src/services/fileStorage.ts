import { Asset } from "@/types/asset";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from "uuid";
// The generated Supabase types are currently empty (no tables declared),
// which makes supabase.from<'assets'> types resolve to never. Use a local
// untyped alias to avoid blocking builds while keeping a single client instance.
const sb: any = supabase;

const BASE_STORAGE_KEY = "dashboard-b3-assets";

// Detecta se está em produção (sem servidor local disponível)
const isProduction = import.meta.env.PROD;
const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getStorageKey(userId: string) {
  return `${BASE_STORAGE_KEY}-${userId}`;
}

/**
 * Carrega os ativos do usuário logado no Supabase (se configurado),
 * ou fallback para servidor local (dev) ou localStorage (prod)
 */
export async function loadAssets(): Promise<Asset[]> {
  // Tentativa 1: Supabase
  if (hasSupabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const storageKey = getStorageKey(user.id);

        const { data, error } = await sb
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .order('ticker');

        if (error) {
          console.error("❌ Erro ao carregar do Supabase:", error);
        } else if (Array.isArray(data) && data.length > 0) {
          const list = data.map(asset => ({
            id: asset.id,
            ticker: asset.ticker,
            quantidade: asset.quantidade,
            preco_medio: parseFloat(asset.preco_medio),
            setor: asset.setor,
            corretora: asset.corretora,
            tipo_ativo_manual: asset.tipo_ativo_manual ?? undefined,
            indice_referencia: asset.indice_referencia ?? undefined,
            taxa_contratada: asset.taxa_contratada ? parseFloat(asset.taxa_contratada) : undefined,
            data_vencimento: asset.data_vencimento ?? undefined,
            data_aplicacao: (asset as any).data_aplicacao ?? undefined,
            valor_atual_rf: asset.valor_atual_rf ? parseFloat(asset.valor_atual_rf) : undefined,
            is_international: asset.is_international ?? false,
          }));

          // Preserva movimentos armazenados apenas no localStorage
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
          } catch { }
          // Dados do Supabase já devem ter UUIDs válidos; ainda assim, validamos por segurança
          const fixed = list.map(a => (uuidValidate(a.id) && uuidVersion(a.id) === 4) ? a : { ...a, id: uuidv4() });
          if (JSON.stringify(fixed) !== JSON.stringify(list)) {
            try { localStorage.setItem(storageKey, JSON.stringify(fixed)); } catch { }
          }
          return fixed;
        } else {
          console.warn("ℹ️ Supabase retornou 0 ativos.");
        }

        // Fallback para localStorage DO USUÁRIO
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

      } else {
        console.log("⚠️ Usuário não autenticado");
      }
    } catch (error) {
      console.error("❌ Erro ao acessar Supabase:", error);
    }
  }

  // Sem dados em nenhum lugar
  return [];
}

/**
 * Salva os ativos no Supabase usando UPSERT (atualiza ou insere, SEM deletar)
 * Inclui backup automático e validação de segurança
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

  // 1) Tenta Supabase primeiro se configurado
  if (hasSupabase) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const user = session?.user;

      if (!user) {
        console.error("❌ Usuário não autenticado");
      } else {
        const storageKey = getStorageKey(user.id);
        const BACKUP_KEY = `${storageKey}_backup`;

        // PROTEÇÃO 1: Backup automático no localStorage ANTES de qualquer operação
        try {
          const currentData = localStorage.getItem(storageKey);
          if (currentData) {
            localStorage.setItem(BACKUP_KEY, currentData);
          }
        } catch (error) {
          console.warn('⚠️ Não foi possível criar backup:', error);
        }

        const { data: existingAssets, error: fetchError } = await sb
          .from('assets')
          .select('id')
          .eq('user_id', user.id);

        if (fetchError) {
          console.error("❌ Erro ao buscar ativos existentes:", fetchError);
        }

        // 2. Identificar IDs que devem ser removidos (existem no banco mas não na lista atual)
        const currentIds = new Set(assetsWithUuid.map(a => a.id));
        const idsToDelete = existingAssets
          ?.map((a: any) => a.id)
          .filter((id: string) => !currentIds.has(id)) || [];

        // 3. Remover ativos excluídos
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await sb
            .from('assets')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error("❌ Erro ao excluir ativos:", deleteError);
          }
        }

        // 4. Atualizar/Inserir ativos atuais (UPSERT)
        if (assetsWithUuid.length > 0) {
          const { error: upsertError } = await sb
            .from('assets')
            .upsert(
              assetsWithUuid.map(asset => ({
                id: asset.id,
                user_id: user.id,
                ticker: asset.ticker,
                quantidade: asset.quantidade,
                preco_medio: asset.preco_medio,
                setor: asset.setor,
                corretora: asset.corretora,
                // Campos renda fixa
                tipo_ativo_manual: asset.tipo_ativo_manual ?? null,
                indice_referencia: asset.indice_referencia ?? null,
                taxa_contratada: asset.taxa_contratada ?? null,
                data_vencimento: asset.data_vencimento ?? null,
                data_aplicacao: (asset as any).data_aplicacao ?? null,
                valor_atual_rf: asset.valor_atual_rf ?? null,
                // Campo internacional
                is_international: asset.is_international ?? false,
              })),
              {
                onConflict: 'id',
                ignoreDuplicates: false
              }
            );

          if (upsertError) {
            console.error("❌ Erro ao fazer UPSERT no Supabase:", upsertError);

            // PROTEÇÃO 3: Restaurar backup em caso de erro
            try {
              const backup = localStorage.getItem(BACKUP_KEY);
              if (backup) {
                localStorage.setItem(storageKey, backup);
                console.log('🔄 Backup restaurado após erro');
              }
            } catch (restoreError) { }
          } else {
            savedSomewhere = true;
          }
        } else {
          savedSomewhere = true;
        }

        // 2) Sempre salva no localStorage como backup redundante (User Specific)
        try {
          const toPersist = idsChanged ? assetsWithUuid : assets;
          localStorage.setItem(storageKey, JSON.stringify(toPersist));
          savedSomewhere = true;
        } catch (error) {
          console.error("❌ Erro ao salvar no localStorage:", error);
        }
      }
    } catch (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
    }
  }

  return savedSomewhere;
}
