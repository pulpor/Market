import { useEffect, useMemo, useState } from "react";
import { FreelanceEntry, DividendForecast, ReceivableEntry, ExpenseEntry, ReturnsForecastState } from "@/types/returns";
import { loadReturns, saveReturns } from "@/services/returnsStorage";
import { loadAssets } from "@/services/fileStorage";
import { Asset } from "@/types/asset";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calculator, Coins, Wallet, Briefcase, TrendingUp, TrendingDown, DollarSign, Receipt, Edit2 } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatBR(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface Props {
  financingParcela?: number;
  cardMonthTotal?: number;
  othersTotal?: number;
  currentMonth?: string;
  month?: string;
  onMonthChange?(m: string): void;
}

export function ReturnsForecastSection(props: Props) {
  const monthInitial = props.month || props.currentMonth || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [month, setMonth] = useState<string>(monthInitial);
  const [state, setState] = useState<ReturnsForecastState>({ month: monthInitial, salary: undefined, freelas: [], dividends: [], receivables: [], expenses: [] });
  const [loaded, setLoaded] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  // local form states
  const [freelaDate, setFreelaDate] = useState<string>("");
  const [freelaClient, setFreelaClient] = useState<string>("");
  const [freelaDesc, setFreelaDesc] = useState<string>("");
  const [freelaTotal, setFreelaTotal] = useState<string>(""); // Simplified input

  const [divTicker, setDivTicker] = useState<string>("");
  const [divAmount, setDivAmount] = useState<string>("");

  const [recDesc, setRecDesc] = useState<string>("");
  const [recAmount, setRecAmount] = useState<string>("");
  const [editingRecId, setEditingRecId] = useState<string | null>(null);

  const [expDesc, setExpDesc] = useState<string>("");
  const [expAmount, setExpAmount] = useState<string>("");
  const [editingExpId, setEditingExpId] = useState<string | null>(null);

  const [salaryInput, setSalaryInput] = useState<string>("");

  useEffect(() => {
    (async () => {
      const loaded = await loadReturns(month);
      // Filter out auto-generated zero dividends if any exist from previous version
      const cleanedDividends = loaded.dividends.filter(d => !d.auto || d.amount > 0);
      // Ensure expenses array exists (migration)
      const loadedWithExpenses = { ...loaded, dividends: cleanedDividends, expenses: loaded.expenses || [] };
      setState(loadedWithExpenses);

      setSalaryInput(loaded.salary?.toString() || "");

      const loadedAssets = await loadAssets();
      setAssets(loadedAssets || []);

      setLoaded(true);
    })();
  }, [month]);

  useEffect(() => {
    if (props.month && props.month !== month) {
      setMonth(props.month);
    }
  }, [props.month]);

  const save = async (next: ReturnsForecastState) => { setState(next); await saveReturns(next); };

  const addFreela = async () => {
    const val = parseFloat(freelaTotal || '0');
    if (!val) return;
    const entry: FreelanceEntry = {
      id: Date.now().toString(),
      date: freelaDate || `${month}-01`,
      client: freelaClient || undefined,
      description: freelaDesc || undefined,
      hours: 0,
      hourlyRate: 0,
      extra: 0,
      total: val
    };
    await save({ ...state, freelas: [...state.freelas, entry] });
    setFreelaDate(''); setFreelaClient(''); setFreelaDesc(''); setFreelaTotal('');
  };

  const removeFreela = async (id: string) => { await save({ ...state, freelas: state.freelas.filter(f => f.id !== id) }); };

  const addDividend = async () => {
    const amt = parseFloat(divAmount || '0');
    if (!divTicker || !amt) return;
    const entry: DividendForecast = { id: Date.now().toString(), assetTicker: divTicker.toUpperCase(), amount: amt, auto: false };
    await save({ ...state, dividends: [...state.dividends, entry] });
    setDivTicker(''); setDivAmount('');
  };

  const removeDividend = async (id: string) => { await save({ ...state, dividends: state.dividends.filter(d => d.id !== id) }); };

  const addReceivable = async () => {
    const amt = parseFloat(recAmount || '0'); if (!recDesc || !amt) return;
    if (editingRecId) {
      // Editar existente
      const updated = state.receivables.map(r => r.id === editingRecId ? { ...r, description: recDesc, amount: amt } : r);
      await save({ ...state, receivables: updated });
      setEditingRecId(null);
    } else {
      // Criar novo
      const entry: ReceivableEntry = { id: Date.now().toString(), description: recDesc, amount: amt };
      await save({ ...state, receivables: [...state.receivables, entry] });
    }
    setRecDesc(''); setRecAmount('');
  };

  const removeReceivable = async (id: string) => { await save({ ...state, receivables: state.receivables.filter(r => r.id !== id) }); };
  
  const editReceivable = (rec: ReceivableEntry) => {
    setRecDesc(rec.description);
    setRecAmount(rec.amount.toString());
    setEditingRecId(rec.id);
  };
  
  const cancelEditReceivable = () => {
    setRecDesc('');
    setRecAmount('');
    setEditingRecId(null);
  };

  const addExpense = async () => {
    const amt = parseFloat(expAmount || '0'); if (!expDesc || !amt) return;
    if (editingExpId) {
      // Editar existente
      const updated = state.expenses.map(e => e.id === editingExpId ? { ...e, description: expDesc, amount: amt } : e);
      await save({ ...state, expenses: updated });
      setEditingExpId(null);
    } else {
      // Criar novo
      const entry: ExpenseEntry = { id: Date.now().toString(), description: expDesc, amount: amt };
      await save({ ...state, expenses: [...state.expenses, entry] });
    }
    setExpDesc(''); setExpAmount('');
  };

  const removeExpense = async (id: string) => { await save({ ...state, expenses: state.expenses.filter(e => e.id !== id) }); };

  const editExpense = (exp: ExpenseEntry) => {
    setExpDesc(exp.description);
    setExpAmount(exp.amount.toString());
    setEditingExpId(exp.id);
  };

  const cancelEditExpense = () => {
    setExpDesc('');
    setExpAmount('');
    setEditingExpId(null);
  };

  const updateSalary = async () => {
    const val = parseFloat(salaryInput || '0');
    await save({ ...state, salary: val > 0 ? val : undefined });
  };

  // Aggregations
  const freelasTotal = useMemo(() => state.freelas.reduce((s, f) => s + (f.total || 0), 0), [state.freelas]);
  const dividendsTotal = useMemo(() => state.dividends.reduce((s, d) => s + d.amount, 0), [state.dividends]);
  const receivablesTotal = useMemo(() => state.receivables.reduce((s, r) => s + r.amount, 0), [state.receivables]);
  const extraExpensesTotal = useMemo(() => state.expenses.reduce((s, e) => s + e.amount, 0), [state.expenses]);

  const incomeTotal = (state.salary || 0) + freelasTotal + dividendsTotal + receivablesTotal;
  const expensesTotal = (props.financingParcela || 0) + (props.cardMonthTotal || 0) + (props.othersTotal || 0) + extraExpensesTotal;
  const netTotal = incomeTotal - expensesTotal;

  if (!loaded) return <div className="mt-10 p-6 text-center text-muted-foreground">Carregando previsão...</div>;

  return (
    <div className="bg-card p-6 rounded-xl border border-border mt-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" /> Previsão de Retornos
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg">
            <Label className="whitespace-nowrap">Mês de Referência:</Label>
            <Input
              type="month"
              value={month}
              onChange={e => { const m = e.target.value; setMonth(m); props.onMonthChange?.(m); }}
              className="h-8 w-auto bg-background"
            />
          </div>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Receitas Previstas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatBR(incomeTotal)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Despesas Previstas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatBR(expensesTotal)}</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${netTotal >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Resultado Líquido
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-bold ${netTotal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatBR(netTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Income Sources */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="h-5 w-5 text-green-500" /> Fontes de Renda
          </h3>

          {/* Salary Section */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Salário Líquido</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={salaryInput}
                onChange={e => setSalaryInput(e.target.value)}
                className="h-10 font-medium"
                placeholder="0,00"
              />
              <Button onClick={updateSalary} variant="secondary">Salvar</Button>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {/* Dividends Section */}
            <AccordionItem value="dividends">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    <span>Dividendos</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{formatBR(dividendsTotal)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Ativo</Label>
                    <Select value={divTicker} onValueChange={setDivTicker}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map(a => (
                          <SelectItem key={a.id} value={a.ticker}>{a.ticker}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={divAmount} onChange={e => setDivAmount(e.target.value)} className="h-9" placeholder="0,00" />
                  </div>
                  <Button onClick={addDividend} size="sm" className="h-9"><Plus className="h-4 w-4" /></Button>
                </div>

                <ScrollArea className="h-60 pr-4">
                  <div className="space-y-1">
                    {state.dividends.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum dividendo lançado.</p>}
                    {state.dividends.slice().reverse().map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-muted/20 rounded text-sm">
                        <span>{d.assetTicker}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">{formatBR(d.amount)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDividend(d.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>

            {/* Freelas Section */}
            <AccordionItem value="freelas">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <span>Freelas & Extras</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{formatBR(freelasTotal)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Descrição / Cliente</Label>
                    <Input value={freelaDesc} onChange={e => setFreelaDesc(e.target.value)} className="h-9" placeholder="Ex: Projeto Web" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={freelaDate} onChange={e => setFreelaDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Total (R$)</Label>
                    <div className="flex gap-2">
                      <Input type="number" step="0.01" value={freelaTotal} onChange={e => setFreelaTotal(e.target.value)} className="h-9" placeholder="0,00" />
                      <Button onClick={addFreela} size="sm" className="h-9"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-60 pr-4">
                  <div className="space-y-1">
                    {state.freelas.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum freela lançado.</p>}
                    {state.freelas.slice().reverse().map(f => (
                      <div key={f.id} className="flex items-center justify-between p-2 bg-muted/20 rounded text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{f.description || 'Sem descrição'}</span>
                          <span className="text-xs text-muted-foreground">{f.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">{formatBR(f.total || 0)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFreela(f.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>

            {/* Receivables Section */}
            <AccordionItem value="receivables">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-purple-500" />
                    <span>Outros Recebimentos</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{formatBR(receivablesTotal)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={recDesc} onChange={e => setRecDesc(e.target.value)} className="h-9" placeholder="Ex: Reembolso" />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={recAmount} onChange={e => setRecAmount(e.target.value)} className="h-9" placeholder="0,00" />
                  </div>
                  {editingRecId ? (
                    <>
                      <Button onClick={addReceivable} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">Salvar</Button>
                      <Button onClick={cancelEditReceivable} size="sm" className="h-9" variant="outline">Cancelar</Button>
                    </>
                  ) : (
                    <Button onClick={addReceivable} size="sm" className="h-9"><Plus className="h-4 w-4" /></Button>
                  )}
                </div>

                <ScrollArea className="h-60 pr-4">
                  <div className="space-y-1">
                    {state.receivables.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro.</p>}
                    {state.receivables.slice().reverse().map(r => (
                      <div key={r.id} className={`flex items-center justify-between p-2 rounded text-sm ${
                        editingRecId === r.id ? 'bg-blue-500/20 border border-blue-300' : 'bg-muted/20'
                      }`}>
                        <span>{r.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">{formatBR(r.amount)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editReceivable(r)}>
                            <Edit2 className="h-3 w-3 text-muted-foreground hover:text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeReceivable(r.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: Expenses & Charts */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
            <TrendingDown className="h-5 w-5 text-red-500" /> Despesas (Resumo)
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <span className="text-sm text-muted-foreground">Financiamento</span>
              <span className="font-semibold">{formatBR(props.financingParcela || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <span className="text-sm text-muted-foreground">Cartão de Crédito</span>
              <span className="font-semibold">{formatBR(props.cardMonthTotal || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <span className="text-sm text-muted-foreground">Dívidas (Lembretes)</span>
              <span className="font-semibold">{formatBR(props.othersTotal || 0)}</span>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="expenses">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-orange-500" />
                    <span>Despesas Extras / Variáveis</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{formatBR(extraExpensesTotal)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={expDesc} onChange={e => setExpDesc(e.target.value)} className="h-9" placeholder="Ex: Uber, Ifood..." />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="h-9" placeholder="0,00" />
                  </div>
                  {editingExpId ? (
                    <>
                      <Button onClick={addExpense} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">Salvar</Button>
                      <Button onClick={cancelEditExpense} size="sm" variant="outline" className="h-9">Cancelar</Button>
                    </>
                  ) : (
                    <Button onClick={addExpense} size="sm" className="h-9"><Plus className="h-4 w-4" /></Button>
                  )}
                </div>

                <ScrollArea className="h-60 pr-4">
                  <div className="space-y-1">
                    {state.expenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma despesa extra lançada.</p>}
                    {state.expenses.slice().reverse().map(e => (
                      <div key={e.id} className={`flex items-center justify-between p-2 rounded text-sm ${editingExpId === e.id ? 'bg-blue-500/20 border border-blue-300' : 'bg-muted/20'}`}>
                        <span>{e.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-red-600">{formatBR(e.amount)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editExpense(e)}>
                            <Edit2 className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExpense(e.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50 mt-4">
            <span className="font-bold">Total Despesas</span>
            <span className="font-bold text-red-600">{formatBR(expensesTotal)}</span>
          </div>

          {/* Chart */}
          <div className="h-64 mt-8 border rounded-xl p-4 bg-card/50">
            <h4 className="text-xs font-semibold text-center mb-4 text-muted-foreground">Distribuição Financeira</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={[
                    { name: 'Receitas', value: Math.max(0, incomeTotal) },
                    { name: 'Despesas', value: Math.max(0, expensesTotal) },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip formatter={(v: number) => formatBR(v)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
