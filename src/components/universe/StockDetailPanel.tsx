'use client';

import React, { useMemo } from 'react';
import { StockSeries, GroupIndexData } from '@/lib/types/stock';
import { formatINR, formatIntegerINR } from '@/lib/utils/format';
import { X, Activity, Clock, BarChart2 } from 'lucide-react';

interface StockDetailPanelProps {
  stock: StockSeries | null;
  groupIndex: GroupIndexData;
  onClose: () => void;
}

export const StockDetailPanel: React.FC<StockDetailPanelProps> = ({
  stock,
  groupIndex,
  onClose,
}) => {
  if (!stock) return null;

  const theta = stock.thetaEst || 0.16;
  const halfLife = (Math.log(2) / theta).toFixed(1);
  const volAnnual = stock.volatilityEst || 18.4;
  const low52 = stock.low52w || Math.round(stock.currentPrice * 0.78);
  const high52 = stock.high52w || Math.round(stock.currentPrice * 1.22);
  const rangeSpan = Math.max(1, high52 - low52);
  const rangePositionPercent = Math.min(100, Math.max(0, Math.round(((stock.currentPrice - low52) / rangeSpan) * 100)));

  // Build SVG path for log price vs group benchmark index
  const trajectoryPoints = useMemo(() => {
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
    const height = 160;
    const pad = 12;
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

  return (
    <div className="p-6 md:p-8 rounded-2xl bg-card border border-border shadow-lg space-y-6 select-none transition-all">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary px-2 py-0.5 rounded bg-muted/60 border border-border">
              {stock.shortName}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {stock.ticker}
            </span>
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/40">
              {stock.sector}
            </span>
          </div>

          <h2 className="text-xl font-medium text-foreground tracking-tight mt-1">
            {stock.name}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              Quote
            </span>
            <span
              suppressHydrationWarning
              className="text-xl font-mono font-medium text-foreground"
            >
              ₹{formatINR(stock.currentPrice)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Trajectory Vector Curve */}
      <div className="p-4 rounded-xl bg-background border border-border space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-muted-foreground">Log Price Trajectory vs. Benchmark Index</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-primary rounded-full" />
              <span className="text-foreground">{stock.shortName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-muted-foreground rounded-full border-dashed" />
              <span className="text-muted-foreground">Benchmark</span>
            </div>
          </div>
        </div>

        <div className="w-full h-36 overflow-hidden flex items-center justify-center">
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
            <div className="text-xs font-mono text-muted-foreground">Loading trajectory preview...</div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Mean-Reversion</span>
          </div>
          <div className="text-lg font-mono font-medium text-foreground">
            {halfLife} days
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            θ = {theta.toFixed(2)}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Volatility</span>
          </div>
          <div className="text-lg font-mono font-medium text-foreground">
            {volAnnual}%
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Annualized σ
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3.5 w-3.5 text-accent" />
            <span>24h Volume</span>
          </div>
          <div
            suppressHydrationWarning
            className="text-lg font-mono font-medium text-foreground"
          >
            {formatIntegerINR(stock.volume || 1500000)}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Shares Traded
          </div>
        </div>

        {/* Metric 4: 52-Week Range */}
        <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>52W Range</span>
            <span>{rangePositionPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${rangePositionPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span suppressHydrationWarning>₹{formatIntegerINR(low52)}</span>
            <span suppressHydrationWarning>₹{formatIntegerINR(high52)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
