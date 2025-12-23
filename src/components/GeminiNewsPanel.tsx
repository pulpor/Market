import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, RefreshCw, Key, ExternalLink } from "lucide-react";
import { fetchGeminiNews, NewsItem } from "@/services/geminiService";
import { Asset } from "@/types/asset";
import { toast } from "@/hooks/use-toast";

interface GeminiNewsPanelProps {
  assets: Asset[];
}

const STORAGE_KEY = 'gemini_news_cache';

export function GeminiNewsPanel({ assets }: GeminiNewsPanelProps) {
  const [news, setNews] = useState<NewsItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached).items || [] : [];
    } catch { return []; }
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached).timestamp || null : null;
    } catch { return null; }
  });
  
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    if (key) setShowKeyInput(false);
  };

  const loadNews = async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    if (assets.length === 0) {
      toast({
        title: "Carteira vazia",
        description: "Adicione ativos à sua carteira para receber notícias.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const tickers = assets.map(a => a.ticker);
      // Limit to unique tickers to save tokens and avoid duplicates
      const uniqueTickers = Array.from(new Set(tickers));
      
      const items = await fetchGeminiNews(uniqueTickers, apiKey);
      setNews(items);
      
      const now = new Date().toLocaleString();
      setLastUpdated(now);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items,
        timestamp: now
      }));

      toast({
        title: "Notícias atualizadas",
        description: "As últimas novidades foram carregadas com sucesso.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao carregar notícias",
        description: "Verifique sua chave API ou tente novamente mais tarde.",
        variant: "destructive"
      });
      setShowKeyInput(true);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500 hover:bg-green-600';
      case 'negative': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'Positivo';
      case 'negative': return 'Negativo';
      default: return 'Neutro';
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle>Gemini Market Insights</CardTitle>
          </div>
          <div className="flex gap-2">
             <Button variant="ghost" size="icon" onClick={() => setShowKeyInput(!showKeyInput)} title="Configurar API Key">
              <Key className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={loadNews} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </div>
        <CardDescription>
          Notícias e previsões baseadas em IA para sua carteira.
          {lastUpdated && <span className="block text-xs mt-1 opacity-70">Última atualização: {lastUpdated}</span>}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        {showKeyInput && (
          <div className="p-4 bg-muted/50 border-b">
            <div className="flex gap-2">
              <Input 
                type="password" 
                placeholder="Cole sua Gemini API Key aqui..." 
                value={apiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
              />
              <Button onClick={() => { if(apiKey) { setShowKeyInput(false); loadNews(); } }}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sua chave é salva apenas no navegador localmente. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-primary">Obter chave gratuita</a>
            </p>
          </div>
        )}

        <ScrollArea className="h-[400px] p-4">
          {news.length === 0 && !loading ? (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma notícia carregada.</p>
              <p className="text-sm">Clique em "Atualizar" para gerar insights.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {news.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">
                        {item.relatedAsset}
                      </Badge>
                      <Badge className={`${getSentimentColor(item.sentiment)} text-white border-none`}>
                        {getSentimentLabel(item.sentiment)}
                      </Badge>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                  {item.source && (
                    <p className="text-xs text-muted-foreground mt-2 italic">Fonte: {item.source}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
