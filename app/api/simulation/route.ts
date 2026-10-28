const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const STOCKS = [
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "TMCV.NS", name: "Tata Motors" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel" },
  { symbol: "TATAPOWER.NS", name: "Tata Power" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products" },
  { symbol: "TITAN.NS", name: "Titan Company" },
] as const;

type YahooResult = {
  meta?: { currency?: string };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
};

async function fetchDailyCloses(symbol: string) {
  const response = await fetch(
    `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=history`,
    {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 Monteverge/1.0" },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`${symbol}: Yahoo Finance returned ${response.status}.`);
  const payload = (await response.json()) as {
    chart?: { result?: YahooResult[] | null; error?: { description?: string } | null };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (payload.chart?.error || !result || !quote) {
    throw new Error(payload.chart?.error?.description ?? `No daily data found for ${symbol}.`);
  }

  const closes = new Map<string, number>();
  (result.timestamp ?? []).forEach((timestamp, index) => {
    const close = quote.close?.[index];
    if (typeof close !== "number" || close <= 0) return;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(timestamp * 1000);
    closes.set(date, close);
  });
  return { currency: result.meta?.currency ?? "INR", closes };
}

export async function GET() {
  try {
    const symbols = [...STOCKS.map(({ symbol }) => symbol), "^NSEI"];
    const results = await Promise.all(symbols.map(fetchDailyCloses));
    const benchmark = results.at(-1);
    if (!benchmark) throw new Error("NIFTY 50 benchmark data is unavailable.");

    const stocks = STOCKS.map((stock, index) => {
      const series = results[index];
      if (!series) return { ...stock, currency: "INR", points: [] };
      const points = [...series.closes.entries()]
        .filter(([date]) => benchmark.closes.has(date))
        .map(([date, price]) => ({
          date,
          price,
          benchmark: benchmark.closes.get(date)!,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (points.length === 0) throw new Error(`No matching dates for ${stock.symbol} and NIFTY 50.`);
      return { ...stock, currency: series.currency, points };
    });

    return Response.json(
      { benchmark: "NIFTY 50", benchmarkSymbol: "^NSEI", fetchedAt: Date.now(), stocks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load market history.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
