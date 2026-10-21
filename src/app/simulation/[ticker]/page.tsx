import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MonteCarloResults } from '@/components/simulation/MonteCarloResults';
import { getFallbackStocksData } from '@/lib/data/tata-fallback-data';
import { TATA_TICKERS } from '@/lib/types/stock';

export function generateStaticParams() {
  return TATA_TICKERS.map((ticker) => ({ ticker }));
}

export default function SimulationPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  return (
    <Suspense fallback={<SimulationLoadingState />}>
      <SimulationPageContent params={params} />
    </Suspense>
  );
}

async function SimulationPageContent({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  if (!TATA_TICKERS.includes(ticker as (typeof TATA_TICKERS)[number])) notFound();

  const data = getFallbackStocksData();
  const stock = data.stocks[ticker];
  if (!stock) notFound();

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <MonteCarloResults
        ticker={ticker}
        initialStock={stock}
        initialGroupIndex={data.groupIndex}
        initialSource={data.source}
      />
    </main>
  );
}

function SimulationLoadingState() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Monte Carlo simulation"
      className="h-dvh overflow-hidden bg-background text-foreground"
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col px-4 py-3 sm:px-8 sm:py-4 lg:px-12">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3">
          <div aria-hidden="true" className="h-11 w-32 animate-pulse rounded-lg bg-card" />
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent-primary)]/60" />
            <span aria-hidden="true" className="h-3 w-24 animate-pulse rounded bg-card" />
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col pt-3 sm:pt-5">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-primary)] sm:text-xs">
            MonteVerge / Stochastic execution
          </p>
          <h1 className="mt-1 shrink-0 text-2xl font-medium tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Preparing simulation
          </h1>
          <p className="mt-1 shrink-0 text-sm text-[var(--text-muted)] sm:text-base">
            Loading the selected stock and its Monte Carlo result view.
          </p>

          <div aria-hidden="true" className="mt-3 grid h-24 shrink-0 gap-3 sm:grid-cols-2">
            <div className="animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
            <div className="animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
          </div>
          <div aria-hidden="true" className="mt-3 min-h-0 flex-1 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]" />
        </section>
      </div>
    </main>
  );
}
