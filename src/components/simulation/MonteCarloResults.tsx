'use client';

import { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import Link from 'next/link';
import { ArrowLeft, Activity, Database, RefreshCw, Wifi, Zap } from 'lucide-react';
import { computeLogSpread, computeMean, computeStdDev, computeZScore } from '@/lib/quant/stochasticEngine';
import type {
  MonteCarloInput,
  MonteCarloPathPoint,
  MonteCarloProgress,
  MonteCarloResult,
  MonteCarloWorkerMessage,
} from '@/lib/simulators/monteCarlo';
import type { GroupIndexData, StockSeries, StocksApiResponse } from '@/lib/types/stock';
import { formatINR, formatIntegerINR } from '@/lib/utils/format';

type Source = StocksApiResponse['source'];
type DisplayMode = 'theory' | 'live';

interface MonteCarloResultsProps {
  ticker: string;
  initialStock: StockSeries;
  initialGroupIndex: GroupIndexData;
  initialSource: Source;
}

interface Calibration {
  initialSpread: number;
  mean: number;
  sigma: number;
  spreadSigma: number;
  theta: number;
  zScore: number;
  groupIndex: number;
  currentPrice: number;
  historyDays: number;
}

const PATH_COUNT = 1000;
const HORIZON = 20;

function calibrate(stock: StockSeries, groupIndex: GroupIndexData): Calibration {
  const indexByDate = new Map(groupIndex.dates.map((date, index) => [date, groupIndex.values[index]]));
  const spreads = stock.history.flatMap((point) => {
    const indexValue = indexByDate.get(point.date);
    return indexValue !== undefined && point.close > 0
      ? [computeLogSpread(point.close, indexValue)]
      : [];
  });
  const mean = spreads.length > 0 ? computeMean(spreads) : (stock.logSpread ?? 0);
  const spreadSigma = spreads.length > 1 ? computeStdDev(spreads, mean) : 0.0001;
  const theta = Math.min(0.5, Math.max(0.01, stock.thetaEst ?? 0.18));
  const residuals = spreads.slice(1).map((spread, index) => (
    spread - spreads[index] - theta * (mean - spreads[index])
  ));
  const sigma = residuals.length > 1
    ? computeStdDev(residuals)
    : Math.max(0.0001, (stock.volatilityEst ?? 10) / 100 / Math.sqrt(252));
  const groupIndexValue = groupIndex.values[groupIndex.values.length - 1] ?? 0;
  const currentPrice = stock.currentPrice > 0
    ? stock.currentPrice
    : stock.history[stock.history.length - 1]?.close ?? 0;
  const initialSpread = computeLogSpread(currentPrice, groupIndexValue);

  return {
    initialSpread,
    mean,
    sigma,
    theta,
    zScore: computeZScore(initialSpread, mean, spreadSigma),
    spreadSigma,
    groupIndex: groupIndexValue,
    currentPrice,
    historyDays: spreads.length,
  };
}

function signed(value: number, digits = 4): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function Formula({ latex }: { latex: string }) {
  const markup = useMemo(() => katex.renderToString(latex, {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: false,
  }), [latex]);

  return (
    <div
      className="min-h-12 overflow-hidden text-[var(--text-primary)] [&_.katex]:text-[0.78rem] [&_.katex-display]:overflow-hidden [&_.katex-display]:text-left sm:[&_.katex]:text-[1rem] xl:[&_.katex]:text-[1.1rem]"
      aria-label="Mathematical formula"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function quantilePath(result: MonteCarloResult, key: 'p10' | 'p50' | 'p90', y: (value: number) => number): string {
  const points = result.bands.map((band, index) => (
    `${index === 0 ? 'M' : 'L'} ${30 + index * (840 / Math.max(1, result.horizon))} ${y(band[key])}`
  ));
  return points.join(' ');
}

interface FanChartProps {
  result: MonteCarloResult | null;
  samplePath: MonteCarloPathPoint[];
  initialSpread: number;
  groupIndex: number;
  horizon: number;
  progress: MonteCarloProgress;
}

function FanChart({ result, samplePath, initialSpread, groupIndex, horizon, progress }: FanChartProps) {
  const pathHorizon = Math.max(1, result?.horizon ?? horizon);
  const bands = result?.bands ?? [];
  const values = [
    initialSpread,
    ...bands.flatMap((band) => [band.p10, band.p90]),
    ...samplePath.map((point) => point.spread),
  ];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, 0.0001);
  const y = (value: number) => 22 + ((high - value) / range) * 196;
  const x = (day: number) => 30 + (day / pathHorizon) * 840;
  const area = result
    ? `${result.bands.map((band, index) => `${index === 0 ? 'M' : 'L'} ${x(band.day)} ${y(band.p90)}`).join(' ')} ${[...result.bands].reverse().map((band) => `L ${x(band.day)} ${y(band.p10)}`).join(' ')} Z`
    : '';
  const sampleLine = samplePath.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.day)} ${y(point.spread)}`).join(' ');
  const zeroY = y(0);
  const currentPathPoint = samplePath[samplePath.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] sm:text-[11px]">{result ? '20-day spread distribution' : 'Live Euler-Maruyama path'}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            {result
              ? '1,000 paths · shaded band shows the 10th–90th percentile'
              : samplePath.length > 1
                ? 'Sample trajectory computed by the worker · percentile fan builds as paths finish'
                : 'Waiting for the worker to compute its first stochastic path'}
          </p>
        </div>
        {result ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" /> MEDIAN</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--accent-secondary)]" /> 10–90%</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--text-primary)]" /> SAMPLE PATH</span>
          </div>
        ) : (
          <span className="font-mono text-[10px] tabular-nums text-[var(--accent-primary)]">{formatIntegerINR(progress.completedPaths)} / {formatIntegerINR(progress.totalPaths)} PATHS</span>
        )}
      </div>
      <div className="mt-1 min-h-0 flex-1 overflow-hidden">
        <svg viewBox="0 0 900 250" className="h-full w-full" role="img" aria-label={result ? 'Monte Carlo spread fan chart with a sampled path from day zero to day twenty' : 'Live first Monte Carlo path generated by the worker'}>
          <line x1="30" x2="870" y1={zeroY} y2={zeroY} stroke="var(--border-default)" strokeDasharray="4 6" />
          {result && (
            <>
              <path d={area} fill="var(--accent-secondary)" fillOpacity="0.12" className="apple-chart-wash" />
              <path d={quantilePath(result, 'p90', y)} fill="none" stroke="var(--accent-secondary)" strokeOpacity="0.52" strokeWidth="1" className="apple-chart-line" />
              <path d={quantilePath(result, 'p10', y)} fill="none" stroke="var(--accent-secondary)" strokeOpacity="0.52" strokeWidth="1" className="apple-chart-line" />
              <path d={quantilePath(result, 'p50', y)} fill="none" stroke="var(--accent-primary)" strokeWidth="2.2" className="apple-chart-line" />
            </>
          )}
          {sampleLine && <path d={sampleLine} fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeDasharray="5 3" className="apple-chart-line" />}
          <circle cx="30" cy={y(initialSpread)} r="3.5" fill="var(--accent-primary)" />
          {currentPathPoint && <circle cx={x(currentPathPoint.day)} cy={y(currentPathPoint.spread)} r="4.5" fill="var(--text-primary)" className="apple-status-glow" />}
          <text x="30" y="244" fill="var(--text-muted)" fontSize="16" fontFamily="var(--font-mono)">DAY 0</text>
          <text x="820" y="244" fill="var(--text-muted)" fontSize="16" fontFamily="var(--font-mono)">DAY {pathHorizon}</text>
          <text x="38" y={Math.max(14, zeroY - 7)} fill="var(--text-muted)" fontSize="14" fontFamily="var(--font-mono)">ZERO SPREAD</text>
        </svg>
      </div>
      <div className="mt-1 grid shrink-0 grid-cols-3 gap-2 border-t border-[var(--border-default)] pt-2 font-mono text-[10px] sm:text-[11px]">
        {result ? (['p10', 'p50', 'p90'] as const).map((key) => {
          const spread = result.bands[result.bands.length - 1]?.[key] ?? 0;
          const price = Math.exp(spread + groupIndex);
          return (
            <div key={key}>
              <p className="text-[var(--text-muted)]">FINAL {key.toUpperCase()}</p>
              <p className="mt-0.5 text-[var(--text-primary)]">{signed(spread, 4)}</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">₹{formatINR(price)}</p>
            </div>
          );
        }) : (
          <>
            <div><p className="text-[var(--text-muted)]">COMPLETED PATHS</p><p className="mt-0.5 text-[var(--text-primary)]">{formatIntegerINR(progress.completedPaths)} / {formatIntegerINR(progress.totalPaths)}</p></div>
            <div><p className="text-[var(--text-muted)]">SAMPLE END SPREAD</p><p className="mt-0.5 text-[var(--text-primary)]">{currentPathPoint ? signed(currentPathPoint.spread, 5) : '—'}</p></div>
            <div><p className="text-[var(--text-muted)]">SAMPLE PATH DAYS</p><p className="mt-0.5 text-[var(--text-primary)]">{currentPathPoint?.day ?? 0} / {pathHorizon}</p></div>
          </>
        )}
      </div>
    </div>
  );
}

function ExecutionPipeline({
  calibration,
  progress,
  status,
  horizon,
}: {
  calibration: Calibration;
  progress: MonteCarloProgress;
  status: 'running' | 'complete' | 'error';
  horizon: number;
}) {
  const completedSteps = progress.completedPaths * horizon
    + (progress.completedPaths === 0 ? progress.sampleDay ?? 0 : 0);
  const totalSteps = Math.max(1, progress.totalPaths * horizon);
  const percent = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
  const pathStatus = status === 'error'
    ? 'FAILED'
    : progress.completedPaths === 0 && progress.sampleDay
      ? `DAY ${progress.sampleDay} / ${horizon}`
      : `${formatIntegerINR(progress.completedPaths)} / ${formatIntegerINR(progress.totalPaths)}`;

  return (
    <section aria-label="Equation execution status" className="mt-2 grid shrink-0 grid-cols-4 gap-1">
      <div className="rounded-lg border border-[var(--state-success)]/20 bg-[var(--bg-surface)] px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="font-mono text-[8px] tracking-[0.02em] text-[var(--text-muted)] sm:text-[9px]">01 / SPREAD</p>
          <span className="font-mono text-[7px] text-[var(--state-success)] sm:text-[8px]">DONE</span>
        </div>
        <p className="mt-1 truncate font-mono text-[9px] tabular-nums text-[var(--text-primary)] sm:text-[10px]">S {signed(calibration.initialSpread, 4)}</p>
      </div>
      <div className="rounded-lg border border-[var(--state-success)]/20 bg-[var(--bg-surface)] px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="font-mono text-[8px] tracking-[0.02em] text-[var(--text-muted)] sm:text-[9px]">02 / Z-SCORE</p>
          <span className="font-mono text-[7px] text-[var(--state-success)] sm:text-[8px]">DONE</span>
        </div>
        <p className="mt-1 truncate font-mono text-[9px] tabular-nums text-[var(--text-primary)] sm:text-[10px]">Z {signed(calibration.zScore, 2)}σ</p>
      </div>
      <div className="rounded-lg border border-[var(--state-success)]/20 bg-[var(--bg-surface)] px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="font-mono text-[8px] tracking-[0.02em] text-[var(--text-muted)] sm:text-[9px]">03 / OU FIT</p>
          <span className="font-mono text-[7px] text-[var(--state-success)] sm:text-[8px]">FIT</span>
        </div>
        <p className="mt-1 truncate font-mono text-[9px] tabular-nums text-[var(--text-primary)] sm:text-[10px]">θ {calibration.theta.toFixed(2)} · σ {calibration.sigma.toFixed(4)}</p>
      </div>
      <div className={`rounded-lg border bg-[var(--bg-surface)] px-2 py-1.5 ${status === 'error' ? 'border-[var(--state-error)]/30' : status === 'complete' ? 'border-[var(--state-success)]/20' : 'border-[var(--accent-primary)]/30 shadow-sm shadow-[var(--accent-primary)]/5'}`}>
        <div className="flex items-center justify-between gap-1">
          <p className="font-mono text-[8px] tracking-[0.02em] text-[var(--text-muted)] sm:text-[9px]">04 / EULER</p>
          <span className={`font-mono text-[7px] sm:text-[8px] ${status === 'error' ? 'text-[var(--state-error)]' : status === 'complete' ? 'text-[var(--state-success)]' : 'animate-pulse text-[var(--accent-primary)]'}`}>{status === 'error' ? 'ERROR' : status === 'complete' ? 'DONE' : 'RUN'}</span>
        </div>
        <p className="mt-1 truncate font-mono text-[9px] tabular-nums text-[var(--text-primary)] sm:text-[10px]">{pathStatus}</p>
        <div
          role="progressbar"
          aria-label="Euler steps completed"
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={completedSteps}
          className="mt-1 h-0.5 overflow-hidden rounded-full bg-[var(--border-default)]"
        >
          <div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}

function opinionFor(probability: number): { label: string; message: string; tone: string } {
  if (probability >= 0.65) {
    return {
      label: 'GOOD MODEL SIGNAL',
      message: 'Most paths moved closer to zero. Promising to watch; not a trade by itself.',
      tone: 'text-[var(--state-success)]',
    };
  }
  if (probability >= 0.45) {
    return {
      label: 'MIXED MODEL SIGNAL',
      message: 'The paths show no clear edge. My read: inconclusive; wait for confirmation.',
      tone: 'text-amber-300',
    };
  }
  return {
    label: 'WEAK MODEL SIGNAL',
    message: 'More paths moved farther from zero. My read: poor reversion setup; stay cautious.',
    tone: 'text-[var(--state-error)]',
  };
}

export function MonteCarloResults({
  ticker,
  initialStock,
  initialGroupIndex,
  initialSource,
}: MonteCarloResultsProps) {
  const [stock, setStock] = useState(initialStock);
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [source, setSource] = useState<Source>(initialSource);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('theory');
  const [pageMode, setPageMode] = useState<'outcome' | 'trace'>('outcome');
  const [activeStepNumber, setActiveStepNumber] = useState('01');
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [status, setStatus] = useState<'running' | 'complete' | 'error'>('running');
  const [progress, setProgress] = useState<MonteCarloProgress>({ completedPaths: 0, totalPaths: PATH_COUNT });
  const [samplePath, setSamplePath] = useState<MonteCarloPathPoint[]>([]);
  const [runVersion, setRunVersion] = useState(0);

  const calibration = useMemo(() => calibrate(stock, groupIndex), [stock, groupIndex]);
  const modelInput = useMemo<Omit<MonteCarloInput, 'seed'>>(() => ({
    initialSpread: calibration.initialSpread,
    mean: calibration.mean,
    theta: calibration.theta,
    sigma: calibration.sigma,
    groupIndex: calibration.groupIndex,
    currentPrice: calibration.currentPrice,
    horizon: HORIZON,
    pathCount: PATH_COUNT,
  }), [calibration]);

  useEffect(() => {
    let active = true;
    async function refreshMarketData() {
      try {
        const response = await fetch('/api/stocks');
        if (!response.ok) return;
        const data = await response.json() as StocksApiResponse;
        const latestStock = data.stocks?.[ticker];
        if (active && latestStock && Array.isArray(latestStock.history) && Array.isArray(data.groupIndex?.values) && data.groupIndex.values.length > 0) {
          setStatus('running');
          setResult(null);
          setProgress({ completedPaths: 0, totalPaths: PATH_COUNT });
          setSamplePath([]);
          setStock(latestStock);
          setGroupIndex(data.groupIndex);
          setSource(data.source);
        }
      } catch {
        // Server-rendered fixture remains available if the market feed is offline.
      }
    }

    void refreshMarketData();
    return () => { active = false; };
  }, [ticker]);

  useEffect(() => {
    const seedValues = new Uint32Array(1);
    crypto.getRandomValues(seedValues);
    const worker = new Worker(new URL('../../lib/simulators/monteCarlo.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<MonteCarloWorkerMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        setStatus('error');
        return;
      }
      if (message.type === 'progress') {
        setProgress(message.progress);
        if (message.progress.samplePath) setSamplePath(message.progress.samplePath);
        return;
      }
      if (message.type === 'complete') {
        setResult(message.result);
        setProgress({ completedPaths: message.result.pathCount, totalPaths: message.result.pathCount });
        setSamplePath(message.result.samplePath);
        setStatus('complete');
      } else {
        setStatus('error');
      }
      worker.terminate();
    };
    worker.onerror = () => {
      setStatus('error');
      worker.terminate();
    };
    worker.postMessage({ ...modelInput, seed: seedValues[0] });

    return () => worker.terminate();
  }, [modelInput, runVersion]);

  const opinion = result ? opinionFor(result.reversionProbability) : null;
  const sourceLabel = source === 'live' ? 'LIVE FEED' : source === 'cache' ? 'CACHED FEED' : 'OFFLINE FIXTURE';
  const firstEulerStep = result?.samplePath[1] ?? samplePath[1];

  const steps = [
    {
      number: '01',
      name: 'LOG SPREAD',
      annotation: 'Removes the group benchmark to isolate relative price divergence.',
      formula: String.raw`S_{i,t} = \ln(P_{i,t}) - I_t`,
      evaluated: `ln(₹${formatINR(calibration.currentPrice)}) − ${calibration.groupIndex.toFixed(5)} = ${signed(calibration.initialSpread, 5)}`,
    },
    {
      number: '02',
      name: 'Z-SCORE',
      annotation: 'Measures the current spread in historical standard deviations.',
      formula: String.raw`z_0 = \frac{S_{i,t} - \mu}{\sigma_{spread}}`,
      evaluated: `(${signed(calibration.initialSpread, 5)} − ${signed(calibration.mean, 5)}) ÷ ${calibration.spreadSigma.toFixed(5)} = ${signed(calibration.zScore, 2)}σ`,
    },
    {
      number: '03',
      name: 'CONTINUOUS SDE',
      annotation: 'Balances deterministic pull toward the mean against random market movement.',
      formula: String.raw`\begin{aligned}dS_t &= \underbrace{\theta(\mu - S_t)dt}_{\text{Deterministic Reversion}} \\ &\quad + \underbrace{\sigma dW_t}_{\text{Stochastic Noise}}\end{aligned}`,
      evaluated: `θ ${calibration.theta.toFixed(3)} · μ ${signed(calibration.mean, 5)} · σ ${calibration.sigma.toFixed(5)}`,
    },
    {
      number: '04',
      name: 'EULER DISCRETIZATION',
      annotation: 'Takes one daily step using a sampled Gaussian shock.',
      formula: String.raw`\begin{aligned}S_{t+\Delta t} &= S_t + \theta(\mu - S_t)\Delta t \\ &\quad + \sigma \sqrt{\Delta t}\, Z_k\end{aligned}`,
      evaluated: firstEulerStep
        ? `DAY ${firstEulerStep.day} · Zₖ ${signed(firstEulerStep.shock, 3)} · drift ${signed(firstEulerStep.drift, 5)} · noise ${signed(firstEulerStep.noise, 5)} · next S ${signed(firstEulerStep.spread, 5)} · implied ₹${formatINR(Math.exp(firstEulerStep.spread + calibration.groupIndex))}`
        : 'Waiting for the worker to sample its first Gaussian shock…',
    },
  ];
  const activeStep = steps.find((step) => step.number === activeStepNumber) ?? steps[0];

  return (
    <div className="apple-reveal mx-auto flex h-dvh w-full max-w-[1600px] flex-col overflow-hidden px-3 py-2 sm:px-5 sm:py-3 xl:px-8">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-default)] pb-2">
        <Link href="/" className="apple-interactive inline-flex min-h-9 items-center gap-2 rounded-lg pr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:text-[11px]">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)] sm:text-[11px]">
          {source === 'live' ? <Wifi className="h-3.5 w-3.5 text-[var(--state-success)]" /> : <Database className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
          DATA / {sourceLabel}
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col pt-2">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-primary)] sm:text-[11px]">MonteVerge / Stochastic execution</p>
            <h1 className="mt-0.5 text-3xl font-medium tracking-[-0.05em] text-[var(--text-primary)] sm:text-4xl xl:text-5xl">{stock.shortName}<span className="ml-2 align-middle text-xs font-normal tracking-normal text-[var(--text-muted)] sm:text-base">{ticker}</span></h1>
            <p className="mt-1 hidden max-w-2xl text-xs leading-relaxed text-[var(--text-muted)] sm:block">A 20-day Monte Carlo estimate of whether this stock’s group-relative spread moves closer to its historical mean.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus('running');
              setResult(null);
              setProgress({ completedPaths: 0, totalPaths: PATH_COUNT });
              setSamplePath([]);
              setRunVersion((version) => version + 1);
            }}
            disabled={status === 'running'}
            className="apple-interactive inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-[10px] text-[var(--text-muted)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-50 sm:min-h-10 sm:text-[11px]"
          >
            <RefreshCw className={status === 'running' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            {status === 'running' ? 'RUNNING' : 'RUN AGAIN'}
          </button>
        </div>

        <nav aria-label="Simulation views" className="mt-2 grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            aria-pressed={pageMode === 'outcome'}
            onClick={() => setPageMode('outcome')}
            className={pageMode === 'outcome' ? 'min-h-9 rounded-lg bg-[var(--accent-primary)] px-3 font-mono text-[10px] tracking-[0.08em] text-[var(--bg-base)] transition-colors sm:text-[11px]' : 'min-h-9 rounded-lg px-3 font-mono text-[10px] tracking-[0.08em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] sm:text-[11px]'}
          >
            [ OUTCOME ]
          </button>
          <button
            type="button"
            aria-pressed={pageMode === 'trace'}
            onClick={() => setPageMode('trace')}
            className={pageMode === 'trace' ? 'min-h-9 rounded-lg bg-[var(--accent-primary)] px-3 font-mono text-[10px] tracking-[0.08em] text-[var(--bg-base)] transition-colors sm:text-[11px]' : 'min-h-9 rounded-lg px-3 font-mono text-[10px] tracking-[0.08em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] sm:text-[11px]'}
          >
            [ EXECUTION TRACE ]
          </button>
        </nav>

        <ExecutionPipeline calibration={calibration} progress={progress} status={status} horizon={HORIZON} />

        {pageMode === 'outcome' ? (
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
            <div className="grid shrink-0 gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <article className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--bg-surface)] p-3 shadow-lg shadow-black/20 sm:p-4">
                <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[var(--accent-primary)]/5 blur-3xl" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">Estimated reversion probability</p>
                    <p key={result?.seed ?? 'pending'} className="apple-fade-in mt-1 min-h-10 font-mono text-4xl leading-none tracking-tight text-[var(--text-primary)] sm:text-5xl">
                      {result ? (result.reversionProbability * 100).toFixed(1) + '%' : status === 'error' ? '—' : '…'}
                    </p>
                    <p className="mt-1 font-mono text-[10px] leading-snug text-[var(--text-muted)] sm:text-[11px]">
                      {result ? formatIntegerINR(result.revertedPaths) + ' / ' + formatIntegerINR(result.pathCount) + ' paths moved closer to zero' : status === 'error' ? 'Worker failed. Run again to retry.' : 'Running 1,000 paths × 20 daily steps…'}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-2 text-right font-mono">
                    <p className="text-[9px] text-[var(--text-muted)] sm:text-[10px]">INITIAL Z</p>
                    <p className={Math.abs(calibration.zScore) >= 2 ? 'mt-0.5 text-xl tabular-nums text-[var(--accent-primary)] sm:text-2xl' : 'mt-0.5 text-xl tabular-nums text-[var(--text-primary)] sm:text-2xl'}>{signed(calibration.zScore, 2)}σ</p>
                    <p className={Math.abs(calibration.zScore) >= 2 ? 'text-[9px] leading-tight text-[var(--accent-primary)]' : 'text-[9px] leading-tight text-[var(--text-muted)]'}>{Math.abs(calibration.zScore) >= 2 ? 'EXTREME' : 'NORMAL RANGE'}</p>
                  </div>
                </div>
                <div className="relative mt-2 flex items-start gap-2 border-t border-[var(--border-default)] pt-2">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                  <div className="min-w-0">
                    <p className={opinion?.tone ?? 'font-mono text-[10px] tracking-[0.08em] text-[var(--text-muted)] sm:text-[11px]'}>{opinion?.label ?? (status === 'error' ? 'NO RESULT' : 'CALCULATING SIGNAL')}</p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--text-primary)]">{opinion?.message ?? 'The model is a statistical screen, not a guaranteed outcome.'}</p>
                  </div>
                </div>
              </article>

              <aside className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">Calibration snapshot</p>
                  <p className="hidden font-mono text-[10px] text-[var(--text-muted)] sm:block">{calibration.historyDays} OBSERVATIONS</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="min-w-0 rounded-lg bg-[var(--bg-base)] p-1.5">
                    <p className="truncate font-mono text-[9px] text-[var(--text-muted)] sm:text-[10px]">PRICE</p>
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--text-primary)] sm:text-sm">₹{formatINR(calibration.currentPrice)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--bg-base)] p-1.5">
                    <p className="truncate font-mono text-[9px] text-[var(--text-muted)] sm:text-[10px]">SPREAD</p>
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--text-primary)] sm:text-sm">{signed(calibration.initialSpread, 4)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--bg-base)] p-1.5">
                    <p className="truncate font-mono text-[9px] text-[var(--text-muted)] sm:text-[10px]">MEAN μ</p>
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--text-primary)] sm:text-sm">{signed(calibration.mean, 4)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--bg-base)] p-1.5">
                    <p className="truncate font-mono text-[9px] text-[var(--text-muted)] sm:text-[10px]">SPEED θ</p>
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--text-primary)] sm:text-sm">{calibration.theta.toFixed(3)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--bg-base)] p-1.5">
                    <p className="truncate font-mono text-[9px] text-[var(--text-muted)] sm:text-[10px]">NOISE σ</p>
                    <p className="truncate font-mono text-xs tabular-nums text-[var(--text-primary)] sm:text-sm">{calibration.sigma.toFixed(5)}</p>
                  </div>
                </div>
              </aside>
            </div>

            <FanChart
              result={result}
              samplePath={result?.samplePath ?? samplePath}
              initialSpread={calibration.initialSpread}
              groupIndex={calibration.groupIndex}
              horizon={HORIZON}
              progress={progress}
            />
          </div>
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-primary)]">Execution trace</p>
                <h2 className="text-base font-medium tracking-tight text-[var(--text-primary)] sm:text-lg">How the result is computed</h2>
              </div>
              <div className="flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5 font-mono text-[9px] sm:text-[10px]">
                <button type="button" onClick={() => setDisplayMode('theory')} aria-pressed={displayMode === 'theory'} className={displayMode === 'theory' ? 'min-h-8 rounded-md bg-[var(--accent-primary)] px-2 text-[var(--bg-base)] transition-colors' : 'min-h-8 rounded-md px-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]'}>THEORY</button>
                <button type="button" onClick={() => setDisplayMode('live')} aria-pressed={displayMode === 'live'} className={displayMode === 'live' ? 'min-h-8 rounded-md bg-[var(--accent-primary)] px-2 text-[var(--bg-base)] transition-colors' : 'min-h-8 rounded-md px-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]'}>LIVE VALUES</button>
              </div>
            </div>

            <nav aria-label="Equation steps" className="grid shrink-0 grid-cols-4 gap-1">
              {steps.map((step) => (
                <button
                  key={step.number}
                  type="button"
                  aria-label={'Show step ' + step.number + ': ' + step.name}
                  aria-pressed={activeStepNumber === step.number}
                  onClick={() => setActiveStepNumber(step.number)}
                  className={activeStepNumber === step.number ? 'min-h-9 truncate rounded-md border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-1 py-1 font-mono text-[9px] tracking-[0.02em] text-[var(--accent-primary)] transition-colors sm:px-2 sm:text-[10px]' : 'min-h-9 truncate rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-1 py-1 font-mono text-[9px] tracking-[0.02em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] sm:px-2 sm:text-[10px]'}
                >
                  STEP {step.number}
                </button>
              ))}
            </nav>

            <article className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-2">
                <p className="font-mono text-[10px] tracking-[0.08em] text-[var(--accent-primary)] sm:text-[11px]">[ STEP {activeStep.number}{' // '}{activeStep.name} ]</p>
                <span className="font-mono text-[9px] text-[var(--text-muted)]">{displayMode === 'theory' ? 'FORMULA THEORY' : 'LIVE EVALUATION'}</span>
              </div>
              {displayMode === 'theory' ? (
                <div key={displayMode} className="apple-fade-in mt-2">
                  <Formula latex={activeStep.formula} />
                </div>
              ) : (
                <p key={displayMode} className="apple-fade-in mt-2 min-h-12 break-words font-mono text-xs leading-relaxed text-[var(--text-primary)]">
                  {activeStep.evaluated}
                </p>
              )}
              <p className="mt-2 border-t border-[var(--border-default)] pt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                {activeStep.annotation}
              </p>

              {activeStep.number === '03' && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ['θ', 'Reversion speed: how quickly the spread is pulled toward its long-run mean.'],
                    ['μ', 'Long-run mean: the equilibrium spread estimated from historical observations.'],
                    ['σ', 'Daily noise scale: the standard deviation of OU model residual moves.'],
                  ].map(([symbol, definition]) => (
                    <details key={symbol} className="group relative">
                      <summary className="min-h-8 cursor-pointer list-none rounded-md border border-[var(--border-default)] px-2 py-1.5 font-mono text-[10px] text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                        {symbol} / meaning
                      </summary>
                      <span className="absolute bottom-full left-0 z-10 mb-1 hidden w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-[var(--text-primary)] shadow-xl group-open:block">
                        {definition}
                      </span>
                    </details>
                  ))}
                </div>
              )}

              {activeStep.number === '01' && <p className="mt-2 font-mono text-[10px] tracking-[0.06em] text-[var(--accent-primary)]">[ RELATIVE PRICE DIVERGENCE ]</p>}
              {activeStep.number === '03' && <p className="mt-2 font-mono text-[10px] tracking-[0.06em] text-[var(--accent-primary)]">[ RUBBER-BAND PULL ] · [ RANDOM MARKET NOISE ]</p>}
              {activeStep.number === '04' && <p className="mt-2 font-mono text-[10px] tracking-[0.06em] text-[var(--accent-primary)]">[ WORKER SAMPLE · DAY 1 SHOCK Zₖ {firstEulerStep ? signed(firstEulerStep.shock, 3) : 'WAITING'} ]</p>}
            </article>
          </div>
        )}

        <footer className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--border-default)] pt-1.5 font-mono text-[9px] leading-tight text-[var(--text-muted)] sm:text-[10px]">
          <span><Zap className="mr-1 inline h-3 w-3 text-[var(--accent-primary)]" />{formatIntegerINR(PATH_COUNT)} PATHS · {HORIZON} DAYS · SEED {result?.seed ?? '—'}</span>
          <span className="hidden sm:inline">STATISTICAL ESTIMATE · NOT A GUARANTEE</span>
        </footer>
      </section>
    </div>
  );
}
