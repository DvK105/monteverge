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
      <div className="h-full rounded-xl bg-card border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
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
    <div className="h-full min-h-0 p-3 rounded-xl bg-card border border-border shadow-sm flex flex-col gap-2.5 overflow-hidden select-none">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded bg-muted/60 border border-border">
              {stock.shortName}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {stock.ticker}
            </span>
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/40">
              {stock.sector}
            </span>
          </div>

          <h2 className="text-sm font-medium text-foreground tracking-tight mt-1 truncate">
            {stock.name}
          </h2>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono uppercase text-muted-foreground block">
            Quote
          </span>
          <span
            suppressHydrationWarning
            className="text-base font-mono font-medium text-foreground"
          >
            ₹{formatINR(stock.currentPrice)}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-2.5 rounded-lg bg-background border border-border flex flex-col gap-1.5">
        <div className="shrink-0 flex items-center justify-between text-[10px] font-mono gap-2">
          <span className="text-muted-foreground truncate">Log Price vs Benchmark</span>
          <div className="flex items-center gap-3 shrink-0">
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
                d={trajectoryPoints.indexPath}
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground/60"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                suppressHydrationWarning
              />
              <path
                d={trajectoryPoints.stockPath}
                fill="none"
                stroke="oklch(0.5676 0.2021 283.0838)"
                strokeWidth="2"
                suppressHydrationWarning
              />
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] font-mono text-muted-foreground">
              Loading trajectory preview...
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3 text-primary" />
            <span>Mean-Reversion</span>
          </div>
          <div className="text-sm font-mono font-medium text-foreground mt-0.5">
            {halfLife} days
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            θ = {theta.toFixed(2)}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span>Volatility</span>
          </div>
          <div className="text-sm font-mono font-medium text-foreground mt-0.5">
            {volAnnual}%
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            Annualized σ
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <BarChart2 className="h-3 w-3 text-accent" />
            <span>24h Volume</span>
          </div>
          <div
            suppressHydrationWarning
            className="text-sm font-mono font-medium text-foreground mt-0.5"
          >
            {formatIntegerINR(stock.volume || 1500000)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            Shares Traded
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background border border-border">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>52W Range</span>
            <span>{rangePositionPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${rangePositionPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
            <span suppressHydrationWarning>₹{formatIntegerINR(low52)}</span>
            <span suppressHydrationWarning>₹{formatIntegerINR(high52)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
