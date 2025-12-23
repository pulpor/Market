import { useEffect, useState, useRef } from "react";
import { fetchAllIndicators, Indicator } from "@/services/marketIndicators";
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from "lucide-react";

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

interface MarketUpdate {
  symbol: string;
  price: number;
  change: number;
  pctChange: number;
  timestamp: number;
}

// Raw env value (undefined if not provided). We only use the collector
// when the env var is explicitly set to avoid noisy dev errors.
const RAW_COLLECTOR_URL: string | undefined = import.meta.env.VITE_COLLECTOR_URL as any;
const COLLECTOR_URL = RAW_COLLECTOR_URL || 'http://localhost:3002';
const USE_REALTIME = import.meta.env.VITE_USE_REALTIME === '1';

// Mapeamento de símbolos do backend real-time para os do frontend
const symbolMap: Record<string, string> = {
  'BTC': 'BTC/BRL',
  'USD': 'USD/BRL',
  'IBOV': 'IBOV',
  'SP500': '^GSPC',
  'DOW': '^DJI',
  'NASDAQ': '^NDX',
};

function getIndicatorName(symbol: string): string {
  const names: Record<string, string> = {
    'BTC': 'Bitcoin',
    'USD': 'Dólar',
    'IBOV': 'Ibovespa',
    'SP500': 'S&P 500',
    'DOW': 'Dow Jones',
    'NASDAQ': 'Nasdaq 100',
  };
  return names[symbol] || symbol;
}

function getCurrency(symbol: string): string {
  // Todos em BRL (USD é a cotação em reais; índices convertidos no backend)
  return 'BRL';
}

export function MarketBar() {
  const [data, setData] = useState<Indicator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Determina se a URL do collector é utilizável (remota e válida)
  const isUsableCollector = (() => {
    // Only consider using collector if the env var was explicitly set.
    if (!RAW_COLLECTOR_URL) return false;
    try {
      const u = new URL(COLLECTOR_URL);
      const isHttp = u.protocol === 'http:' || u.protocol === 'https:';
      const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
      if (!isHttp) return false;
      if (import.meta.env.PROD && isLocalHost) return false; // nunca usar localhost em prod
      return !!u.hostname;
    } catch {
      // URL inválida (ex: ":3002"). Em prod, nunca usar; em dev, também ignorar para evitar erros.
      return false;
    }
  })();

  // Carrega indicadores via REST
  const loadFallback = async () => {
    setLoading(true);
    try {
      const out = await fetchAllIndicators();
      setData(out);
    } catch (err) {
      console.error('❌ MarketBar: Erro ao buscar indicadores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega indicadores no mount
  useEffect(() => {
    loadFallback();
    // Atualiza a cada 60 segundos
    const id = setInterval(loadFallback, 60_000);
    return () => clearInterval(id);
  }, []);

  // (helpers movidos para o topo para reutilizar no fallback)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(() => {
          const order: Array<[string, string, string]> = [
            ['IBOV', 'Ibovespa', 'BRL'],
            ['USD/BRL', 'Dólar', 'BRL'],
            ['BTC/BRL', 'Bitcoin', 'BRL'],
            ['^GSPC', 'S&P 500', 'BRL'],
            ['^DJI', 'Dow Jones', 'BRL'],
            ['^NDX', 'Nasdaq 100', 'BRL'],
          ];
          const map = new Map<string, Indicator>();
          for (const it of data || []) map.set(it.symbol, it);
          return order.map(([symbol, name, cur], idx) => {
            const d = map.get(symbol) || { name, symbol, price: null, changePct: null, currency: cur, source: '—', time: null };
            const up = (d?.changePct || 0) > 0;
            const down = (d?.changePct || 0) < 0;
            return (
              <div key={`${symbol}-${idx}`} className="p-3 rounded-lg bg-muted/50 border border-border/50 relative">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground/70">{d.name}</p>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${up ? 'text-green-600 dark:text-green-400' : down ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {up ? <TrendingUp className="h-3 w-3"/> : down ? <TrendingDown className="h-3 w-3"/> : <Minus className="h-3 w-3"/>}
                    <span>{fmtPct(d.changePct ?? null)}</span>
                  </div>
                </div>
                <p className="text-lg font-bold mt-1 text-foreground">{fmtMoney(d.price ?? null, d.currency)}</p>
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
