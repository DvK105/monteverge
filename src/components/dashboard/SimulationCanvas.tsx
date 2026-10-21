'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SDEParameters, MetricSummary } from '@/lib/types/sde';
import { StockSeries } from '@/lib/types/stock';
import { eulerMaruyamaStep, computeOUExpectation, computeOUVariance } from '@/lib/quant/stochasticEngine';
import { Play, Sparkles, RefreshCw, Layers, TrendingUp, BarChart2 } from 'lucide-react';

interface SimulationCanvasProps {
  stock: StockSeries | null;
  params: SDEParameters;
  metrics: MetricSummary;
  groupIndexLatest: number;
  onHorizonChange: (horizon: number) => void;
  onZ0Change: (z0: number) => void;
  onRunSimulation: () => void;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  stock,
  params,
  metrics,
  groupIndexLatest,
  onHorizonChange,
  onZ0Change,
  onRunSimulation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<'fanChart' | 'timeSeries' | 'density'>('fanChart');
  const [simSeed, setSimSeed] = useState(0);

  // Current initial log spread S0
  const currentSpread = useMemo(() => {
    if (!stock || groupIndexLatest <= 0) return 0.045;
    return Math.log(stock.currentPrice) - groupIndexLatest;
  }, [stock, groupIndexLatest]);

  // Fast client-side Euler-Maruyama Monte Carlo simulation of 1,000 paths
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, width, height);

    // Padding
    const padX = 55;
    const padY = 35;
    const plotW = width - padX - 25;
    const plotH = height - padY * 2;

    const horizon = params.horizon;
    const dt = 1.0; // 1 trading day per step
    const numPaths = 1000;
    const s0 = currentSpread;

    // Generate paths and track percentiles
    // Simple deterministic pseudo-random or fast Box-Muller generator
    let seed = 42 + simSeed;
    function randNormal(): number {
      seed = (seed * 9301 + 49297) % 233280;
      const u1 = Math.max(1e-7, seed / 233280);
      seed = (seed * 9301 + 49297) % 233280;
      const u2 = seed / 233280;
      return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    const pathsAtSteps: number[][] = Array.from({ length: horizon + 1 }, () => []);
    const sampleRenderPaths: number[][] = [];
    const sampleLimit = 40; // draw 40 representative individual stochastic paths

    for (let p = 0; p < numPaths; p++) {
      let currentS = s0;
      const path: number[] = [s0];
      pathsAtSteps[0].push(s0);

      for (let t = 1; t <= horizon; t++) {
        const z = randNormal();
        currentS = eulerMaruyamaStep(currentS, params.theta, params.mu, params.sigma, dt, z);
        path.push(currentS);
        pathsAtSteps[t].push(currentS);
      }

      if (p < sampleLimit) {
        sampleRenderPaths.push(path);
      }
    }

    // Sort steps to compute 10th, 50th (median), and 90th percentiles
    const p10: number[] = [];
    const p50: number[] = [];
    const p90: number[] = [];

    for (let t = 0; t <= horizon; t++) {
      const stepVals = pathsAtSteps[t].sort((a, b) => a - b);
      p10.push(stepVals[Math.floor(numPaths * 0.10)]);
      p50.push(stepVals[Math.floor(numPaths * 0.50)]);
      p90.push(stepVals[Math.floor(numPaths * 0.90)]);
    }

    // Determine Y range with padding
    const allMin = Math.min(s0, params.mu, ...p10);
    const allMax = Math.max(s0, params.mu, ...p90);
    const span = Math.max(allMax - allMin, 0.05);
    const yMin = allMin - span * 0.15;
    const yMax = allMax + span * 0.15;

    const toX = (step: number) => padX + (step / horizon) * plotW;
    const toY = (val: number) => padY + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    // 1. Gridlines & Y-Axis labels
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const val = yMin + (i / yTicks) * (yMax - yMin);
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - 25, y);
      ctx.stroke();

      const label = (val * 100).toFixed(1) + '%';
      ctx.fillText(label, padX - 8, y + 3);
    }

    // X-Axis labels
    ctx.textAlign = 'center';
    const xStepInterval = Math.max(1, Math.floor(horizon / 5));
    for (let step = 0; step <= horizon; step += xStepInterval) {
      const x = toX(step);
      ctx.beginPath();
      ctx.moveTo(x, padY);
      ctx.lineTo(x, height - padY);
      ctx.stroke();

      ctx.fillText(`T+${step}d`, x, height - padY + 16);
    }

    // 2. Target Mean Line (mu)
    const yMu = toY(params.mu);
    ctx.save();
    ctx.strokeStyle = '#7000FF';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, yMu);
    ctx.lineTo(width - 25, yMu);
    ctx.stroke();
    ctx.restore();

    // Label Target Mean
    ctx.fillStyle = '#A78BFA';
    ctx.textAlign = 'left';
    ctx.fillText(`Target Equilibrium μ = ${(params.mu * 100).toFixed(1)}%`, padX + 10, yMu - 6);

    // 3. 10th - 90th Confidence Corridor Shading
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(p10[0]));
    for (let t = 1; t <= horizon; t++) {
      ctx.lineTo(toX(t), toY(p10[t]));
    }
    for (let t = horizon; t >= 0; t--) {
      ctx.lineTo(toX(t), toY(p90[t]));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.fill();

    // Border of corridor
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Sample stochastic paths (additive noise)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 0.8;
    for (const path of sampleRenderPaths) {
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(path[0]));
      for (let t = 1; t <= horizon; t++) {
        ctx.lineTo(toX(t), toY(path[t]));
      }
      ctx.stroke();
    }

    // 5. Highlighted Median Path (50th percentile)
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(p50[0]));
    for (let t = 1; t <= horizon; t++) {
      ctx.lineTo(toX(t), toY(p50[t]));
    }
    ctx.stroke();

    // 6. Starting Point Marker (S0)
    const yS0 = toY(s0);
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.arc(padX, yS0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#07090E';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label Starting Point
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'left';
    ctx.fillText(`S0 = ${(s0 * 100).toFixed(2)}%`, padX + 8, yS0 + 4);
  }, [params, currentSpread, simSeed]);

  const handleSimulate = () => {
    setSimSeed((prev) => prev + 1);
    onRunSimulation();
  };

  const handleScenarioShock = (type: 'earnings' | 'supply' | 'equilibrium') => {
    if (type === 'earnings') {
      onZ0Change(-2.2);
    } else if (type === 'supply') {
      onZ0Change(1.9);
    } else {
      onZ0Change(0.0);
    }
    setSimSeed((prev) => prev + 1);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-base)] overflow-hidden border-r border-[var(--border-default)]">
      {/* Top Workspace Ribbon */}
      <div className="h-11 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
              {stock?.ticker || 'TCS.NS'}
            </span>
            <span className="text-[10px] font-mono text-[var(--accent-primary)] bg-[#131824] px-1.5 py-0.5 rounded border border-[#1E293B]">
              Spread S_t: {(currentSpread * 100).toFixed(2)}%
            </span>
          </div>

          <div className="h-4 w-px bg-[var(--border-default)]" />

          {/* Quick Scenario Shocks */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono">
            <span className="text-[var(--text-muted)] text-[10px] mr-1">SCENARIOS:</span>
            <button
              onClick={() => handleScenarioShock('earnings')}
              className="px-2 py-0.5 rounded bg-[#131824] hover:bg-[#1E293B] border border-[#1E293B] text-cyan-400 text-[10px] cursor-pointer"
            >
              Earnings Dip (z = -2.2)
            </button>
            <button
              onClick={() => handleScenarioShock('supply')}
              className="px-2 py-0.5 rounded bg-[#131824] hover:bg-[#1E293B] border border-[#1E293B] text-purple-400 text-[10px] cursor-pointer"
            >
              Supply Surge (z = +1.9)
            </button>
            <button
              onClick={() => handleScenarioShock('equilibrium')}
              className="px-2 py-0.5 rounded bg-[#131824] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 text-[10px] cursor-pointer"
            >
              Par (z = 0)
            </button>
          </div>
        </div>

        {/* Horizon selector chips and run simulation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md bg-[var(--bg-base)] p-0.5 border border-[var(--border-default)]">
            {[5, 10, 20, 40, 60].map((h) => (
              <button
                key={h}
                onClick={() => onHorizonChange(h)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                  params.horizon === h
                    ? 'bg-[var(--accent-primary)] text-black font-bold'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          <button
            onClick={handleSimulate}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-primary)] hover:bg-[#20f5ff] text-black font-mono text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)] cursor-pointer"
          >
            <Play className="h-3 w-3 fill-black" />
            <span>RE-RUN 1K PATHS</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative p-3 flex flex-col">
        {/* Mathematical HUD Banner */}
        <div className="absolute top-5 left-5 z-10 bg-[#0D111A]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E293B] flex items-center gap-3">
          <div className="font-mono text-xs text-[var(--text-primary)]">
            <span className="text-[var(--text-muted)]">SDE: </span>
            <span className="text-[var(--accent-primary)] font-semibold">
              dS_t = {params.theta.toFixed(2)}({params.mu.toFixed(2)} - S_t)dt + {params.sigma.toFixed(3)}dW_t
            </span>
          </div>
          <div className="h-3 w-px bg-[var(--border-default)]" />
          <div className="font-mono text-[10px] text-[var(--text-muted)]">
            Euler-Maruyama Discretization (Δt=1.0)
          </div>
        </div>

        {/* High performance Canvas */}
        <div className="flex-1 w-full h-full rounded-xl overflow-hidden border border-[var(--border-default)] bg-[#07090E] shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Bottom Probability & Quantitative Readouts Ribbon */}
      <div className="h-20 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
        {/* Card 1: Reversion Probability */}
        <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] flex items-center justify-between">
            <span>P(Reversion in {params.horizon}d)</span>
            <Sparkles className="h-2.5 w-2.5 text-[var(--accent-primary)]" />
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-mono text-base font-black text-[var(--state-success)]">
              {(metrics.reversionProbability * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">
              |S_T| &lt; |S_0|
            </span>
          </div>
        </div>

        {/* Card 2: Half-Life Decay */}
        <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)]">
            Half-Life Decay (τ)
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-base font-bold text-cyan-400">
              {metrics.halfLifeDays}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">trading days</span>
          </div>
        </div>

        {/* Card 3: Expected Spread E[S_{t+H}] */}
        <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)]">
            Expected Spread E[S_H]
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-base font-bold text-purple-400">
              {(computeOUExpectation(currentSpread, params.theta, params.mu, params.horizon) * 100).toFixed(2)}%
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">
              vs μ={(params.mu * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card 4: Signal Recommendation Badge */}
        <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)]">
            Algorithmic Bias
          </div>
          <div className="mt-0.5">
            <span
              className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                metrics.signalRecommendation === 'STRONG_REVERSION_LONG'
                  ? 'bg-emerald-950/60 text-[var(--state-success)] border-emerald-800'
                  : metrics.signalRecommendation === 'STRONG_REVERSION_SHORT'
                  ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              {metrics.signalRecommendation.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
