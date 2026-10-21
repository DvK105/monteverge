import { StockSeries, StocksApiResponse, TATA_TICKERS } from '../types/stock';

interface TickerMeta {
  ticker: string;
  name: string;
  shortName: string;
  sector: string;
  basePrice: number;
  drift: number;
  vol: number;
  calibratedTheta: number;
}

const TATA_METADATA: Record<string, TickerMeta> = {
  'TCS.NS': {
    ticker: 'TCS.NS',
    name: 'Tata Consultancy Services Ltd',
    shortName: 'TCS',
    sector: 'Information Technology',
    basePrice: 4125.50,
    drift: 0.0003,
    vol: 0.012,
    calibratedTheta: 0.16,
  },
  'TATAMOTORS.NS': {
    ticker: 'TATAMOTORS.NS',
    name: 'Tata Motors Limited',
    shortName: 'Tata Motors',
    sector: 'Automotive / EV',
    basePrice: 968.20,
    drift: 0.0006,
    vol: 0.021,
    calibratedTheta: 0.24,
  },
  'TATASTEEL.NS': {
    ticker: 'TATASTEEL.NS',
    name: 'Tata Steel Limited',
    shortName: 'Tata Steel',
    sector: 'Metals & Mining',
    basePrice: 156.40,
    drift: 0.0002,
    vol: 0.019,
    calibratedTheta: 0.19,
  },
  'TATAPOWER.NS': {
    ticker: 'TATAPOWER.NS',
    name: 'Tata Power Company Ltd',
    shortName: 'Tata Power',
    sector: 'Utilities & Renewables',
    basePrice: 424.80,
    drift: 0.0005,
    vol: 0.018,
    calibratedTheta: 0.21,
  },
  'TATACONSUM.NS': {
    ticker: 'TATACONSUM.NS',
    name: 'Tata Consumer Products Ltd',
    shortName: 'Tata Consumer',
    sector: 'Consumer Goods (FMCG)',
    basePrice: 1142.10,
    drift: 0.0004,
    vol: 0.014,
    calibratedTheta: 0.14,
  },
  'TITAN.NS': {
    ticker: 'TITAN.NS',
    name: 'Titan Company Limited',
    shortName: 'Titan Co',
    sector: 'Luxury Goods & Retail',
    basePrice: 3485.60,
    drift: 0.0005,
    vol: 0.016,
    calibratedTheta: 0.18,
  },
};

/**
 * Deterministically generates ~250 trading days of historical daily prices
 * with realistic co-movement, sector-level mean reversion, and calibrated volatility.
 */
function generateDeterministicHistory(): Record<string, StockSeries> {
  const tradingDays = 252;
  const startDate = new Date('2025-10-20T00:00:00Z');
  const timestamps: number[] = [];
  const dateStrings: string[] = [];

  let cur = new Date(startDate);
  cur.setDate(cur.getDate() - 365);
  while (dateStrings.length < tradingDays) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      timestamps.push(cur.getTime());
      dateStrings.push(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Common conglomerate co-movement factor
  const macroFactor: number[] = new Array(tradingDays).fill(0);
  let macroLevel = 0;
  for (let t = 0; t < tradingDays; t++) {
    const pseudoRand = Math.sin((t + 1) * 12.9898 + 78.233) * 43758.5453;
    const shock = (pseudoRand - Math.floor(pseudoRand) - 0.5) * 2;
    macroLevel = macroLevel * 0.96 + shock * 0.008;
    macroFactor[t] = macroLevel;
  }

  const result: Record<string, StockSeries> = {};

  for (const ticker of TATA_TICKERS) {
    const meta = TATA_METADATA[ticker];
    const history = [];
    let currentPrice = meta.basePrice * 0.88;

    for (let t = 0; t < tradingDays; t++) {
      const pseudoRand = Math.sin((t + 10) * (ticker.length * 17.13) + 31.41) * 43758.5453;
      const idiosyncraticShock = (pseudoRand - Math.floor(pseudoRand) - 0.5) * 2;
      const dailyReturn = meta.drift + macroFactor[t] * 0.5 + idiosyncraticShock * meta.vol;
      currentPrice = currentPrice * (1 + dailyReturn);
      const roundedPrice = Math.round(currentPrice * 100) / 100;

      history.push({
        date: dateStrings[t],
        timestamp: timestamps[t],
        close: roundedPrice,
        open: Math.round(roundedPrice * (1 - dailyReturn * 0.2) * 100) / 100,
        high: Math.round(roundedPrice * 1.008 * 100) / 100,
        low: Math.round(roundedPrice * 0.992 * 100) / 100,
        volume: Math.floor(1200000 + Math.abs(idiosyncraticShock) * 2400000),
      });
    }

    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    const change24h = Math.round((latest.close - prev.close) * 100) / 100;
    const change24hPercent = Math.round((change24h / prev.close) * 10000) / 100;

    const closes = history.map((h) => h.close);
    const high52w = Math.max(...closes);
    const low52w = Math.min(...closes);

    result[ticker] = {
      ticker: meta.ticker,
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
      volume: latest.volume || 1450000,
      thetaEst: meta.calibratedTheta,
      cointegrationPValue: 0.004,
    };
  }

  return result;
}

export function getFallbackStocksData(): StocksApiResponse {
  const stocks = generateDeterministicHistory();
  const sampleStock = stocks[TATA_TICKERS[0]];
  const dates = sampleStock.history.map((h) => h.date);
  const timestamps = sampleStock.history.map((h) => h.timestamp);

  // Synthesize group index I_t = (1/N) * sum(ln(P_i,t))
  const values: number[] = [];
  const N = TATA_TICKERS.length;

  for (let t = 0; t < dates.length; t++) {
    let sumLog = 0;
    for (const ticker of TATA_TICKERS) {
      const price = stocks[ticker].history[t].close;
      sumLog += Math.log(price);
    }
    values.push(sumLog / N);
  }

  // Calculate Z-Score & LogSpread relative to group benchmark
  for (const ticker of TATA_TICKERS) {
    const stock = stocks[ticker];
    const spreads: number[] = [];
    for (let t = 0; t < dates.length; t++) {
      spreads.push(Math.log(stock.history[t].close) - values[t]);
    }
    const latestSpread = spreads[spreads.length - 1];
    let meanSpread = 0;
    for (let i = 0; i < spreads.length; i++) meanSpread += spreads[i];
    meanSpread /= spreads.length;

    let varSum = 0;
    for (let i = 0; i < spreads.length; i++) {
      const d = spreads[i] - meanSpread;
      varSum += d * d;
    }
    const stdSpread = Math.sqrt(varSum / (spreads.length - 1));

    stock.logSpread = Math.round(latestSpread * 10000) / 10000;
    stock.zScore = Math.round(((latestSpread - meanSpread) / stdSpread) * 100) / 100;
    stock.volatilityEst = Math.round(stdSpread * Math.sqrt(252) * 1000) / 10;
  }

  return {
    stocks,
    tickers: [...TATA_TICKERS],
    source: 'offline_fallback',
    lastUpdated: '2025-10-20T15:30:00.000Z',
    queryBudget: {
      budgetMs: 1500,
      elapsedMs: 2,
      hitCache: true,
    },
    groupIndex: {
      dates,
      timestamps,
      values,
    },
  };
}
