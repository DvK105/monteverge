'use client';

import React from 'react';
import { Activity, ShieldCheck, Zap, Database, Wifi, Sliders } from 'lucide-react';

interface HeaderBarProps {
  dataSource: 'live' | 'cache' | 'offline_fallback';
  lastUpdated: string;
  workerLatencyMs: number;
  selectedTicker: string;
  onOpenDefenseModal?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  dataSource,
  lastUpdated,
  workerLatencyMs,
  selectedTicker,
  onOpenDefenseModal,
}) => {
  const isLive = dataSource === 'live';
  const isCache = dataSource === 'cache';

  return (
    <header className="h-14 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 flex items-center justify-between select-none">
      {/* Left: Brand & Architecture Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#131824] border border-[#1E293B] shadow-inner">
          <span className="font-mono text-xs font-black text-[var(--accent-primary)] tracking-tighter">
            MV
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm font-semibold tracking-wider text-[var(--text-primary)]">
              MONTEVERGE
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#131824] text-[var(--text-muted)] border border-[#1E293B]">
              v1.0-STOCHASTIC
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] font-mono leading-none">
            Tata Group OU Mean-Reversion Engine • NSE Universe
          </p>
        </div>
      </div>

      {/* Center: Live Execution & System Target Monitor */}
      <div className="hidden md:flex items-center gap-4 bg-[var(--bg-base)] px-3 py-1.5 rounded-lg border border-[var(--border-default)]">
        {/* Worker Latency Target Monitor */}
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
          <div className="text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">WORKER: </span>
            <span className={`font-bold ${workerLatencyMs <= 50 ? 'text-[var(--state-success)]' : 'text-amber-400'}`}>
              {workerLatencyMs}ms
            </span>
            <span className="text-[10px] text-[var(--text-muted)]"> (TARGET &lt;50ms)</span>
          </div>
        </div>

        <div className="h-3 w-px bg-[var(--border-default)]" />

        {/* Data Feed / Market Status Badge */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <Wifi className="h-3.5 w-3.5 text-[var(--state-success)] animate-pulse" strokeWidth={2} />
          ) : (
            <Database className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} />
          )}
          <div className="text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">FEED: </span>
            <span
              className={`font-semibold uppercase ${
                isLive
                  ? 'text-[var(--state-success)]'
                  : isCache
                  ? 'text-cyan-400'
                  : 'text-amber-400'
              }`}
            >
              {isLive ? 'LIVE YAHOO/NSE' : isCache ? 'CACHED (IN-MEMORY)' : 'AIR-GAPPED DEMO FIXTURE'}
            </span>
          </div>
        </div>

        <div className="h-3 w-px bg-[var(--border-default)]" />

        {/* Active Focus Ticker */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-[var(--text-muted)]">ACTIVE: </span>
          <span className="text-[var(--accent-primary)] font-bold">{selectedTicker}</span>
        </div>
      </div>

      {/* Right: Science Fair Presentation Trigger & Status Indicator */}
      <div className="flex items-center gap-2.5">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131824] border border-[#1E293B] text-[11px] font-mono text-[var(--text-muted)]">
          <Activity className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
          <span>Euler-Maruyama 1K Paths</span>
        </div>

        {onOpenDefenseModal && (
          <button
            onClick={onOpenDefenseModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131824] hover:bg-[#1E293B] text-[var(--text-primary)] border border-[var(--border-default)] text-xs font-mono transition-colors cursor-pointer"
            title="Open Science Fair Mathematical Derivations & Judge Defense"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
            <span className="hidden sm:inline">Defense Matrix</span>
          </button>
        )}
      </div>
    </header>
  );
};
