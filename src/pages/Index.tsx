import { useState, useEffect, useMemo } from "react";
import { Asset, CalculatedAsset, PortfolioSummary, Corretora } from "@/types/asset";
import { AssetForm } from "@/components/AssetForm";
import { AssetCard } from "@/components/AssetCard";
import { Charts } from "@/components/Charts";
import { calculateAssets } from "@/services/yahooFinance";
import { loadAssets, saveAssets } from "@/services/fileStorage";
import { mergeAssetsByTicker } from "@/utils/assetUtils";
import { TrendingUp, LogOut, Building2, Bell, Calendar, AlertCircle, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const { user, signOut } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [calculatedAssets, setCalculatedAssets] = useState<CalculatedAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CalculatedAsset | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  
  // Filtros e ordenação
  const [brokerFilter, setBrokerFilter] = useState<"Todas" | Corretora>("Todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<
    "valor_total" | "dividend_yield" | "quantidade" | "preco_atual" | "variacao_percentual" | "pl_posicao"
  >("valor_total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Carrega os ativos do arquivo ao montar o componente
  useEffect(() => {
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
    setAssets((prev) => {
      // Se estiver editando, remove o antigo antes de adicionar o novo
      const filtered = editingAsset ? prev.filter(a => a.id !== editingAsset.id) : prev;
      const updated = [...filtered, asset];
      const merged = mergeAssetsByTicker(updated);

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

    setIsCalculating(true);
    try {
      const result = await calculateAssets(assetsToUse);
      
      // Enriquece cada ativo com os indicadores adicionais
      const valorTotalCarteira = result.resumo.valor_total_carteira;
      const enrichedAssets = result.ativos.map(asset => ({
        ...asset,
        peso_carteira: valorTotalCarteira > 0 ? (asset.valor_total / valorTotalCarteira) * 100 : 0,
        yoc: asset.preco_medio > 0 ? (asset.dividend_yield * asset.preco_atual / asset.preco_medio) : 0,
        projecao_dividendos_anual: (asset.dividend_yield / 100) * asset.valor_total,
      }));
      
      setCalculatedAssets(enrichedAssets);
      setSummary(result.resumo);
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
      : calculatedAssets.filter(a => a.corretora === brokerFilter);

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
      const comp = (typeof av === "number" && typeof bv === "number") ? av - bv : 0;
      return sortDir === "asc" ? comp : -comp;
    });

    return sorted;
  }, [calculatedAssets, brokerFilter, searchQuery, sortKey, sortDir]);

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground flex items-center justify-center md:justify-start gap-3">
              <TrendingUp className="h-10 w-10 text-primary" />
              Dashboard B3
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

        {/* Formulário */}
        <AssetForm 
          onAddAndCalculate={handleAddAndCalculate}
          isCalculating={isCalculating}
          editingAsset={editingAsset}
          onCancelEdit={() => setEditingAsset(null)}
        />

        {/* Resumo da Carteira */}
        {summary && (
          <div className="bg-card p-6 rounded-xl border border-border">
            <Tabs defaultValue="total" className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Resumo da Carteira</h2>
                <TabsList className="grid grid-cols-4 w-auto">
                  <TabsTrigger value="total">Total</TabsTrigger>
                  <TabsTrigger value="corretora">
                    <Building2 className="h-4 w-4 mr-2" />
                    Por Corretora
                  </TabsTrigger>
                  <TabsTrigger value="tipo">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Por Tipo
                  </TabsTrigger>
                  <TabsTrigger value="setor">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Por Setor
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
                      className={`text-3xl font-bold ${
                        calculatedAssets.reduce((sum, a) => sum + a.variacao_percentual, 0) / calculatedAssets.length >= 0 
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
                      className={`text-3xl font-bold ${
                        summary.pl_total >= 0 ? "text-success" : "text-destructive"
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

              <TabsContent value="corretora">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {Array.from(new Set(calculatedAssets.map(a => a.corretora))).map(corretora => {
                    const assetsCorretora = calculatedAssets.filter(a => a.corretora === corretora);
                    const valorTotal = assetsCorretora.reduce((sum, a) => sum + a.valor_total, 0);
                    const dyPonderado = assetsCorretora.reduce((sum, a) => {
                      const participacao = a.valor_total / valorTotal;
                      return sum + a.dividend_yield * participacao;
                    }, 0);
                    const crescimentoMedio = assetsCorretora.reduce((sum, a) => sum + a.variacao_percentual, 0) / assetsCorretora.length;
                    const plTotal = assetsCorretora.reduce((sum, a) => sum + a.pl_posicao, 0);
                    
                    return (
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
                    );
                  })}
                </div>

                {/* Previsão de Dividendos por Corretora */}
                <div className="border-t border-border pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    Previsão de Dividendos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from(new Set(calculatedAssets.map(a => a.corretora))).map(corretora => {
                      const assetsCorretora = calculatedAssets.filter(a => a.corretora === corretora);
                      const projecaoAnual = assetsCorretora.reduce((sum, asset) => sum + asset.projecao_dividendos_anual, 0);
                      const projecaoMensal = projecaoAnual / 12;
                      
                      return (
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
                      );
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
                    {Array.from(new Set(calculatedAssets.map(a => a.tipo_ativo || 'Outro'))).sort().map(tipo => {
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
                    
                    return (
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
                    );
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
                      
                      return (
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
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Cards dos Ativos Calculados */}
        {calculatedAssets.length > 0 && (
          <div>
            <div className="flex flex-col gap-4 mb-4">
              <h2 className="text-2xl font-bold text-foreground">Meus Ativos</h2>

              {/* Barra de busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por ticker ou nome do ativo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 max-w-md"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {/* Barra de filtros/ordenação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Filtrar Corretora */}
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1"><Filter className="h-4 w-4" /> Corretora</div>
                  <Select value={brokerFilter} onValueChange={(v) => setBrokerFilter(v as any)}>
                    <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas</SelectItem>
                      <SelectItem value="Nubank">Nubank</SelectItem>
                      <SelectItem value="XP">XP</SelectItem>
                      <SelectItem value="Itaú">Itaú</SelectItem>
                      <SelectItem value="Santander">Santander</SelectItem>
                      <SelectItem value="BTG">BTG</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ordenar por */}
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Ordenar por</div>
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                    <SelectTrigger className="min-w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor_total">Maior valor</SelectItem>
                      <SelectItem value="dividend_yield">Maior DY</SelectItem>
                      <SelectItem value="quantidade">Maior quantidade</SelectItem>
                      <SelectItem value="preco_atual">Maior preço atual</SelectItem>
                      <SelectItem value="variacao_percentual">Maior variação %</SelectItem>
                      <SelectItem value="pl_posicao">Maior P/L posição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Direção */}
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Direção</div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={sortDir === "desc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortDir("desc")}
                      title="Maior para menor"
                    >
                      <ArrowDownWideNarrow className="h-4 w-4 mr-1" /> Desc
                    </Button>
                    <Button
                      type="button"
                      variant={sortDir === "asc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortDir("asc")}
                      title="Menor para maior"
                    >
                      <ArrowUpWideNarrow className="h-4 w-4 mr-1" /> Asc
                    </Button>
                  </div>
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

            {/* Paginação */}
            {displayedAssets.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-2 mt-8">
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
        )}

        {/* Lembretes - Vencimentos de Títulos */}
        {upcomingMaturities.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Bell className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  Lembretes
                  {upcomingMaturities.filter(a => a.daysUntilMaturity <= 30).length > 0 && (
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-full">
                      {upcomingMaturities.filter(a => a.daysUntilMaturity <= 30 && a.daysUntilMaturity >= 0).length} próximo(s)
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">Vencimentos dos seus títulos de renda fixa</p>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingMaturities.map((asset) => {
                const isExpiringSoon = asset.daysUntilMaturity <= 30 && asset.daysUntilMaturity >= 0;
                const isExpired = asset.daysUntilMaturity < 0;
                
                return (
                  <div 
                    key={asset.id} 
                    className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
                      isExpired 
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' 
                        : isExpiringSoon 
                          ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                          : 'bg-card border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2.5 rounded-lg shrink-0 ${
                        isExpired 
                          ? 'bg-red-500/10' 
                          : isExpiringSoon 
                            ? 'bg-amber-500/10' 
                            : 'bg-primary/10'
                      }`}>
                        <Calendar className={`h-5 w-5 ${
                          isExpired 
                            ? 'text-red-500' 
                            : isExpiringSoon 
                              ? 'text-amber-500' 
                              : 'text-primary'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground text-lg">
                            {asset.ticker_normalizado.replace(".SA", "") || asset.tipo_ativo_manual}
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
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {asset.tipo_ativo_manual || 'Renda Fixa'} • {asset.corretora}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 md:gap-8">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                        <p className="text-base md:text-lg font-bold text-foreground whitespace-nowrap">
                          {new Date(asset.data_vencimento!).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      
                      <div className="text-left md:text-right min-w-[120px]">
                        <p className="text-xs text-muted-foreground mb-1">Faltam</p>
                        <p className={`text-base md:text-lg font-bold whitespace-nowrap ${
                          isExpired 
                            ? 'text-red-600 dark:text-red-400' 
                            : isExpiringSoon 
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground'
                        }`}>
                          {isExpired 
                            ? `${Math.abs(asset.daysUntilMaturity)} dias atrás`
                            : asset.daysUntilMaturity === 0
                              ? 'Vence hoje!'
                              : asset.daysUntilMaturity === 1
                                ? '1 dia'
                                : `${asset.daysUntilMaturity} dias`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gráficos */}
        {calculatedAssets.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Análise Gráfica</h2>
            <Charts assets={calculatedAssets} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
