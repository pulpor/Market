
import { CalculatedAsset, Corretora } from "@/types/asset";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface ChartsProps {
  assets: CalculatedAsset[];
}

const COLORS: Record<Corretora, string> = {
  Nubank: "#8A05BE",
  XP: "#1A1A1A",
  Itaú: "#FF6700",
  Santander: "#EC0000",
  BTG: "#00205B",
  Outros: "#6B7280",
};

export function Charts({ assets }: ChartsProps) {
  // Dados para pizza de alocação por ticker
  const tickerData = assets.map((asset) => ({
    name: asset.ticker_normalizado.replace(".SA", ""),
    value: asset.valor_total,
    color: COLORS[asset.corretora],
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

  // Dados para gráfico de barras DY
  const dyData = assets
    .map((asset) => ({
      ticker: asset.ticker_normalizado.replace(".SA", ""),
      dy: asset.dividend_yield,
      color: COLORS[asset.corretora],
    }))
    .sort((a, b) => b.dy - a.dy);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Alocação por Ticker */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Alocação por Ticker</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={tickerData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {tickerData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `R$ ${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Alocação por Corretora */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="text-lg font-bold text-foreground mb-4">Alocação por Corretora</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={corretoraData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {corretoraData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `R$ ${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Dividend Yield por Ticker */}
      <div className="bg-card p-6 rounded-xl border border-border lg:col-span-2">
        <h3 className="text-lg font-bold text-foreground mb-4">Dividend Yield TTM por Ticker</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="ticker" stroke="hsl(var(--foreground))" />
            <YAxis stroke="hsl(var(--foreground))" label={{ value: "DY (%)", angle: -90, position: "insideLeft" }} />
            <Tooltip
              formatter={(value: number) => `${value.toFixed(2)}%`}
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <Bar dataKey="dy" radius={[8, 8, 0, 0]}>
              {dyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
