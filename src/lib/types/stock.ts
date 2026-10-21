export interface StockDataPoint {
  date: string;
  timestamp: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface StockSeries {
  ticker: string;
  name: string;
  shortName: string;
  sector: string;
  weight: number;
  currentPrice: number;
  change24h: number;
  change24hPercent: number;
  currency: string;
  history: StockDataPoint[];
  high52w?: number;
  low52w?: number;
  volume?: number;
  zScore?: number;
  logSpread?: number;
  thetaEst?: number;
  volatilityEst?: number;
  cointegrationPValue?: number;
}

export interface GroupIndexData {
  dates: string[];
  timestamps: number[];
  values: number[]; // Synthesized log benchmark: I_t = (1/N) * sum(ln(P_i,t))
}

export interface StocksApiResponse {
  stocks: Record<string, StockSeries>;
  tickers: string[];
  source: 'live' | 'cache' | 'offline_fallback';
  lastUpdated: string;
  groupIndex: GroupIndexData;
  queryBudget?: {
    budgetMs: number;
    elapsedMs: number;
    hitCache: boolean;
  };
  error?: string;
}

export const TATA_TICKERS = [
  'TCS.NS',
  'TATAMOTORS.NS',
  'TATASTEEL.NS',
  'TATAPOWER.NS',
  'TATACONSUM.NS',
  'TITAN.NS',
] as const;

export type TataTicker = typeof TATA_TICKERS[number];
