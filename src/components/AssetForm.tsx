import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Asset, Corretora, CalculatedAsset } from "@/types/asset";
import { Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssetFormProps {
  onAddAndCalculate: (asset: Asset) => void;
  isCalculating: boolean;
  editingAsset?: CalculatedAsset | null;
  onCancelEdit?: () => void;
}

const corretoras: Corretora[] = ["Nubank", "XP", "Itaú", "Santander", "BTG", "Outros"];

export function AssetForm({ onAddAndCalculate, isCalculating, editingAsset, onCancelEdit }: AssetFormProps) {
  const [ticker, setTicker] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoMedio, setPrecoMedio] = useState("");
  const [corretora, setCorretora] = useState<Corretora>("Nubank");

  // Preenche o formulário quando editingAsset mudar
  useEffect(() => {
    if (editingAsset) {
      setTicker(editingAsset.ticker);
      setQuantidade(editingAsset.quantidade.toString());
      setPrecoMedio(editingAsset.preco_medio.toString());
      setCorretora(editingAsset.corretora);
    }
  }, [editingAsset]);

  const handleCalculate = () => {
    if (!ticker || !quantidade || !precoMedio) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha ticker, quantidade e preço médio",
        variant: "destructive",
      });
      return;
    }

    const qtd = parseFloat(quantidade);
    const preco = parseFloat(precoMedio);

    if (qtd <= 0 || preco <= 0) {
      toast({
        title: "Valores inválidos",
        description: "Quantidade e preço devem ser maiores que zero",
        variant: "destructive",
      });
      return;
    }

    const newAsset: Asset = {
      id: editingAsset?.id || Date.now().toString(),
      ticker: ticker.toUpperCase().trim(),
      quantidade: qtd,
      preco_medio: preco,
      corretora,
    };

  // Adiciona e calcula com a lista mesclada atual
  onAddAndCalculate(newAsset);

    // Limpa o formulário
    setTicker("");
    setQuantidade("");
    setPrecoMedio("");

    // Cálculo será disparado no container (Index) junto com a adição
  };

  return (
    <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          {editingAsset ? `Editando ${editingAsset.ticker}` : "Adicionar Ativo"}
        </h2>
        {editingAsset && onCancelEdit && (
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancelar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ticker">Ticker *</Label>
          <Input
            id="ticker"
            placeholder="Ex: PETR4"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="uppercase"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade *</Label>
          <Input
            id="quantidade"
            type="number"
            step="1"
            min="1"
            placeholder="Ex: 100"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="preco_medio">Preço Médio (R$) *</Label>
          <Input
            id="preco_medio"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Ex: 27.50"
            value={precoMedio}
            onChange={(e) => setPrecoMedio(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="corretora">Corretora *</Label>
          <Select value={corretora} onValueChange={(value) => setCorretora(value as Corretora)}>
            <SelectTrigger id="corretora">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {corretoras.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleCalculate} 
        disabled={isCalculating}
        className="w-full"
      >
        <Calculator className="mr-2 h-4 w-4" />
        {isCalculating ? "Calculando..." : editingAsset ? "Atualizar Ativo" : "Calcular via Yahoo Finance"}
      </Button>
    </div>
  );
}
