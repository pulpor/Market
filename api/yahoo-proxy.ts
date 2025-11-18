export const config = {
  runtime: 'edge',
};

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: {
      code: string;
      description: string;
    };
  };
}

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Missing symbol parameter' }),
        { status: 400, headers }
      );
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data: YahooChartResponse = await response.json();

    if (data.chart?.error) {
      return new Response(
        JSON.stringify({ error: data.chart.error.description }),
        { status: 400, headers }
      );
    }

    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) {
      return new Response(
        JSON.stringify({ error: 'No data available' }),
        { status: 404, headers }
      );
    }

    return new Response(
      JSON.stringify({
        price: meta.regularMarketPrice ?? null,
        prevClose: meta.previousClose ?? null,
        timestamp: meta.regularMarketTime ?? null,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Yahoo proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers }
    );
  }
}
