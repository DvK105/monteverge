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
  const [mobilePanel, setMobilePanel] = useState<'universe' | 'detail'>('universe');
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
    setMobilePanel('detail');
  };

  const isLive = data.source === 'live';

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1600px] flex-col gap-2 overflow-hidden px-3 py-3 sm:gap-3 sm:px-5 sm:py-4 xl:px-8 xl:py-5">
      <header className="apple-reveal flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-border pb-2.5 sm:pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-medium tracking-[-0.04em] text-foreground sm:text-3xl xl:text-4xl">
              MonteVerge
            </h1>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:px-3 sm:py-1.5 sm:text-xs">
              Tata Group
            </span>
          </div>
          <p className="mt-1 hidden max-w-2xl text-xs leading-relaxed text-muted-foreground sm:block sm:text-sm">
            Relative-value research across six Tata Group equities.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
          <div className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] sm:min-h-10 sm:px-3.5 sm:text-xs">
            {isLive ? (
              <Wifi className="apple-status-glow h-3.5 w-3.5 rounded-full text-emerald-400" />
            ) : (
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">Feed:</span>
            <span className={isLive ? 'text-emerald-400' : 'text-foreground font-medium'}>
              {isLive ? 'Live' : 'Cached'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDefenseOpen(true)}
            className="apple-interactive flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] text-muted-foreground hover:border-primary/40 hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-10 sm:gap-2 sm:px-3.5 sm:text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Theory</span>
          </button>
        </div>
      </header>

      <nav aria-label="Dashboard panels" className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 xl:hidden">
        <button
          type="button"
          aria-pressed={mobilePanel === 'universe'}
          onClick={() => setMobilePanel('universe')}
          className={`min-h-9 rounded-lg px-3 font-mono text-[11px] transition-colors ${mobilePanel === 'universe' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          EQUITIES / 06
        </button>
        <button
          type="button"
          aria-pressed={mobilePanel === 'detail'}
          onClick={() => setMobilePanel('detail')}
          className={`min-h-9 rounded-lg px-3 font-mono text-[11px] transition-colors ${mobilePanel === 'detail' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {selectedStock?.shortName ?? 'DETAILS'} / DETAIL
        </button>
      </nav>

      <div className="apple-reveal grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(400px,0.88fr)] xl:gap-5" style={{ animationDelay: '80ms' }}>
        <section className={`${mobilePanel === 'universe' ? 'flex' : 'hidden'} min-h-0 flex-col gap-2 xl:flex`}>
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground xl:text-sm">
            <div>
              <span className="font-medium tracking-tight text-foreground">Tata universe</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground xl:text-[11px]">06 names</span>
            </div>
            <span className="text-[11px] xl:text-xs">Select a name to inspect</span>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-6 gap-1.5 min-[380px]:grid-cols-2 min-[380px]:grid-rows-3 min-[380px]:gap-2 xl:grid-cols-3 xl:grid-rows-2 xl:gap-3">
            {data.tickers.map((ticker, index) => {
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
                  style={{ animationDelay: `${index * 55 + 120}ms` }}
                />
              );
            })}
          </div>
        </section>

        <section key={selectedStock?.ticker ?? 'empty'} className={`${mobilePanel === 'detail' ? 'flex' : 'hidden'} min-h-0 xl:flex`} style={{ animationDelay: '130ms' }}>
          <StockDetailPanel
            stock={selectedStock}
            groupIndex={data.groupIndex}
          />
        </section>
      </div>

      <section className="apple-reveal shrink-0" style={{ animationDelay: '180ms' }}>
        <MathTraceDrawer stock={selectedStock} />
      </section>

      <DefenseModal isOpen={defenseOpen} onClose={() => setDefenseOpen(false)} />
    </div>
  );
};
