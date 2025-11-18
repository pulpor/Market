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

  // Fallback: tenta snapshot do collector; se falhar, usa REST comum
  const loadFallback = async () => {
    setLoading(true);
    try {
      // 1) Tentar snapshot do collector (somente quando URL é válida e não-local em produção)
      if (isUsableCollector) {
        const res = await fetch(`${COLLECTOR_URL}/api/market/snapshot`, { 
          cache: 'no-store',
          signal: AbortSignal.timeout(3000) // timeout de 3s
        });
        if (res.ok) {
          const json = await res.json();
          const list: MarketUpdate[] = Array.isArray(json?.data) ? json.data : [];
          if (list.length) {
            const mapped: Indicator[] = list.map((item) => ({
              name: getIndicatorName(item.symbol),
              symbol: symbolMap[item.symbol] || item.symbol,
              price: item.price,
              changePct: item.pctChange,
              currency: getCurrency(item.symbol),
              source: 'snapshot',
              time: new Date(item.timestamp).toISOString(),
            }));
            setData(mapped);
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      // Collector indisponível ou inválido, usar REST
      console.log('Collector não disponível, usando REST fallback');
    }

    try {
      // 2) Fallback REST de fontes públicas / Supabase function
      console.log('📊 MarketBar: Chamando fetchAllIndicators...');
      const out = await fetchAllIndicators();
      console.log('📊 MarketBar: Recebido', out.length, 'indicadores:', out.map(i => `${i.symbol}=${i.price}`));
      setData(out);
    } catch (err) {
      console.error('❌ MarketBar: Erro ao buscar indicadores:', err);
    } finally {
      setLoading(false);
    }
  };

  // SSE: conecta ao collector e recebe updates em tempo real
  useEffect(() => {
    if (!USE_REALTIME) {
      // Modo fallback: polling REST a cada 60s
      loadFallback();
      const id = setInterval(loadFallback, 60_000);
      return () => clearInterval(id);
    }

    // Em produção com collector inválido ou local, pula direto para fallback
    if (!isUsableCollector) {
      console.log('⚠️ Produção detectada com collector localhost, usando REST fallback');
      loadFallback();
      const id = setInterval(loadFallback, 60_000);
      return () => clearInterval(id);
    }

    // Modo real-time: Server-Sent Events (SSE)
    console.log('🔌 Connecting to SSE stream:', `${COLLECTOR_URL}/api/market/stream`);
    
    const eventSource = new EventSource(`${COLLECTOR_URL}/api/market/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
      setConnected(true);
      setLoading(false);
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      setConnected(false);
      
      // Fallback para REST (sem reload!)
      loadFallback();
      
      // Fechar conexão SSE quebrada
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Snapshot inicial
        if (message.type === 'snapshot' && Array.isArray(message.data)) {
          console.log('📸 Received snapshot:', message.data.length, 'symbols');
          
          const indicators: Indicator[] = message.data.map((item: MarketUpdate) => ({
            name: getIndicatorName(item.symbol),
            symbol: symbolMap[item.symbol] || item.symbol,
            price: item.price,
            changePct: item.pctChange,
            currency: getCurrency(item.symbol),
            source: 'real-time',
            time: new Date(item.timestamp).toISOString(),
          }));
          
          setData(indicators);
          setLoading(false);
          return;
        }
        
        // Update individual
        if (message.symbol) {
          const update = message as MarketUpdate;
          const frontendSymbol = symbolMap[update.symbol] || update.symbol;
          
          setData(prev => {
            if (!prev) return prev;
            
            const index = prev.findIndex(item => item.symbol === frontendSymbol);
            
            if (index >= 0) {
              const current = prev[index];
              // Throttle: só atualiza se preço mudou mais que 0.01% (evita flicker)
              const priceDiff = current.price ? Math.abs((update.price - current.price) / current.price) * 100 : 999;
              if (priceDiff < 0.01 && current.price) {
                return prev; // Ignora micro-variações
              }
              
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                price: update.price,
                changePct: update.pctChange,
                time: new Date(update.timestamp).toISOString(),
              };
              return updated;
            }
            
            // Adicionar símbolo novo se não existir
            return [...prev, {
              name: getIndicatorName(message.symbol),
              symbol: frontendSymbol,
              price: update.price,
              changePct: update.pctChange,
              currency: getCurrency(message.symbol),
              source: 'real-time',
              time: new Date(update.timestamp).toISOString(),
            }];
          });
        }
      } catch (error) {
        console.error('❌ SSE message parse error:', error);
      }
    };

    return () => {
      console.log('🔌 Disconnecting from SSE stream');
      eventSource.close();
    };
  }, []);

  // (helpers movidos para o topo para reutilizar no fallback)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Status de conexão real-time */}
      {USE_REALTIME && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">Ao vivo</span>
              <span className="text-muted-foreground">• Dados atualizados em tempo real</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-yellow-500" />
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                {loading ? 'Conectando...' : 'Modo offline'}
              </span>
              <span className="text-muted-foreground">• Usando dados em cache</span>
            </>
          )}
        </div>
      )}
      
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
                
                {/* Pulse animation quando conectado em real-time */}
                {USE_REALTIME && connected && d.price !== null && (
                  <div className="absolute top-1 right-1">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      {loading && !USE_REALTIME && (
        <p className="text-xs text-muted-foreground mt-2">Atualizando cotações...</p>
      )}
    </div>
  );
}
