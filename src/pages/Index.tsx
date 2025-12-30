import { useState, useEffect, useMemo, useCallback } from "react";
import { Asset, CalculatedAsset, PortfolioSummary, Corretora, Movement } from "@/types/asset";
import { AssetForm } from "@/components/AssetForm";
import { MarketBar } from "@/components/MarketBar";
import { AssetCard } from "@/components/AssetCard";
import { Charts } from "@/components/Charts";
import { PortfolioIndexComparison } from "@/components/PortfolioIndexComparison";
import { DebtsSection } from "@/components/DebtsSection";
import { ReturnsForecastSection } from "@/components/ReturnsForecastSection";
import { loadDebts, saveDebts } from "@/services/debtStorage";
import { DebtsState } from "@/types/debt";
import { calculateAssets } from "@/services/yahooFinance";
import { loadAssets, saveAssets } from "@/services/fileStorage";
import { mergeAssetsByTicker } from "@/utils/assetUtils";
import { TrendingUp, LogOut, Building2, Bell, Calendar, AlertCircle, Search, Download, BarChart3, Layers, LayoutGrid, History, Trash2, PlusCircle, Wallet, List, CreditCard, Globe, ArrowRightLeft, Sparkles } from "lucide-react";
import { getBrokerColor, BROKER_LIST } from "@/utils/brokerColors";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getHistoryWithDiff, recordPortfolioSnapshot, updateMonthValue, deleteMonth, addMonth, initializeWithUserData } from "@/services/portfolioHistory";
import { CurrencyConverter } from "@/components/CurrencyConverter";
import { GeminiNewsPanel } from "@/components/GeminiNewsPanel";
// Removido import do util PDF

const Index = () => {
  const { user, signOut } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [calculatedAssets, setCalculatedAssets] = useState<CalculatedAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CalculatedAsset | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [historyVersion, setHistoryVersion] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const histPerPage = 12;
  const [allHistory, setAllHistory] = useState<Awaited<ReturnType<typeof getHistoryWithDiff>>>([]);
  
  useEffect(() => {
    getHistoryWithDiff(user?.id).then(setAllHistory);
  }, [historyVersion, user?.id]);
  
  const histTotalPages = Math.max(1, Math.ceil(allHistory.length / histPerPage));
  const histEnd = allHistory.length - (histPage - 1) * histPerPage;
  const histStart = Math.max(0, histEnd - histPerPage);
  const pageHistory = allHistory.slice(histStart, histEnd);
  useEffect(() => {
    if (histPage > histTotalPages) setHistPage(histTotalPages);
  }, [histTotalPages]);

  // Filtros e ordenação
  const [brokerFilter, setBrokerFilter] = useState<"Todas" | Corretora>("Todas");
  const [marketTypeFilter, setMarketTypeFilter] = useState<"Todos" | "Nacional" | "Internacional">("Todos");
  const brokerAliasMap = useMemo(() => {
    const entries: Record<string, Corretora> = {
      "nubank": "Nubank",
      "nu": "Nubank",
      "xp": "XP",
      "xp investimentos": "XP",
      "xp investimentos s.a": "XP",
      "clear": "Clear",
      "clear corretora": "Clear",
      "sofisa": "Sofisa",
      "sofisa diretos": "Sofisa",
      "grão": "Grão",
      "grao": "Grão",
      "inter": "Inter",
      "banco inter": "Inter",
      "nomad": "Nomad",
      "genial": "Genial",
      "binance": "Binance",
      "inco": "Inco",
      "outros": "Outros",
    };
    return entries;
  }, []);
  const normalizeBroker = useCallback((b: string): Corretora => {
    const raw = (b || '').trim();
    if (!raw) return 'Outros';
    // Match exact canonical first
    if ((BROKER_LIST as readonly string[]).includes(raw)) return raw as Corretora;
    const key = raw.toLowerCase();
    const hit = brokerAliasMap[key];
    return hit || 'Outros';
  }, [brokerAliasMap]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [assetClassFilter, setAssetClassFilter] = useState<string>("Todos");
  const [sortKey, setSortKey] = useState<
    "valor_total" | "dividend_yield" | "quantidade" | "preco_atual" | "variacao_percentual" | "pl_posicao"
  >("valor_total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const xnpv = useCallback((rate: number, cashflows: { date: string; amount: number }[]) => {
    if (cashflows.length === 0) return 0;
    const sorted = [...cashflows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const t0 = new Date(sorted[0].date).getTime();
    return sorted.reduce((acc, cf) => {
      const t = (new Date(cf.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 365);
      return acc + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  }, []);

  const xirr = useCallback((cashflows: { date: string; amount: number }[]): number | undefined => {
    if (cashflows.length < 2) return undefined;
    const hasPos = cashflows.some(c => c.amount > 0);
    const hasNeg = cashflows.some(c => c.amount < 0);
    if (!hasPos || !hasNeg) return undefined;

    const f = (r: number) => xnpv(r, cashflows);
    let low = -0.9999;
    let high = 1;
    let fLow = f(low);
    let fHigh = f(high);

    let expand = 0;
    while (fLow * fHigh > 0 && expand < 20) {
      high *= 2;
      fHigh = f(high);
      expand += 1;
    }
    if (fLow * fHigh > 0) return undefined;

    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const fMid = f(mid);
      if (Math.abs(fMid) < 1e-6) return mid;
      if (fLow * fMid < 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
    return (low + high) / 2;
  }, [xnpv]);

  const assetClassOptions = useMemo(() => {
    const classes = new Set<string>();
    calculatedAssets.forEach((asset) => {
      const cls = asset.tipo_ativo_manual || asset.tipo_ativo || "Outro";
      classes.add(cls);
    });
    return Array.from(classes).sort((a, b) => a.localeCompare(b));
  }, [calculatedAssets]);

  // Debts State
  const [debtsState, setDebtsState] = useState<DebtsState>({ financings: [], cardSpending: [], others: [], monthlyTarget: undefined });
  const [forecastMonth, setForecastMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [debtTotals, setDebtTotals] = useState({ financingParcela: 0, cardMonthTotal: 0, othersTotal: 0 });

  const recomputeDebtTotals = useCallback((st: DebtsState, m: string) => {
    setDebtTotals(computeDebtForecast(st, m));
  }, []);

  useEffect(() => {
    (async () => {
      const st = await loadDebts();
      setDebtsState(st);
      recomputeDebtTotals(st, forecastMonth);
    })();
  }, []); // Carrega apenas uma vez na montagem

  const handleDebtsChange = (st: DebtsState) => {
    setDebtsState(st);
    recomputeDebtTotals(st, forecastMonth);
  };

  const removeDebtReminder = async (id: string) => {
    const next = { ...debtsState, others: debtsState.others.filter(o => o.id !== id) };
    setDebtsState(next);
    await saveDebts(next);
    recomputeDebtTotals(next, forecastMonth);
    toast({ title: "Lembrete removido", description: "O lembrete de dívida foi removido com sucesso." });
  };

  // Carrega os ativos do arquivo ao montar o componente
  useEffect(() => {
    initializeWithUserData(); // Inicializa histórico com dados da planilha se estiver vazio
    const loadInitialAssets = async () => {
      const loadedAssets = await loadAssets();
      setAssets(loadedAssets);

      if (loadedAssets.length > 0) {
        toast({
          title: "Carteira carregada",
          description: `${loadedAssets.length} ativo(s) carregados do arquivo`,
        });

        // Calcula automaticamente após carregar para manter cards e gráficos após F5
        await calculateAndPersist(loadedAssets, true);
      }
    };
    loadInitialAssets();
  }, []);

  // Adiciona ou atualiza o ativo e já calcula usando a lista mesclada atualizada
  const handleAddAndCalculate = (asset: Asset) => {
    console.log("📝 Novo ativo recebido:", { ticker: asset.ticker, is_international: asset.is_international, corretora: asset.corretora });
    
    // Log específico para SPHD
    if (asset.ticker.toUpperCase() === 'SPHD') {
      console.log("🔍 SPHD recebido no handleAddAndCalculate:", JSON.stringify(asset, null, 2));
    }
    
    setAssets((prev) => {
      // Se estiver editando, remove o antigo antes de adicionar o novo
      const filtered = editingAsset ? prev.filter(a => a.id !== editingAsset.id) : prev;
      const updated = [...filtered, asset];
      
      // Log específico para SPHD após merge
      const sphdInUpdated = updated.find(a => a.ticker.toUpperCase() === 'SPHD');
      if (sphdInUpdated) {
        console.log("🔍 SPHD após adicionar em array:", sphdInUpdated);
      }
      
      const merged = mergeAssetsByTicker(updated);
      
      // Log específico para SPHD após merge
      const sphdInMerged = merged.find(a => a.ticker.toUpperCase() === 'SPHD');
      if (sphdInMerged) {
        console.log("🔍 SPHD após merge:", sphdInMerged);
      }

      if (merged.length < updated.length) {
        toast({
          title: "Posições mescladas",
          description: `${asset.ticker.toUpperCase()} na corretora ${asset.corretora} teve posição combinada (quantidade e preço médio recalculados).`,
        });
      }

      calculateAndPersist(merged, true).then(() => {
        toast({
          title: editingAsset ? "Ativo atualizado" : "Cálculo concluído",
          description: editingAsset
            ? `${asset.ticker.toUpperCase()} foi atualizado com sucesso`
            : `${asset.ticker.toUpperCase()} adicionado e carteira recalculada`,
        });
        setEditingAsset(null); // Limpa o modo de edição
      });

      return merged;
    });
  };

  const handleRemoveAsset = async (id: string) => {
    const updatedAssets = assets.filter((a) => a.id !== id);
    setAssets(updatedAssets);
    setCalculatedAssets((prev) => prev.filter((a) => a.id !== id));

    // Salva automaticamente após remover
    await saveAssets(updatedAssets);
  };

  const handleEditAsset = (asset: CalculatedAsset) => {
    setEditingAsset(asset);
    // Scroll suave para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: "Modo de edição",
      description: `Edite ${asset.ticker_normalizado.replace(".SA", "")} e clique em Adicionar para atualizar`,
    });
  };

  // Função reutilizável para calcular e persistir
  const calculateAndPersist = async (assetsToUse: Asset[], silent = false) => {
    if (assetsToUse.length === 0) {
      toast({
        title: "Nenhum ativo",
        description: "Adicione pelo menos um ativo antes de calcular",
        variant: "destructive",
      });
      return;
    }

    const movimentosMap = new Map<string, Movement[] | undefined>(assetsToUse.map(a => [a.id, a.movimentos]));

    // Log específico para SPHD
    const sphd = assetsToUse.find(a => a.ticker.toUpperCase() === 'SPHD');
    // if (sphd) {
    //   console.log("🔍 SPHD antes de calculateAssets:", sphd);
    // }

    setIsCalculating(true);
    try {
      const result = await calculateAssets(assetsToUse);

      const withMovimentos = result.ativos.map(a => ({
        ...a,
        movimentos: movimentosMap.get(a.id) || [],
      }));
      
      // Log detalhado de ativos com erro ou preço zero (comentado para limpar console)
      /*
      result.ativos.forEach(a => {
        if (a.preco_atual <= 0 || (a as any).error) {
          console.warn(`⚠️ ALERTA para ${a.ticker_normalizado}:`, {
            preco_atual: a.preco_atual,
            is_international: a.is_international,
            error: (a as any).error
          });
        }
      });
      */

      // Cálculo local de RF (MVP) para garantir funcionamento mesmo sem função atualizada
      const CDI_ANUAL_PADRAO = 12.65;
      const SELIC_ANUAL_PADRAO = 12.25;
      const IPCA_ANUAL_PADRAO = 4.5;

      const toNumber = (val: unknown): number | undefined => {
        const n = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : undefined);
        return Number.isFinite(n as number) ? (n as number) : undefined;
      };
      const isBusinessDay = (d: Date) => {
        const day = d.getDay();
        return day !== 0 && day !== 6;
      };
      const businessDaysBetween = (fromISO: string, to: Date): number => {
        const from = new Date(fromISO);
        if (to <= from) return 0;
        let count = 0;
        const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        while (cur < to) {
          if (isBusinessDay(cur)) count++;
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      };
      const computeRfValorAtualLocal = (a: any): number | undefined => {
        if (!a?.tipo_ativo_manual) return undefined;
        const principal = toNumber(a.preco_medio);
        if (!principal || principal <= 0) return undefined;
        const dataAplic = a.data_aplicacao as string | undefined;
        const taxa = toNumber(a.taxa_contratada);
        const indice = (a.indice_referencia || '').toUpperCase();
        if (!dataAplic) return undefined;
        const hoje = new Date();
        const tipo = (a.tipo_ativo_manual || '').toUpperCase();
        const usa252 = indice.includes('CDI') || indice.includes('SELIC') ||
          tipo.includes('LCI') || tipo.includes('LCA') || tipo.includes('CDB') || tipo.includes('TESOURO');
        const dias = usa252 ? businessDaysBetween(dataAplic, hoje) : Math.max(0, Math.floor((hoje.getTime() - new Date(dataAplic).getTime()) / (1000 * 60 * 60 * 24)));
        if (dias <= 0) return principal;
        let taxaAnual: number | undefined;
        if (indice.includes('PRÉ')) {
          taxaAnual = taxa;
        } else if (indice.includes('SELIC')) {
          taxaAnual = taxa ?? SELIC_ANUAL_PADRAO;
        } else if (indice.includes('CDI')) {
          if (typeof taxa === 'number') {
            taxaAnual = taxa >= 20 ? (taxa / 100) * CDI_ANUAL_PADRAO : CDI_ANUAL_PADRAO + taxa;
          } else {
            taxaAnual = CDI_ANUAL_PADRAO;
          }
        } else if (indice.includes('IPCA') || indice.includes('IGP')) {
          taxaAnual = IPCA_ANUAL_PADRAO + (taxa ?? 0);
        } else {
          taxaAnual = taxa; // Outros => usa taxa nominal se houver
        }
        if (typeof taxaAnual !== 'number' || !Number.isFinite(taxaAnual)) return undefined;
        const baseDias = usa252 ? 252 : 365;
        const taxaDia = taxaAnual / 100 / baseDias;
        const fator = Math.pow(1 + taxaDia, dias);
        return principal * fator;
      };

      // Ajusta ativos usando cálculo local quando fizer sentido
      const adjustedAssets = withMovimentos.map((a) => {
        if (!a.tipo_ativo_manual) return a;

        const manualAtual = typeof a.valor_atual_rf === 'number' && a.valor_atual_rf > 0 ? a.valor_atual_rf : undefined;
        const estimado = computeRfValorAtualLocal(a);

        // Regra: se o usuário informou valor_atual_rf, usa sempre o manual; senão tenta estimar.
        const valorAtual = manualAtual ?? (typeof estimado === 'number' && estimado > 0 ? estimado : undefined);

        if (typeof valorAtual === 'number' && valorAtual > 0) {
          const valorAplicado = a.preco_medio;
          const valor_total = valorAtual;
          const variacao_percentual = valorAplicado > 0 ? ((valorAtual - valorAplicado) / valorAplicado) * 100 : 0;
          const pl_posicao = valorAtual - valorAplicado;
          return { ...a, preco_atual: valorAtual, valor_total, variacao_percentual, pl_posicao };
        }

        return a;
      });

      // Recalcula o resumo com base nos ativos ajustados
      const validAssets = adjustedAssets.filter(a => (typeof a.preco_atual === 'number' && a.preco_atual > 0));
      const valor_total_carteira_local = validAssets.reduce((sum, a) => sum + a.valor_total, 0);
      const pl_total_local = validAssets.reduce((sum, a) => sum + a.pl_posicao, 0);
      const dy_ponderado_local = validAssets.reduce((sum, a) => {
        const part = valor_total_carteira_local > 0 ? (a.valor_total / valor_total_carteira_local) : 0;
        return sum + a.dividend_yield * part;
      }, 0);

      const valorTotalCarteira = valor_total_carteira_local;
      const enrichedAssetsBase = adjustedAssets.map(asset => ({
        ...asset,
        peso_carteira: valorTotalCarteira > 0 ? (asset.valor_total / valorTotalCarteira) * 100 : 0,
        yoc: asset.preco_medio > 0 ? (asset.dividend_yield * asset.preco_atual / asset.preco_medio) : 0,
        projecao_dividendos_anual: (asset.dividend_yield / 100) * asset.valor_total,
      }));

      const enrichedAssets = enrichedAssetsBase.map(asset => {
        const movs = (asset as any).movimentos as Movement[] | undefined;
        if (!movs || movs.length === 0 || !(asset.valor_total > 0)) return asset;

        const cashflows = movs
          .filter(m => Number.isFinite(m.valor) && Number.isFinite(m.cotas))
          .map(m => ({ date: m.data, amount: -m.valor }));
        cashflows.push({ date: new Date().toISOString().slice(0, 10), amount: asset.valor_total });

        const rate = xirr(cashflows);
        if (rate === undefined || !Number.isFinite(rate)) return asset;
        return { ...asset, xirr_percentual: rate * 100 };
      });

      setCalculatedAssets(enrichedAssets);
      setSummary({
        valor_total_carteira: valor_total_carteira_local,
        dy_ponderado: dy_ponderado_local,
        pl_total: pl_total_local,
      });
      // REMOVIDO: Gravação automática de histórico para não sobrescrever edições manuais
      // try { recordPortfolioSnapshot(valor_total_carteira_local); setHistoryVersion(v => v + 1); } catch { }
      await saveAssets(assetsToUse);

      if (!silent) {
        toast({
          title: "Cálculo concluído",
          description: "Dados atualizados e salvos automaticamente",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao calcular",
        description: "Não foi possível buscar dados do Yahoo Finance",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCalculate = async () => {
    // Cálculo manual (não usado pelo fluxo principal agora, mas mantido se quiser recalcular sem adicionar)
    await calculateAndPersist(assets);
  };

  // Ativos após filtros/ordenação
  const displayedAssets = useMemo(() => {
    // Filtro por corretora
    let filtered = brokerFilter === "Todas"
      ? calculatedAssets
      : calculatedAssets.filter(a => normalizeBroker(a.corretora) === brokerFilter);

    // Filtro por mercado
    if (marketTypeFilter !== "Todos") {
      filtered = filtered.filter(a => {
        if (marketTypeFilter === "Internacional") return a.is_international;
        return !a.is_international;
      });
    }

    // Filtro por classe do ativo (Ação, FII, ETF, RF, etc.)
    if (assetClassFilter !== "Todos") {
      filtered = filtered.filter(a => {
        const cls = (a.tipo_ativo_manual || a.tipo_ativo || "Outro").toLowerCase();
        return cls === assetClassFilter.toLowerCase();
      });
    }

    // Filtro por busca de nome
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a => {
        const ticker = a.ticker_normalizado.replace(".SA", "").toLowerCase();
        const tipoAtivo = (a.tipo_ativo_manual || "").toLowerCase();
        return ticker.includes(query) || tipoAtivo.includes(query);
      });
    }

    // Ordenação
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];

      let comp = 0;
      if (typeof av === "string" && typeof bv === "string") {
        comp = av.localeCompare(bv);
      } else if (typeof av === "number" && typeof bv === "number") {
        comp = av - bv;
      }

      return sortDir === "asc" ? comp : -comp;
    });

    return sorted;
  }, [calculatedAssets, brokerFilter, searchQuery, sortKey, sortDir, marketTypeFilter, assetClassFilter]);

  // Títulos de Renda Fixa com vencimento (ordenados por data)
  const upcomingMaturities = useMemo(() => {
    const today = new Date();

    return calculatedAssets
      .filter(asset => asset.data_vencimento) // Apenas ativos com data de vencimento
      .map(asset => ({
        ...asset,
        daysUntilMaturity: asset.data_vencimento
          ? Math.ceil((new Date(asset.data_vencimento).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }))
      .sort((a, b) => {
        // Ordena por data de vencimento (mais próximo primeiro)
        if (!a.data_vencimento || !b.data_vencimento) return 0;
        return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
      });
  }, [calculatedAssets]);

  // Combined Reminders (Assets + Debts)
  const allReminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assetReminders = calculatedAssets
      .filter(asset => asset.data_vencimento)
      .map(asset => ({
        id: asset.id,
        type: 'asset' as const,
        title: asset.ticker_normalizado.replace(".SA", "") || asset.tipo_ativo_manual || "Ativo",
        subtitle: `${asset.tipo_ativo_manual || 'Renda Fixa'} • ${asset.corretora}`,
        date: new Date(asset.data_vencimento!),
        value: asset.valor_total, // Valor atual aproximado
        original: asset
      }));

    const debtReminders = debtsState.others
      .filter(d => d.tem_vencimento && d.vencimento)
      .map(d => ({
        id: d.id,
        type: 'debt' as const,
        title: d.descricao,
        subtitle: "Lembrete de Dívida",
        date: new Date(d.vencimento!),
        value: d.valor,
        original: d
      }));

    const combined = [...assetReminders, ...debtReminders].map(item => {
      const daysUntil = Math.ceil((item.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...item, daysUntil };
    });

    return combined.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calculatedAssets, debtsState.others]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground flex items-center justify-center md:justify-start gap-3">
              <TrendingUp className="h-10 w-10 text-primary" />
              Minha Carteira
            </h1>
            <p className="text-muted-foreground text-lg">Acompanhe sua carteira e Dividend Yield em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Logado como</p>
              <p className="text-sm font-medium truncate max-w-[200px]">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Indicadores de Mercado */}
        <MarketBar />



        <Accordion type="multiple" defaultValue={["currency-converter", "add-asset", "summary", "my-assets", "reminders", "debts", "returns", "charts"]} className="w-full space-y-4">

          {/* 1. Conversor de Moedas */}
          <AccordionItem value="currency-converter" className="border-none bg-transparent px-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-teal-500/10 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5 text-teal-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Conversor de Moedas</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              <CurrencyConverter />
            </AccordionContent>
          </AccordionItem>

          {/* 1.5 Adicionar Ativo */}
          <AccordionItem value="add-asset" className="border-none bg-transparent px-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-primary/10 rounded-lg">
                  <PlusCircle className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Adicionar Ativo</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              <AssetForm
                onAddAndCalculate={handleAddAndCalculate}
                isCalculating={isCalculating}
                editingAsset={editingAsset}
                onCancelEdit={() => setEditingAsset(null)}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 2. Resumo da Carteira */}
          {summary && (
            <AccordionItem value="summary" className="border-none bg-transparent px-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-blue-500/10 rounded-lg">
                    <Wallet className="h-5 w-5 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Resumo da Carteira</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6">
                <Tabs defaultValue="total" className="w-full">
                  <div className="flex items-center justify-end mb-6">
                    <TabsList className="grid grid-cols-5 w-auto">
                      <TabsTrigger value="total">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Total
                      </TabsTrigger>
                      <TabsTrigger value="corretora">
                        <Building2 className="h-4 w-4 mr-2" />
                        Por Corretora
                      </TabsTrigger>
                      <TabsTrigger value="tipo">
                        <Layers className="h-4 w-4 mr-2" />
                        Por Tipo
                      </TabsTrigger>
                      <TabsTrigger value="setor">
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Por Setor
                      </TabsTrigger>
                      <TabsTrigger value="historico">
                        <History className="h-4 w-4 mr-2" />
                        Histórico
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="total">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">Valor Total</p>
                        <p className="text-3xl font-bold text-foreground">
                          R$ {summary.valor_total_carteira.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">DY Médio Ponderado</p>
                        <p className="text-3xl font-bold text-success">
                          {summary.dy_ponderado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">Crescimento Médio</p>
                        <p
                          className={`text-3xl font-bold ${calculatedAssets.reduce((sum, a) => sum + a.variacao_percentual, 0) / calculatedAssets.length >= 0
                            ? "text-success"
                            : "text-destructive"
                            }`}
                        >
                          {(calculatedAssets.reduce((sum, a) => sum + a.variacao_percentual, 0) / calculatedAssets.length >= 0 ? "+" : "")}
                          {(calculatedAssets.reduce((sum, a) => sum + a.variacao_percentual, 0) / calculatedAssets.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm mb-1">P/L Total</p>
                        <p
                          className={`text-3xl font-bold ${summary.pl_total >= 0 ? "text-success" : "text-destructive"
                            }`}
                        >
                          R$ {summary.pl_total >= 0 ? "+" : ""}
                          {summary.pl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Previsão de Dividendos */}
                    <div className="border-t border-border pt-6 mt-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Previsão de Dividendos
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-success/5 p-4 rounded-lg border border-success/20">
                          <p className="text-muted-foreground text-sm mb-1">Projeção Anual</p>
                          <p className="text-2xl font-bold text-success">
                            R$ {calculatedAssets.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Baseado no DY atual × Valor investido
                          </p>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                          <p className="text-muted-foreground text-sm mb-1">Projeção Mensal (média)</p>
                          <p className="text-2xl font-bold text-primary">
                            R$ {(calculatedAssets.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0) / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Projeção anual ÷ 12 meses
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="historico">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Calendar className="h-5 w-5" /> Histórico mensal do patrimônio
                        </h3>
                        <div className="flex items-center gap-4">
                          {summary && (
                            <div className="hidden md:flex items-center gap-4 mr-2">
                              {(() => {
                                // Determina o valor atual: usa o histórico manual do mês atual se existir, senão usa o calculado
                                const today = new Date();
                                const currentKey = today.toISOString().slice(0, 7);
                                const currentManualEntry = allHistory.find(h => h.month === currentKey);

                                // Valor atual efetivo (Manual > Calculado)
                                const currentValue = currentManualEntry ? currentManualEntry.value : summary.valor_total_carteira;

                                // Custo total (aproximado pelo valor atual - lucro total)
                                // Nota: Se o usuário editou o valor manual, o P/L muda. 
                                // Assumindo que o custo base (investido) é (Valor Calculado - PL Calculado)
                                const investedValue = summary.valor_total_carteira - summary.pl_total;

                                // Novo P/L baseado no valor manual
                                const effectivePL = currentValue - investedValue;
                                const effectivePLPct = investedValue > 0 ? (effectivePL / investedValue) * 100 : 0;

                                // Busca exata ou aproximada de 12 meses atrás
                                const targetDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
                                const targetKey = targetDate.toISOString().slice(0, 7);

                                // Encontra o registro mais próximo de 12 meses atrás (ou exato)
                                const pastEntry = allHistory.find(h => h.month === targetKey)
                                  || allHistory.find(h => h.month <= targetKey);

                                return (
                                  <>
                                    {/* Rendimento Total */}
                                    <div className="text-right">
                                      <p className="text-xs text-muted-foreground">Rendimento Total</p>
                                      <p className={`text-sm font-bold ${effectivePL >= 0 ? 'text-success' : 'text-destructive'}`}>
                                        {effectivePL >= 0 ? '+' : ''}
                                        {effectivePLPct.toFixed(1)}%
                                        <span className="text-xs font-normal ml-1 opacity-80">
                                          (R$ {effectivePL.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                                        </span>
                                      </p>
                                    </div>

                                    {/* Últimos 12 Meses */}
                                    {pastEntry && (
                                      (() => {
                                        const diff = currentValue - pastEntry.value;
                                        const pct = pastEntry.value ? (diff / pastEntry.value) * 100 : 0;
                                        return (
                                          <div className="text-right border-l border-border pl-4">
                                            <p className="text-xs text-muted-foreground">Últimos 12 Meses</p>
                                            <p className={`text-sm font-bold ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                                              {diff >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                              <span className="text-xs font-normal ml-1 opacity-80">
                                                (R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                                              </span>
                                            </p>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          <Button variant="outline" size="sm" onClick={() => {
                            const m = prompt('Mês (YYYY-MM):');
                            const v = prompt('Valor (R$):');
                            if (m && v) { addMonth(m, parseFloat(v.replace(/[^\d,.-]/g, '').replace(',', '.'))); setHistoryVersion(h => h + 1); }
                          }}>+ Adicionar mês</Button>
                        </div>
                      </div>

                      <ScrollArea className="w-full whitespace-nowrap rounded-lg border border-border">
                        <div className="w-full">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3">Mês</th>
                                <th className="text-right p-3">Valor</th>
                                <th className="text-right p-3">Diferença</th>
                                <th className="text-right p-3">% M/M</th>
                                <th className="text-center p-3">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageHistory.map((row) => (
                                <tr key={row.month} className="border-t border-border/60 hover:bg-muted/30">
                                  <td className="p-3">{row.month}</td>
                                  <td className="p-3 text-right">
                                    <button
                                      className="hover:underline text-left w-full text-right"
                                      onClick={() => {
                                        const newVal = prompt(`Editar valor de ${row.month}:`, row.value.toString());
                                        if (newVal) { updateMonthValue(row.month, parseFloat(newVal.replace(/[^\d,.-]/g, '').replace(',', '.'))); setHistoryVersion(h => h + 1); }
                                      }}
                                    >
                                      R$ {row.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </button>
                                  </td>
                                  <td className={`p-3 text-right ${row.diff && row.diff < 0 ? 'text-destructive' : 'text-success'}`}>{row.diff == null ? '—' : `R$ ${(row.diff >= 0 ? '+' : '')}${row.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                                  <td className={`p-3 text-right ${row.diffPct && row.diffPct < 0 ? 'text-destructive' : 'text-success'}`}>{row.diffPct == null ? '—' : `${row.diffPct >= 0 ? '+' : ''}${row.diffPct.toFixed(2)}%`}</td>
                                  <td className="p-3 text-center">
                                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Deletar ${row.month}?`)) { deleteMonth(row.month); setHistoryVersion(h => h + 1); } }} className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              {allHistory.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum registro ainda. Clique em "+ Adicionar mês" ou "Registrar mês atual".</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                      {allHistory.length > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                          <div>
                            Mostrando {Math.min(allHistory.length, histStart + 1)}–{histEnd} de {allHistory.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={histPage >= histTotalPages} onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))}>Anterior</Button>
                            <span>Página {histPage} / {histTotalPages}</span>
                            <Button variant="outline" size="sm" disabled={histPage <= 1} onClick={() => setHistPage(p => Math.max(1, p - 1))}>Próxima</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="corretora">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {BROKER_LIST.map(corretora => {
                        const assetsCorretora = displayedAssets.filter(a => normalizeBroker(a.corretora) === corretora);
                        const valorTotal = assetsCorretora.reduce((sum, a) => sum + a.valor_total, 0);
                        const dyPonderado = assetsCorretora.reduce((sum, a) => {
                          const participacao = valorTotal > 0 ? a.valor_total / valorTotal : 0;
                          return sum + a.dividend_yield * participacao;
                        }, 0);
                        const crescimentoMedio = assetsCorretora.length > 0 ? assetsCorretora.reduce((sum, a) => sum + a.variacao_percentual, 0) / assetsCorretora.length : 0;
                        const plTotal = assetsCorretora.reduce((sum, a) => sum + a.pl_posicao, 0);

                        return valorTotal > 0 ? (
                          <div key={corretora} className="bg-gradient-to-br from-card to-card/50 p-5 rounded-lg border border-border hover:border-primary/50 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 mb-4">
                              <Building2 className="h-5 w-5 text-primary" />
                              <h4 className="font-bold text-lg text-foreground">{corretora}</h4>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Valor Total</p>
                                <p className="text-xl font-bold text-foreground">
                                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">DY Médio</p>
                                  <p className="text-sm font-semibold text-success">
                                    {dyPonderado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Crescim.</p>
                                  <p className={`text-sm font-semibold ${crescimentoMedio >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {crescimentoMedio >= 0 ? '+' : ''}{crescimentoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">P/L</p>
                                  <p className={`text-sm font-semibold ${plTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    R$ {plTotal >= 0 ? '+' : ''}{Math.abs(plTotal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>

                    {/* Previsão de Dividendos por Corretora */}
                    <div className="border-t border-border pt-6 mt-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Previsão de Dividendos
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {BROKER_LIST.map(corretora => {
                          const assetsCorretora = displayedAssets.filter(a => normalizeBroker(a.corretora) === corretora);
                          const projecaoAnual = assetsCorretora.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0);
                          const projecaoMensal = projecaoAnual / 12;

                          const valorTotal = assetsCorretora.reduce((sum, a) => sum + a.valor_total, 0);

                          return valorTotal > 0 ? (
                            <div key={corretora} className="bg-card p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                              <div className="flex items-center gap-2 mb-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-foreground">{corretora}</h4>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Anual</p>
                                  <p className="text-lg font-bold text-success">
                                    R$ {projecaoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Mensal</p>
                                  <p className="text-sm font-semibold text-primary">
                                    R$ {projecaoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="tipo">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {Array.from(new Set(calculatedAssets.map(a => a.tipo_ativo || 'Outro'))).sort().map(tipo => {
                        const assetsTipo = calculatedAssets.filter(a => (a.tipo_ativo || 'Outro') === tipo);
                        const valorTotal = assetsTipo.reduce((sum, a) => sum + a.valor_total, 0);
                        const dyPonderado = assetsTipo.reduce((sum, a) => {
                          const participacao = a.valor_total / valorTotal;
                          return sum + a.dividend_yield * participacao;
                        }, 0);
                        const crescimentoMedio = assetsTipo.reduce((sum, a) => sum + a.variacao_percentual, 0) / assetsTipo.length;
                        const plTotal = assetsTipo.reduce((sum, a) => sum + a.pl_posicao, 0);

                        return (
                          <div key={tipo} className="bg-gradient-to-br from-card to-card/50 p-5 rounded-lg border border-border hover:border-primary/50 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 mb-4">
                              <TrendingUp className="h-5 w-5 text-primary" />
                              <h4 className="font-bold text-lg text-foreground">{tipo}</h4>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Valor Total</p>
                                <p className="text-xl font-bold text-foreground">
                                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">DY Médio</p>
                                  <p className="text-sm font-semibold text-success">
                                    {dyPonderado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Crescim.</p>
                                  <p className={`text-sm font-semibold ${crescimentoMedio >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {crescimentoMedio >= 0 ? '+' : ''}{crescimentoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">P/L</p>
                                  <p className={`text-sm font-semibold ${plTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    R$ {plTotal >= 0 ? '+' : ''}{Math.abs(plTotal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Previsão de Dividendos por Tipo */}
                    <div className="border-t border-border pt-6 mt-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Previsão de Dividendos
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from(new Set(calculatedAssets.map(a => a.tipo_ativo || 'Outro')))
                          .sort()
                          .filter(tipo => !['LCI/LCA', 'Previdência', 'Tesouro Direto'].includes(tipo))
                          .map(tipo => {
                            const assetsTipo = calculatedAssets.filter(a => (a.tipo_ativo || 'Outro') === tipo);
                            const projecaoAnual = assetsTipo.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0);
                            const projecaoMensal = projecaoAnual / 12;

                            return (
                              <div key={tipo} className="bg-card p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                  <h4 className="font-semibold text-foreground">{tipo}</h4>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Anual</p>
                                    <p className="text-lg font-bold text-success">
                                      R$ {projecaoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Mensal</p>
                                    <p className="text-sm font-semibold text-primary">
                                      R$ {projecaoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="setor">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {Array.from(new Set(calculatedAssets.map(a => a.setor || 'Outros'))).sort().map(setor => {
                        const assetsSetor = calculatedAssets.filter(a => (a.setor || 'Outros') === setor);
                        const valorTotal = assetsSetor.reduce((sum, a) => sum + a.valor_total, 0);
                        const dyPonderado = assetsSetor.reduce((sum, a) => {
                          const participacao = a.valor_total / valorTotal;
                          return sum + a.dividend_yield * participacao;
                        }, 0);
                        const crescimentoMedio = assetsSetor.reduce((sum, a) => sum + a.variacao_percentual, 0) / assetsSetor.length;
                        const plTotal = assetsSetor.reduce((sum, a) => sum + a.pl_posicao, 0);

                        return valorTotal > 0 ? (
                          <div key={setor} className="bg-gradient-to-br from-card to-card/50 p-5 rounded-lg border border-border hover:border-primary/50 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 mb-4">
                              <TrendingUp className="h-5 w-5 text-primary" />
                              <h4 className="font-bold text-lg text-foreground">{setor}</h4>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Valor Total</p>
                                <p className="text-xl font-bold text-foreground">
                                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">DY Médio</p>
                                  <p className="text-sm font-semibold text-success">
                                    {dyPonderado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Crescim.</p>
                                  <p className={`text-sm font-semibold ${crescimentoMedio >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {crescimentoMedio >= 0 ? '+' : ''}{crescimentoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">P/L</p>
                                  <p className={`text-sm font-semibold ${plTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    R$ {plTotal >= 0 ? '+' : ''}{Math.abs(plTotal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>

                    {/* Previsão de Dividendos por Setor */}
                    <div className="border-t border-border pt-6 mt-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Previsão de Dividendos
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from(new Set(calculatedAssets.map(a => a.setor || 'Outros'))).sort().map(setor => {
                          const assetsSetor = calculatedAssets.filter(a => (a.setor || 'Outros') === setor);
                          const projecaoAnual = assetsSetor.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0);
                          const projecaoMensal = projecaoAnual / 12;

                          const valorTotal = assetsSetor.reduce((sum, a) => sum + a.valor_total, 0);

                          return projecaoAnual > 0 ? (
                            <div key={setor} className="bg-card p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                              <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-foreground">{setor}</h4>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Anual</p>
                                  <p className="text-lg font-bold text-success">
                                    R$ {projecaoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Mensal</p>
                                  <p className="text-sm font-semibold text-primary">
                                    R$ {projecaoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 3. Meus Ativos */}
          {calculatedAssets.length > 0 && (
            <AccordionItem value="my-assets" className="border-none bg-transparent px-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-green-500/10 rounded-lg">
                    <List className="h-5 w-5 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Meus Ativos</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6">
                <div className="flex flex-col gap-4 mb-4">

                  {/* Barra de filtros/ordenação + busca */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 w-full items-end">
                    {/* Busca */}
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1"><Search className="h-4 w-4" /> Busca</div>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Buscar por ticker ou nome do ativo..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-10"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            Limpar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Filtrar Corretora */}
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-4 w-4" /> Corretora
                      </div>
                      <Select value={brokerFilter} onValueChange={(v) => setBrokerFilter(v as any)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Todas">Todas</SelectItem>
                          {BROKER_LIST.map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filtrar Mercado */}
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="h-4 w-4" /> Mercado
                      </div>
                      <Select value={marketTypeFilter} onValueChange={(v) => setMarketTypeFilter(v as any)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Todos">Todos</SelectItem>
                          <SelectItem value="Nacional">Nacional</SelectItem>
                          <SelectItem value="Internacional">Internacional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                      {/* Filtrar Classe */}
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Layers className="h-4 w-4" /> Classe
                        </div>
                        <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Todos">Todas</SelectItem>
                            {assetClassOptions.map((cls) => (
                              <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    {/* Filtrar Corretora */}

                    {/* Ordenar por */}
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Filter className="h-4 w-4" /> Ordenar por
                      </div>
                      <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="valor_total">Maior valor</SelectItem>
                          <SelectItem value="dividend_yield">Maior DY</SelectItem>
                          <SelectItem value="quantidade">Maior quantidade</SelectItem>
                          <SelectItem value="preco_atual">Maior preço atual</SelectItem>
                          <SelectItem value="variacao_percentual">Maior variação %</SelectItem>
                          <SelectItem value="pl_posicao">Maior P/L posição</SelectItem>
                          <SelectItem value="ticker_normalizado">Ordem Alfabética</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Direção */}
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <ArrowDownWideNarrow className="h-4 w-4" /> Direção
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={sortDir === "desc" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSortDir("desc")}
                          title="Maior para menor"
                          className="flex-1"
                        >
                          <ArrowDownWideNarrow className="h-4 w-4 mr-1" /> Desc
                        </Button>
                        <Button
                          type="button"
                          variant={sortDir === "asc" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSortDir("asc")}
                          title="Menor para maior"
                          className="flex-1"
                        >
                          <ArrowUpWideNarrow className="h-4 w-4 mr-1" /> Asc
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedAssets
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((asset) => (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          onRemove={handleRemoveAsset}
                          onEdit={handleEditAsset}
                        />
                      ))
                    }
                  </div>


                </div>


                {/* Paginação e Botão PDF */}
                {(displayedAssets.length > itemsPerPage || (calculatedAssets.length > 0 && summary)) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 items-center mt-8 gap-4 mb-6">

                    {/* Coluna Esquerda (Vazia para balanceamento) */}
                    <div className="hidden md:block"></div>

                    {/* Coluna Central (Paginação) */}
                    <div className="flex justify-center">
                      {displayedAssets.length > itemsPerPage && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Anterior
                          </Button>

                          <div className="flex gap-1">
                            {Array.from({ length: Math.ceil(displayedAssets.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="min-w-[40px]"
                              >
                                {page}
                              </Button>
                            ))}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(displayedAssets.length / itemsPerPage), p + 1))}
                            disabled={currentPage === Math.ceil(displayedAssets.length / itemsPerPage)}
                          >
                            Próxima
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Coluna Direita (Botão PDF) */}
                    <div className="flex justify-center md:justify-end">
                      {calculatedAssets.length > 0 && summary && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={async () => {
                            const jsPDF = (window as any).jspdf?.jsPDF;
                            if (!jsPDF) {
                              alert("Biblioteca de PDF não carregada. Verifique sua conexão de internet.");
                              return;
                            }
                            const doc = new jsPDF();
                            doc.setFontSize(18);
                            doc.text("Resumo da Carteira", 14, 18);
                            doc.setFontSize(12);
                            doc.text(`Valor Total: R$ ${summary.valor_total_carteira.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 28);
                            doc.text(`DY Médio Ponderado: ${summary.dy_ponderado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`, 14, 36);
                            doc.text(`Crescimento Médio: ${(calculatedAssets.reduce((sum, a) => sum + a.variacao_percentual, 0) / calculatedAssets.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`, 14, 44);
                            doc.text(`P/L Total: R$ ${summary.pl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 52);
                            (doc as any).autoTable({
                              startY: 60,
                              head: [[
                                "Ativo",
                                "Tipo",
                                "Índice",
                                "Taxa",
                                "Corretora",
                                "Valor Atual",
                                "Valor Aplicado",
                                "Rentabilidade %",
                                "P/L Posição"
                              ]],
                              body: calculatedAssets.map(a => {
                                const indice = a.indice_referencia || '';
                                const taxa = (typeof a.taxa_contratada === 'number' && a.taxa_contratada > 0)
                                  ? `${a.taxa_contratada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                  : '';
                                return [
                                  a.ticker_normalizado.replace('.SA', ''),
                                  a.tipo_ativo_manual || a.tipo_ativo || '',
                                  indice,
                                  taxa,
                                  a.corretora,
                                  `R$ ${a.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                                  (a.preco_medio && a.quantidade) ? `R$ ${(a.preco_medio * a.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `R$ ${a.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                                  `${a.variacao_percentual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '-'}%`,
                                  `R$ ${a.pl_posicao?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '-'}`
                                ];
                              }),
                              styles: { fontSize: 10 },
                              headStyles: { fillColor: [44, 62, 80] },
                              margin: { left: 14, right: 14 },
                              theme: 'grid',
                            });
                            doc.save("carteira_dashboard_b3.pdf");
                          }}
                        >
                          <Download className="h-4 w-4" />
                          Baixar PDF da Carteira
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 4. Lembretes */}
          {
            allReminders.length > 0 && (
              <AccordionItem value="reminders" className="border-none bg-transparent px-0">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-amber-500/10 rounded-lg">
                      <Bell className="h-5 w-5 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                      Lembretes
                      {allReminders.filter(a => a.daysUntil <= 30).length > 0 && (
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-full">
                          {allReminders.filter(a => a.daysUntil <= 30 && a.daysUntil >= 0).length} próximo(s)
                        </span>
                      )}
                    </h2>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <p className="text-sm text-muted-foreground mb-4">Vencimentos de títulos e contas a pagar</p>

                  <div className="space-y-3">
                    {allReminders.map((item) => {
                      const isExpiringSoon = item.daysUntil <= 30 && item.daysUntil >= 0;
                      const isExpired = item.daysUntil < 0;
                      const isDebt = item.type === 'debt';

                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${isExpired
                            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                            : isExpiringSoon
                              ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                              : 'bg-card border-border hover:border-primary/30'
                            }`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2.5 rounded-lg shrink-0 ${isExpired
                              ? 'bg-red-500/10'
                              : isExpiringSoon
                                ? 'bg-amber-500/10'
                                : isDebt ? 'bg-blue-500/10' : 'bg-primary/10'
                              }`}>
                              {isDebt ? (
                                <Bell className={`h-5 w-5 ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-blue-500'
                                  }`} />
                              ) : (
                                <Calendar className={`h-5 w-5 ${isExpired
                                  ? 'text-red-500'
                                  : isExpiringSoon
                                    ? 'text-amber-500'
                                    : 'text-primary'
                                  }`} />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-foreground text-lg">
                                  {item.title}
                                </h3>
                                {isExpiringSoon && (
                                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 whitespace-nowrap">
                                    <AlertCircle className="h-3 w-3" />
                                    Vence em breve
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 whitespace-nowrap">
                                    <AlertCircle className="h-3 w-3" />
                                    Vencido
                                  </span>
                                )}
                                {isDebt && (
                                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 whitespace-nowrap">
                                    Dívida
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.subtitle} • {item.value ? item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ -'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 md:gap-8 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-left md:text-right">
                              <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                              <p className="text-base md:text-lg font-bold text-foreground whitespace-nowrap">
                                {item.date.toLocaleDateString('pt-BR')}
                              </p>
                            </div>

                            <div className="text-left md:text-right min-w-[100px]">
                              <p className="text-xs text-muted-foreground mb-1">Faltam</p>
                              <p className={`text-base md:text-lg font-bold whitespace-nowrap ${isExpired
                                ? 'text-red-600 dark:text-red-400'
                                : isExpiringSoon
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-foreground'
                                }`}>
                                {isExpired
                                  ? `${Math.abs(item.daysUntil)} dias atrás`
                                  : item.daysUntil === 0
                                    ? 'Vence hoje!'
                                    : item.daysUntil === 1
                                      ? '1 dia'
                                      : `${item.daysUntil} dias`
                                }
                              </p>
                            </div>

                            {isDebt && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Remover este lembrete?")) removeDebtReminder(item.id);
                                }}
                                title="Remover lembrete"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          }

          {/* 5. Minhas Dívidas */}
          <AccordionItem value="debts" className="border-none bg-transparent px-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-red-500/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Minhas Dívidas</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              <DebtsSection data={debtsState} onChange={handleDebtsChange} />
            </AccordionContent>
          </AccordionItem>

          {/* 6. Previsão de Retornos */}
          <AccordionItem value="returns" className="border-none bg-transparent px-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-purple-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Previsão de Retornos</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              <ReturnsForecastSection
                financingParcela={debtTotals.financingParcela}
                cardMonthTotal={debtTotals.cardMonthTotal}
                othersTotal={debtTotals.othersTotal}
                month={forecastMonth}
                onMonthChange={(m) => {
                  setForecastMonth(m);
                  recomputeDebtTotals(debtsState, m);
                }}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 7. Gemini News Panel */}
          <AccordionItem value="gemini-news" className="border-none bg-transparent px-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-indigo-500/10 rounded-lg">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Notícias e Insights (IA)</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              <GeminiNewsPanel assets={assets} />
            </AccordionContent>
          </AccordionItem>

          {/* 8. Análise Gráfica */}
          {calculatedAssets.length > 0 && (
            <AccordionItem value="charts" className="border-none bg-transparent px-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-orange-500/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Análise Gráfica</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <Charts assets={calculatedAssets} />
                <div className="border-t pt-6">
                  <PortfolioIndexComparison assets={calculatedAssets} summary={summary} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

        </Accordion>
      </div>
    </div>
  );
};

// Componente wrapper para integrar Dívidas e Previsão de Retornos

function computeDebtForecast(state: DebtsState, month: string) {
  // Financiamento (soma de todos os financiamentos ativos)
  let financingParcela = 0;
  if (state.financings && state.financings.length > 0) {
    financingParcela = state.financings.reduce((total, financing) => {
      let parcela = 0;
      if (financing.parcela_atual && financing.parcela_atual > 0) {
        parcela = financing.parcela_atual;
      } else {
        const P = financing.valor_financiado || 0;
        const n = financing.prazo_total_meses || 0;
        const i_a = financing.taxa_juros_nominal || 0;
        const i_m = (i_a / 12) / 100;
        if (P > 0 && n > 0) {
          parcela = i_m > 0 ? (P * i_m) / (1 - Math.pow(1 + i_m, -n)) : P / n;
        }
      }
      return total + parcela;
    }, 0);
  }

  const cardMonthTotal = state.cardSpending.filter(e => e.month === month).reduce((s, e) => s + e.amount, 0);
  // Considera apenas "Outros" com vencimento no mês selecionado
  const othersTotal = state.others.reduce((s, o) => {
    if (!o.vencimento) return s; // sem vencimento não entra por padrão
    return o.vencimento.startsWith(month) ? s + o.valor : s;
  }, 0);
  return { financingParcela, cardMonthTotal, othersTotal };
}





export default Index;
