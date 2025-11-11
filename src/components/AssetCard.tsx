import { CalculatedAsset } from "@/types/asset";
import { TrendingUp, TrendingDown, Trash2, ChevronDown, Percent, TrendingUp as TrendingUpIcon, DollarSign, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface AssetCardProps {
  asset: CalculatedAsset;
  onRemove?: (id: string) => void;
  onEdit?: (asset: CalculatedAsset) => void;
}

const getGradientClass = (corretora: string): string => {
  const gradients: Record<string, string> = {
    Nubank: "bg-gradient-to-br from-nubank-start to-nubank-end",
    XP: "bg-gradient-to-br from-xp-start to-xp-end",
    Itaú: "bg-gradient-to-br from-itau-start to-itau-end",
    Santander: "bg-gradient-to-br from-santander-start to-santander-end",
    BTG: "bg-gradient-to-br from-btg-start to-btg-end",
    Outros: "bg-gradient-to-br from-other-start to-other-end",
  };
  return gradients[corretora] || gradients.Outros;
};

export function AssetCard({ asset, onRemove, onEdit }: AssetCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isPositive = asset.variacao_percentual >= 0;
  const gradientClass = getGradientClass(asset.corretora);

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
    <div className={`${gradientClass} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative group`}>
      {/* Botões de ação */}
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
          <h3 className="text-2xl font-bold">{asset.ticker_normalizado.replace(".SA", "")}</h3>
          <p className="text-white/80 text-sm">{asset.setor || 'Setor desconhecido'}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            <span className={`text-lg font-bold ${isPositive ? "text-green-200" : "text-red-200"}`}>
              {isPositive ? "+" : ""}
              {asset.variacao_percentual.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-white/70 text-xs mb-1">Preço Atual</p>
          <p className="text-xl font-bold">R$ {asset.preco_atual.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/70 text-xs mb-1">Preço Médio</p>
          <p className="text-xl font-bold">R$ {asset.preco_medio.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-white/70 text-xs mb-1">Quantidade</p>
          <p className="text-lg font-semibold">{asset.quantidade}</p>
        </div>
        <div>
          <p className="text-white/70 text-xs mb-1">Valor Total</p>
          <p className="text-lg font-semibold">R$ {asset.valor_total.toFixed(2)}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-white/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/70 text-xs mb-1">Dividend Yield</p>
            <p className="text-2xl font-bold text-green-200">{asset.dividend_yield.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">P/L Posição</p>
            <p className={`text-2xl font-bold ${asset.pl_posicao >= 0 ? "text-green-200" : "text-red-200"}`}>
              R$ {asset.pl_posicao >= 0 ? "+" : ""}
              {asset.pl_posicao.toFixed(2)}
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
            <span className="text-sm font-semibold text-white">{asset.peso_carteira.toFixed(2)}%</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">Yield on Cost</span>
            </div>
            <span className="text-sm font-semibold text-green-200">{asset.yoc.toFixed(2)}%</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">Projeção Anual</span>
            </div>
            <span className="text-sm font-semibold text-green-200">R$ {asset.projecao_dividendos_anual.toFixed(2)}</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
