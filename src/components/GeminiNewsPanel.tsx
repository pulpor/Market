import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Newspaper, RefreshCw, ExternalLink, Calendar } from "lucide-react";
import { fetchRSSNews, NewsItem } from "@/services/newsService";
import { Asset } from "@/types/asset";
import { toast } from "@/hooks/use-toast";

interface GeminiNewsPanelProps {
  assets: Asset[];
}

const STORAGE_KEY = 'market_news_cache_v3'; // Version bump to clear old cached order

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
  
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);

  const loadNews = async () => {
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
      const uniqueTickers = Array.from(new Set(tickers));
      
      const items = await fetchRSSNews(uniqueTickers);
      setNews(items);
      
      const now = new Date().toLocaleString();
      setLastUpdated(now);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items,
        timestamp: now
      }));

      toast({
        title: "Notícias atualizadas",
        description: `${items.length} notícias carregadas com sucesso.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao carregar notícias",
        description: "Tente novamente mais tarde.",
        variant: "destructive"
      });
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
            <Newspaper className="h-5 w-5 text-blue-500" />
            <CardTitle>Notícias de Mercado</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadNews} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </div>
        <CardDescription>
          Notícias mais recentes sobre seus ativos via Google News.
          {lastUpdated && <span className="block text-xs mt-1 opacity-70">Última atualização: {lastUpdated}</span>}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        {news.length === 0 && !loading && (
          <div className="p-4 bg-muted/50 border-b">
            <p className="text-sm text-muted-foreground text-center">
              Clique em "Atualizar" para buscar as últimas notícias dos seus ativos.
            </p>
          </div>
        )}

        <ScrollArea className="h-[400px] p-4">
          {news.length === 0 && !loading ? (
            <div className="text-center text-muted-foreground py-8">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma notícia carregada.</p>
              <p className="text-sm">Clique em "Atualizar" para buscar notícias.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...news]
                .sort((a, b) => (b.sortDate ?? 0) - (a.sortDate ?? 0))
                .map((item, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedNews(item)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">
                        {item.relatedAsset}
                      </Badge>
                      <Badge className={`${getSentimentColor(item.sentiment)} text-white border-none`}>
                        {getSentimentLabel(item.sentiment)}
                      </Badge>
                    </div>
                    {item.date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.date}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  {item.source && (
                    <p className="text-xs text-muted-foreground mt-2 italic">Fonte: {item.source}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNews?.relatedAsset && (
                <Badge variant="outline">{selectedNews.relatedAsset}</Badge>
              )}
              {selectedNews?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNews?.date && (
                <span className="flex items-center gap-1 mt-1">
                  <Calendar className="h-3 w-3" /> {selectedNews.date}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sentimento:</span>
              <Badge className={`${selectedNews ? getSentimentColor(selectedNews.sentiment) : ''} text-white border-none`}>
                {selectedNews ? getSentimentLabel(selectedNews.sentiment) : ''}
              </Badge>
            </div>
            
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {selectedNews?.fullText || selectedNews?.summary}
            </div>
            
            {selectedNews?.source && (
              <p className="text-xs text-muted-foreground italic">
                Fonte: {selectedNews.source}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNews(null)}>
              Fechar
            </Button>
            <Button asChild>
              <a 
                href={selectedNews?.url || `https://www.google.com/search?q=${encodeURIComponent(`${selectedNews?.title} ${selectedNews?.source || ''}`)}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                {selectedNews?.url ? 'Ler na fonte' : 'Buscar fonte'} <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
