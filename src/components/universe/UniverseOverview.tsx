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
    if (selectedStock?.ticker === stock.ticker) {
      setSelectedStock(null);
    } else {
      setSelectedStock(stock);
    }
  };

  const isLive = data.source === 'live';

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* 1. Simple, Clean Dark Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
              MonteVerge
            </h1>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Tata Group
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Continuous Ornstein-Uhlenbeck stochastic spread modeling & mean-reversion analysis.
          </p>
        </div>

        {/* Status Pill & Defense Action */}
        <div className="flex items-center gap-3">
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

      {/* 2. Stock Universe Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Universe Constituents</span>
          <span>Click a card to inspect</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* 3. Detail View Panel (when selected) */}
      {selectedStock && (
        <section className="pt-2">
          <StockDetailPanel
            stock={selectedStock}
            groupIndex={data.groupIndex}
            onClose={() => setSelectedStock(null)}
          />
        </section>
      )}

      {/* 4. Simple Monte Carlo Simulation Trigger */}
      <section className="pt-4">
        <MonteCarloTrigger />
      </section>

      {/* 5. Defense / Math Derivations Modal */}
      <DefenseModal isOpen={defenseOpen} onClose={() => setDefenseOpen(false)} />
    </div>
  );
};
