import { Asset } from "@/types/asset";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssetListProps {
  assets: Asset[];
  onRemoveAsset: (id: string) => void;
}

export function AssetList({ assets, onRemoveAsset }: AssetListProps) {
  if (assets.length === 0) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border text-center">
        <p className="text-muted-foreground">Nenhum ativo cadastrado. Adicione ativos usando o formulário acima.</p>
      </div>
    );
  }

  const handleRemove = (id: string, ticker: string) => {
    onRemoveAsset(id);
    toast({
      title: "Ativo removido",
      description: `${ticker} foi removido da carteira`,
    });
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h2 className="text-xl font-bold text-foreground mb-4">Ativos Cadastrados ({assets.length})</h2>
      <div className="space-y-2">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-foreground">{asset.ticker}</span>
                <span className="text-sm text-muted-foreground">{asset.corretora}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {asset.quantidade} ações × R$ {asset.preco_medio.toFixed(2)}
                {asset.setor && <span className="ml-2">• {asset.setor}</span>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(asset.id, asset.ticker)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
