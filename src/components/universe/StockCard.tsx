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
  style?: React.CSSProperties;
}

export const StockCard: React.FC<StockCardProps> = ({
  stock,
  isSelected,
  onSelect,
  groupIndexValue,
  style,
}) => {
  const isPositive = stock.change24h >= 0;
  const spread = stock.logSpread ?? (
    groupIndexValue > 0 ? Math.log(stock.currentPrice) - groupIndexValue : 0
  );
  const zScore = stock.zScore ?? (spread / 0.025);

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(stock)}
      style={style}
      className={`stock-card apple-reveal apple-interactive group flex h-full min-h-0 w-full flex-col justify-between overflow-hidden rounded-xl border bg-card p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:rounded-2xl xl:p-4 ${
        isSelected
          ? 'border-primary/70 bg-primary/[0.035] ring-1 ring-primary/40 shadow-lg shadow-primary/5'
          : 'border-border hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-black/20'
      }`}
    >
      <div className="stock-card__identity min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary xl:px-2 xl:py-1 xl:text-[11px]">
              {stock.shortName}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground xl:text-[11px]">
              {stock.ticker}
            </span>
          </div>

          <span className="stock-card__sector hidden max-w-24 shrink-0 truncate rounded-full bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground xl:inline-flex xl:max-w-28 xl:text-[11px]">
            {stock.sector}
          </span>
        </div>

        <h3 className="stock-card__name mt-1 truncate text-xs font-medium tracking-tight text-foreground xl:mt-2 xl:text-sm">
          {stock.name}
        </h3>
      </div>

      <div className="stock-card__middle my-1 flex flex-wrap items-baseline justify-between gap-x-1 gap-y-1 xl:my-2 xl:gap-x-2">
        <div
          suppressHydrationWarning
          className="stock-card__price whitespace-nowrap font-mono text-base font-medium tabular-nums tracking-tight text-foreground xl:text-xl"
        >
          ₹{formatINR(stock.currentPrice)}
        </div>

        <div
          className={`stock-card__change inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-mono text-[10px] font-medium xl:gap-1.5 xl:px-2 xl:py-1.5 xl:text-[11px] ${
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

      <div className="stock-card__spread flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 border-t border-border pt-1.5 font-mono text-[10px] xl:gap-x-2 xl:pt-2 xl:text-[11px]">
        <div className="text-muted-foreground">
          <span className="stock-card__spread-label">Spread z:</span>{' '}
          <span className="text-foreground font-medium">
            {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}σ
          </span>
        </div>

        <div className="stock-card__detail flex items-center gap-1 text-[10px] text-muted-foreground transition-colors group-hover:text-primary xl:gap-1.5 xl:text-[11px]">
          <span>{isSelected ? 'Selected' : 'Details'}</span>
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
};
