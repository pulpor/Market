
export interface NewsItem {
  title: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedAsset: string;
  source?: string;
  url?: string;
}

export const fetchGeminiNews = async (assets: string[], apiKey: string): Promise<NewsItem[]> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const prompt = `
    Atue como um analista financeiro experiente.
    Eu tenho uma carteira de investimentos com os seguintes ativos: ${assets.join(', ')}.
    
    Por favor, forneça as notícias mais recentes e previsões interessantes para esses ativos.
    Foque em fatos relevantes que possam impactar o preço ou os dividendos.
    
    Retorne a resposta APENAS como um array JSON válido, sem formatação markdown (como \`\`\`json), seguindo exatamente esta estrutura para cada item:
    [
      {
        "title": "Título curto da notícia ou previsão",
        "summary": "Resumo conciso (máximo 2 frases)",
        "sentiment": "positive" | "negative" | "neutral",
        "relatedAsset": "Ticker do ativo relacionado (ex: PETR4)",
        "source": "Fonte da informação (opcional)",
        "url": "Link para a notícia (opcional, se souber)"
      }
    ]
    
    Se não houver notícias relevantes recentes para algum ativo, ignore-o. Tente trazer pelo menos 3 a 5 itens no total.
  `;

  // First, try to list available models to find a valid one
  let targetModel = 'gemini-1.5-flash';
  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const availableModels = listData.models || [];
      // Find the best available model that supports generateContent
      const bestModel = availableModels.find((m: any) => 
        m.supportedGenerationMethods?.includes('generateContent') && 
        (m.name.includes('flash') || m.name.includes('pro'))
      );
      if (bestModel) {
        targetModel = bestModel.name.replace('models/', '');
        // console.log('Using auto-detected model:', targetModel);
      }
    }
  } catch (e) {
    console.warn('Failed to list models, falling back to default', e);
  }

  const modelsToTry = [targetModel, 'gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
  // Remove duplicates
  const uniqueModels = [...new Set(modelsToTry)];
  
  let lastError: any;

  for (const model of uniqueModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn(`Model ${model} failed:`, errorData);
        lastError = errorData;
        continue; // Try next model
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        return [];
      }

      // Clean up markdown code blocks if present, although we asked not to
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(`Error fetching Gemini news with ${model}:`, error);
      lastError = error;
    }
  }

  throw new Error(lastError?.error?.message || lastError?.message || 'Failed to fetch from Gemini (all models failed)');
};
