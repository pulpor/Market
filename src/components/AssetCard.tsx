import { CalculatedAsset } from "@/types/asset";
import { TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetCardProps {
  asset: CalculatedAsset;
  onRemove?: (id: string) => void;
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

export function AssetCard({ asset, onRemove }: AssetCardProps) {
  const isPositive = asset.variacao_percentual >= 0;
  const gradientClass = getGradientClass(asset.corretora);

  return (
    <div className={`${gradientClass} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative`}>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(asset.id)}
          className="absolute top-2 right-2 h-8 w-8 text-white/70 hover:text-white hover:bg-white/20"
          title="Remover ativo"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold">{asset.ticker_normalizado.replace(".SA", "")}</h3>
          <p className="text-white/80 text-sm">{asset.setor || asset.corretora}</p>
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
    </div>
  );
}
