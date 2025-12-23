import { CalculatedAsset, PortfolioSummary } from "@/types/asset";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getIPCAData, getSELICData, getCDIData } from "@/services/bcbApi";
import { getHistoryWithDiff } from "@/services/portfolioHistory";
import { useAuth } from "@/contexts/AuthContext";

interface ChartData {
  period: string;
  portfolio?: number;
  ipca?: number;
  selic?: number;
  cdi?: number;
}

interface PortfolioIndexComparisonProps {
  assets: CalculatedAsset[];
  summary: PortfolioSummary | null;
}

const FALLBACK_IPCA_DATA = [
  { date: "2025-01-01", value: 0.41 },
  { date: "2025-02-01", value: 0.38 },
  { date: "2025-03-01", value: 0.29 },
  { date: "2025-04-01", value: 0.61 },
  { date: "2025-05-01", value: 0.46 },
  { date: "2025-06-01", value: 0.13 },
  { date: "2025-07-01", value: 0.30 },
  { date: "2025-08-01", value: 0.38 },
  { date: "2025-09-01", value: 0.44 },
  { date: "2025-10-01", value: 0.79 },
  { date: "2025-11-01", value: 0.42 },
  { date: "2025-12-01", value: 0.56 },
];

const FALLBACK_SELIC_DATA = [
  { date: "2025-01-01", value: 0.92 },
  { date: "2025-02-01", value: 0.92 },
  { date: "2025-03-01", value: 0.92 },
  { date: "2025-04-01", value: 0.92 },
  { date: "2025-05-01", value: 0.92 },
  { date: "2025-06-01", value: 0.92 },
  { date: "2025-07-01", value: 0.93 },
  { date: "2025-08-01", value: 0.93 },
  { date: "2025-09-01", value: 0.93 },
  { date: "2025-10-01", value: 0.93 },
  { date: "2025-11-01", value: 0.94 },
  { date: "2025-12-01", value: 0.94 },
];

const FALLBACK_CDI_DATA = [
  { date: "2025-01-01", value: 0.89 },
  { date: "2025-02-01", value: 0.89 },
  { date: "2025-03-01", value: 0.89 },
  { date: "2025-04-01", value: 0.89 },
  { date: "2025-05-01", value: 0.89 },
  { date: "2025-06-01", value: 0.89 },
  { date: "2025-07-01", value: 0.90 },
  { date: "2025-08-01", value: 0.90 },
  { date: "2025-09-01", value: 0.90 },
  { date: "2025-10-01", value: 0.90 },
  { date: "2025-11-01", value: 0.91 },
  { date: "2025-12-01", value: 0.91 },
];

export function PortfolioIndexComparison({
  assets,
  summary,
}: PortfolioIndexComparisonProps) {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState({
    portfolio: true,
    ipca: true,
    selic: true,
    cdi: true,
  });
  const [stats, setStats] = useState<any>({
    portfolio: { avg: 0, max: 0, min: 0, accum: 0 },
    ipca: { avg: 0, accum: 0 },
    selic: { avg: 0, accum: 0 },
    cdi: { avg: 0, accum: 0 },
  });

  useEffect(() => {
    const loadIndexData = async () => {
      try {
        setLoading(true);

        // Busca histórico da carteira
        const portfolioHistory = await getHistoryWithDiff(user?.id);

        // Busca dados dos índices
        let ipcaData: any[] = [];
        let selicData: any[] = [];
        let cdiData: any[] = [];

        try {
          [ipcaData, selicData, cdiData] = await Promise.all([
            getIPCAData(12),
            getSELICData(12),
            getCDIData(12),
          ]);
        } catch (apiError) {
          console.error("❌ Erro na API do BCB:", apiError);
        }

        // Usa fallback se não tiver dados
        const finalIPCA = ipcaData.length > 0 ? ipcaData : FALLBACK_IPCA_DATA;
        const finalSELIC = selicData.length > 0 ? selicData : FALLBACK_SELIC_DATA;
        const finalCDI = cdiData.length > 0 ? cdiData : FALLBACK_CDI_DATA;

        // Calcula retorno da carteira por mês (ACUMULADO)
        const portfolioMonthly = calculatePortfolioMonthlyReturn(portfolioHistory);

        // Coleta todos os meses
        const monthSet = new Set<string>();
        finalIPCA.forEach((d) => monthSet.add(d.date.substring(0, 7)));
        finalSELIC.forEach((d) => monthSet.add(d.date.substring(0, 7)));
        finalCDI.forEach((d) => monthSet.add(d.date.substring(0, 7)));
        portfolioMonthly.forEach((d) => monthSet.add(d.date.substring(0, 7)));

        const months = Array.from(monthSet).sort();
        if (months.length === 0) {
          setLoading(false);
          return;
        }

        // Últimos 12 meses
        const last12Months = months.slice(-12);

        // Mescla dados com ACUMULADO para índices
        const mergedData: ChartData[] = last12Months.map((month, index) => {
          const portfolio = portfolioMonthly.find((d) => d.date === month);

          // Calcula retorno ACUMULADO dos índices (composição mensal) até este mês
          let ipcaFactor = 1;
          let selicFactor = 1;
          let cdiFactor = 1;

          for (let i = 0; i <= index; i++) {
            const m = last12Months[i];
            const ipcaMonth = finalIPCA.find((d) => d.date.startsWith(m));
            const selicMonth = finalSELIC.find((d) => d.date.startsWith(m));
            const cdiMonth = finalCDI.find((d) => d.date.startsWith(m));

            ipcaFactor *= 1 + (ipcaMonth?.value || 0) / 100;
            selicFactor *= 1 + (selicMonth?.value || 0) / 100;
            cdiFactor *= 1 + (cdiMonth?.value || 0) / 100;
          }

          const ipcaAccum = (ipcaFactor - 1) * 100;
          const selicAccum = (selicFactor - 1) * 100;
          const cdiAccum = (cdiFactor - 1) * 100;

          return {
            period: month,
            ipca: ipcaAccum,
            selic: selicAccum,
            cdi: cdiAccum,
            portfolio: portfolio?.value ?? 0,
          };
        });

        setChartData(mergedData);

        // Estatísticas (último valor = acumulado total)
        const lastData = mergedData[mergedData.length - 1];
        const portfolioValues = mergedData.map((d) => d.portfolio || 0);
        
        setStats({
          portfolio: {
            avg: portfolioValues.reduce((a, b) => a + b, 0) / portfolioValues.length || 0,
            max: Math.max(...portfolioValues, 0),
            min: Math.min(...portfolioValues, 0),
            accum: lastData?.portfolio || 0,
          },
          ipca: {
            avg: (lastData?.ipca || 0) / 12,
            accum: lastData?.ipca || 0,
          },
          selic: {
            avg: (lastData?.selic || 0) / 12,
            accum: lastData?.selic || 0,
          },
          cdi: {
            avg: (lastData?.cdi || 0) / 12,
            accum: lastData?.cdi || 0,
          },
        });

      } catch (error) {
        console.error("❌ Erro:", error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    loadIndexData();
  }, [user?.id]);

  const toggleIndex = (index: keyof typeof selectedIndices) => {
    setSelectedIndices((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análise Comparativa - Carteira vs Índices</CardTitle>
          <CardDescription>Buscando dados do Banco Central...</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">⏳ Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Análise Comparativa - Carteira vs Índices</CardTitle>
          <CardDescription>Retorno acumulado vs IPCA, SELIC e CDI (12 meses)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gráfico */}
          {chartData.length > 0 ? (
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 11 }} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    style={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(value: any) => `${value?.toFixed(2) || "0"}%`}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} iconType="line" />

                  {selectedIndices.portfolio && (
                    <Line type="monotone" dataKey="portfolio" stroke="#8B5CF6" strokeWidth={3} 
                          dot={{ r: 4, fill: "#8B5CF6" }} name="Carteira" isAnimationActive={false} />
                  )}
                  {selectedIndices.ipca && (
                    <Line type="monotone" dataKey="ipca" stroke="#F59E0B" strokeWidth={2}
                          dot={{ r: 3 }} name="IPCA (Acum)" isAnimationActive={false} />
                  )}
                  {selectedIndices.selic && (
                    <Line type="monotone" dataKey="selic" stroke="#EF4444" strokeWidth={2}
                          dot={{ r: 3 }} name="SELIC (Acum)" isAnimationActive={false} />
                  )}
                  {selectedIndices.cdi && (
                    <Line type="monotone" dataKey="cdi" stroke="#06B6D4" strokeWidth={2}
                          dot={{ r: 3 }} name="CDI (Acum)" isAnimationActive={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedIndices.portfolio} onChange={() => toggleIndex("portfolio")} className="rounded" />
              <span className="text-sm font-medium">Carteira</span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8B5CF6" }} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedIndices.ipca} onChange={() => toggleIndex("ipca")} className="rounded" />
              <span className="text-sm font-medium">IPCA</span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedIndices.selic} onChange={() => toggleIndex("selic")} className="rounded" />
              <span className="text-sm font-medium">SELIC</span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#EF4444" }} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedIndices.cdi} onChange={() => toggleIndex("cdi")} className="rounded" />
              <span className="text-sm font-medium">CDI</span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#06B6D4" }} />
            </label>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-purple-500/30 bg-purple-50/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">Carteira</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acumulado</span>
                  <span className="font-semibold text-green-600">{stats.portfolio.accum.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Máx/Mín</span>
                  <span className="font-semibold">{stats.portfolio.max.toFixed(2)}% / {stats.portfolio.min.toFixed(2)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-50/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600">IPCA (Inflação)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acumulado</span>
                  <span className="font-semibold text-orange-600">{stats.ipca.accum.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">vs Carteira</span>
                  <span className={`font-semibold ${stats.portfolio.accum > stats.ipca.accum ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.portfolio.accum - stats.ipca.accum).toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/30 bg-red-50/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">SELIC</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acumulado</span>
                  <span className="font-semibold text-red-600">{stats.selic.accum.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">vs Carteira</span>
                  <span className={`font-semibold ${stats.portfolio.accum > stats.selic.accum ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.portfolio.accum - stats.selic.accum).toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/30 bg-cyan-50/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-cyan-600">CDI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acumulado</span>
                  <span className="font-semibold text-cyan-600">{stats.cdi.accum.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">vs Carteira</span>
                  <span className={`font-semibold ${stats.portfolio.accum > stats.cdi.accum ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.portfolio.accum - stats.cdi.accum).toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

         
        </CardContent>
      </Card>
    </div>
  );
}

function calculatePortfolioMonthlyReturn(
  history: Array<any>
): Array<{ date: string; value: number }> {
  if (!history || history.length === 0) return [];

  const result: Array<{ date: string; value: number }> = [];
  const firstValue = history[0].value;

  history.forEach((entry) => {
    if (firstValue > 0) {
      const accumulatedReturn = ((entry.value - firstValue) / firstValue) * 100;
      result.push({
        date: entry.month,
        value: accumulatedReturn,
      });
    }
  });

  return result;
}
