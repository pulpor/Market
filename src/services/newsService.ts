export interface NewsItem {
  title: string;
  summary: string;
  fullText?: string;
  date?: string;
  sortDate?: number; // numeric timestamp used for ordering
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedAsset: string;
  source?: string;
  url?: string;
}

export async function fetchRSSNews(assets: string[]): Promise<NewsItem[]> {
  try {
    // Create a query string with assets
    // Limit to first 8 assets to avoid huge queries
    const queryAssets = assets.slice(0, 8).join(' OR ');
    const query = `${queryAssets} ações mercado`;
    
    // Use local proxy to avoid CORS
    const proxyUrl = `/google-news/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      console.error('Failed to fetch news:', response.status);
      return [];
    }
    
    const xmlText = await response.text();

    if (!xmlText) return [];

    // Parse XML in the browser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const items = Array.from(xmlDoc.querySelectorAll("item"));

    const newsItems: NewsItem[] = items.map(item => {
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "";
      const pubDateStr = item.querySelector("pubDate")?.textContent || "";
      const descriptionRaw = item.querySelector("description")?.textContent || "";
      const sourceEl = item.querySelector("source");
      const source = sourceEl?.textContent || "Google News";
      
      // Clean up description and decode HTML entities
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = descriptionRaw;
      const description = (tempDiv.textContent || tempDiv.innerText || "").substring(0, 200);
      
      // Decode HTML entities in title
      const tempTitleDiv = document.createElement('div');
      tempTitleDiv.innerHTML = title;
      const decodedTitle = tempTitleDiv.textContent || tempTitleDiv.innerText || title;
      
      // Parse date
      let date = '';
      let sortDate = 0;
      if (pubDateStr) {
        try {
          const parsedDate = new Date(pubDateStr);
          const day = String(parsedDate.getDate()).padStart(2, '0');
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const year = parsedDate.getFullYear();
          date = `${day}/${month}/${year}`;
          const timestamp = parsedDate.getTime();
          sortDate = Number.isNaN(timestamp) ? Date.now() : timestamp;
        } catch {
          date = pubDateStr;
          sortDate = Date.now();
        }
      }

      // Try to determine related asset (simple keyword match)
      let relatedAsset = 'GERAL';
      for (const asset of assets) {
        const assetClean = asset.replace(/\d+$/, ''); // Remove numbers (PETR4 -> PETR)
        if (decodedTitle.toUpperCase().includes(assetClean.toUpperCase()) || 
            description.toUpperCase().includes(assetClean.toUpperCase())) {
          relatedAsset = asset;
          break;
        }
      }

      // Simple sentiment analysis based on keywords
      const text = (decodedTitle + ' ' + description).toLowerCase();
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      
      const positiveWords = ['sobe', 'alta', 'lucro', 'crescimento', 'valoriza', 'ganho', 'positivo', 'recorde', 'melhor'];
      const negativeWords = ['cai', 'queda', 'prejuízo', 'perda', 'desvaloriza', 'negativo', 'crise', 'pior'];
      
      const positiveCount = positiveWords.filter(word => text.includes(word)).length;
      const negativeCount = negativeWords.filter(word => text.includes(word)).length;
      
      if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount) sentiment = 'negative';

      return {
        title: decodedTitle,
        summary: description,
        fullText: description,
        date,
        sortDate,
        sentiment,
        relatedAsset,
        source,
        url: link
      };
    });

    // Order by newest first and limit to 10
    return newsItems
      .sort((a, b) => (b.sortDate ?? 0) - (a.sortDate ?? 0))
      .slice(0, 10);

  } catch (error) {
    console.error('Failed to fetch RSS news:', error);
    return [];
  }
}
