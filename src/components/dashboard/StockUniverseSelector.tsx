'use client';

import React from 'react';
import { StockSeries, TataTicker } from '@/lib/types/stock';
import { TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface StockUniverseSelectorProps {
  stocks: Record<string, StockSeries>;
  selectedTicker: TataTicker;
  onSelectTicker: (ticker: TataTicker) => void;
  groupIndexLatestValue?: number;
}

export const StockUniverseSelector: React.FC<StockUniverseSelectorProps> = ({
  stocks,
  selectedTicker,
  onSelectTicker,
  groupIndexLatestValue = 0,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <Layers className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
          <span>Tata Universe (NSE)</span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">N = 6 Equities</span>
      </div>

      <div className="space-y-1.5">
        {Object.values(stocks).map((stock) => {
          const isSelected = stock.ticker === selectedTicker;
          const isPositive = stock.change24h >= 0;
          const logSpread = groupIndexLatestValue > 0
            ? Math.log(stock.currentPrice) - groupIndexLatestValue
            : 0;
          const spreadPct = (logSpread * 100).toFixed(2);

          return (
            <button
              key={stock.ticker}
              onClick={() => onSelectTicker(stock.ticker as TataTicker)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'bg-[#131824] border-[var(--accent-primary)] shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                  : 'bg-[var(--bg-surface)] hover:bg-[#111724] border-[var(--border-default)]'
              }`}
            >
              {/* Active hardware side tab */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />
              )}

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {stock.shortName}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-base)] px-1 py-0.5 rounded border border-[#1E293B]">
                      {stock.ticker.replace('.NS', '')}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[130px] mt-0.5">
                    {stock.sector}
                  </p>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                    ₹{stock.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-medium ${
                      isPositive ? 'text-[var(--state-success)]' : 'text-[var(--state-error)]'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-2.5 w-2.5" strokeWidth={2} />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" strokeWidth={2} />
                    )}
                    <span>
                      {isPositive ? '+' : ''}
                      {stock.change24hPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Spread relative to Conglomerate Benchmark */}
              <div className="mt-2 pt-1.5 border-t border-[#1E293B]/60 flex items-center justify-between text-[10px] font-mono">
                <span className="text-[var(--text-muted)]">Spread vs Index:</span>
                <span
                  className={`font-semibold ${
                    logSpread > 0 ? 'text-cyan-400' : 'text-purple-400'
                  }`}
                >
                  {logSpread > 0 ? '+' : ''}
                  {spreadPct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
