import { useEffect, useMemo, useState } from "react";
import { FreelanceEntry, DividendForecast, ReceivableEntry, ReturnsForecastState } from "@/types/returns";
import { loadReturns, saveReturns } from "@/services/returnsStorage";
import { loadAssets } from "@/services/fileStorage"; // assets already persisted
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Calculator, Coins, Wallet, Briefcase } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

function formatBR(v:number){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} 

interface Props {
  financingParcela?: number; // parcela financiamento
  cardMonthTotal?: number; // gasto cartão mês
  othersTotal?: number; // outras dívidas mês
  currentMonth?: string; // YYYY-MM (deprecated, usar month)
  month?: string; // mês controlado pelo pai
  onMonthChange?(m: string): void; // callback para sincronizar com pai
}

export function ReturnsForecastSection(props: Props){
  const monthInitial = props.month || props.currentMonth || (()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
  const [month,setMonth] = useState<string>(monthInitial);
  const [state,setState] = useState<ReturnsForecastState>({month:monthInitial, salary: undefined, freelas:[], dividends:[], receivables:[]});
  const [loaded,setLoaded]=useState(false);

  // local form states (freela)
  const [freelaDate,setFreelaDate]=useState<string>("" );
  const [freelaClient,setFreelaClient]=useState<string>("");
  const [freelaDesc,setFreelaDesc]=useState<string>("");
  const [freelaHours,setFreelaHours]=useState<string>("");
  const [freelaRate,setFreelaRate]=useState<string>("");
  const [freelaExtra,setFreelaExtra]=useState<string>("");

  // dividend form
  const [divTicker,setDivTicker]=useState<string>("");
  const [divAmount,setDivAmount]=useState<string>("");

  // receivable form
  const [recDesc,setRecDesc]=useState<string>("");
  const [recAmount,setRecAmount]=useState<string>("");

  // salary
  const [salaryInput,setSalaryInput]=useState<string>("");

  useEffect(()=>{
    (async () =>{
      const loaded = await loadReturns(month);
      setState(loaded);
      setSalaryInput(loaded.salary?.toString() || "");
      setLoaded(true);
      // auto dividends placeholder
      const assets = await loadAssets();
      if(assets && assets.length){
        const existingTickers = new Set(loaded.dividends.map(d=>d.assetTicker));
        const add: DividendForecast[] = [];
        for(const a of assets){
          const ticker = a.ticker.toUpperCase();
          // Heurística renda variável: ticker padrão B3 (4 letras + número) ou FII (termina em 11) e não marcado como renda fixa manual
          const manual = (a.tipo_ativo_manual||'').toLowerCase();
          const isRendaFixaManual = manual.includes('cdb')||manual.includes('lci')||manual.includes('lca')||manual.includes('tesouro')||manual.includes('previd')||manual.includes('selic')||manual.includes('ipca');
          const patternRV = /^[A-Z]{4}[0-9]{1,2}$/; // ações, FIIs
          const isRV = !isRendaFixaManual && patternRV.test(ticker);
          if(isRV && !existingTickers.has(a.ticker)){
            add.push({ id: `${a.ticker}-${month}`, assetTicker: a.ticker, amount: 0, auto: true });
          }
        }
        if(add.length){
          const updated = { ...loaded, dividends: [...loaded.dividends, ...add] };
          setState(updated);
          saveReturns(updated);
        }
      }
    })();
  },[month]);

  // Sincroniza mês externo se controlado pelo pai
  useEffect(()=>{
    if(props.month && props.month !== month){
      setMonth(props.month);
    }
  },[props.month]);

  const save = async (next: ReturnsForecastState)=>{ setState(next); await saveReturns(next); };

  const addFreela = async () => {
    const hours = parseFloat(freelaHours||'0');
    const rate = parseFloat(freelaRate||'0');
    if(!hours || !rate) return;
    const extra = parseFloat(freelaExtra||'0')||0;
    const total = hours*rate + extra;
    const entry: FreelanceEntry = { id: Date.now().toString(), date: freelaDate || `${month}-01`, client: freelaClient||undefined, description: freelaDesc||undefined, hours, hourlyRate: rate, extra, total };
    await save({ ...state, freelas: [...state.freelas, entry] });
    setFreelaDate(''); setFreelaClient(''); setFreelaDesc(''); setFreelaHours(''); setFreelaRate(''); setFreelaExtra('');
  };

  const removeFreela = async (id:string)=>{ await save({ ...state, freelas: state.freelas.filter(f=>f.id!==id) }); };

  const addDividend = async ()=>{
    const amt = parseFloat(divAmount||'0'); if(!divTicker || !amt) return;
    const entry: DividendForecast = { id: Date.now().toString(), assetTicker: divTicker.toUpperCase(), amount: amt };
    await save({ ...state, dividends: [...state.dividends, entry] });
    setDivTicker(''); setDivAmount('');
  };

  const removeDividend = async (id:string)=>{ await save({ ...state, dividends: state.dividends.filter(d=>d.id!==id) }); };

  const addReceivable = async ()=>{
    const amt = parseFloat(recAmount||'0'); if(!recDesc || !amt) return;
    const entry: ReceivableEntry = { id: Date.now().toString(), description: recDesc, amount: amt };
    await save({ ...state, receivables: [...state.receivables, entry] });
    setRecDesc(''); setRecAmount('');
  };

  const removeReceivable = async (id:string)=>{ await save({ ...state, receivables: state.receivables.filter(r=>r.id!==id) }); };

  const updateSalary = async ()=>{
    const val = parseFloat(salaryInput||'0');
    await save({ ...state, salary: val>0? val: undefined });
  };

  // Aggregations
  const freelasTotal = useMemo(()=> state.freelas.reduce((s,f)=> s + (f.total || 0),0),[state.freelas]);
  const dividendsTotal = useMemo(()=> state.dividends.reduce((s,d)=> s + d.amount,0),[state.dividends]);
  const receivablesTotal = useMemo(()=> state.receivables.reduce((s,r)=> s + r.amount,0),[state.receivables]);

  const incomeTotal = (state.salary||0) + freelasTotal + dividendsTotal + receivablesTotal;
  const expensesTotal = (props.financingParcela||0) + (props.cardMonthTotal||0) + (props.othersTotal||0);
  const netTotal = incomeTotal - expensesTotal;

  if(!loaded) return <div className="mt-10">Carregando previsão...</div>;

  return (
    <div className="mt-10 border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Calculator className="h-5 w-5"/> Previsão de Retornos</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <Label>Mês</Label>
          <Input type="month" value={month} onChange={e=>{ const m=e.target.value; setMonth(m); props.onMonthChange?.(m); }} className="h-10" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Salário (R$)</Label>
          <div className="flex gap-2">
            <Input type="number" step="0.01" value={salaryInput} onChange={e=>setSalaryInput(e.target.value)} className="h-10" placeholder="Ex: 4500" />
            <Button onClick={updateSalary} className="h-10" variant="outline">Salvar</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Total Líquido Previsto</Label>
          <div className={`p-3 rounded-md border ${netTotal>=0? 'border-green-600 bg-green-600/10':'border-red-600 bg-red-600/10'}`}> 
            <p className="text-lg font-bold">{formatBR(netTotal)}</p>
            <p className="text-xs text-muted-foreground">Receitas {formatBR(incomeTotal)} • Despesas {formatBR(expensesTotal)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="freelas" className="mt-8">
        <TabsList>
          <TabsTrigger value="freelas" className="flex items-center gap-1"><Briefcase className="h-4 w-4"/> Freelas</TabsTrigger>
          <TabsTrigger value="dividends" className="flex items-center gap-1"><Coins className="h-4 w-4"/> Dividendos</TabsTrigger>
          <TabsTrigger value="receivables" className="flex items-center gap-1"><Wallet className="h-4 w-4"/> Valores a Receber</TabsTrigger>
        </TabsList>

        <TabsContent value="freelas" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={freelaDate} onChange={e=>setFreelaDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label>Cliente / Unidade</Label>
              <Input value={freelaClient} onChange={e=>setFreelaClient(e.target.value)} className="h-10" placeholder="Ex: Saul" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={freelaDesc} onChange={e=>setFreelaDesc(e.target.value)} className="h-10" placeholder="Ex: Aula" />
            </div>
            <div className="space-y-1">
              <Label>Horas</Label>
              <Input type="number" step="0.25" value={freelaHours} onChange={e=>setFreelaHours(e.target.value)} className="h-10" placeholder="Ex: 3.5" />
            </div>
            <div className="space-y-1">
              <Label>R$/hora</Label>
              <Input type="number" step="0.01" value={freelaRate} onChange={e=>setFreelaRate(e.target.value)} className="h-10" placeholder="Ex: 35" />
            </div>
            <div className="space-y-1">
              <Label>Extra (vt, etc)</Label>
              <Input type="number" step="0.01" value={freelaExtra} onChange={e=>setFreelaExtra(e.target.value)} className="h-10" placeholder="Ex: 11.50" />
            </div>
            <Button onClick={addFreela} className="h-10 md:col-span-6"><Plus className="h-4 w-4 mr-2"/>Adicionar</Button>
          </div>
          {state.freelas.length>0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Lançamentos ({formatBR(freelasTotal)})</h4>
              <div className="space-y-2">
                {state.freelas.slice().reverse().map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="text-xs">
                      <p className="font-medium">{f.date} • {f.client || '—'} • {f.description || '—'}</p>
                      <p>{f.hours}h x {formatBR(f.hourlyRate||0)} {f.extra? `+ ${formatBR(f.extra)}`:''} = <strong>{formatBR(f.total||0)}</strong></p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={()=>removeFreela(f.id)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dividends" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Ticker</Label>
              <Input value={divTicker} onChange={e=>setDivTicker(e.target.value)} className="h-10" placeholder="Ex: PETR4" />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={divAmount} onChange={e=>setDivAmount(e.target.value)} className="h-10" placeholder="Ex: 120" />
            </div>
            <Button onClick={addDividend} className="h-10 md:col-span-2"><Plus className="h-4 w-4 mr-2"/>Adicionar</Button>
          </div>
          {state.dividends.length>0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Dividendos ({formatBR(dividendsTotal)})</h4>
              <div className="space-y-2">
                {state.dividends.slice().reverse().map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="text-xs">{d.assetTicker} — <strong>{formatBR(d.amount)}</strong>{d.auto? ' (auto)':''}</span>
                    <Button variant="ghost" size="icon" onClick={()=>removeDividend(d.id)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="receivables" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={recDesc} onChange={e=>setRecDesc(e.target.value)} className="h-10" placeholder="Ex: Projeto X" />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={recAmount} onChange={e=>setRecAmount(e.target.value)} className="h-10" placeholder="Ex: 800" />
            </div>
            <Button onClick={addReceivable} className="h-10 md:col-span-2"><Plus className="h-4 w-4 mr-2"/>Adicionar</Button>
          </div>
          {state.receivables.length>0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Valores a Receber ({formatBR(receivablesTotal)})</h4>
              <div className="space-y-2">
                {state.receivables.slice().reverse().map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="text-xs">{r.description} — <strong>{formatBR(r.amount)}</strong></span>
                    <Button variant="ghost" size="icon" onClick={()=>removeReceivable(r.id)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Gráfico de pizza - distribuição de receitas e despesas */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg border">
          <p className="text-sm font-semibold mb-2">Receitas por categoria</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={[
                  { name: 'Salário', value: Math.max(0, state.salary||0) },
                  { name: 'Freelas', value: Math.max(0, freelasTotal) },
                  { name: 'Dividendos', value: Math.max(0, dividendsTotal) },
                  { name: 'A receber', value: Math.max(0, receivablesTotal) },
                ]} innerRadius={50} outerRadius={80} paddingAngle={2}>
                  <Cell fill="#10b981" />
                  <Cell fill="#22c55e" />
                  <Cell fill="#34d399" />
                  <Cell fill="#6ee7b7" />
                </Pie>
                <Tooltip formatter={(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-sm font-semibold mb-2">Despesas por categoria</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={[
                  { name: 'Financiamento', value: Math.max(0, props.financingParcela||0) },
                  { name: 'Cartão', value: Math.max(0, props.cardMonthTotal||0) },
                  { name: 'Outros', value: Math.max(0, props.othersTotal||0) },
                ]} innerRadius={50} outerRadius={80} paddingAngle={2}>
                  <Cell fill="#ef4444" />
                  <Cell fill="#f97316" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip formatter={(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border">
          <p className="text-xs text-muted-foreground">Salário</p>
          <p className="text-lg font-bold">{formatBR(state.salary||0)}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-xs text-muted-foreground">Freelas</p>
          <p className="text-lg font-bold">{formatBR(freelasTotal)}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-xs text-muted-foreground">Dividendos</p>
          <p className="text-lg font-bold">{formatBR(dividendsTotal)}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-xs text-muted-foreground">Valores a Receber</p>
          <p className="text-lg font-bold">{formatBR(receivablesTotal)}</p>
        </div>
      </div>
    </div>
  );
}
