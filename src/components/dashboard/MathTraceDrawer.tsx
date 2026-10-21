'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight, Zap } from 'lucide-react';
import type { StockSeries } from '@/lib/types/stock';

interface MathTraceDrawerProps {
  stock: StockSeries | null;
}

export function MathTraceDrawer({ stock }: MathTraceDrawerProps) {
  const router = useRouter();

  const openSimulation = () => {
    if (stock) router.push(`/simulation/${encodeURIComponent(stock.ticker)}`);
  };

  return (
    <div className="apple-reveal rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:rounded-2xl sm:p-4 xl:p-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0">
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-primary)] sm:block">
            Quantitative research / next step
          </p>
          <h2 className="text-sm font-medium tracking-tight text-[var(--text-primary)] sm:text-base xl:text-lg">
            Run the equations for {stock?.shortName ?? 'a selected Tata equity'}
          </h2>
          <p className="mt-1 hidden max-w-2xl text-xs leading-relaxed text-[var(--text-muted)] sm:block sm:text-sm">
            Open a dedicated results view with a 1,000-path, 20-day Ornstein–Uhlenbeck simulation and its model readout.
          </p>
        </div>

        <button
          type="button"
          onClick={openSimulation}
          disabled={!stock}
          className="apple-interactive group inline-flex min-h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--accent-primary)]/35 bg-[var(--bg-base)] px-2.5 py-2 font-mono text-[10px] tracking-[0.02em] text-[var(--text-primary)] shadow-sm hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/70 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-[11px] xl:px-4 xl:text-xs"
        >
          <Zap className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.8} />
          [ RUN MONTE CARLO EQUATIONS ]
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
