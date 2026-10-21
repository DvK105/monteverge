'use client';

import React, { useMemo } from 'react';
import { StockSeries, GroupIndexData } from '@/lib/types/stock';
import { formatINR, formatIntegerINR } from '@/lib/utils/format';
import { Activity, Clock, BarChart2 } from 'lucide-react';

interface StockDetailPanelProps {
  stock: StockSeries | null;
  groupIndex: GroupIndexData;
}

export const StockDetailPanel: React.FC<StockDetailPanelProps> = ({
  stock,
  groupIndex,
}) => {
  const trajectoryPoints = useMemo(() => {
    if (!stock) return null;

    const history = stock.history;
    const len = Math.min(history.length, groupIndex.values.length);
    if (len < 5) return null;

    const step = Math.max(1, Math.floor(len / 60));
    const sampledStockLogs: number[] = [];
    const sampledIndexLogs: number[] = [];

    for (let i = 0; i < len; i += step) {
      sampledStockLogs.push(Math.log(history[i].close));
      sampledIndexLogs.push(groupIndex.values[i]);
    }

    const allVals = [...sampledStockLogs, ...sampledIndexLogs];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const span = Math.max(0.01, maxVal - minVal);

    const width = 640;
    const height = 120;
    const pad = 8;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const toSvgY = (v: number) => Number((pad + h - ((v - minVal) / span) * h).toFixed(1));
    const toSvgX = (idx: number) => Number((pad + (idx / (sampledStockLogs.length - 1)) * w).toFixed(1));

    const stockPath = sampledStockLogs.reduce((acc, v, i) => {
      const x = toSvgX(i);
      const y = toSvgY(v);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');

    const indexPath = sampledIndexLogs.reduce((acc, v, i) => {
      const x = toSvgX(i);
      const y = toSvgY(v);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');

    return { stockPath, indexPath, width, height };
  }, [stock, groupIndex]);

  if (!stock) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Select a constituent to inspect
      </div>
    );
  }

  const theta = stock.thetaEst || 0.16;
  const halfLife = (Math.log(2) / theta).toFixed(1);
  const volAnnual = stock.volatilityEst || 18.4;
  const low52 = stock.low52w || Math.round(stock.currentPrice * 0.78);
  const high52 = stock.high52w || Math.round(stock.currentPrice * 1.22);
  const rangeSpan = Math.max(1, high52 - low52);
  const rangePositionPercent = Math.min(100, Math.max(0, Math.round(((stock.currentPrice - low52) / rangeSpan) * 100)));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm select-none sm:gap-3 sm:p-4 xl:gap-4 xl:rounded-2xl xl:p-5">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary xl:px-2 xl:py-1 xl:text-[11px]">
              {stock.shortName}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground xl:text-[11px]">
              {stock.ticker}
            </span>
            <span className="truncate rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground xl:px-2 xl:py-1 xl:text-[11px]">
              {stock.sector}
            </span>
          </div>

          <h2 className="mt-1 truncate text-base font-medium tracking-tight text-foreground xl:mt-2 xl:text-lg">
            {stock.name}
          </h2>
        </div>

        <div className="text-right shrink-0">
          <span className="block font-mono text-[10px] uppercase text-muted-foreground xl:text-[11px]">
            LAST PRICE
          </span>
          <span
            suppressHydrationWarning
          className="whitespace-nowrap font-mono text-base font-medium tabular-nums text-foreground xl:text-lg"
          >
            ₹{formatINR(stock.currentPrice)}
          </span>
        </div>
      </div>

      <div className="flex min-h-24 flex-1 flex-col gap-1.5 rounded-xl border border-border bg-background p-2.5 sm:min-h-28 sm:p-3 xl:min-h-36 xl:gap-2 xl:p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 font-mono text-[10px] xl:text-[11px]">
          <span className="text-muted-foreground truncate">Log Price vs Benchmark</span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-primary rounded-full" />
              <span className="text-foreground">{stock.shortName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-muted-foreground rounded-full" />
              <span className="text-muted-foreground">Index</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {trajectoryPoints ? (
            <svg
              viewBox={`0 0 ${trajectoryPoints.width} ${trajectoryPoints.height}`}
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <path
                key={`${stock.ticker}-index`}
                d={trajectoryPoints.indexPath}
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground/60"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                suppressHydrationWarning
              />
              <path
                key={`${stock.ticker}-stock`}
                d={trajectoryPoints.stockPath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                className="apple-chart-line"
                suppressHydrationWarning
              />
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] font-mono text-muted-foreground xl:text-xs">
              Loading trajectory preview...
            </div>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:gap-2 xl:gap-3">
        <div className="rounded-lg border border-border bg-background p-2 sm:p-2.5 xl:rounded-xl xl:p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground xl:text-[11px]">
            <Clock className="h-3 w-3 text-primary" />
            <span>Mean-Reversion</span>
          </div>
          <div className="mt-0.5 font-mono text-xs font-medium text-foreground xl:text-sm">
            {halfLife} days
          </div>
          <div className="hidden font-mono text-[10px] text-muted-foreground xl:block">
            θ = {theta.toFixed(2)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-2 sm:p-2.5 xl:rounded-xl xl:p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground xl:text-[11px]">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span>Volatility</span>
          </div>
          <div className="mt-0.5 font-mono text-xs font-medium text-foreground xl:text-sm">
            {volAnnual}%
          </div>
          <div className="hidden font-mono text-[10px] text-muted-foreground xl:block">
            Annualized σ
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-2 sm:p-2.5 xl:rounded-xl xl:p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground xl:text-[11px]">
            <BarChart2 className="h-3 w-3 text-accent" />
            <span>24h Volume</span>
          </div>
          <div
            suppressHydrationWarning
            className="mt-0.5 font-mono text-xs font-medium text-foreground xl:text-sm"
          >
            {formatIntegerINR(stock.volume || 1500000)}
          </div>
          <div className="hidden font-mono text-[10px] text-muted-foreground xl:block">
            Shares Traded
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-2 sm:p-2.5 xl:rounded-xl xl:p-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground xl:text-[11px]">
            <span>52W Range</span>
            <span>{rangePositionPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${rangePositionPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1 xl:text-[11px]">
            <span suppressHydrationWarning>₹{formatIntegerINR(low52)}</span>
            <span suppressHydrationWarning>₹{formatIntegerINR(high52)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
