'use client';

import React from 'react';
import { StockSeries } from '@/lib/types/stock';
import { formatINR } from '@/lib/utils/format';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';

interface StockCardProps {
  stock: StockSeries;
  isSelected: boolean;
  onSelect: (stock: StockSeries) => void;
  groupIndexValue: number;
}

export const StockCard: React.FC<StockCardProps> = ({
  stock,
  isSelected,
  onSelect,
  groupIndexValue,
}) => {
  const isPositive = stock.change24h >= 0;
  const spread = stock.logSpread ?? (
    groupIndexValue > 0 ? Math.log(stock.currentPrice) - groupIndexValue : 0
  );
  const zScore = stock.zScore ?? (spread / 0.025);

  return (
    <div
      onClick={() => onSelect(stock)}
      className={`group p-5 rounded-xl bg-card border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
        isSelected
          ? 'border-primary ring-1 ring-primary'
          : 'border-border hover:border-muted-foreground/50'
      }`}
    >
      {/* Top Header: Symbol & Sector */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary px-2 py-0.5 rounded bg-muted/60 border border-border">
              {stock.shortName}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {stock.ticker}
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/40">
            {stock.sector}
          </span>
        </div>

        <h3 className="text-sm font-medium text-foreground mt-2 truncate">
          {stock.name}
        </h3>
      </div>

      {/* Main Quote */}
      <div className="my-5 flex items-baseline justify-between gap-3">
        <div
          suppressHydrationWarning
          className="text-2xl font-mono font-medium tracking-tight text-foreground"
        >
          ₹{formatINR(stock.currentPrice)}
        </div>

        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {isPositive ? '+' : ''}
            {stock.change24hPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Footer Metrics: Z-Score & Inspect */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
        <div className="text-muted-foreground">
          <span>Spread z: </span>
          <span className="text-foreground font-medium">
            {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}σ
          </span>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors text-[11px]">
          <span>{isSelected ? 'Selected' : 'Details'}</span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
};
