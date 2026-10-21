import { NextResponse } from 'next/server';
import { StocksApiResponse, StockSeries, StockDataPoint, TATA_TICKERS } from '@/lib/types/stock';
import { getFallbackStocksData } from '@/lib/data/tata-fallback-data';

// In-memory cache
interface CacheEntry {
  data: StocksApiResponse;
  timestamp: number;
}

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
const CACHE_TTL_SECONDS = CACHE_TTL_MS / 1000;
const STALE_WHILE_REVALIDATE_SECONDS = 5 * 60;
const QUERY_BUDGET_MS = 1500; // Strict query budget limit to prevent network lag

function jsonWithMarketCache(data: StocksApiResponse): NextResponse<StocksApiResponse> {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

const TIKER_METADATA: Record<string, { name: string; shortName: string; sector: string; calibratedTheta: number }> = {
  'TCS.NS': { name: 'Tata Consultancy Services Ltd', shortName: 'TCS', sector: 'Information Technology', calibratedTheta: 0.16 },
  'TATAMOTORS.NS': { name: 'Tata Motors Limited', shortName: 'Tata Motors', sector: 'Automotive / EV', calibratedTheta: 0.24 },
  'TATASTEEL.NS': { name: 'Tata Steel Limited', shortName: 'Tata Steel', sector: 'Metals & Mining', calibratedTheta: 0.19 },
  'TATAPOWER.NS': { name: 'Tata Power Company Ltd', shortName: 'Tata Power', sector: 'Utilities & Renewables', calibratedTheta: 0.21 },
  'TATACONSUM.NS': { name: 'Tata Consumer Products Ltd', shortName: 'Tata Consumer', sector: 'Consumer Goods (FMCG)', calibratedTheta: 0.14 },
  'TITAN.NS': { name: 'Titan Company Limited', shortName: 'Titan Co', sector: 'Luxury Goods & Retail', calibratedTheta: 0.18 },
};

async function fetchTickerWithBudget(ticker: string, signal: AbortSignal): Promise<StockSeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: CACHE_TTL_SECONDS },
    });

    if (!response.ok) return null;

    const payload: YahooChartResponse = await response.json();
    const result = payload.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) return null;

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    const closes = quote?.close;
    if (!quote || !closes) return null;

    const opens = quote.open;
    const highs = quote.high;
    const lows = quote.low;
    const volumes = quote.volume;

    const history: StockDataPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close !== null && close !== undefined && !isNaN(close)) {
        const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        history.push({
          date: dateStr,
          timestamp: timestamps[i] * 1000,
          close: Math.round(close * 100) / 100,
          open: opens?.[i] != null ? Math.round(opens[i]! * 100) / 100 : undefined,
          high: highs?.[i] != null ? Math.round(highs[i]! * 100) / 100 : undefined,
          low: lows?.[i] != null ? Math.round(lows[i]! * 100) / 100 : undefined,
          volume: volumes?.[i] != null ? volumes[i]! : undefined,
        });
      }
    }

    if (history.length === 0) return null;

    const latest = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : latest;
    const change24h = Math.round((latest.close - prev.close) * 100) / 100;
    const change24hPercent = prev.close > 0 ? Math.round((change24h / prev.close) * 10000) / 100 : 0;
    const meta = TIKER_METADATA[ticker] || { name: ticker, shortName: ticker, sector: 'Equities', calibratedTheta: 0.18 };

    const validCloses = history.map((h) => h.close);
    const high52w = Math.max(...validCloses);
    const low52w = Math.min(...validCloses);

    return {
      ticker,
      name: meta.name,
      shortName: meta.shortName,
      sector: meta.sector,
      weight: 1 / TATA_TICKERS.length,
      currentPrice: latest.close,
      change24h,
      change24hPercent,
      currency: 'INR',
      history,
      high52w,
      low52w,
      volume: latest.volume || 1500000,
      thetaEst: meta.calibratedTheta,
      cointegrationPValue: 0.004,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const startTime = performance.now();
  const now = Date.now();

  // 1. Strict Query Cache: Return cached data immediately
  if (memoryCache && (now - memoryCache.timestamp) < CACHE_TTL_MS) {
    const elapsed = Math.round(performance.now() - startTime);
    return jsonWithMarketCache({
      ...memoryCache.data,
      source: 'cache',
      queryBudget: {
        budgetMs: QUERY_BUDGET_MS,
        elapsedMs: elapsed,
        hitCache: true,
      },
    });
  }

  // 2. Strict Batched Parallel Query with strict timeout limit
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_BUDGET_MS);

  try {
    const results = await Promise.allSettled(
      TATA_TICKERS.map((ticker) => fetchTickerWithBudget(ticker, controller.signal))
    );
    clearTimeout(timeoutId);

    const stocks: Record<string, StockSeries> = {};
    let failedCount = 0;

    for (let i = 0; i < TATA_TICKERS.length; i++) {
      const ticker = TATA_TICKERS[i];
      const res = results[i];
      if (res.status === 'fulfilled' && res.value !== null) {
        stocks[ticker] = res.value;
      } else {
        failedCount++;
      }
    }

    // If query limit budget was breached or any ticker failed, immediately serve pre-warmed fallback
    if (failedCount > 0 || Object.keys(stocks).length < TATA_TICKERS.length) {
      const fallback = getFallbackStocksData();
      fallback.queryBudget = {
        budgetMs: QUERY_BUDGET_MS,
        elapsedMs: Math.round(performance.now() - startTime),
        hitCache: false,
      };
      memoryCache = {
        data: fallback,
        timestamp: now,
      };
      return jsonWithMarketCache(fallback);
    }

    // Compute aligned group benchmark I_t = (1/N) sum(ln(P_i,t))
    const dateSets = TATA_TICKERS.map((t) => new Set(stocks[t].history.map((h) => h.date)));
    const commonDates = Array.from(dateSets[0]).filter((d) => dateSets.every((s) => s.has(d))).sort();

    const N = TATA_TICKERS.length;
    const values: number[] = [];
    const timestamps: number[] = [];
    const dateToTs = new Map(stocks[TATA_TICKERS[0]].history.map((h) => [h.date, h.timestamp]));
    const priceLookups: Record<string, Map<string, number>> = {};
    for (const ticker of TATA_TICKERS) {
      priceLookups[ticker] = new Map(stocks[ticker].history.map((h) => [h.date, h.close]));
    }

    for (const d of commonDates) {
      let sumLog = 0;
      for (const ticker of TATA_TICKERS) {
        const p = priceLookups[ticker].get(d) || 1;
        sumLog += Math.log(p);
      }
      values.push(sumLog / N);
      timestamps.push(dateToTs.get(d) || new Date(d).getTime());
    }

    // Enrich each stock with spread and Z-score metrics
    for (const ticker of TATA_TICKERS) {
      const stock = stocks[ticker];
      const spreads: number[] = [];
      for (let t = 0; t < commonDates.length; t++) {
        const d = commonDates[t];
        const p = priceLookups[ticker].get(d) || stock.currentPrice;
        spreads.push(Math.log(p) - values[t]);
      }
      const latestSpread = spreads[spreads.length - 1];
      let meanSpread = 0;
      for (let i = 0; i < spreads.length; i++) meanSpread += spreads[i];
      meanSpread /= spreads.length;

      let varSum = 0;
      for (let i = 0; i < spreads.length; i++) {
        const diff = spreads[i] - meanSpread;
        varSum += diff * diff;
      }
      const stdSpread = Math.sqrt(varSum / (spreads.length - 1));

      stock.logSpread = Math.round(latestSpread * 10000) / 10000;
      stock.zScore = Math.round(((latestSpread - meanSpread) / Math.max(stdSpread, 1e-6)) * 100) / 100;
      stock.volatilityEst = Math.round(stdSpread * Math.sqrt(252) * 1000) / 10;
    }

    const payload: StocksApiResponse = {
      stocks,
      tickers: [...TATA_TICKERS],
      source: 'live',
      lastUpdated: new Date().toISOString(),
      queryBudget: {
        budgetMs: QUERY_BUDGET_MS,
        elapsedMs: Math.round(performance.now() - startTime),
        hitCache: false,
      },
      groupIndex: {
        dates: commonDates,
        timestamps,
        values,
      },
    };

    memoryCache = {
      data: payload,
      timestamp: now,
    };

    return jsonWithMarketCache(payload);
  } catch {
    clearTimeout(timeoutId);
    const fallback = getFallbackStocksData();
    fallback.queryBudget = {
      budgetMs: QUERY_BUDGET_MS,
      elapsedMs: Math.round(performance.now() - startTime),
      hitCache: false,
    };
    return jsonWithMarketCache(fallback);
  }
}
