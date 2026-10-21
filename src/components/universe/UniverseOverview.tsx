'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { StocksApiResponse, StockSeries, TATA_TICKERS } from '@/lib/types/stock';
import { StockCard } from './StockCard';
import { StockDetailPanel } from './StockDetailPanel';
import { MonteCarloTrigger } from './MonteCarloTrigger';
import { DefenseModal } from '../defense/DefenseModal';
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
              if (selectedStock) {
                setSelectedStock(json.stocks[selectedStock.ticker] || null);
              }
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
    <div className="h-full w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 overflow-hidden">
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

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3 overflow-hidden">
        <section className="min-h-0 flex flex-col gap-2 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Universe Constituents</span>
            <span>Click a card to inspect</span>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-2 md:grid-cols-3 grid-rows-3 md:grid-rows-2 gap-2">
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

        <section className="min-h-0 overflow-hidden">
          <StockDetailPanel
            stock={selectedStock}
            groupIndex={data.groupIndex}
          />
        </section>
      </div>

      <section className="shrink-0">
        <MonteCarloTrigger />
      </section>

      <DefenseModal isOpen={defenseOpen} onClose={() => setDefenseOpen(false)} />
    </div>
  );
};
