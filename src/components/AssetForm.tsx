import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Asset, Corretora, CalculatedAsset } from "@/types/asset";
import { Calculator, TrendingUp, Landmark } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssetFormProps {
  onAddAndCalculate: (asset: Asset) => void;
  isCalculating: boolean;
  editingAsset?: CalculatedAsset | null;
  onCancelEdit?: () => void;
}

const corretoras: Corretora[] = ["Nubank", "XP", "Itaú", "Santander", "BTG", "Outros"];
const tiposRendaFixa = ["Previdência", "Tesouro Direto", "CDB", "LCI/LCA", "Debêntures", "Outros"] as const;
const indicesReferencia = ["CDI", "IPCA", "Pré-fixado", "Selic", "IGP-M", "Outros"] as const;

export function AssetForm({ onAddAndCalculate, isCalculating, editingAsset, onCancelEdit }: AssetFormProps) {
  const [modoAtivo, setModoAtivo] = useState<"variavel" | "fixa">("variavel");
  
  // Campos Renda Variável
  const [ticker, setTicker] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoMedio, setPrecoMedio] = useState("");
  const [corretora, setCorretora] = useState<Corretora>("Nubank");

  // Campos Renda Fixa
  const [nomeAtivo, setNomeAtivo] = useState("");
  const [tipoRendaFixa, setTipoRendaFixa] = useState<typeof tiposRendaFixa[number]>("Tesouro Direto");
  const [valorAplicado, setValorAplicado] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [indiceReferencia, setIndiceReferencia] = useState<typeof indicesReferencia[number]>("CDI");
  const [taxaContratada, setTaxaContratada] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");

  // Preenche o formulário quando editingAsset mudar
  useEffect(() => {
    if (editingAsset) {
      // Se tem tipo_ativo_manual, é Renda Fixa
      if (editingAsset.tipo_ativo_manual) {
        setModoAtivo("fixa");
        setNomeAtivo(editingAsset.ticker);
        setTipoRendaFixa(editingAsset.tipo_ativo_manual as typeof tiposRendaFixa[number]);
        setValorAplicado(editingAsset.preco_medio.toString());
        setValorAtual((editingAsset.valor_atual_rf || editingAsset.preco_medio).toString());
        setIndiceReferencia((editingAsset.indice_referencia || "CDI") as typeof indicesReferencia[number]);
        setTaxaContratada(editingAsset.taxa_contratada?.toString() || "");
        setDataVencimento(editingAsset.data_vencimento || "");
        setCorretora(editingAsset.corretora);
      } else {
        // Renda Variável
        setModoAtivo("variavel");
        setTicker(editingAsset.ticker);
        setQuantidade(editingAsset.quantidade.toString());
        setPrecoMedio(editingAsset.preco_medio.toString());
        setCorretora(editingAsset.corretora);
      }
    }
  }, [editingAsset]);

  const handleCalculate = () => {
    if (modoAtivo === "variavel") {
      // Validação Renda Variável
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

      onAddAndCalculate(newAsset);

      // Limpa o formulário
      setTicker("");
      setQuantidade("");
      setPrecoMedio("");
    } else {
      // Validação Renda Fixa
      if (!nomeAtivo || !valorAplicado || !valorAtual) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha nome, valor aplicado e valor atual",
          variant: "destructive",
        });
        return;
      }

      const valAplicado = parseFloat(valorAplicado);
      const valAtual = parseFloat(valorAtual);

      if (valAplicado <= 0 || valAtual <= 0) {
        toast({
          title: "Valores inválidos",
          description: "Valores devem ser maiores que zero",
          variant: "destructive",
        });
        return;
      }

      const newAsset: Asset = {
        id: editingAsset?.id || Date.now().toString(),
        ticker: nomeAtivo.toUpperCase().trim(),
        quantidade: 1, // Renda fixa sempre 1 unidade
        preco_medio: valAplicado,
        corretora,
        tipo_ativo_manual: tipoRendaFixa,
        indice_referencia: indiceReferencia,
        taxa_contratada: taxaContratada ? parseFloat(taxaContratada) : undefined,
        data_vencimento: dataVencimento || undefined,
        valor_atual_rf: valAtual,
      };

      onAddAndCalculate(newAsset);

      // Limpa o formulário
      setNomeAtivo("");
      setValorAplicado("");
      setValorAtual("");
      setTaxaContratada("");
      setDataVencimento("");
    }
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

      {/* Toggle Renda Variável / Renda Fixa */}
      <Tabs value={modoAtivo} onValueChange={(v) => setModoAtivo(v as "variavel" | "fixa")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="variavel">
            <TrendingUp className="h-4 w-4 mr-2" />
            Renda Variável
          </TabsTrigger>
          <TabsTrigger value="fixa">
            <Landmark className="h-4 w-4 mr-2" />
            Renda Fixa / Outros
          </TabsTrigger>
        </TabsList>

        {/* Formulário Renda Variável */}
        <TabsContent value="variavel" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker *</Label>
              <Input
                id="ticker"
                placeholder="Ex: PETR4, VISC11"
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
          <p className="text-xs text-muted-foreground">
            Ações, FIIs e ETFs são detectados automaticamente e atualizados em tempo real via Yahoo Finance.
          </p>
        </TabsContent>

        {/* Formulário Renda Fixa */}
        <TabsContent value="fixa" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeAtivo">Nome do Ativo *</Label>
              <Input
                id="nomeAtivo"
                placeholder="Ex: Tesouro Selic 2029"
                value={nomeAtivo}
                onChange={(e) => setNomeAtivo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoRendaFixa">Tipo *</Label>
              <Select value={tipoRendaFixa} onValueChange={(v) => setTipoRendaFixa(v as typeof tiposRendaFixa[number])}>
                <SelectTrigger id="tipoRendaFixa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposRendaFixa.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorAplicado">Valor Aplicado (R$) *</Label>
              <Input
                id="valorAplicado"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 10000.00"
                value={valorAplicado}
                onChange={(e) => setValorAplicado(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorAtual">Valor Atual (R$) *</Label>
              <Input
                id="valorAtual"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 10850.00"
                value={valorAtual}
                onChange={(e) => setValorAtual(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="indiceReferencia">Índice de Referência</Label>
              <Select value={indiceReferencia} onValueChange={(v) => setIndiceReferencia(v as typeof indicesReferencia[number])}>
                <SelectTrigger id="indiceReferencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {indicesReferencia.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxaContratada">Taxa Contratada (% a.a.)</Label>
              <Input
                id="taxaContratada"
                type="number"
                step="0.01"
                placeholder="Ex: 12.5"
                value={taxaContratada}
                onChange={(e) => setTaxaContratada(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data de Vencimento</Label>
              <Input
                id="dataVencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="corretoraRF">Instituição *</Label>
              <Select value={corretora} onValueChange={(value) => setCorretora(value as Corretora)}>
                <SelectTrigger id="corretoraRF">
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
          <p className="text-xs text-muted-foreground">
            Valores devem ser atualizados manualmente. Indicadores como rentabilidade e prazo são calculados automaticamente.
          </p>
        </TabsContent>
      </Tabs>

      <Button 
        onClick={handleCalculate} 
        disabled={isCalculating}
        className="w-full"
      >
        <Calculator className="mr-2 h-4 w-4" />
        {isCalculating ? "Processando..." : editingAsset ? "Atualizar Ativo" : modoAtivo === "variavel" ? "Adicionar e Calcular" : "Adicionar Investimento"}
      </Button>
    </div>
  );
}
