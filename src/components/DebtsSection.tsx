import { useEffect, useMemo, useState } from "react";
import { DebtsState, FinancingDebt, CardSpendingEntry, OtherDebt } from "@/types/debt";
import { loadDebts, saveDebts } from "@/services/debtStorage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CreditCard, Home, ListChecks, Calendar as CalendarIcon, AlertCircle, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, ReferenceLine } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatCurrencyBR(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthsBetween(startISO: string, end: Date): number {
  const start = new Date(startISO);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function yearsDecimalFromMonths(m: number): number {
  return Math.round((m / 12) * 10) / 10;
}

interface DebtsSectionProps {
  data?: DebtsState;
  onChange?(state: DebtsState): void;
}

export function DebtsSection({ data, onChange }: DebtsSectionProps) {
  const { toast } = useToast();
  const [internalState, setInternalState] = useState<DebtsState>({ financings: [], cardSpending: [], others: [], monthlyTarget: undefined });

  const state = data || internalState;

  useEffect(() => {
    if (!data) {
      (async () => setInternalState(await loadDebts()))();
    }
  }, [data]);

  const save = async (next: DebtsState) => {
    if (!data) setInternalState(next);
    await saveDebts(next);
    try { onChange?.(next); } catch (e) { /* silencioso */ }
  };

  // Auto-atualização do financiamento no dia 10 de cada mês
  useEffect(() => {
    if (!state.financings || state.financings.length === 0) return;

    const processarPagamentoAutomatico = async () => {
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      const mesAnoAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

      // Só processa no dia 10 ou depois
      if (diaHoje < 10) return;

      let changed = false;
      const updatedFinancings = state.financings.map(fin => {
        const ultimoProcessamento = fin.ultimo_processamento_automatico;
        if (ultimoProcessamento === mesAnoAtual) return fin; // Já processou

        if (!fin.saldo_devedor_atual || !fin.meses_restantes || !fin.taxa_juros_nominal) return fin;

        const i_mensal = (Math.pow(1 + fin.taxa_juros_nominal / 100, 1 / 12) - 1);
        const juros_mes = fin.saldo_devedor_atual * i_mensal;

        let PMT: number;
        if (fin.parcela_atual && fin.parcela_atual > 0) {
          PMT = fin.parcela_atual;
        } else {
          PMT = fin.saldo_devedor_atual * i_mensal / (1 - Math.pow(1 + i_mensal, -fin.meses_restantes));
        }

        const amortizacao = PMT - juros_mes;
        const novoSaldo = fin.saldo_devedor_atual - amortizacao;

        changed = true;
        return {
          ...fin,
          saldo_devedor_atual: Math.max(0, novoSaldo),
          meses_restantes: Math.max(0, fin.meses_restantes - 1),
          ultimo_processamento_automatico: mesAnoAtual,
        };
      });

      if (changed) {
        await save({ ...state, financings: updatedFinancings });
      }
    };

    processarPagamentoAutomatico();
  }, [state.financings]);

  // Financiamento helpers
  const calculateFinancing = (fin: FinancingDebt) => {
    const P = fin.valor_financiado || 0;
    const n = fin.prazo_total_meses || 0;
    const i_a = fin.taxa_juros_nominal || 0;
    const saldoInformado = fin.saldo_devedor_atual;
    const mesesRestantesInformado = fin.meses_restantes;
    const parcelaInformada = fin.parcela_atual;

    if (P <= 0 || n <= 0) return null;

    const i_m = (i_a / 12) / 100;

    let PMT: number;
    if (parcelaInformada && parcelaInformada > 0) {
      PMT = parcelaInformada;
    } else {
      PMT = i_m > 0 ? (P * i_m) / (1 - Math.pow(1 + i_m, -n)) : P / n;
    }

    let saldo: number;
    let k: number;

    if (saldoInformado !== undefined && saldoInformado > 0) {
      saldo = saldoInformado;
      if (mesesRestantesInformado !== undefined) {
        k = n - mesesRestantesInformado;
      } else if (fin.data_inicio) {
        k = Math.min(n, monthsBetween(fin.data_inicio, new Date()));
      } else {
        k = 0;
      }
    } else {
      k = fin.data_inicio ? Math.min(n, monthsBetween(fin.data_inicio, new Date())) : 0;
      saldo = i_m > 0
        ? Math.max(0, P * Math.pow(1 + i_m, k) - PMT * ((Math.pow(1 + i_m, k) - 1) / i_m))
        : Math.max(0, P - PMT * k);
    }

    const remaining = mesesRestantesInformado !== undefined ? mesesRestantesInformado : Math.max(0, n - k);
    const totalJuros = Math.max(0, PMT * n - P);
    const quitacaoData = fin.data_inicio
      ? new Date(new Date(fin.data_inicio).setMonth(new Date(fin.data_inicio).getMonth() + n))
      : null;

    return { PMT, saldo, totalJuros, quitacaoData, remaining };
  };

  const calculateProgress = (fin: FinancingDebt) => {
    if (!fin.prazo_total_meses) return null;
    const total = fin.prazo_total_meses;

    let elapsed: number;
    let remaining: number;

    if (fin.meses_restantes !== undefined) {
      remaining = fin.meses_restantes;
      elapsed = total - remaining;
    } else if (fin.data_inicio) {
      elapsed = monthsBetween(fin.data_inicio, new Date());
      remaining = Math.max(0, total - elapsed);
    } else {
      elapsed = 0;
      remaining = total;
    }

    const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return { total, elapsed, remaining, percent, remainingYears: yearsDecimalFromMonths(remaining) };
  };

  // Credit card chart data
  const cardData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.cardSpending) map.set(e.month, (map.get(e.month) || 0) + e.amount);
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
    }
    const base = months.map(m => ({ month: m, valor: map.get(m) || 0 }));
    const mm3: number[] = [];
    const mm6: number[] = [];
    for (let i = 0; i < base.length; i++) {
      const slice3 = base.slice(Math.max(0, i - 2), i + 1);
      const slice6 = base.slice(Math.max(0, i - 5), i + 1);
      mm3.push(slice3.reduce((s, x) => s + x.valor, 0) / slice3.length);
      mm6.push(slice6.reduce((s, x) => s + x.valor, 0) / slice6.length);
    }
    return base.map((row, i) => ({ ...row, mm3: mm3[i], mm6: mm6[i] }));
  }, [state.cardSpending]);

  const cardMonthOverMonth = useMemo(() => {
    if (cardData.length < 2) return null;
    const last = cardData[cardData.length - 1].valor;
    const prev = cardData[cardData.length - 2].valor;
    const delta = last - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : 0;
    return { last, prev, delta, pct };
  }, [cardData]);

  const annotations = useMemo(() => {
    return state.others
      .filter(o => !o.tem_vencimento || !o.vencimento)
      .slice()
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }, [state.others]);

  // Handlers
  const addFinancing = async () => {
    const newFin: FinancingDebt = {
      prazo_total_meses: 360,
      data_inicio: new Date().toISOString().slice(0, 10),
      instituicao: "Novo Financiamento"
    };
    await save({ ...state, financings: [...(state.financings || []), newFin] });
  };

  const updateFinancing = async (index: number, patch: Partial<FinancingDebt>) => {
    const copy = [...(state.financings || [])];
    copy[index] = { ...copy[index], ...patch };
    await save({ ...state, financings: copy });
  };

  const removeFinancing = async (index: number) => {
    toast({
      title: "Confirmar exclusão",
      description: "Deseja excluir este financiamento?",
      action: (
        <ToastAction altText="Excluir" onClick={async () => {
          const copy = [...(state.financings || [])];
          copy.splice(index, 1);
          await save({ ...state, financings: copy });
        }}>
          Excluir
        </ToastAction>
      ),
    });
  };

  const addCardSpending = async (entry: CardSpendingEntry) => {
    const next: DebtsState = { ...state, cardSpending: [...state.cardSpending, entry] };
    await save(next);
  };

  const removeCardSpending = async (idx: number) => {
    const copy = [...state.cardSpending];
    copy.splice(idx, 1);
    await save({ ...state, cardSpending: copy });
  };

  const updateCardSpending = async (idx: number, patch: Partial<CardSpendingEntry>) => {
    const copy = [...state.cardSpending];
    copy[idx] = { ...copy[idx], ...patch };
    await save({ ...state, cardSpending: copy });
  };

  const addOther = async (d: OtherDebt) => {
    await save({ ...state, others: [...state.others, d] });
  };

  const removeOther = async (id: string) => {
    toast({
      title: "Confirmar exclusão",
      description: "Deseja excluir esta anotação?",
      action: (
        <ToastAction altText="Excluir" onClick={async () => {
          await save({ ...state, others: state.others.filter(o => o.id !== id) });
          if (editingNoteId === id) {
            cancelEditOther();
          }
        }}>
          Excluir
        </ToastAction>
      ),
    });
  };

  const updateOther = async (id: string, d: Partial<OtherDebt>) => {
    const copy = [...state.others];
    const idx = copy.findIndex(o => o.id === id);
    if (idx >= 0) {
      copy[idx] = { ...copy[idx], ...d };
      await save({ ...state, others: copy });
    }
  };

  const handleEditOther = (note: OtherDebt) => {
    setEditingNoteId(note.id);
    setOtherDesc(note.descricao);
    setOtherValue(note.valor.toString());
    setOtherDue(note.vencimento || "");
    setOtherHasDue(!!note.tem_vencimento);
  };

  const cancelEditOther = () => {
    setEditingNoteId(null);
    setOtherDesc("");
    setOtherValue("");
    setOtherDue("");
    setOtherHasDue(false);
  };

  // Local form states
  const [cardMonth, setCardMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const selectedYear = cardMonth.split('-')[0];
  const selectedMonth = cardMonth.split('-')[1];

  const updateCardMonth = (type: 'year' | 'month', val: string) => {
    if (type === 'year') {
      setCardMonth(`${val}-${selectedMonth}`);
    } else {
      setCardMonth(`${selectedYear}-${val}`);
    }
  };

  const [cardAmount, setCardAmount] = useState<string>("");
  const [cardTarget, setCardTarget] = useState<string>("");

  useEffect(() => {
    if (typeof state.monthlyTarget === 'number') setCardTarget(String(state.monthlyTarget));
  }, [state.monthlyTarget]);

  const [otherDesc, setOtherDesc] = useState<string>("");
  const [otherValue, setOtherValue] = useState<string>("");
  const [otherDue, setOtherDue] = useState<string>("");
  const [otherHasDue, setOtherHasDue] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Expand state for financings
  const [expandedFinancing, setExpandedFinancing] = useState<number | null>(0);

  // Pagination state for credit card
  const [cardPage, setCardPage] = useState(1);

  return (
    <div className="bg-card p-6 rounded-xl border border-border mt-8 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-2xl font-bold text-foreground">Minhas Dívidas</h2>
      </div>

      <Tabs defaultValue="financiamento">
        <TabsList className="grid grid-cols-3 w-full md:w-auto mb-6">
          <TabsTrigger value="financiamento" className="flex items-center gap-2"><Home className="h-4 w-4" /> Financiamento</TabsTrigger>
          <TabsTrigger value="cartao" className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Cartão de Crédito</TabsTrigger>
          <TabsTrigger value="anotacoes" className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="financiamento" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={addFinancing} size="sm" variant="outline"><Plus className="h-4 w-4 mr-2" />Adicionar Financiamento</Button>
          </div>

          {(state.financings || []).length === 0 && (
            <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
              Nenhum financiamento cadastrado. Clique em "Adicionar Financiamento".
            </div>
          )}

          {(state.financings || []).map((fin, idx) => {
            const calc = calculateFinancing(fin);
            const progress = calculateProgress(fin);
            const isExpanded = expandedFinancing === idx;

            return (
              <Card key={idx} className="border border-border">
                <CardHeader className="p-4 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedFinancing(isExpanded ? null : idx)}>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Home className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{fin.instituicao || `Financiamento ${idx + 1}`}</CardTitle>
                      <p className="text-sm text-muted-foreground">{fin.numero_contrato || "Sem número"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="p-6 pt-0 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="space-y-2">
                        <Label>Instituição</Label>
                        <Input value={fin.instituicao || ""} onChange={(e) => updateFinancing(idx, { instituicao: e.target.value })} placeholder="Ex: Caixa" />
                      </div>
                      <div className="space-y-2">
                        <Label>Contrato</Label>
                        <Input value={fin.numero_contrato || ""} onChange={(e) => updateFinancing(idx, { numero_contrato: e.target.value })} placeholder="Ex: 878..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Saldo Devedor (R$)</Label>
                        <Input type="number" step="0.01" value={fin.saldo_devedor_atual || ""} onChange={(e) => updateFinancing(idx, { saldo_devedor_atual: parseFloat(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Meses Restantes</Label>
                        <Input type="number" value={fin.meses_restantes || ""} onChange={(e) => updateFinancing(idx, { meses_restantes: parseInt(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Parcela Atual (R$)</Label>
                        <Input type="number" step="0.01" value={fin.parcela_atual || ""} onChange={(e) => updateFinancing(idx, { parcela_atual: parseFloat(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Financiado (R$)</Label>
                        <Input type="number" step="0.01" value={fin.valor_financiado || ""} onChange={(e) => updateFinancing(idx, { valor_financiado: parseFloat(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Prazo (anos)</Label>
                        <Input type="number" step="0.5" value={fin.prazo_total_meses ? fin.prazo_total_meses / 12 : ""} onChange={(e) => updateFinancing(idx, { prazo_total_meses: Math.round(parseFloat(e.target.value) * 12) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Juros (% a.a.)</Label>
                        <Input type="number" step="0.01" value={fin.taxa_juros_nominal || ""} onChange={(e) => updateFinancing(idx, { taxa_juros_nominal: parseFloat(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Início</Label>
                        <Input type="date" value={fin.data_inicio || ""} onChange={(e) => updateFinancing(idx, { data_inicio: e.target.value })} />
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); removeFinancing(idx); }}>Excluir Financiamento</Button>
                    </div>

                    {progress && (
                      <div className="mt-6 space-y-4 bg-muted/20 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Progresso</p>
                          <p className="text-sm font-bold">{Math.round(progress.percent)}%</p>
                        </div>
                        <Progress value={progress.percent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{progress.remainingYears} anos restantes</span>
                          <span>{progress.remaining} meses</span>
                        </div>
                      </div>
                    )}

                    {calc && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">Parcela Mensal</span>
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrencyBR(calc.PMT)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">Saldo Devedor</span>
                            <span className="font-semibold">{formatCurrencyBR(calc.saldo)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">Juros Totais</span>
                            <span className="font-semibold">{formatCurrencyBR(calc.totalJuros)}</span>
                          </div>
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie dataKey="value" data={[
                                { name: 'Principal', value: (fin.valor_financiado || 0) },
                                { name: 'Juros', value: Math.max(0, calc.totalJuros) },
                              ]} innerRadius={40} outerRadius={70} paddingAngle={2}>
                                <Cell fill="#22c55e" />
                                <Cell fill="#ef4444" />
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="cartao" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={(v) => updateCardMonth('month', v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">Janeiro</SelectItem>
                    <SelectItem value="02">Fevereiro</SelectItem>
                    <SelectItem value="03">Março</SelectItem>
                    <SelectItem value="04">Abril</SelectItem>
                    <SelectItem value="05">Maio</SelectItem>
                    <SelectItem value="06">Junho</SelectItem>
                    <SelectItem value="07">Julho</SelectItem>
                    <SelectItem value="08">Agosto</SelectItem>
                    <SelectItem value="09">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={(v) => updateCardMonth('year', v)}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardAmount">Gasto (R$)</Label>
              <Input id="cardAmount" type="number" step="0.01" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} placeholder="Ex: 2500" className="h-10" />
            </div>
            <Button onClick={() => {
              const amt = parseFloat(cardAmount || '0');
              if (!amt || amt <= 0) return;
              addCardSpending({ month: cardMonth, amount: amt });
              setCardAmount("");
            }} className="h-10 md:self-end"><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-2">
              <Label htmlFor="cardTarget">Meta Mensal (R$)</Label>
              <div className="flex gap-2">
                <Input id="cardTarget" type="number" step="0.01" value={cardTarget} onChange={(e) => setCardTarget(e.target.value)} placeholder="Ex: 2000" className="h-10 flex-1" />
                <Button className="h-10" variant="outline" onClick={() => save({ ...state, monthlyTarget: cardTarget ? parseFloat(cardTarget) : undefined })}>Salvar Meta</Button>
              </div>
            </div>
            {cardMonthOverMonth && (
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">M/M Atual vs Anterior</p>
                <p className={`text-lg font-bold ${cardMonthOverMonth.delta >= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{cardMonthOverMonth.delta >= 0 ? '+' : ''}{formatCurrencyBR(cardMonthOverMonth.delta)} ({cardMonthOverMonth.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</p>
              </div>
            )}
            {typeof state.monthlyTarget === 'number' && (
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Meta Mensal Salva</p>
                <p className="text-lg font-bold">{formatCurrencyBR(state.monthlyTarget)}</p>
              </div>
            )}
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cardData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} labelFormatter={(l) => `Mês: ${l}`} />
                {typeof state.monthlyTarget === 'number' && (
                  <ReferenceLine y={state.monthlyTarget} stroke="#ef4444" strokeDasharray="4 4" label="Meta" />
                )}
                <Line type="monotone" dataKey="valor" stroke="#7c3aed" strokeWidth={2} dot={false} name="Gasto" />
                <Line type="monotone" dataKey="mm3" stroke="#22c55e" strokeWidth={2} dot={false} name="MM 3m" />
                <Line type="monotone" dataKey="mm6" stroke="#f59e0b" strokeWidth={2} dot={false} name="MM 6m" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {state.cardSpending.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Lançamentos</h4>
              <div className="space-y-2">
                {(() => {
                  // Paginação com Ordenação por Data (Mais recente primeiro)
                  // Mapeia para preservar o índice original para edição/remoção
                  const indexedList = state.cardSpending.map((item, index) => ({ ...item, originalIndex: index }));

                  // Ordena: Mês mais recente no topo (descendente)
                  const sortedList = indexedList.sort((a, b) => b.month.localeCompare(a.month));

                  const itemsPerPage = 12;
                  const totalPages = Math.ceil(sortedList.length / itemsPerPage);
                  // Garante que a página atual é válida
                  const safePage = Math.min(Math.max(1, cardPage), Math.max(1, totalPages));
                  if (safePage !== cardPage && totalPages > 0) setCardPage(safePage);

                  const start = (safePage - 1) * itemsPerPage;
                  const end = start + itemsPerPage;
                  const currentItems = sortedList.slice(start, end);

                  return (
                    <>
                      {currentItems.map((e) => {
                        const realIndex = e.originalIndex;

                        return (
                          <div key={`${e.month}-${realIndex}`} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/30 transition-colors">
                            <span className="text-sm">{e.month} — <strong>{formatCurrencyBR(e.amount)}</strong></span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newVal = prompt(`Editar valor para ${e.month}:`, e.amount.toString());
                                  if (newVal) {
                                    const parsed = parseFloat(newVal.replace(/[^\d,.-]/g, '').replace(',', '.'));
                                    if (!isNaN(parsed) && parsed > 0) {
                                      updateCardSpending(realIndex, { amount: parsed });
                                    }
                                  }
                                }}
                                title="Editar valor"
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCardSpending(realIndex)}
                                title="Excluir lançamento"
                              >
                                <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Controles de Paginação */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-2 border-t border-border">
                          <div>
                            Página {safePage} de {totalPages}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={safePage <= 1}
                              onClick={() => setCardPage(p => Math.max(1, p - 1))}
                            >
                              Anterior
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={safePage >= totalPages}
                              onClick={() => setCardPage(p => Math.min(totalPages, p + 1))}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="anotacoes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="otherDesc">Descrição</Label>
              <Input id="otherDesc" value={otherDesc} onChange={(e) => setOtherDesc(e.target.value)} placeholder="Ex: MEI, pagar fulano, contas..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherValue">Valor (R$)</Label>
              <Input id="otherValue" type="number" step="0.01" value={otherValue} onChange={(e) => setOtherValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherDue">Vencimento</Label>
              <Input id="otherDue" type="date" value={otherDue} onChange={(e) => setOtherDue(e.target.value)} disabled={!otherHasDue} />
            </div>
            <div className="flex gap-2 md:col-span-4">
              <Button onClick={() => {
                const val = parseFloat(otherValue || '0');
                if (!otherDesc || !val || val <= 0) return;

                if (editingNoteId) {
                  updateOther(editingNoteId, {
                    descricao: otherDesc,
                    valor: val,
                    vencimento: otherHasDue ? otherDue || undefined : undefined,
                    tem_vencimento: otherHasDue
                  });
                  cancelEditOther();
                  toast({ title: "Anotação atualizada", description: "As alterações foram salvas com sucesso." });
                } else {
                  addOther({ id: Date.now().toString(), descricao: otherDesc, valor: val, vencimento: otherHasDue ? otherDue || undefined : undefined, tem_vencimento: otherHasDue });
                  setOtherDesc(""); setOtherValue(""); setOtherDue(""); setOtherHasDue(false);
                }
              }} className="h-10 flex-1">
                {editingNoteId ? <><Pencil className="h-4 w-4 mr-2" /> Salvar Alterações</> : <><Plus className="h-4 w-4 mr-2" /> Adicionar</>}
              </Button>
              {editingNoteId && (
                <Button variant="outline" onClick={cancelEditOther} className="h-10">
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="hasDue" checked={otherHasDue} onCheckedChange={(c) => setOtherHasDue(c === true)} />
            <Label htmlFor="hasDue" className="font-normal cursor-pointer">Este é um lembrete com vencimento (irá para a aba "Lembretes")</Label>
          </div>

          {annotations.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold mb-2">Anotações</h4>
              <div className="space-y-2">
                {annotations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="text-sm font-medium">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrencyBR(d.valor)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditOther(d)} title="Editar">
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeOther(d.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              Nenhuma anotação adicionada. Desmarque "Este é um lembrete..." e adicione uma.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
