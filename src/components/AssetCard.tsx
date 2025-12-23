import { CalculatedAsset } from "@/types/asset";
import { TrendingUp, TrendingDown, Trash2, ChevronDown, Percent, TrendingUp as TrendingUpIcon, DollarSign, Edit, Calendar, Landmark, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { getBrokerColor } from "@/utils/brokerColors";
import { Corretora } from "@/types/asset";

interface AssetCardProps {
  asset: CalculatedAsset;
  onRemove?: (id: string) => void;
  onEdit?: (asset: CalculatedAsset) => void;
}

const getCardStyle = (corretora: string): React.CSSProperties => {
  const baseColor = getBrokerColor(corretora as Corretora);

  // Escurece a cor base para aumentar o contraste com o texto
  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - percent));
    const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - percent));
    const b = Math.max(0, (num & 0xFF) * (1 - percent));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  };

  const gradStart = darkenColor(baseColor, 0.35);
  const gradEnd = darkenColor(baseColor, 0.65);

  return {
    // Overlay sutil escuro + gradiente da corretora escurecido
    backgroundImage: `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%)`,
    color: '#fff',
  };
};

export function AssetCard({ asset, onRemove, onEdit }: AssetCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isPositive = asset.variacao_percentual >= 0;
  const cardStyle = getCardStyle(asset.corretora);

  // Detecta se é Renda Fixa
  const isRendaFixa = !!asset.tipo_ativo_manual;

  // Para Renda Fixa, usa valor_atual_rf, senão usa valor_total
  const valorAtual = isRendaFixa ? (asset.valor_atual_rf || asset.valor_total) : asset.preco_atual;
  const valorInvestido = asset.preco_medio;
  const valorTotalAtivo = isRendaFixa ? (asset.valor_atual_rf || asset.valor_total) : asset.valor_total;

  // Calcula rentabilidade para Renda Fixa
  const rentabilidade = isRendaFixa && valorInvestido > 0
    ? ((valorAtual - valorInvestido) / valorInvestido) * 100
    : asset.variacao_percentual;

  const handleDelete = () => {
    if (!onRemove) return;

    toast({
      title: "Confirmar exclusão",
      description: `Deseja realmente remover ${asset.ticker_normalizado.replace(".SA", "")} da carteira?`,
      action: (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onRemove(asset.id);
            toast({
              title: "Ativo removido",
              description: `${asset.ticker_normalizado.replace(".SA", "")} foi removido da carteira`,
            });
          }}
        >
          Confirmar
        </Button>
      ),
    });
  };

  return (
    <div
      style={cardStyle}
      className="rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative group"
    >
      {/* Exibe alerta de erro se houver */}
      {(asset as any).error && (
        <div className="mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-xs text-red-200">{(asset as any).error}</p>
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(asset)}
            className="h-8 w-8 rounded-full bg-white/0 text-white/60 hover:bg-white/20 hover:text-white focus:bg-white/20 transition-all shadow-sm backdrop-blur-sm border border-white/10"
            title="Editar ativo"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="h-8 w-8 rounded-full bg-white/0 text-white/60 hover:bg-white/20 hover:text-white focus:bg-white/20 transition-all shadow-sm backdrop-blur-sm border border-white/10"
            title="Remover ativo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold">{asset.ticker_normalizado.replace(".SA", "")}</h3>
            {asset.is_international && (
              <span className="bg-blue-500/20 text-blue-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
                <Globe className="h-3 w-3" />
                INTL
              </span>
            )}
          </div>
          <p className="text-white/80 text-sm flex items-center gap-2">
            {isRendaFixa ? (
              (() => {
                const indice = asset.indice_referencia || asset.tipo_ativo_manual || '';
                const taxa = asset.taxa_contratada ?? undefined;
                // Heurística:
                // - CDI/Selic com taxa alta (>= 50) tratamos como X% do INDICE
                // - IPCA/IGP-M com taxa -> INDICE + X%
                // - Pré-fixado -> X% a.a.
                if (indice?.toUpperCase().includes('CDI') || indice?.toUpperCase().includes('SELIC')) {
                  if (typeof taxa === 'number' && taxa > 0) return `${formatPercent(taxa, taxa % 1 === 0 ? 0 : 2)} do ${indice}`;
                  return indice;
                }
                if (indice?.toUpperCase().includes('IPCA') || indice?.toUpperCase().includes('IGP')) {
                  if (typeof taxa === 'number' && taxa > 0) return `${indice} + ${formatPercent(taxa, 2)}`;
                  return indice;
                }
                if (indice?.toLowerCase().includes('pré')) {
                  if (typeof taxa === 'number' && taxa > 0) return `${formatPercent(taxa, 2)} a.a.`;
                  return 'Pré-fixado';
                }
                if (taxa && taxa > 0 && indice) return `${indice} + ${formatPercent(taxa, 2)}`;
                return indice || asset.tipo_ativo_manual || 'Renda Fixa';
              })()
            ) : (
              <>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded text-xs">
                  {asset.tipo_ativo || 'Ação'}
                </span>
                <span>•</span>
                <span>{asset.corretora}</span>
                {asset.setor && (
                  <>
                    <span>•</span>
                    <span>{asset.setor}</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            <span className={`text-lg font-bold ${isPositive ? "text-green-200" : "text-red-200"}`}>
              {formatPercent(rentabilidade, 2, true)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-white/70 text-xs mb-1">{isRendaFixa ? 'Valor Atual' : 'Preço Atual'}</p>
          <p className="text-xl font-bold">{formatCurrency(valorAtual)}</p>
        </div>
        <div>
          <p className="text-white/70 text-xs mb-1">{isRendaFixa ? 'Valor Aplicado' : 'Preço Médio'}</p>
          <p className="text-xl font-bold">{formatCurrency(valorInvestido)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-white/70 text-xs mb-1">{isRendaFixa ? 'Tipo' : 'Quantidade'}</p>
          <p className="text-lg font-semibold">{isRendaFixa ? asset.tipo_ativo_manual : asset.quantidade}</p>
        </div>
        <div>
          <p className="text-white/70 text-xs mb-1">Valor Total</p>
          <p className="text-lg font-semibold">{formatCurrency(valorTotalAtivo)}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-white/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/70 text-xs mb-1">{isRendaFixa ? 'Rentabilidade' : 'Dividend Yield'}</p>
            <p className="text-2xl font-bold text-green-200">
              {isRendaFixa ? formatPercent(rentabilidade, 2, true) : formatPercent(asset.dividend_yield, 2)}
            </p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">P/L Posição</p>
            <p className={`text-2xl font-bold ${asset.pl_posicao >= 0 ? "text-green-200" : "text-red-200"}`}>
              {formatCurrency(asset.pl_posicao, true)}
            </p>
          </div>
        </div>
      </div>

      {/* Toggle para indicadores adicionais */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="text-xs">Ver mais detalhes</span>
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">Peso na Carteira</span>
            </div>
            <span className="text-sm font-semibold text-white">{formatPercent(asset.peso_carteira, 2)}</span>
          </div>

          {!isRendaFixa && (
            <>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 text-white/60" />
                  <span className="text-sm text-white/80">Yield on Cost</span>
                </div>
                <span className="text-sm font-semibold text-green-200">{formatPercent(asset.yoc, 2)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-white/60" />
                  <span className="text-sm text-white/80">Projeção Anual</span>
                </div>
                <span className="text-sm font-semibold text-green-200">{formatCurrency(asset.projecao_dividendos_anual)}</span>
              </div>
            </>
          )}

          {isRendaFixa && (
            <>
              {asset.indice_referencia && (
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-white/60" />
                    <span className="text-sm text-white/80">Índice de Referência</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{asset.indice_referencia}</span>
                </div>
              )}

              {asset.taxa_contratada && asset.taxa_contratada > 0 && (
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-white/60" />
                    <span className="text-sm text-white/80">Taxa Contratada</span>
                  </div>
                  <span className="text-sm font-semibold text-green-200">{formatPercent(asset.taxa_contratada, 2, true)}</span>
                </div>
              )}

              {asset.data_aplicacao && (
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/60" />
                    <span className="text-sm text-white/80">Aplicação</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {new Date(asset.data_aplicacao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}

              {asset.data_vencimento && (
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/60" />
                    <span className="text-sm text-white/80">Vencimento</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {new Date(asset.data_vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
