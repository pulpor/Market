import { useState, useEffect } from "react";
import { ArrowRightLeft, DollarSign, Euro, Bitcoin, RefreshCw, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

type Currency = "BRL" | "USD" | "EUR" | "BTC";

const CURRENCIES: { value: Currency; label: string; icon: React.ReactNode }[] = [
    { value: "BRL", label: "Real Brasileiro", icon: <span className="font-bold text-xs">R$</span> },
    { value: "USD", label: "Dólar Americano", icon: <DollarSign className="h-4 w-4" /> },
    { value: "EUR", label: "Euro", icon: <Euro className="h-4 w-4" /> },
    { value: "BTC", label: "Bitcoin", icon: <Bitcoin className="h-4 w-4" /> },
];

export function CurrencyConverter() {
    const [amount, setAmount] = useState<string>("100");
    const [fromCurrency, setFromCurrency] = useState<Currency>("BRL");
    const [toCurrency, setToCurrency] = useState<Currency>("USD");
    const [rates, setRates] = useState<Record<string, number>>({ BRL: 1 });
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchRates = async () => {
        setLoading(true);
        try {
            // Busca cotações em relação ao BRL
            const response = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL");
            const data = await response.json();

            // AwesomeAPI retorna formato: { USDBRL: { ask: "5.00", ... }, ... }
            // A cotação 'ask' é o preço de venda (quanto custa comprar a moeda)

            const newRates: Record<string, number> = {
                BRL: 1,
                USD: parseFloat(data.USDBRL.ask),
                EUR: parseFloat(data.EURBRL.ask),
                BTC: parseFloat(data.BTCBRL.ask),
            };

            setRates(newRates);
            setLastUpdate(new Date());

            toast({
                title: "Cotações atualizadas",
                description: "Valores obtidos em tempo real.",
                variant: "default",
            });
        } catch (error) {
            console.error("Erro ao buscar cotações", error);
            toast({
                title: "Erro na atualização",
                description: "Não foi possível buscar as cotações mais recentes.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
        // Atualiza a cada 5 minutos
        const interval = setInterval(fetchRates, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleSwap = () => {
        setFromCurrency(toCurrency);
        setToCurrency(fromCurrency);
    };

    const calculateConversion = () => {
        const val = parseFloat(amount.replace(",", "."));
        if (isNaN(val)) return 0;

        const rateFrom = rates[fromCurrency]; // Ex: USD = 5.0 (1 USD vale 5 BRL)
        const rateTo = rates[toCurrency];     // Ex: BRL = 1.0

        // Converte para BRL primeiro: Valor * TaxaOrigem
        // Ex: 100 USD * 5.0 = 500 BRL
        const valueInBRL = val * rateFrom;

        // Converte de BRL para Destino: ValorBRL / TaxaDestino
        // Ex: 500 BRL / 1 = 500 BRL
        // Ex2: 500 BRL / 5.0 (USD) = 100 USD
        return valueInBRL / rateTo;
    };

    const convertedValue = calculateConversion();

    return (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Conversor de Moedas
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchRates}
                    disabled={loading}
                    title="Atualizar cotações"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                {/* Origem */}
                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">De</label>
                        <Select value={fromCurrency} onValueChange={(v) => setFromCurrency(v as Currency)}>
                            <SelectTrigger className="w-full bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 flex justify-center">{c.icon}</div>
                                            <span>{c.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">Quantia</label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="text-lg font-bold bg-background"
                        />
                    </div>
                </div>

                {/* Botão de Troca */}
                <div className="flex justify-center">
                    <Button variant="ghost" size="icon" onClick={handleSwap} className="rounded-full hover:bg-primary/10">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                    </Button>
                </div>

                {/* Destino */}
                <div className="space-y-4 bg-muted/50 p-4 rounded-lg border border-primary/20">
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">Para</label>
                        <Select value={toCurrency} onValueChange={(v) => setToCurrency(v as Currency)}>
                            <SelectTrigger className="w-full bg-background border-primary/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 flex justify-center">{c.icon}</div>
                                            <span>{c.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">Resultado Estimado</label>
                        <div className="h-10 flex items-center px-3 rounded-md border border-primary/20 bg-background text-lg font-bold text-primary">
                            {convertedValue.toLocaleString('pt-BR', {
                                minimumFractionDigits: toCurrency === 'BTC' ? 8 : 2,
                                maximumFractionDigits: toCurrency === 'BTC' ? 8 : 2
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                    Taxa utilizada: 1 {fromCurrency} = {(rates[fromCurrency] / rates[toCurrency]).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {toCurrency}
                    {lastUpdate && ` • Atualizado em ${lastUpdate.toLocaleTimeString()}`}
                </p>
            </div>
        </div>
    );
}
