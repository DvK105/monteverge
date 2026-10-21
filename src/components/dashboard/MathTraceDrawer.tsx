'use client';

import React, { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import { Activity, ArrowDown, ArrowUp, RefreshCw, X, Zap } from 'lucide-react';
import { computeMean, computeStdDev, eulerMaruyamaStep, sampleStandardNormal } from '@/lib/quant/stochasticEngine';
import { GroupIndexData, StockSeries } from '@/lib/types/stock';
import { formatINR } from '@/lib/utils/format';

interface MathTraceDrawerProps {
  stock: StockSeries | null;
  groupIndex: GroupIndexData;
}

type DisplayMode = 'theory' | 'live';

interface StockSnapshot {
  currentPrice: number;
  logPrice: number;
  groupIndex: number;
  spread: number;
  mean: number;
  sigma: number;
  zScore: number;
  theta: number;
}

const STEP_LABELS = [
  '[ STEP 01 // LOG SPREAD ]',
  '[ STEP 02 // Z-SCORE ]',
  '[ STEP 03 // CONTINUOUS SDE ]',
  '[ STEP 04 // EULER DISCRETIZATION ]',
] as const;

const THEORY_FORMULAS = {
  spread: String.raw`S_{i,t} = \ln(P_{i,t}) - I_t`,
  zScore: String.raw`z_0 = \frac{S_{i,t} - \mu}{\sigma_{spread}}`,
  sde: String.raw`dS_t = \underbrace{\theta(\mu - S_t)dt}_{\text{Deterministic Reversion}} + \underbrace{\sigma dW_t}_{\text{Stochastic Noise}}`,
  euler: String.raw`S_{t+\Delta t} = S_t + \theta(\mu - S_t)\Delta t + \sigma \sqrt{\Delta t}\, Z_k`,
};

function renderFormula(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: false,
  });
}

function Formula({ latex, className = '' }: { latex: string; className?: string }) {
  const markup = useMemo(() => renderFormula(latex), [latex]);

  return (
    <div
      className={`min-h-16 overflow-x-auto overflow-y-hidden text-[var(--text-primary)] [&_.katex]:text-[1.1rem] [&_.katex-display]:text-left ${className}`}
      aria-label="Mathematical formula"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function ParameterProbe({
  symbol,
  label,
  definition,
}: {
  symbol: string;
  label: string;
  definition: string;
}) {
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-left transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg text-[var(--accent-primary)]">{symbol}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
        <span className="ml-auto text-[10px] text-[var(--text-muted)] transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <span className="absolute left-0 top-[calc(100%+0.5rem)] z-20 hidden w-64 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-[var(--text-primary)] shadow-xl group-open:block group-hover:block">
        {definition}
      </span>
    </details>
  );
}

function StepCard({
  step,
  title,
  annotation,
  children,
}: {
  step: (typeof STEP_LABELS)[number];
  title: string;
  annotation: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors duration-300 hover:border-[var(--accent-primary)]/30 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-md border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-[var(--accent-primary)]">
            {step}
          </span>
          <h3 className="mt-3 text-base font-medium tracking-tight text-[var(--text-primary)]">{title}</h3>
        </div>
        <Activity className="mt-1 h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.5} aria-hidden="true" />
      </div>

      {children}

      <p className="mt-6 max-w-prose border-l border-[var(--accent-primary)]/40 pl-3 text-xs leading-relaxed text-[var(--text-muted)]">
        {annotation}
      </p>
    </article>
  );
}

function signed(value: number, digits = 4): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export const MathTraceDrawer: React.FC<MathTraceDrawerProps> = ({ stock, groupIndex }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('theory');
  const [gaussianShock, setGaussianShock] = useState(0);

  const snapshot = useMemo<StockSnapshot | null>(() => {
    if (!stock) return null;

    const currentPrice = Number.isFinite(stock.currentPrice) && stock.currentPrice > 0
      ? stock.currentPrice
      : 1;
    const groupIndexValue = groupIndex.values.length > 0
      ? groupIndex.values[groupIndex.values.length - 1]
      : 0;
    const logPrice = Math.log(currentPrice);
    const spread = logPrice - groupIndexValue;
    const indexByDate = new Map<string, number>();

    groupIndex.dates.forEach((date, index) => {
      const value = groupIndex.values[index];
      if (Number.isFinite(value)) indexByDate.set(date, value);
    });

    const historicalSpreads = stock.history.flatMap((point) => {
      const benchmark = indexByDate.get(point.date);
      if (benchmark === undefined || point.close <= 0 || !Number.isFinite(point.close)) return [];
      return [Math.log(point.close) - benchmark];
    });

    const mean = historicalSpreads.length > 1 ? computeMean(historicalSpreads) : 0;
    const estimatedAnnualVol = (stock.volatilityEst ?? 20) / 100;
    const sigma = historicalSpreads.length > 1
      ? Math.max(computeStdDev(historicalSpreads, mean), 1e-6)
      : Math.max(estimatedAnnualVol / Math.sqrt(252), 1e-6);

    return {
      currentPrice,
      logPrice,
      groupIndex: groupIndexValue,
      spread,
      mean,
      sigma,
      zScore: (spread - mean) / sigma,
      theta: Math.max(stock.thetaEst ?? 0.16, 0.001),
    };
  }, [stock, groupIndex]);

  useEffect(() => {
    setGaussianShock(sampleStandardNormal());
  }, [stock?.ticker]);

  const timeStep = 1;
  const nextSpread = snapshot
    ? eulerMaruyamaStep(
        snapshot.spread,
        snapshot.theta,
        snapshot.mean,
        snapshot.sigma,
        timeStep,
        gaussianShock,
      )
    : 0;
  const drift = snapshot ? snapshot.theta * (snapshot.mean - snapshot.spread) * timeStep : 0;
  const noise = snapshot ? snapshot.sigma * Math.sqrt(timeStep) * gaussianShock : 0;
  const nextPrice = snapshot && Number.isFinite(nextSpread)
    ? Math.exp(nextSpread + snapshot.groupIndex)
    : 0;

  const signal = snapshot && Math.abs(snapshot.zScore) >= 2
    ? 'EXTREME DIVERGENCE DETECTED'
    : snapshot && Math.abs(snapshot.zScore) >= 1
      ? 'ELEVATED DEVIATION'
      : 'WITHIN NORMAL RANGE';
  const isExtreme = snapshot !== null && Math.abs(snapshot.zScore) >= 2;

  const liveSpreadFormula = snapshot
    ? String.raw`\ln(${snapshot.currentPrice.toFixed(2)}) - ${snapshot.groupIndex.toFixed(5)} = ${snapshot.spread.toFixed(5)}`
    : THEORY_FORMULAS.spread;
  const liveZFormula = snapshot
    ? String.raw`\frac{${snapshot.spread.toFixed(5)} - (${snapshot.mean.toFixed(5)})}{${snapshot.sigma.toFixed(5)}} = ${snapshot.zScore.toFixed(2)}`
    : THEORY_FORMULAS.zScore;
  const liveSdeFormula = snapshot
    ? String.raw`dS_t = \underbrace{${snapshot.theta.toFixed(3)}(${snapshot.mean.toFixed(5)} - S_t)dt}_{\text{Reversion Force}} + \underbrace{${snapshot.sigma.toFixed(5)}dW_t}_{\text{Market Noise}}`
    : THEORY_FORMULAS.sde;
  const liveEulerFormula = snapshot
    ? String.raw`S_{t+1} = ${snapshot.spread.toFixed(5)} + ${drift.toFixed(5)} + ${noise.toFixed(5)} = ${nextSpread.toFixed(5)}`
    : THEORY_FORMULAS.euler;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border-default)] px-1 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/5 text-[var(--accent-primary)] shadow-[0_0_18px_color-mix(in_srgb,var(--accent-primary)_8%,transparent)]">
            <Zap className="h-4 w-4" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Stochastic execution trace</p>
            <p className="mt-0.5 truncate text-sm text-[var(--text-primary)]">One path · one trading day · {stock?.shortName ?? 'Select a Tata stock'}</p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="math-trace-panel"
          disabled={!stock}
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg border border-[var(--accent-primary)]/35 bg-[var(--bg-surface)] px-4 py-2.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[var(--text-primary)] shadow-[0_0_20px_color-mix(in_srgb,var(--accent-primary)_8%,transparent)] transition-all hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
        >
          {isOpen ? <ArrowUp className="h-4 w-4 text-[var(--accent-primary)]" /> : <Zap className="h-4 w-4 text-[var(--accent-primary)]" />}
          <span>{isOpen ? 'HIDE STOCHASTIC TRACE' : 'RUN MONTE CARLO EQUATIONS'}</span>
          <span className="hidden text-[var(--text-muted)] sm:inline">{isOpen ? '−' : '↗'}</span>
        </button>
      </div>

      {isOpen && stock && snapshot && (
        <section id="math-trace-panel" className="trace-enter scroll-mt-6 pt-8" aria-label="Stochastic execution telemetry panel">
          <div className="mb-8 flex flex-col justify-between gap-6 border-b border-[var(--border-default)] pb-7 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--state-success)]" />
                Model trace / {stock.ticker}
              </div>
              <h2 className="mt-3 text-2xl font-light tracking-tight text-[var(--text-primary)] sm:text-3xl">
                From relative price to one simulated step.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
                Follow the observed spread through normalization, mean-reverting dynamics, and one stochastic update.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 sm:justify-start" role="group" aria-label="Formula display mode">
              <button
                type="button"
                onClick={() => setDisplayMode('theory')}
                aria-pressed={displayMode === 'theory'}
                className={`min-h-10 rounded-lg px-3.5 font-mono text-[9px] tracking-[0.08em] transition-colors sm:px-4 ${displayMode === 'theory' ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                [ FORMULA THEORY ]
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('live')}
                aria-pressed={displayMode === 'live'}
                className={`min-h-10 rounded-lg px-3.5 font-mono text-[9px] tracking-[0.08em] transition-colors sm:px-4 ${displayMode === 'live' ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                [ LIVE NUMERICAL EVALUATION ]
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            <StepCard
              step={STEP_LABELS[0]}
              title="Log spread · Sᵢ,ₜ"
              annotation="Isolates pure relative price divergence from broader market or group movement."
            >
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 sm:px-5">
                <Formula latex={displayMode === 'theory' ? THEORY_FORMULAS.spread : liveSpreadFormula} />
              </div>
              {displayMode === 'live' && (
                <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
                  <div className="rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Price · Pᵢ,ₜ</p>
                    <p className="mt-2 truncate text-xs text-[var(--text-primary)]">₹{formatINR(snapshot.currentPrice)}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">ln = {snapshot.logPrice.toFixed(5)}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Group · Iₜ</p>
                    <p className="mt-2 text-xs text-[var(--text-primary)]">{snapshot.groupIndex.toFixed(5)}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">log benchmark</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Spread · Sᵢ,ₜ</p>
                    <p className="mt-2 text-xs text-[var(--accent-primary)]">{signed(snapshot.spread, 5)}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">log points</p>
                  </div>
                </div>
              )}
              {displayMode === 'theory' && (
                <p className="mt-4 font-mono text-[10px] text-[var(--text-muted)]">
                  PRICE LOG <span className="px-1.5 text-[var(--accent-primary)]">−</span> GROUP BENCHMARK <span className="px-1.5 text-[var(--accent-primary)]">=</span> RELATIVE SPREAD
                </p>
              )}
            </StepCard>

            <StepCard
              step={STEP_LABELS[1]}
              title="Z-score normalization · z₀"
              annotation="Measures how far the current spread sits from its historical average, in standard deviations (σ)."
            >
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 sm:px-5">
                <Formula latex={displayMode === 'theory' ? THEORY_FORMULAS.zScore : liveZFormula} />
              </div>
              {displayMode === 'live' ? (
                <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
                  <div className="rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Historical mean · μ</p>
                    <p className="mt-2 text-xs text-[var(--text-primary)]">{signed(snapshot.mean, 5)}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Spread deviation · σ</p>
                    <p className="mt-2 text-xs text-[var(--text-primary)]">{snapshot.sigma.toFixed(5)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 font-mono text-[10px] text-[var(--text-muted)]">
                  DISTANCE FROM EQUILIBRIUM <span className="px-1.5 text-[var(--accent-primary)]">÷</span> TYPICAL SPREAD RANGE
                </p>
              )}
              <div className={`mt-4 flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 font-mono ${isExtreme ? 'border-[var(--state-error)]/30 bg-[var(--state-error)]/5' : 'border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5'}`}>
                <span className={`text-xs font-semibold ${isExtreme ? 'text-[var(--state-error)]' : 'text-[var(--accent-primary)]'}`}>
                  Z = {signed(snapshot.zScore, 2)}σ
                </span>
                <span className="text-right text-[9px] tracking-[0.08em] text-[var(--text-primary)]">→ {signal}</span>
              </div>
            </StepCard>

            <StepCard
              step={STEP_LABELS[2]}
              title="Continuous Ornstein–Uhlenbeck SDE"
              annotation="The process combines a deterministic pull toward equilibrium with continuously arriving random market shocks."
            >
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 sm:px-5">
                <Formula latex={displayMode === 'theory' ? THEORY_FORMULAS.sde : liveSdeFormula} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <ParameterProbe symbol="θ" label="reversion speed" definition="How quickly the spread is pulled back toward its long-run mean after a deviation." />
                <ParameterProbe symbol="μ" label="target mean" definition="The historical equilibrium level around which the relative spread fluctuates." />
                <ParameterProbe symbol="σ" label="spread volatility" definition="The scale of unpredictable spread movement per trading-day step." />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/15 bg-[var(--accent-primary)]/[0.035] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                <span className="shrink-0 font-mono text-[var(--accent-primary)]">MODEL READ</span>
                <span>θ(μ − Sₜ)dt <span className="text-[var(--text-primary)]">[ REVERSION FORCE / RUBBER-BAND PULL ]</span></span>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                <span className="shrink-0 font-mono text-[var(--accent-primary)]">MODEL READ</span>
                <span>σdWₜ <span className="text-[var(--text-primary)]">[ RANDOM MARKET NOISE ]</span></span>
              </div>
            </StepCard>

            <StepCard
              step={STEP_LABELS[3]}
              title="Euler–Maruyama path step"
              annotation="Turns the continuous model into one discrete trading-day move using a fresh standard-normal shock."
            >
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 sm:px-5">
                <Formula latex={displayMode === 'theory' ? THEORY_FORMULAS.euler : liveEulerFormula} />
              </div>
              <div className="mt-4 rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--bg-base)] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">One-step random draw</p>
                    <p className="mt-1.5 font-mono text-sm text-[var(--text-primary)]">Zₖ ∼ 𝒩(0, 1)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGaussianShock(sampleStandardNormal())}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 font-mono text-[9px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    aria-label="Generate a new Gaussian shock"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.7} />
                    RE-ROLL SHOCK
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
                  <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[9px] text-[var(--text-muted)]">Zₖ DRAW</p>
                    <p className="mt-2 text-sm text-[var(--accent-primary)]">{signed(gaussianShock, 3)}</p>
                  </div>
                  <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[9px] text-[var(--text-muted)]">REVERSION</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{signed(drift, 5)}</p>
                  </div>
                  <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[9px] text-[var(--text-muted)]">RANDOM NOISE</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{signed(noise, 5)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-3 font-mono">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Next spread · Sₜ₊₁</p>
                    <p key={`${stock.ticker}-${gaussianShock}`} className="trace-value mt-1 text-base text-[var(--text-primary)]">{signed(nextSpread, 5)}</p>
                  </div>
                  <ArrowDown className="h-4 w-4 shrink-0 rotate-[-45deg] text-[var(--accent-primary)]" strokeWidth={1.5} aria-hidden="true" />
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Implied next price</p>
                    <p className="mt-1 text-base text-[var(--accent-primary)]">₹{formatINR(nextPrice)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
                  Implied price holds the latest group index constant for this one-step illustration.
                </p>
              </div>
            </StepCard>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-5 text-[10px] text-[var(--text-muted)]">
            <p className="font-mono">CALIBRATION · {stock.shortName} HISTORICAL SPREAD SERIES</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <X className="h-3.5 w-3.5" />
              Close trace
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
