import { useState, useEffect } from "react";
import { Asset, CalculatedAsset, PortfolioSummary } from "@/types/asset";
import { AssetForm } from "@/components/AssetForm";
import { AssetList } from "@/components/AssetList";
import { AssetCard } from "@/components/AssetCard";
import { Charts } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { calculateAssets } from "@/services/yahooFinance";
import { loadAssets, saveAssets } from "@/services/fileStorage";
import { Calculator, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [calculatedAssets, setCalculatedAssets] = useState<CalculatedAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Carrega os ativos do arquivo ao montar o componente
  useEffect(() => {
    const loadInitialAssets = async () => {
      setIsLoading(true);
      const loadedAssets = await loadAssets();
      setAssets(loadedAssets);
      setIsLoading(false);

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

  const handleAddAsset = (asset: Asset) => {
    setAssets((prev) => [...prev, asset]);
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
      setCalculatedAssets(result.ativos);
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
    await calculateAndPersist(assets);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground flex items-center justify-center gap-3">
            <TrendingUp className="h-10 w-10 text-primary" />
            Dashboard B3
          </h1>
          <p className="text-muted-foreground text-lg">Acompanhe sua carteira e Dividend Yield em tempo real</p>
        </header>

        {/* Formulário */}
        <AssetForm onAddAsset={handleAddAsset} />

        {/* Lista de Ativos */}
        {isLoading ? (
          <div className="bg-card p-6 rounded-xl border border-border text-center">
            <p className="text-muted-foreground">Carregando carteira...</p>
          </div>
        ) : (
          <AssetList assets={assets} onRemoveAsset={handleRemoveAsset} />
        )}

        {/* Botões de Ação */}
        {assets.length > 0 && (
            <div className="flex justify-center">
            <Button onClick={handleCalculate} disabled={isCalculating} size="lg" className="text-lg px-8">
              <Calculator className="mr-2 h-5 w-5" />
              {isCalculating ? "Calculando..." : "Calcular via Yahoo Finance"}
            </Button>
          </div>
        )}

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
            <h2 className="text-2xl font-bold text-foreground mb-4">Meus Ativos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calculatedAssets.map((asset) => (
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
