
import { CalculatedAsset, Corretora } from "@/types/asset";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { formatBRL } from "@/utils/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface ChartsProps {
  assets: CalculatedAsset[];
}

// Paleta refinada com tons modernos e acessíveis em modo claro/escuro
const COLORS: Record<Corretora, string> = {
  Nubank: "#9B24D4",
  XP: "#2D2D2D",
  Itaú: "#FF7A1A",
  Santander: "#FF2D2D",
  BTG: "#003C8F",
  Outros: "#7E8895",
};

// Paleta categórica para TICKERS (independente da corretora)
const TICKER_PALETTE: string[] = [
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#22C55E", // green-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#3B82F6", // blue-500
  "#EC4899", // pink-500
  "#10B981", // emerald-500
  "#A855F7", // purple-500
  "#F97316", // orange-500
  "#14B8A6", // teal-500
  "#EAB308", // yellow-500
];

const gradientFills = [
  "url(#grad1)",
  "url(#grad2)",
  "url(#grad3)",
  "url(#grad4)",
  "url(#grad5)",
  "url(#grad6)",
];

export function Charts({ assets }: ChartsProps) {
  const [selectedBroker, setSelectedBroker] = useState<string>("Todas");
  const LABEL_FONT = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"";

  // Fallback local para classificar tipo de ativo quando não vier do backend (ex.: mock)
  const inferTipoAtivo = (rawTicker: string, setor?: string): string => {
    const t = (rawTicker || '').toUpperCase().replace('.SA', '').trim();
    const etfPrefixes = ['BOVA', 'SMAL', 'IVVB', 'SPXI', 'PIBB', 'BRAX', 'FIND', 'MATB', 'DIVO', 'HASH', 'ISUS', 'WRLD', 'NDIV', 'BOVV', 'ECOO', 'XFIX', 'B5P2'];
    if (etfPrefixes.some(prefix => t.startsWith(prefix))) return 'ETF';
    const setorLower = (setor || '').toLowerCase();
    const isImobiliario = setorLower.includes('imobili') || setorLower.includes('real');
    const nonFiiUnits = new Set(['TAEE11','SANB11','SAPR11','KLBN11','ALUP11','STBP11','ITUB11','BBDC11']);
    if (isImobiliario) return 'FII';
    if (t.endsWith('11') && !nonFiiUnits.has(t)) return 'FII';
    if (t.endsWith('11')) return 'Ação';
    if (/[3-9]$/.test(t)) return 'Ação';
    return 'Outro';
  };
  
  // Filtra os ativos pela corretora selecionada
  const filteredAssets = selectedBroker === "Todas" 
    ? assets 
    : assets.filter(a => a.corretora === selectedBroker);
  
  // Dados para pizza de alocação por ticker (usando ativos filtrados)
  const tickerData = filteredAssets.map((asset, i) => ({
    name: asset.ticker_normalizado.replace(".SA", ""),
    value: asset.valor_total,
    color: TICKER_PALETTE[i % TICKER_PALETTE.length],
  }));

  // Dados para pizza de alocação por corretora
  const corretoraMap = new Map<Corretora, number>();
  assets.forEach((asset) => {
    const current = corretoraMap.get(asset.corretora) || 0;
    corretoraMap.set(asset.corretora, current + asset.valor_total);
  });

  const corretoraData = Array.from(corretoraMap.entries()).map(([corretora, value]) => ({
    name: corretora,
    value,
    color: COLORS[corretora],
  }));

  // Dados para gráfico de barras DY - agrupa por ticker (soma se tiver em várias corretoras)
  const dyMap = new Map<string, { ticker: string; dy: number; valor_total: number }>();
  
  assets.forEach((asset) => {
    const ticker = asset.ticker_normalizado.replace(".SA", "");
    const existing = dyMap.get(ticker);
    
    if (existing) {
      // Se já existe, faz média ponderada do DY pelo valor total
      const totalValor = existing.valor_total + asset.valor_total;
      const dyPonderado = (existing.dy * existing.valor_total + asset.dividend_yield * asset.valor_total) / totalValor;
      dyMap.set(ticker, {
        ticker,
        dy: dyPonderado,
        valor_total: totalValor,
      });
    } else {
      dyMap.set(ticker, {
        ticker,
        dy: asset.dividend_yield,
        valor_total: asset.valor_total,
      });
    }
  });

  const dyData = Array.from(dyMap.values())
    .map((data, i) => ({
      ticker: data.ticker,
      dy: data.dy,
      color: TICKER_PALETTE[i % TICKER_PALETTE.length],
    }))
    .sort((a, b) => b.dy - a.dy);

  // Helpers para legendas
  const buildLegend = (data: { name: string; value: number; color: string }[]) => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    return data
      .slice()
      .sort((a, b) => b.value - a.value)
      .map(d => ({
        name: d.name,
        value: d.value,
        percent: (d.value / total) * 100,
        color: d.color,
      }));
  };

  const tickerLegend = buildLegend(tickerData);
  const corretoraLegend = buildLegend(corretoraData);
  
  // Lista de corretoras disponíveis para o filtro
  const availableBrokers = Array.from(new Set(assets.map(a => a.corretora))).sort();

  // Dados para pizza de alocação por tipo de ativo (Ação, FII, ETF)
  const tipoAtivoMap = new Map<string, number>();
  assets.forEach((asset) => {
    const tipo = asset.tipo_ativo || inferTipoAtivo(asset.ticker_normalizado, asset.setor);
    const current = tipoAtivoMap.get(tipo) || 0;
    tipoAtivoMap.set(tipo, current + asset.valor_total);
  });

  const tipoAtivoColors: Record<string, string> = {
    'Ação': '#3B82F6',
    'FII': '#10B981',
    'ETF': '#F59E0B',
    'Outro': '#7E8895',
  };

  const tipoAtivoData = Array.from(tipoAtivoMap.entries()).map(([tipo, value]) => ({
    name: tipo,
    value,
    color: tipoAtivoColors[tipo] || tipoAtivoColors['Outro'],
  }));

  const tipoAtivoLegend = buildLegend(tipoAtivoData);

  // Dados para pizza de alocação por setor
  // Se for FII, contabiliza no grupo "FII" para melhor distinção visual
  const setorMap = new Map<string, number>();
  assets.forEach((asset) => {
    const tipo = asset.tipo_ativo || inferTipoAtivo(asset.ticker_normalizado, asset.setor);
    const setorLabel = tipo === 'FII' ? 'FII' : (asset.setor || 'Outros');
    const current = setorMap.get(setorLabel) || 0;
    setorMap.set(setorLabel, current + asset.valor_total);
  });

  const setorData = Array.from(setorMap.entries()).map(([setor, value], i) => ({
    name: setor,
    value,
    color: TICKER_PALETTE[i % TICKER_PALETTE.length],
  }));

  const setorLegend = buildLegend(setorData);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Alocação por Ticker */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Alocação por Ticker</h3>
          <Select value={selectedBroker} onValueChange={setSelectedBroker}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar corretora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas Corretoras</SelectItem>
              {availableBrokers.map(broker => (
                <SelectItem key={broker} value={broker}>{broker}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="w-full md:flex-1">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9B24D4" />
                <stop offset="100%" stopColor="#6F18A2" />
              </linearGradient>
              <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2D2D2D" />
                <stop offset="100%" stopColor="#4B4B4B" />
              </linearGradient>
              <linearGradient id="grad3" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF7A1A" />
                <stop offset="100%" stopColor="#D95F00" />
              </linearGradient>
              <linearGradient id="grad4" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF2D2D" />
                <stop offset="100%" stopColor="#C50000" />
              </linearGradient>
              <linearGradient id="grad5" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#003C8F" />
                <stop offset="100%" stopColor="#002456" />
              </linearGradient>
              <linearGradient id="grad6" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7E8895" />
                <stop offset="100%" stopColor="#5A636D" />
              </linearGradient>
            </defs>
                <Pie
                  data={tickerData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  innerRadius={48}
                  paddingAngle={2}
                  blendStroke
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tickerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", fontSize: 12, fontFamily: LABEL_FONT as any }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="md:w-56 w-full max-h-[280px] overflow-auto pr-1">
            <ul className="space-y-2">
              {tickerLegend.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm" style={{ fontFamily: LABEL_FONT }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-foreground/80">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{item.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Alocação por Corretora */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Alocação por Corretora</h3>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="w-full md:flex-1">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={corretoraData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  innerRadius={48}
                  paddingAngle={2}
                  blendStroke
                  fill="#8884d8"
                  dataKey="value"
                >
                  {corretoraData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", fontSize: 12, fontFamily: LABEL_FONT as any }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="md:w-56 w-full max-h-[280px] overflow-auto pr-1">
            <ul className="space-y-2">
              {corretoraLegend.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm" style={{ fontFamily: LABEL_FONT }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-foreground/80">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{item.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Dividend Yield por Ticker */}
      <div className="bg-card p-6 rounded-xl border border-border lg:col-span-2">
        <h3 className="text-lg font-bold text-foreground mb-4">Dividend Yield TTM por Ticker</h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={dyData}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="ticker" 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }} 
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} 
              label={{ value: "DY (%)", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" } }} 
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent) / 0.1)" }}
              formatter={(value: number) => [`${formatBRL(value, 2)}%`, "Dividend Yield"]}
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                color: "hsl(var(--foreground))", 
                border: "1px solid hsl(var(--border))", 
                borderRadius: 8, 
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)", 
                fontSize: 12,
                fontFamily: LABEL_FONT as any
              }}
              itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
            />
            <Bar dataKey="dy" radius={[8, 8, 0, 0]}>
              {dyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList 
                dataKey="dy" 
                position="top" 
                formatter={(v: number) => `${formatBRL(v, 1)}%`} 
                style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))", fontFamily: LABEL_FONT }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alocação por Tipo de Ativo */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Alocação por Tipo de Ativo</h3>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="w-full md:flex-1">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={tipoAtivoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  innerRadius={48}
                  paddingAngle={2}
                  blendStroke
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tipoAtivoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", fontSize: 12, fontFamily: LABEL_FONT as any }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="md:w-56 w-full max-h-[280px] overflow-auto pr-1">
            <ul className="space-y-2">
              {tipoAtivoLegend.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm" style={{ fontFamily: LABEL_FONT }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-foreground/80">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{item.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Alocação por Setor */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Alocação por Setor</h3>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="w-full md:flex-1">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={setorData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  innerRadius={48}
                  paddingAngle={2}
                  blendStroke
                  fill="#8884d8"
                  dataKey="value"
                >
                  {setorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", fontSize: 12, fontFamily: LABEL_FONT as any }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="md:w-56 w-full max-h-[280px] overflow-auto pr-1">
            <ul className="space-y-2">
              {setorLegend.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm" style={{ fontFamily: LABEL_FONT }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-foreground/80">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{item.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
