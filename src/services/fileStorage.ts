import { Asset } from "@/types/asset";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from "uuid";
// The generated Supabase types are currently empty (no tables declared),
// which makes supabase.from<'assets'> types resolve to never. Use a local
// untyped alias to avoid blocking builds while keeping a single client instance.
const sb: any = supabase;

const API_URL = "http://localhost:3001/api/assets";
const LOCAL_STORAGE_KEY = "dashboard-b3-assets";

// Detecta se está em produção (sem servidor local disponível)
const isProduction = import.meta.env.PROD;
const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Only use the local storage server when explicitly enabled
const useLocalServer = !isProduction && import.meta.env.VITE_USE_LOCAL_STORAGE_SERVER === '1';

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
        const { data, error } = await sb
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .order('ticker');
        if (error) {
          console.error("❌ Erro ao carregar do Supabase:", error);
        } else if (Array.isArray(data) && data.length > 0) {
          console.log(`✅ ${data.length} ativo(s) carregado(s) do Supabase`);
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
          }));
          // Dados do Supabase já devem ter UUIDs válidos; ainda assim, validamos por segurança
          const fixed = list.map(a => (uuidValidate(a.id) && uuidVersion(a.id) === 4) ? a : { ...a, id: uuidv4() });
          if (JSON.stringify(fixed) !== JSON.stringify(list)) {
            try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fixed)); } catch {}
          }
          return fixed;
        } else {
          console.warn("ℹ️ Supabase retornou 0 ativos.");
        }
      } else {
        console.log("⚠️ Usuário não autenticado");
      }
    } catch (error) {
      console.error("❌ Erro ao acessar Supabase:", error);
    }
  }

  // Tentativa 2: localStorage (sempre disponível no browser)
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const assets = JSON.parse(data);
      if (Array.isArray(assets) && assets.length > 0) {
        // Normaliza IDs caso o storage tenha valores antigos (timestamps etc.)
        const fixed = assets.map((a: Asset) => {
          const ok = typeof a.id === 'string' && uuidValidate(a.id) && uuidVersion(a.id) === 4;
          return ok ? a : { ...a, id: uuidv4() };
        });
        if (JSON.stringify(fixed) !== JSON.stringify(assets)) {
          try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fixed)); } catch {}
        }
        console.log(`✅ ${fixed.length} ativo(s) carregado(s) do localStorage`);
        return fixed;
      }
    }
    console.log("ℹ️ Nenhum ativo salvo no localStorage.");
  } catch (error) {
    console.error("❌ Erro ao carregar do localStorage:", error);
  }

  // Tentativa 3: servidor local (opcional; somente se explicitamente habilitado)
  if (useLocalServer) {
    try {
      console.log("🔄 Carregando ativos do servidor local em", API_URL);
      const response = await fetch(API_URL);
      if (!response.ok) {
        console.warn("❌ Erro ao carregar assets.json do servidor local.");
      } else {
        const data = await response.json();
        console.log("📦 Dados recebidos do servidor:", data);
        if (Array.isArray(data?.assets) && data.assets.length > 0) {
          const arr: Asset[] = data.assets;
          const fixed = arr.map((a: Asset) => {
            const ok = typeof a.id === 'string' && uuidValidate(a.id) && uuidVersion(a.id) === 4;
            return ok ? a : { ...a, id: uuidv4() };
          });
          if (JSON.stringify(fixed) !== JSON.stringify(arr)) {
            try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fixed)); } catch {}
          }
          console.log(`✅ ${fixed.length} ativo(s) carregado(s) do arquivo assets.json`);
          return fixed;
        }
        console.log("ℹ️ Arquivo assets.json está vazio.");
      }
    } catch (error) {
      console.warn("⚠️ Servidor local não está acessível ou não está rodando (npm run storage)");
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
  
  // PROTEÇÃO 1: Backup automático no localStorage ANTES de qualquer operação
  const BACKUP_KEY = `${LOCAL_STORAGE_KEY}_backup`;
  try {
    const currentData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (currentData) {
      localStorage.setItem(BACKUP_KEY, currentData);
      console.log('💾 Backup automático criado antes de salvar');
    }
  } catch (error) {
    console.warn('⚠️ Não foi possível criar backup:', error);
  }

  // PROTEÇÃO 2: Validação de segurança - avisar ao salvar lista vazia
  if (assets.length === 0) {
    console.warn('⚠️ ATENÇÃO: Tentando salvar lista VAZIA de ativos!');
    console.warn('   Isso NÃO vai deletar dados existentes (UPSERT protege)');
    console.warn('   Mas confirme se era isso que você queria.');
  }
  
  // 1) Tenta Supabase primeiro se configurado
  if (hasSupabase) {
    try {
        const { data: { session } } = await sb.auth.getSession();
        const user = session?.user;
      
      if (!user) {
        console.error("❌ Usuário não autenticado");
      } else {
        console.log(`📤 Salvando ${assets.length} ativo(s) no Supabase usando UPSERT...`);
        
        // ESTRATÉGIA SEGURA: UPSERT ao invés de DELETE+INSERT
        // Atualiza registros existentes OU insere novos, SEM deletar nada
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
                valor_atual_rf: asset.valor_atual_rf ?? null,
              })),
              { 
                onConflict: 'id',  // Se ID já existe, atualiza; senão insere
                ignoreDuplicates: false 
              }
            );

          if (upsertError) {
            console.error("❌ Erro ao fazer UPSERT no Supabase:", upsertError);
            console.error("   Detalhes:", upsertError.message);
            
            // PROTEÇÃO 3: Restaurar backup em caso de erro
            try {
              const backup = localStorage.getItem(BACKUP_KEY);
              if (backup) {
                localStorage.setItem(LOCAL_STORAGE_KEY, backup);
                console.log('🔄 Backup restaurado após erro');
              }
            } catch (restoreError) {
              console.error('❌ Falha ao restaurar backup:', restoreError);
            }
          } else {
            console.log(`✅ ${assetsWithUuid.length} ativo(s) salvos com sucesso no Supabase (UPSERT)`);
            savedSomewhere = true;
          }
        } else {
          console.log('ℹ️ Lista vazia - nenhuma operação realizada no Supabase');
          savedSomewhere = true; // Considera sucesso pois não houve erro
        }
      }
    } catch (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
      
      // PROTEÇÃO 3: Restaurar backup em caso de erro crítico
      try {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup) {
          localStorage.setItem(LOCAL_STORAGE_KEY, backup);
          console.log('🔄 Backup restaurado após erro crítico');
        }
      } catch (restoreError) {
        console.error('❌ Falha ao restaurar backup:', restoreError);
      }
    }
  }

  // 2) Sempre salva no localStorage como backup redundante
  if (isProduction || hasSupabase) {
    try {
      // Se IDs foram normalizados, persistimos a versão normalizada para manter consistência entre dispositivos
      const toPersist = idsChanged ? assetsWithUuid : assets;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toPersist));
      console.log(`✅ ${assets.length} ativo(s) salvo(s) no localStorage (backup redundante)`);
      savedSomewhere = true;
    } catch (error) {
      console.error("❌ Erro ao salvar no localStorage:", error);
    }
  }

  // 3) Fallback: Em desenvolvimento, salva no servidor local (somente se habilitado)
  if (useLocalServer) {
    try {
      console.log(`💾 Salvando ${assets.length} ativo(s) no servidor local...`);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assets: idsChanged ? assetsWithUuid : assets }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar no servidor local");
      }

      console.log("✅ Ativos salvos no arquivo assets.json");
      savedSomewhere = true;
    } catch (error) {
      console.warn("⚠️ Servidor local não disponível (habilite com VITE_USE_LOCAL_STORAGE_SERVER=1)");
    }
  }
  
  // Log final do resultado
  if (savedSomewhere) {
    console.log(`\n📊 Resumo do salvamento (${new Date().toLocaleString('pt-BR')}):`);
    console.log(`   Total de ativos: ${(idsChanged ? assetsWithUuid : assets).length}`);
    console.log(`   Renda Variável: ${(idsChanged ? assetsWithUuid : assets).filter(a => !a.tipo_ativo_manual).length}`);
    console.log(`   Renda Fixa: ${(idsChanged ? assetsWithUuid : assets).filter(a => a.tipo_ativo_manual).length}`);
    console.log(`   Status: ✅ Salvo com sucesso\n`);
  } else {
    console.error('❌ FALHA: Não foi possível salvar em nenhum destino!');
  }
  
  return savedSomewhere;
}
