'use client';

import React from 'react';
import { SDEParameters } from '@/lib/types/sde';
import { Sliders, RotateCcw, Clock, Target, Activity, Calendar } from 'lucide-react';
import { computeHalfLife } from '@/lib/quant/stochasticEngine';

interface TactileSDESlidersProps {
  params: SDEParameters;
  onChange: (params: SDEParameters) => void;
  onReset: () => void;
}

export const TactileSDESliders: React.FC<TactileSDESlidersProps> = ({
  params,
  onChange,
  onReset,
}) => {
  const halfLife = computeHalfLife(params.theta);
  const annualizedVol = (params.sigma * Math.sqrt(252) * 100).toFixed(1);

  const updateParam = <K extends keyof SDEParameters>(key: K, value: SDEParameters[K]) => {
    onChange({
      ...params,
      [key]: value,
    });
  };

  const applyPreset = (preset: 'typical' | 'friction' | 'fast' | 'regime') => {
    switch (preset) {
      case 'typical':
        onChange({ ...params, theta: 0.15, mu: 0.0, sigma: 0.022, horizon: 20 });
        break;
      case 'friction':
        onChange({ ...params, theta: 0.05, mu: 0.0, sigma: 0.015, horizon: 30 });
        break;
      case 'fast':
        onChange({ ...params, theta: 0.35, mu: 0.0, sigma: 0.030, horizon: 10 });
        break;
      case 'regime':
        onChange({ ...params, theta: 0.02, mu: 0.08, sigma: 0.045, horizon: 40 });
        break;
    }
  };

  return (
    <div className="space-y-4 bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-default)]">
      {/* Title & Presets Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <Sliders className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
          <span>SDE Calibration</span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
          title="Reset to default baseline"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          <span>RESET</span>
        </button>
      </div>

      {/* Preset Buttons - Teenage Engineering Hardware Toggles */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => applyPreset('typical')}
          className="px-2 py-1.5 rounded-md bg-[#131824] hover:bg-[#1A2234] border border-[#1E293B] text-[10px] font-mono text-left text-[var(--text-primary)] transition-all cursor-pointer flex flex-col"
        >
          <span className="font-bold text-cyan-400">Typical Noise</span>
          <span className="text-[9px] text-[var(--text-muted)]">θ=0.15 • τ=4.6d</span>
        </button>
        <button
          onClick={() => applyPreset('fast')}
          className="px-2 py-1.5 rounded-md bg-[#131824] hover:bg-[#1A2234] border border-[#1E293B] text-[10px] font-mono text-left text-[var(--text-primary)] transition-all cursor-pointer flex flex-col"
        >
          <span className="font-bold text-emerald-400">Fast Arbitrage</span>
          <span className="text-[9px] text-[var(--text-muted)]">θ=0.35 • τ=2.0d</span>
        </button>
        <button
          onClick={() => applyPreset('friction')}
          className="px-2 py-1.5 rounded-md bg-[#131824] hover:bg-[#1A2234] border border-[#1E293B] text-[10px] font-mono text-left text-[var(--text-primary)] transition-all cursor-pointer flex flex-col"
        >
          <span className="font-bold text-indigo-400">High Friction</span>
          <span className="text-[9px] text-[var(--text-muted)]">θ=0.05 • τ=13.9d</span>
        </button>
        <button
          onClick={() => applyPreset('regime')}
          className="px-2 py-1.5 rounded-md bg-[#131824] hover:bg-[#1A2234] border border-[#1E293B] text-[10px] font-mono text-left text-[var(--text-primary)] transition-all cursor-pointer flex flex-col"
        >
          <span className="font-bold text-rose-400">Regime Break</span>
          <span className="text-[9px] text-[var(--text-muted)]">θ=0.02 • Drift</span>
        </button>
      </div>

      <div className="space-y-3.5 pt-1">
        {/* Slider 1: Theta (Speed of Reversion) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <Clock className="h-3 w-3 text-cyan-400" />
              <span>Speed (θ)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-muted)]">
                Half-life: <span className="text-cyan-400 font-semibold">{halfLife.toFixed(1)}d</span>
              </span>
              <span className="font-bold text-[var(--accent-primary)] bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[#1E293B]">
                {params.theta.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('theta', Math.max(0.01, +(params.theta - 0.01).toFixed(2)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="0.01"
              max="0.50"
              step="0.01"
              value={params.theta}
              onChange={(e) => updateParam('theta', parseFloat(e.target.value))}
              className="w-full"
            />
            <button
              onClick={() => updateParam('theta', Math.min(0.50, +(params.theta + 0.01).toFixed(2)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>0.01 (Weak)</span>
            <span>0.50 (Aggressive)</span>
          </div>
        </div>

        {/* Slider 2: Mu (Long-Term Equilibrium Mean) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <Target className="h-3 w-3 text-purple-400" />
              <span>Mean Target (μ)</span>
            </div>
            <span className="font-bold text-purple-400 bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[#1E293B]">
              {params.mu > 0 ? '+' : ''}{params.mu.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('mu', Math.max(-0.10, +(params.mu - 0.005).toFixed(3)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="-0.10"
              max="0.10"
              step="0.005"
              value={params.mu}
              onChange={(e) => updateParam('mu', parseFloat(e.target.value))}
              className="w-full"
            />
            <button
              onClick={() => updateParam('mu', Math.min(0.10, +(params.mu + 0.005).toFixed(3)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>-0.10 (Discount)</span>
            <span>0.0 (Par)</span>
            <span>+0.10 (Premium)</span>
          </div>
        </div>

        {/* Slider 3: Sigma (Diffusion Volatility) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>Volatility (σ)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-muted)]">
                Ann: <span className="text-emerald-400 font-semibold">{annualizedVol}%</span>
              </span>
              <span className="font-bold text-emerald-400 bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[#1E293B]">
                {(params.sigma * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('sigma', Math.max(0.005, +(params.sigma - 0.001).toFixed(3)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="0.005"
              max="0.080"
              step="0.001"
              value={params.sigma}
              onChange={(e) => updateParam('sigma', parseFloat(e.target.value))}
              className="w-full"
            />
            <button
              onClick={() => updateParam('sigma', Math.min(0.080, +(params.sigma + 0.001).toFixed(3)))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>0.5% (Subdued)</span>
            <span>8.0% (Turbulent)</span>
          </div>
        </div>

        {/* Slider 4: Forecast Horizon H */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <Calendar className="h-3 w-3 text-amber-400" />
              <span>Horizon (H)</span>
            </div>
            <span className="font-bold text-amber-400 bg-[var(--bg-base)] px-1.5 py-0.5 rounded border border-[#1E293B]">
              {params.horizon} Trading Days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('horizon', Math.max(5, params.horizon - 1))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={params.horizon}
              onChange={(e) => updateParam('horizon', parseInt(e.target.value, 10))}
              className="w-full"
            />
            <button
              onClick={() => updateParam('horizon', Math.min(60, params.horizon + 1))}
              className="w-5 h-5 rounded bg-[#131824] border border-[#1E293B] text-xs font-mono text-[var(--text-muted)] hover:text-white flex items-center justify-center cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>5 Days</span>
            <span>20 Days (1M)</span>
            <span>60 Days (1Q)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
