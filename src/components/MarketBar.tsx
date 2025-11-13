import { useEffect, useState } from "react";
import { fetchAllIndicators, Indicator } from "@/services/marketIndicators";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function fmtMoney(v: number | null, currency?: string) {
  if (v == null) return "—";
  const cur = currency || 'BRL';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: cur, maximumFractionDigits: 2 });
}

function fmtPct(v: number | null) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function MarketBar() {
  const [data, setData] = useState<Indicator[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setLoading(true); const out = await fetchAllIndicators(); setData(out); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // 60s
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(() => {
          const order: Array<[string, string, string]> = [
            ['IBOV', 'Ibovespa', 'BRL'],
            ['USD/BRL', 'Dólar', 'BRL'],
            ['BTC/BRL', 'Bitcoin', 'BRL'],
            ['^GSPC', 'S&P 500', 'USD'],
            ['^DJI', 'Dow Jones', 'USD'],
            ['^NDX', 'Nasdaq 100', 'USD'],
          ];
          const map = new Map<string, Indicator>();
          for (const it of data || []) map.set(it.symbol, it);
          return order.map(([symbol, name, cur], idx) => {
            const d = map.get(symbol) || { name, symbol, price: null, changePct: null, currency: cur, source: '—', time: null };
            const up = (d?.changePct || 0) > 0;
            const down = (d?.changePct || 0) < 0;
            return (
              <div key={`${symbol}-${idx}`} className="p-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{d.name}</p>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${up ? 'text-green-600 dark:text-green-400' : down ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {up ? <TrendingUp className="h-3 w-3"/> : down ? <TrendingDown className="h-3 w-3"/> : <Minus className="h-3 w-3"/>}
                    <span>{fmtPct(d.changePct ?? null)}</span>
                  </div>
                </div>
                <p className="text-lg font-bold mt-1">{fmtMoney(d.price ?? null, d.currency)}</p>
              </div>
            );
          });
        })()}
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground mt-2">Atualizando cotações...</p>
      )}
    </div>
  );
}
