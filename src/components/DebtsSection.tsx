import { useEffect, useMemo, useState } from "react";
import { DebtsState, FinancingDebt, CardSpendingEntry, OtherDebt } from "@/types/debt";
import { loadDebts, saveDebts } from "@/services/debtStorage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CreditCard, Home, ListChecks, Calendar as CalendarIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, XAxis, Tooltip, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, ReferenceLine } from "recharts";

function formatCurrencyBR(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthsBetween(startISO: string, end: Date): number {
  const start = new Date(startISO);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  // Ajuste de dia do mês
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function yearsDecimalFromMonths(m: number): number {
  return Math.round((m / 12) * 10) / 10; // 1 casa decimal
}

interface DebtsSectionProps { onChange?(state: DebtsState): void }

export function DebtsSection({ onChange }: DebtsSectionProps) {
  const [state, setState] = useState<DebtsState>({ financing: undefined, cardSpending: [], others: [], monthlyTarget: undefined });

  useEffect(() => {
    (async () => setState(await loadDebts()))();
  }, []);

  const save = async (next: DebtsState) => {
    setState(next);
    await saveDebts(next);
    try { onChange?.(next); } catch (e) { /* silencioso */ }
  };

  // Auto-atualização do financiamento no dia 10 de cada mês
  useEffect(() => {
    if (!state.financing) return;
    
    const processarPagamentoAutomatico = async () => {
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      const mesAnoAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      
      // Verifica se já processou este mês
      const ultimoProcessamento = state.financing?.ultimo_processamento_automatico;
      if (ultimoProcessamento === mesAnoAtual) {
        return; // Já processou este mês
      }
      
      // Só processa no dia 10 ou depois
      if (diaHoje < 10) return;
      
      const fin = state.financing;
      if (!fin.saldo_devedor_atual || !fin.meses_restantes || !fin.taxa_juros_nominal) return;
      
        // Calcula juros do mês sobre o saldo atual
        const i_mensal = (Math.pow(1 + fin.taxa_juros_nominal / 100, 1 / 12) - 1);
        const juros_mes = fin.saldo_devedor_atual * i_mensal;
      
        // Usa parcela informada ou calcula via Price
        let PMT: number;
        if (fin.parcela_atual && fin.parcela_atual > 0) {
          PMT = fin.parcela_atual; // Usa a parcela REAL do extrato
        } else {
          PMT = fin.saldo_devedor_atual * i_mensal / (1 - Math.pow(1 + i_mensal, -fin.meses_restantes));
        }
      
        // Amortização = Parcela - Juros
        const amortizacao = PMT - juros_mes;
      
      // Novo saldo = Saldo Anterior + Juros - Amortização
      // Ou simplificando: Saldo Anterior - (PMT - Juros)
      const novoSaldo = fin.saldo_devedor_atual - amortizacao;
      
      console.log('🏦 PROCESSAMENTO AUTOMÁTICO DO FINANCIAMENTO:');
      console.log(`Data: ${hoje.toLocaleDateString('pt-BR')}`);
      console.log(`Saldo Anterior: R$ ${fin.saldo_devedor_atual.toFixed(2)}`);
      console.log(`Juros do Mês: R$ ${juros_mes.toFixed(2)}`);
      console.log(`Parcela (PMT): R$ ${PMT.toFixed(2)}`);
      console.log(`Amortização: R$ ${amortizacao.toFixed(2)}`);
      console.log(`Novo Saldo: R$ ${novoSaldo.toFixed(2)}`);
      console.log(`Meses Restantes: ${fin.meses_restantes - 1}`);
      
      // Atualiza o financiamento
      const finAtualizado: FinancingDebt = {
        ...fin,
        saldo_devedor_atual: Math.max(0, novoSaldo),
        meses_restantes: Math.max(0, fin.meses_restantes - 1),
        ultimo_processamento_automatico: mesAnoAtual,
      };
      
      await save({ ...state, financing: finAtualizado });
    };
    
    processarPagamentoAutomatico();
  }, [state.financing?.saldo_devedor_atual, state.financing?.meses_restantes]); // Reexecuta quando os dados mudarem

  // Financiamento helpers
  const financiamento = state.financing;
  
  // Usa saldo devedor atual se informado, senão calcula via Price
  const financiamentoCalc = useMemo(() => {
    if (!financiamento) return null;
    
    const P = financiamento.valor_financiado || 0;
    const n = financiamento.prazo_total_meses || 0;
    const i_a = financiamento.taxa_juros_nominal || 0; // % a.a.
    const saldoInformado = financiamento.saldo_devedor_atual;
    const mesesRestantesInformado = financiamento.meses_restantes;
    const parcelaInformada = financiamento.parcela_atual; // Parcela real do extrato
    
    if (P <= 0 || n <= 0) return null;
    
    const i_m = (i_a / 12) / 100;
    
    // Se tem parcela informada, usa ela; senão calcula via Price
    let PMT: number;
    if (parcelaInformada && parcelaInformada > 0) {
      PMT = parcelaInformada; // Usa a parcela REAL do extrato
    } else {
      PMT = i_m > 0 ? (P * i_m) / (1 - Math.pow(1 + i_m, -n)) : P / n;
    }
    
    // Se temos saldo informado, usa ele; senão calcula
    let saldo: number;
    let k: number; // meses decorridos
    
    if (saldoInformado !== undefined && saldoInformado > 0) {
      saldo = saldoInformado;
      // Retroage k a partir do saldo: saldo = P*(1+i)^k - PMT*((1+i)^k - 1)/i
      // Simplificando: usa meses_restantes se informado, senão calcula desde data_inicio
      if (mesesRestantesInformado !== undefined) {
        k = n - mesesRestantesInformado;
      } else if (financiamento.data_inicio) {
        k = Math.min(n, monthsBetween(financiamento.data_inicio, new Date()));
      } else {
        k = 0;
      }
    } else {
      // Calcula via Price clássico
      k = financiamento.data_inicio ? Math.min(n, monthsBetween(financiamento.data_inicio, new Date())) : 0;
      saldo = i_m > 0
        ? Math.max(0, P * Math.pow(1 + i_m, k) - PMT * ((Math.pow(1 + i_m, k) - 1) / i_m))
        : Math.max(0, P - PMT * k);
    }
    
    const remaining = mesesRestantesInformado !== undefined ? mesesRestantesInformado : Math.max(0, n - k);
    const totalPago = PMT * k;
    const principalPago = Math.max(0, P - saldo);
    const jurosPagos = Math.max(0, totalPago - principalPago);
    const totalJuros = Math.max(0, PMT * n - P);
    const quitacaoData = financiamento.data_inicio 
      ? new Date(new Date(financiamento.data_inicio).setMonth(new Date(financiamento.data_inicio).getMonth() + n)) 
      : null;
    
      // Não usa mais seguros separado - a parcela informada já inclui tudo
      const PMT_total = PMT;
      const seguros = 0; // Mantém para compatibilidade
    
      return { PMT, PMT_total, seguros, saldo, jurosPagos, principalPago, totalJuros, quitacaoData, n, k, remaining };
  }, [financiamento]);
  
  const financiamentoProgress = useMemo(() => {
    if (!financiamento?.prazo_total_meses) return null;
    const total = financiamento.prazo_total_meses;
    
    let elapsed: number;
    let remaining: number;
    
    if (financiamento.meses_restantes !== undefined) {
      remaining = financiamento.meses_restantes;
      elapsed = total - remaining;
    } else if (financiamento.data_inicio) {
      elapsed = monthsBetween(financiamento.data_inicio, new Date());
      remaining = Math.max(0, total - elapsed);
    } else {
      elapsed = 0;
      remaining = total;
    }
    
    const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return { total, elapsed, remaining, percent, remainingYears: yearsDecimalFromMonths(remaining) };
  }, [financiamento]);

  // Credit card chart data (last 12 months)
  const cardData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.cardSpending) map.set(e.month, (map.get(e.month) || 0) + e.amount);
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push(key);
    }
    const base = months.map(m => ({ month: m, valor: map.get(m) || 0 }));
    // médias móveis 3/6
    const mm3: number[] = [];
    const mm6: number[] = [];
    for (let i = 0; i < base.length; i++) {
      const slice3 = base.slice(Math.max(0, i-2), i+1);
      const slice6 = base.slice(Math.max(0, i-5), i+1);
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

  // Handlers
  const updateFinancing = async (patch: Partial<FinancingDebt>) => {
    const next: DebtsState = { ...state, financing: { ...(state.financing || { prazo_total_meses: 360, data_inicio: new Date().toISOString().slice(0,10) }), ...patch } };
    await save(next);
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

  const addOther = async (d: OtherDebt) => {
    await save({ ...state, others: [...state.others, d] });
  };

  const removeOther = async (id: string) => {
    await save({ ...state, others: state.others.filter(o => o.id !== id) });
  };

  // Local form states
  const [finContrato, setFinContrato] = useState<string>("");
  const [finInst, setFinInst] = useState<string>("");
  const [finValor, setFinValor] = useState<string>("");
  const [finSaldoAtual, setFinSaldoAtual] = useState<string>("");
    const [finParcelaAtual, setFinParcelaAtual] = useState<string>("");
  const [finTaxa, setFinTaxa] = useState<string>("");
  const [finPrazoAnos, setFinPrazoAnos] = useState<string>("");
  const [finMesesRestantes, setFinMesesRestantes] = useState<string>("");
  const [finSeguros, setFinSeguros] = useState<string>("");
  const [finInicio, setFinInicio] = useState<string>("");

  useEffect(() => {
    if (financiamento) {
      setFinContrato(financiamento.numero_contrato || "");
      setFinInst(financiamento.instituicao || "");
      setFinValor(financiamento.valor_financiado?.toString() || "");
      setFinSaldoAtual(financiamento.saldo_devedor_atual?.toString() || "");
        setFinParcelaAtual(financiamento.parcela_atual?.toString() || "");
      setFinTaxa(financiamento.taxa_juros_nominal?.toString() || "");
      setFinPrazoAnos(financiamento.prazo_total_meses ? (financiamento.prazo_total_meses/12).toString() : "");
      setFinMesesRestantes(financiamento.meses_restantes?.toString() || "");
      setFinSeguros(financiamento.seguros_taxas_mensais?.toString() || "");
      setFinInicio(financiamento.data_inicio || "");
    }
  }, [financiamento]);

  const [cardMonth, setCardMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [cardAmount, setCardAmount] = useState<string>("");
  const [cardTarget, setCardTarget] = useState<string>("");

  useEffect(() => {
    if (typeof state.monthlyTarget === 'number') setCardTarget(String(state.monthlyTarget));
  }, [state.monthlyTarget]);

  const [otherDesc, setOtherDesc] = useState<string>("");
  const [otherValue, setOtherValue] = useState<string>("");
  const [otherDue, setOtherDue] = useState<string>("");

  return (
    <div className="bg-card p-6 rounded-xl border border-border mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-bold text-foreground">Minhas Dívidas</h2>
      </div>

      <Tabs defaultValue="financiamento">
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="financiamento" className="flex items-center gap-2"><Home className="h-4 w-4"/> Financiamento</TabsTrigger>
          <TabsTrigger value="cartao" className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> Cartão de Crédito</TabsTrigger>
          <TabsTrigger value="outros" className="flex items-center gap-2"><ListChecks className="h-4 w-4"/> Outros</TabsTrigger>
        </TabsList>

        <TabsContent value="financiamento" className="mt-6">
          <div className="space-y-6">
            {/* Dados do app da Caixa */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Dados do App (Caixa)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="finContrato">Número do Contrato</Label>
                  <Input id="finContrato" value={finContrato} onChange={(e)=>setFinContrato(e.target.value)} placeholder="Ex: 878777347..."/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finInst">Instituição</Label>
                  <Input id="finInst" value={finInst} onChange={(e)=>setFinInst(e.target.value)} placeholder="Ex: Caixa"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finSaldoAtual">Saldo Devedor Atual (R$) *</Label>
                  <Input id="finSaldoAtual" type="number" step="0.01" value={finSaldoAtual} onChange={(e)=>setFinSaldoAtual(e.target.value)} placeholder="Ex: 91009.17"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finMesesRestantes">Meses Restantes *</Label>
                  <Input id="finMesesRestantes" type="number" step="1" value={finMesesRestantes} onChange={(e)=>setFinMesesRestantes(e.target.value)} placeholder="Ex: 189"/>
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="finParcelaAtual">Parcela Atual (R$) *</Label>
                    <Input id="finParcelaAtual" type="number" step="0.01" value={finParcelaAtual} onChange={(e)=>setFinParcelaAtual(e.target.value)} placeholder="Ex: 776.42"/>
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="finValor">Valor Financiado (R$) *</Label>
                  <Input id="finValor" type="number" step="0.01" value={finValor} onChange={(e)=>setFinValor(e.target.value)} placeholder="Ex: 350000"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finPrazo">Prazo do Contrato (anos) *</Label>
                  <Input id="finPrazo" type="number" step="0.5" value={finPrazoAnos} onChange={(e)=>setFinPrazoAnos(e.target.value)} placeholder="Ex: 30"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finTaxa">Juros Nominal Vigente (% a.a.) *</Label>
                  <Input id="finTaxa" type="number" step="0.01" value={finTaxa} onChange={(e)=>setFinTaxa(e.target.value)} placeholder="Ex: 6.0"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finSeguros">Seguros + Taxas (R$/mês)</Label>
                  <Input id="finSeguros" type="number" step="0.01" value={finSeguros} onChange={(e)=>setFinSeguros(e.target.value)} placeholder="Ex: 38.68" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finInicio">Data de Início do Contrato</Label>
                  <Input id="finInicio" type="date" value={finInicio} onChange={(e)=>setFinInicio(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => updateFinancing({
                numero_contrato: finContrato || undefined,
                instituicao: finInst || undefined,
                valor_financiado: finValor ? parseFloat(finValor) : undefined,
                saldo_devedor_atual: finSaldoAtual ? parseFloat(finSaldoAtual) : undefined,
                  parcela_atual: finParcelaAtual ? parseFloat(finParcelaAtual) : undefined,
                taxa_juros_nominal: finTaxa ? parseFloat(finTaxa) : undefined,
                prazo_total_meses: finPrazoAnos ? Math.round(parseFloat(finPrazoAnos) * 12) : 0,
                meses_restantes: finMesesRestantes ? parseInt(finMesesRestantes) : undefined,
                seguros_taxas_mensais: finSeguros ? parseFloat(finSeguros) : undefined,
                data_inicio: finInicio || new Date().toISOString().slice(0,10),
              })}>Salvar Financiamento</Button>
            </div>
          </div>

          {financiamentoProgress && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Progresso do Prazo</p>
                <p className="text-sm font-medium">{Math.round(financiamentoProgress.percent)}%</p>
              </div>
              <Progress value={financiamentoProgress.percent} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/20 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tempo restante</p>
                  <p className="text-lg font-bold">{financiamentoProgress.remainingYears.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} anos</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Meses restantes</p>
                  <p className="text-lg font-bold">{financiamentoProgress.remaining}</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="text-lg font-bold flex items-center gap-1"><CalendarIcon className="h-4 w-4"/>{new Date(financiamento!.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {financiamentoCalc && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div className="bg-muted/20 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Parcela Mensal</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrencyBR(financiamentoCalc.PMT)}</p>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo devedor</p>
                        <p className="text-lg font-semibold">{formatCurrencyBR(financiamentoCalc.saldo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Juros totais</p>
                        <p className="text-lg font-semibold">{formatCurrencyBR(financiamentoCalc.totalJuros)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Quitação estimada</p>
                        <p className="text-lg font-semibold">{financiamentoCalc.quitacaoData ? new Date(financiamentoCalc.quitacaoData).toLocaleDateString('pt-BR') : '-'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie dataKey="value" data={[
                          { name: 'Principal', value: (financiamento?.valor_financiado || 0) },
                          { name: 'Juros', value: Math.max(0, financiamentoCalc.totalJuros) },
                        ]} innerRadius={50} outerRadius={80} paddingAngle={2}>
                          <Cell fill="#22c55e" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip formatter={(v:number)=>formatCurrencyBR(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cartao" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="cardMonth">Mês</Label>
              <Input id="cardMonth" type="month" value={cardMonth} onChange={(e)=>setCardMonth(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardAmount">Gasto (R$)</Label>
              <Input id="cardAmount" type="number" step="0.01" value={cardAmount} onChange={(e)=>setCardAmount(e.target.value)} placeholder="Ex: 2500" className="h-10" />
            </div>
            <Button onClick={() => {
              const amt = parseFloat(cardAmount || '0');
              if (!amt || amt <= 0) return;
              addCardSpending({ month: cardMonth, amount: amt });
              setCardAmount("");
            }} className="h-10 md:self-end"><Plus className="h-4 w-4 mr-2"/>Adicionar</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start mt-6">
            <div className="space-y-2">
              <Label htmlFor="cardTarget">Meta Mensal (R$)</Label>
              <div className="flex gap-2">
                <Input id="cardTarget" type="number" step="0.01" value={cardTarget} onChange={(e)=>setCardTarget(e.target.value)} placeholder="Ex: 2000" className="h-10 flex-1" />
                <Button className="h-10" variant="outline" onClick={() => save({ ...state, monthlyTarget: cardTarget ? parseFloat(cardTarget) : undefined })}>Salvar Meta</Button>
              </div>
            </div>
            {cardMonthOverMonth && (
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">M/M Atual vs Anterior</p>
                <p className={`text-lg font-bold ${cardMonthOverMonth.delta >=0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{cardMonthOverMonth.delta >= 0 ? '+' : ''}{formatCurrencyBR(cardMonthOverMonth.delta)} ({cardMonthOverMonth.pct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%)</p>
              </div>
            )}
            {typeof state.monthlyTarget === 'number' && (
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Meta Mensal Salva</p>
                <p className="text-lg font-bold">{formatCurrencyBR(state.monthlyTarget)}</p>
              </div>
            )}
          </div>

          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cardData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v:number)=>formatCurrencyBR(v)} labelFormatter={(l)=>`Mês: ${l}`} />
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
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Lançamentos</h4>
              <div className="space-y-2">
                {state.cardSpending.slice().reverse().map((e, idx) => (
                  <div key={`${e.month}-${idx}`} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="text-sm">{e.month} — <strong>{formatCurrencyBR(e.amount)}</strong></span>
                    <Button variant="ghost" size="icon" onClick={() => removeCardSpending(state.cardSpending.length - 1 - idx)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="outros" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="otherDesc">Descrição</Label>
              <Input id="otherDesc" value={otherDesc} onChange={(e)=>setOtherDesc(e.target.value)} placeholder="Ex: MEI, pagar fulano, contas..."/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherValue">Valor (R$)</Label>
              <Input id="otherValue" type="number" step="0.01" value={otherValue} onChange={(e)=>setOtherValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherDue">Vencimento</Label>
              <Input id="otherDue" type="date" value={otherDue} onChange={(e)=>setOtherDue(e.target.value)} />
            </div>
            <Button onClick={() => {
              const val = parseFloat(otherValue || '0');
              if (!otherDesc || !val || val <= 0) return;
              addOther({ id: Date.now().toString(), descricao: otherDesc, valor: val, vencimento: otherDue || undefined });
              setOtherDesc(""); setOtherValue(""); setOtherDue("");
            }} className="h-10 md:col-span-4"><Plus className="h-4 w-4 mr-2"/>Adicionar</Button>
          </div>

          {state.others.length > 0 && (
            <div className="mt-4">
              <div className="space-y-2">
                {state.others.slice().reverse().map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="text-sm font-medium">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">{formatCurrencyBR(d.valor)} {d.vencimento ? `• vence em ${new Date(d.vencimento).toLocaleDateString('pt-BR')}` : ''}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeOther(d.id)} title="Excluir"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
