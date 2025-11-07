import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Asset, Corretora } from "@/types/asset";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssetFormProps {
  onAddAsset: (asset: Asset) => void;
}

const corretoras: Corretora[] = ["Nubank", "XP", "Itaú", "Santander", "BTG", "Outros"];

export function AssetForm({ onAddAsset }: AssetFormProps) {
  const [ticker, setTicker] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoMedio, setPrecoMedio] = useState("");
  const [setor, setSetor] = useState("");
  const [corretora, setCorretora] = useState<Corretora>("Nubank");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      id: Date.now().toString(),
      ticker: ticker.toUpperCase().trim(),
      quantidade: qtd,
      preco_medio: preco,
      setor: setor || undefined,
      corretora,
    };

    onAddAsset(newAsset);

    // Limpa o formulário
    setTicker("");
    setQuantidade("");
    setPrecoMedio("");
    setSetor("");

    toast({
      title: "Ativo adicionado",
      description: `${newAsset.ticker} foi adicionado à carteira`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-xl border border-border">
      <h2 className="text-xl font-bold text-foreground">Adicionar Ativo</h2>

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
          <Label htmlFor="setor">Setor (opcional)</Label>
          <Input
            id="setor"
            placeholder="Ex: Petróleo"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
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

      <Button type="submit" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Ativo
      </Button>
    </form>
  );
}
