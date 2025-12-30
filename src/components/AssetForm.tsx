import { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Asset, Corretora, CalculatedAsset } from "@/types/asset";
import { BROKER_LIST } from "@/utils/brokerColors";
import { Calculator, TrendingUp, Landmark } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssetFormProps {
  onAddAndCalculate: (asset: Asset) => void;
  isCalculating: boolean;
  editingAsset?: CalculatedAsset | null;
  onCancelEdit?: () => void;
}

const tiposRendaFixa = ["Previdência", "Tesouro Direto", "CDB", "LCI/LCA", "Debêntures", "Outros"] as const;
const indicesReferencia = ["CDI", "IPCA", "Pré-fixado", "Selic", "IGP-M", "Outros"] as const;

export function AssetForm({ onAddAndCalculate, isCalculating, editingAsset, onCancelEdit }: AssetFormProps) {
  const [modoAtivo, setModoAtivo] = useState<"variavel" | "fixa">("variavel");
  const [multiAporteRf, setMultiAporteRf] = useState(false);
  type MovimentoForm = { id: string; data: string; valor: string };
  const hojeISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [movimentosRf, setMovimentosRf] = useState<MovimentoForm[]>([]);

  // Campos Renda Variável
  const [ticker, setTicker] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoMedio, setPrecoMedio] = useState("");
  const [corretora, setCorretora] = useState<Corretora>("Nubank");
  const [isInternational, setIsInternational] = useState(false);

  // Campos Renda Fixa
  const [nomeAtivo, setNomeAtivo] = useState("");
  const [tipoRendaFixa, setTipoRendaFixa] = useState<typeof tiposRendaFixa[number]>("Tesouro Direto");
  const [valorAplicado, setValorAplicado] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [indiceReferencia, setIndiceReferencia] = useState<typeof indicesReferencia[number]>("CDI");
  const [taxaContratada, setTaxaContratada] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState("");

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
        setDataAplicacao((editingAsset as any).data_aplicacao || "");
        setCorretora(editingAsset.corretora);
        if (editingAsset.movimentos && editingAsset.movimentos.length > 0) {
          setMultiAporteRf(true);
          setMovimentosRf(editingAsset.movimentos.map(m => ({ id: m.id, data: m.data, valor: m.valor.toString() })));
        } else {
          setMultiAporteRf(false);
          setMovimentosRf([]);
        }
      } else {
        // Renda Variável
        setModoAtivo("variavel");
        setTicker(editingAsset.ticker);
        setQuantidade(editingAsset.quantidade.toString());
        setPrecoMedio(editingAsset.preco_medio.toString());
        setCorretora(editingAsset.corretora);
        setIsInternational(editingAsset.is_international || false);
        setMultiAporteRf(false);
        setMovimentosRf([]);
      }
    }
  }, [editingAsset]);

  const addMovimento = () => {
    setMovimentosRf((prev) => [...prev, { id: uuidv4(), data: hojeISO, valor: "" }]);
  };

  const updateMovimento = (id: string, field: keyof MovimentoForm, value: string) => {
    setMovimentosRf((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeMovimento = (id: string) => {
    setMovimentosRf((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCalculate = () => {
    if (modoAtivo === "variavel") {
      // Validação Renda Variável (preço médio manual)
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
        id: editingAsset?.id || uuidv4(),
        ticker: ticker.toUpperCase().trim(),
        quantidade: qtd,
        preco_medio: preco,
        corretora,
        is_international: isInternational,
      };

      onAddAndCalculate(newAsset);

      // Limpa o formulário
      setTicker("");
      setQuantidade("");
      setPrecoMedio("");
      setIsInternational(false);
    } else {
      // Validação Renda Fixa
      if (!nomeAtivo) {
        toast({ title: "Campos obrigatórios", description: "Preencha nome do ativo", variant: "destructive" });
        return;
      }

      let valAplicado = valorAplicado ? parseFloat(valorAplicado) : 0;
      const valAtual = valorAtual ? parseFloat(valorAtual) : undefined;

      if (multiAporteRf) {
        const movsValidos = movimentosRf.filter(m => m.valor.trim() !== "");
        if (movsValidos.length === 0) {
          toast({ title: "Adicione aportes", description: "Inclua pelo menos um movimento", variant: "destructive" });
          return;
        }
        valAplicado = movsValidos.reduce((sum, m) => sum + parseFloat(m.valor || "0"), 0);
        if (!Number.isFinite(valAplicado) || valAplicado <= 0) {
          toast({ title: "Valor inválido", description: "Somatório dos aportes deve ser maior que zero", variant: "destructive" });
          return;
        }
      } else {
        if (!valorAplicado) {
          toast({ title: "Campos obrigatórios", description: "Preencha valor aplicado", variant: "destructive" });
          return;
        }
        if (valAplicado <= 0) {
          toast({ title: "Valores inválidos", description: "Valor aplicado deve ser maior que zero", variant: "destructive" });
          return;
        }
      }

      const movimentosParaSalvar = multiAporteRf
        ? movimentosRf.filter(m => m.valor.trim() !== "").map(m => ({ id: m.id, data: m.data || hojeISO, valor: parseFloat(m.valor), cotas: 1 }))
        : undefined;

      // Usa a data do primeiro aporte como aplicação se não houver data informada
      const dataAplicacaoFinal = dataAplicacao || (multiAporteRf && movimentosParaSalvar && movimentosParaSalvar[0]?.data) || undefined;

      const newAsset: Asset = {
        id: editingAsset?.id || uuidv4(),
        ticker: nomeAtivo.toUpperCase().trim(),
        quantidade: 1, // Renda fixa permanece unidade lógica
        preco_medio: valAplicado,
        corretora,
        tipo_ativo_manual: tipoRendaFixa,
        indice_referencia: indiceReferencia,
        taxa_contratada: taxaContratada ? parseFloat(taxaContratada) : undefined,
        data_vencimento: dataVencimento || undefined,
        valor_atual_rf: valAtual,
        data_aplicacao: dataAplicacaoFinal,
        movimentos: movimentosParaSalvar,
      };

      onAddAndCalculate(newAsset);

      // Limpa o formulário
      setNomeAtivo("");
      setValorAplicado("");
      setValorAtual("");
      setTaxaContratada("");
      setDataVencimento("");
      setDataAplicacao("");
      setMultiAporteRf(false);
      setMovimentosRf([]);
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
          <div className="flex items-center space-x-2 pb-2">
            <Switch id="international-mode" checked={isInternational} onCheckedChange={setIsInternational} />
            <Label htmlFor="international-mode" className="cursor-pointer">Ativo Internacional</Label>
          </div>
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
                  {BROKER_LIST.map((c) => (
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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="multiaportes-rf" checked={multiAporteRf} onCheckedChange={setMultiAporteRf} />
                <Label htmlFor="multiaportes-rf" className="cursor-pointer">Registrar múltiplos aportes</Label>
              </div>
              {multiAporteRf && (
                <Button type="button" size="sm" onClick={addMovimento} variant="secondary">Adicionar aporte</Button>
              )}
            </div>

            {multiAporteRf && (
              <div className="space-y-2">
                {movimentosRf.length === 0 && (
                  <p className="text-xs text-muted-foreground">Inclua aportes ou resgates; o valor aplicado será a soma.</p>
                )}
                {movimentosRf.map((m) => (
                  <div key={m.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <div className="space-y-1">
                      <Label>Data</Label>
                      <Input type="date" value={m.data} onChange={(e) => updateMovimento(m.id, "data", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Valor (R$)</Label>
                      <Input type="number" step="0.01" value={m.valor} onChange={(e) => updateMovimento(m.id, "valor", e.target.value)} />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" onClick={() => removeMovimento(m.id)} className="mt-2">Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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

            {!multiAporteRf && (
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
            )}

            <div className="space-y-2">
              <Label htmlFor="valorAtual">Valor Atual (R$)</Label>
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
              <Label htmlFor="dataAplicacao">Data de Aplicação</Label>
              <Input
                id="dataAplicacao"
                type="date"
                value={dataAplicacao}
                onChange={(e) => setDataAplicacao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="corretoraRF">Instituição *</Label>
              <Select value={corretora} onValueChange={(value) => setCorretora(value as Corretora)}>
                <SelectTrigger id="corretoraRF">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKER_LIST.map((c) => (
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
