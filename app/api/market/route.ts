const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooChartResult = {
  meta?: {
    currency?: string;
    exchangeName?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    previousClose?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol")?.trim().toUpperCase();
  const timeframe = params.get("timeframe") ?? "1D";
  const chartSettings: Record<string, { range: string; interval: string }> = {
    "1D": { range: "1d", interval: "1m" },
    "5D": { range: "5d", interval: "5m" },
    "1M": { range: "1mo", interval: "30m" },
    "1Y": { range: "1y", interval: "1d" },
  };
  const settings = chartSettings[timeframe];

  if (!symbol || !/^[A-Z0-9^=.-]{1,20}$/.test(symbol)) {
    return fail("Enter a valid ticker symbol.", 400);
  }
  if (!settings) return fail("Choose a supported chart timeframe.", 400);

  try {
    const response = await fetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${settings.range}&interval=${settings.interval}&includePrePost=false`,
      {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 Monteverge/1.0" },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      return fail(`Yahoo Finance returned ${response.status} for ${symbol}.`, 502);
    }

    const payload = (await response.json()) as {
      chart?: { result?: YahooChartResult[] | null; error?: { description?: string } | null };
    };
    const chart = payload.chart;
    const result = chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];

    if (chart?.error || !result || !quote) {
      return fail(chart?.error?.description ?? `No market data found for ${symbol}.`, 404);
    }

    const candles = (result.timestamp ?? [])
      .map((time, index) => ({
        time,
        open: quote.open?.[index] ?? null,
        high: quote.high?.[index] ?? null,
        low: quote.low?.[index] ?? null,
        close: quote.close?.[index] ?? null,
        volume: quote.volume?.[index] ?? null,
      }))
      .filter(
        (candle) =>
          candle.open !== null &&
          candle.high !== null &&
          candle.low !== null &&
          candle.close !== null,
      );

    if (candles.length === 0) {
      return fail(`Yahoo Finance has no intraday candles for ${symbol} right now.`, 404);
    }

    return Response.json(
      {
        symbol,
        currency: result.meta?.currency ?? "USD",
        exchange: result.meta?.exchangeName ?? "Market",
        price: result.meta?.regularMarketPrice ?? candles.at(-1)?.close,
        previousClose: result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null,
        marketTime: result.meta?.regularMarketTime ?? candles.at(-1)?.time ?? null,
        candles,
        fetchedAt: Date.now(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Yahoo Finance timed out. Try refreshing in a moment."
      : "Could not reach Yahoo Finance. Try again in a moment.";
    return fail(message, 502);
  }
}
