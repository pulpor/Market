
export interface NewsItem {
  title: string;
  summary: string;
  fullText?: string;
  date?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedAsset: string;
  source?: string;
  url?: string;
}

async function fetchRSSNews(assets: string[]): Promise<any[]> {
  try {
    // Create a query string with assets
    // Limit to first 5 assets to avoid huge queries, or group them
    const queryAssets = assets.slice(0, 5).join(' OR ');
    const query = `${queryAssets} mercado financeiro`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    
    // Use local proxy to avoid CORS
    const proxyUrl = `/google-news/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) return [];
    
    const xmlText = await response.text();

    if (!xmlText) return [];

    // Parse XML in the browser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const items = Array.from(xmlDoc.querySelectorAll("item"));

    return items.map(item => {
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const descriptionRaw = item.querySelector("description")?.textContent || "";
      // Clean up description
      const description = descriptionRaw.replace(/<[^>]+>/g, '');

      return {
        title,
        link,
        pubDate,
        description
      };
    });

  } catch (error) {
    console.warn('Failed to fetch RSS news:', error);
    return [];
  }
}

export const fetchGeminiNews = async (assets: string[], apiKey: string): Promise<NewsItem[]> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  // 1. Fetch real news from RSS first
  const rssNews = await fetchRSSNews(assets);
  
  // Format RSS news for the prompt
  const newsContext = rssNews.slice(0, 15).map(item => 
    `- [${item.pubDate}] ${item.title}: ${item.description} (Link: ${item.link})`
  ).join('\n');

  const prompt = `
    Atue como um analista financeiro experiente.
    Eu tenho uma carteira de investimentos com os seguintes ativos: ${assets.join(', ')}.
    
    Abaixo estão as notícias MAIS RECENTES coletadas via RSS (Google News).
    Sua tarefa é analisar essas notícias, identificar o sentimento e formatar a resposta.
    
    NOTÍCIAS RECENTES (FONTE REAL):
    ${newsContext}
    
    INSTRUÇÕES:
    1. Use APENAS as notícias fornecidas acima como base. Não invente notícias.
    2. Se as notícias acima não forem suficientes ou relevantes para os ativos, você pode usar seu conhecimento interno APENAS se tiver certeza que é algo muito recente (últimos dias) ou um fato geral de mercado. Mas dê preferência total ao contexto fornecido.
    3. Analise o sentimento de cada notícia em relação ao ativo ou ao mercado.
    
    Retorne a resposta APENAS como um array JSON válido, sem formatação markdown (como \`\`\`json), seguindo exatamente esta estrutura para cada item:
    [
      {
        "title": "Título da notícia",
        "summary": "Resumo conciso da notícia",
        "fullText": "Análise breve do impacto desta notícia",
        "date": "Data da notícia (use a data fornecida no contexto ou a data de hoje se for fato geral)",
        "sentiment": "positive" | "negative" | "neutral",
        "relatedAsset": "Ticker do ativo relacionado (ex: PETR4) ou 'GERAL'",
        "source": "Fonte (ex: Google News / Veículo original)",
        "url": "Link original da notícia (se disponível no contexto)"
      }
    ]
    
    Se não houver notícias no contexto, retorne uma lista vazia ou 1-2 itens sobre o estado geral do mercado brasileiro (Ibovespa, Dólar) com base no seu conhecimento, mas deixe claro que é uma análise geral.
  `;

  // First, try to list available models to find a valid one
  let availableModelsList: string[] = [];
  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const models = listData.models || [];
      console.log('Available Gemini Models:', models.map((m: any) => m.name));
      
      // Filter for models that support generateContent
      availableModelsList = models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
    } else {
      console.warn('Failed to list models:', await listResponse.text());
    }
  } catch (e) {
    console.warn('Failed to list models, falling back to default', e);
  }

  // Prioritize models found in the list, then fallbacks
  // Put 1.5 Flash first as it is stable and has good limits
  const preferredOrder = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro', 
    'gemini-1.5-pro-latest',
    'gemini-1.0-pro',
    'gemini-pro'
  ];

  let modelsToTry: string[] = [];

  if (availableModelsList.length > 0) {
    // Sort available models by preference
    modelsToTry = availableModelsList.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      // If both are in preference list, sort by index
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only A is in list, A comes first
      if (indexA !== -1) return -1;
      // If only B is in list, B comes first
      if (indexB !== -1) return 1;
      // Otherwise keep original order (or maybe sort by version?)
      return 0;
    });
  } else {
    // Fallback if list failed
    modelsToTry = preferredOrder;
  }
  
  // Remove duplicates and filter out potentially problematic auto-detected models if needed
  const uniqueModels = [...new Set(modelsToTry)].filter(m => !m.includes('2.5') && m);
  
  console.log('Attempting models in order:', uniqueModels);

  let lastError: any;

  for (const model of uniqueModels) {
    // Helper to perform the fetch
    const performFetch = async () => {
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      
      // We are now providing context via prompt, so we don't strictly need tools.
      // Removing tools to save quota and avoid errors.

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.status === 429) {
        // Rate limit hit, wait a bit and throw specific error to handle retry or skip
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
        const errorData = await response.json();
        throw new Error(`RateLimit: ${JSON.stringify(errorData)}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      return response.json();
    };

    try {
      let data;
      
      try {
        data = await performFetch();
      } catch (fetchError: any) {
        if (fetchError.message.includes('RateLimit')) {
             console.warn(`Model ${model} hit rate limit.`);
             lastError = fetchError;
             // Add a delay before trying the next model to avoid cascading failures
             await new Promise(resolve => setTimeout(resolve, 2000));
             continue; 
        }
        throw fetchError;
      }

      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        continue; // Try next model if empty response
      }

      // Clean up markdown code blocks if present
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const items = JSON.parse(cleanJson);
      
      // Filter out old news (older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      return items.filter((item: any) => {
          if (!item.date) return true; // Keep if no date (model unsure)
          const itemDate = new Date(item.date);
          return itemDate > ninetyDaysAgo;
      });
    } catch (error) {
      console.error(`Error fetching Gemini news with ${model}:`, error);
      lastError = error;
      // Continue to next model
    }
  }

  throw new Error(lastError?.error?.message || lastError?.message || 'Failed to fetch from Gemini (all models failed)');
};
