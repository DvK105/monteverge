'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { StocksApiResponse, StockSeries, TATA_TICKERS } from '@/lib/types/stock';
import { StockCard } from './StockCard';
import { StockDetailPanel } from './StockDetailPanel';
import { DefenseModal } from '../defense/DefenseModal';
import { MathTraceDrawer } from '../dashboard/MathTraceDrawer';
import { Database, Wifi, ShieldCheck } from 'lucide-react';

interface UniverseOverviewProps {
  initialData: StocksApiResponse;
}

export const UniverseOverview: React.FC<UniverseOverviewProps> = ({ initialData }) => {
  const [data, setData] = useState<StocksApiResponse>(initialData);
  const [selectedStock, setSelectedStock] = useState<StockSeries | null>(
    initialData.stocks[TATA_TICKERS[0]] || null
  );
  const [defenseOpen, setDefenseOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Background fetch to live endpoint
  useEffect(() => {
    let isMounted = true;
    async function fetchUniverse() {
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const json: StocksApiResponse = await res.json();
          if (isMounted && json && json.stocks) {
            startTransition(() => {
              setData(json);
              setSelectedStock((current) => (
                current ? json.stocks[current.ticker] || null : json.stocks[TATA_TICKERS[0]] || null
              ));
            });
          }
        }
      } catch {
        // Fallback already operational
      }
    }

    fetchUniverse();
    return () => {
      isMounted = false;
    };
  }, []);

  const latestGroupIndex = data.groupIndex.values.length > 0
    ? data.groupIndex.values[data.groupIndex.values.length - 1]
    : 7.215;

  const handleSelectStock = (stock: StockSeries) => {
    setSelectedStock(stock);
  };

  const isLive = data.source === 'live';

  return (
    <div className="min-h-dvh w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 overflow-visible">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              MonteVerge
            </h1>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Tata Group
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Continuous Ornstein-Uhlenbeck stochastic spread modeling & mean-reversion analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-mono">
            {isLive ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">Feed:</span>
            <span className={isLive ? 'text-emerald-400' : 'text-foreground font-medium'}>
              {isLive ? 'Live' : 'Cached'}
            </span>
          </div>

          <button
            onClick={() => setDefenseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Theory</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-[36rem] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-8">
        <section className="flex min-h-[36rem] flex-col gap-4">
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.12em]">Universe constituents</span>
            <span>Select a name to inspect</span>
          </div>

          <div className="grid min-h-[33rem] flex-1 grid-cols-2 grid-rows-3 gap-3 sm:grid-cols-3 sm:grid-rows-2">
            {data.tickers.map((ticker) => {
              const stock = data.stocks[ticker];
              if (!stock) return null;
              const isSelected = selectedStock?.ticker === ticker;

              return (
                <StockCard
                  key={ticker}
                  stock={stock}
                  isSelected={isSelected}
                  onSelect={handleSelectStock}
                  groupIndexValue={latestGroupIndex}
                />
              );
            })}
          </div>
        </section>

        <section className="min-h-[33rem]">
          <StockDetailPanel
            stock={selectedStock}
            groupIndex={data.groupIndex}
          />
        </section>
      </div>

      <section className="shrink-0">
        <MathTraceDrawer stock={selectedStock} groupIndex={data.groupIndex} />
      </section>

      <DefenseModal isOpen={defenseOpen} onClose={() => setDefenseOpen(false)} />
    </div>
  );
};
