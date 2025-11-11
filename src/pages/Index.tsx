import { useState, useEffect, useMemo } from "react";
import { Asset, CalculatedAsset, PortfolioSummary, Corretora } from "@/types/asset";
import { AssetForm } from "@/components/AssetForm";
import { AssetCard } from "@/components/AssetCard";
import { Charts } from "@/components/Charts";
import { calculateAssets } from "@/services/yahooFinance";
import { loadAssets, saveAssets } from "@/services/fileStorage";
import { mergeAssetsByTicker } from "@/utils/assetUtils";
import { TrendingUp, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, signOut } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [calculatedAssets, setCalculatedAssets] = useState<CalculatedAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  // Filtros e ordenação
  const [brokerFilter, setBrokerFilter] = useState<"Todas" | Corretora>("Todas");
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

  // Adiciona o ativo e já calcula usando a lista mesclada atualizada
  const handleAddAndCalculate = (asset: Asset) => {
    setAssets((prev) => {
      const updated = [...prev, asset];
      const merged = mergeAssetsByTicker(updated);

      if (merged.length < updated.length) {
        toast({
          title: "Posições mescladas",
          description: `${asset.ticker.toUpperCase()} na corretora ${asset.corretora} teve posição combinada (quantidade e preço médio recalculados).`,
        });
      }

      calculateAndPersist(merged, true).then(() => {
        toast({
          title: "Cálculo concluído",
          description: `${asset.ticker.toUpperCase()} adicionado e carteira recalculada`,
        });
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
    const filtered = brokerFilter === "Todas"
      ? calculatedAssets
      : calculatedAssets.filter(a => a.corretora === brokerFilter);

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const comp = (typeof av === "number" && typeof bv === "number") ? av - bv : 0;
      return sortDir === "asc" ? comp : -comp;
    });

    return sorted;
  }, [calculatedAssets, brokerFilter, sortKey, sortDir]);

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
        />

        {/* Resumo da Carteira */}
        {summary && (
          <div className="bg-card p-6 rounded-xl border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-4">Resumo da Carteira</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Valor Total</p>
                <p className="text-3xl font-bold text-foreground">R$ {summary.valor_total_carteira.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">DY Médio Ponderado</p>
                <p className="text-3xl font-bold text-success">{summary.dy_ponderado.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">P/L Total</p>
                <p
                  className={`text-3xl font-bold ${
                    summary.pl_total >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  R$ {summary.pl_total >= 0 ? "+" : ""}
                  {summary.pl_total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cards dos Ativos Calculados */}
        {calculatedAssets.length > 0 && (
          <div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
              <h2 className="text-2xl font-bold text-foreground">Meus Ativos</h2>

              {/* Barra de filtros/ordenação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
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
              {displayedAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onRemove={handleRemoveAsset} />
              ))}
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
