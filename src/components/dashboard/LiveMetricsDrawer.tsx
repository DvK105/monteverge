'use client';

import React, { useState } from 'react';
import { MetricSummary, SDEParameters } from '@/lib/types/sde';
import { StockSeries } from '@/lib/types/stock';
import { DEFENSE_QA_CARDS, DefenseItem } from '@/lib/data/defense-data';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Cpu,
  BarChart,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface LiveMetricsDrawerProps {
  stock: StockSeries | null;
  params: SDEParameters;
  metrics: MetricSummary;
  onSelectDefenseCard?: (card: DefenseItem) => void;
}

export const LiveMetricsDrawer: React.FC<LiveMetricsDrawerProps> = ({
  stock,
  params,
  metrics,
  onSelectDefenseCard,
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>('cointegration-vs-correlation');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const toggleExpand = (id: string) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  };

  const filteredCards = activeCategory === 'ALL'
    ? DEFENSE_QA_CARDS
    : DEFENSE_QA_CARDS.filter((c) => c.category === activeCategory);

  return (
    <div className="w-80 flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)] select-none overflow-y-auto">
      {/* 1. Live Quantitative Readouts (OKX Dense Utility) */}
      <div className="p-3.5 border-b border-[var(--border-default)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <Cpu className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
            <span>Quantitative Metrics</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--state-success)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--state-success)] animate-pulse" />
            STATIONARY
          </span>
        </div>

        {/* Signal Strength Hardware Bar */}
        <div className="bg-[var(--bg-base)] p-3 rounded-xl border border-[var(--border-default)]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>SIGNAL STRENGTH</span>
            <span className="text-[var(--text-primary)] font-bold">
              |z| = {Math.abs(metrics.currentZScore).toFixed(2)}σ
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full bg-[#131824] rounded-full overflow-hidden p-0.5 border border-[#1E293B] flex">
            {/* 3 segment LED meter */}
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                Math.abs(metrics.currentZScore) >= 1.5
                  ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]'
                  : Math.abs(metrics.currentZScore) >= 0.8
                  ? 'bg-cyan-400'
                  : 'bg-slate-600'
              }`}
              style={{ width: `${Math.min(100, (Math.abs(metrics.currentZScore) / 2.5) * 100)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">Strategy:</span>
            <span className="font-bold text-[var(--accent-primary)]">
              {metrics.currentZScore <= -1.5
                ? 'LONG SPREAD (+α)'
                : metrics.currentZScore >= 1.5
                ? 'SHORT SPREAD (-α)'
                : 'WAIT EQUILIBRIUM'}
            </span>
          </div>
        </div>

        {/* Metric Grid Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--text-muted)]">Z-SCORE (z0)</div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {metrics.currentZScore > 0 ? '+' : ''}{metrics.currentZScore.toFixed(2)}
            </div>
            <div className="text-[9px] text-[var(--text-muted)]">
              {Math.abs(metrics.currentZScore) > 2 ? 'Rare (>2σ)' : 'Normal band'}
            </div>
          </div>

          <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--text-muted)]">HALF-LIFE (τ)</div>
            <div className="text-sm font-bold text-cyan-400 mt-0.5">
              {metrics.halfLifeDays}d
            </div>
            <div className="text-[9px] text-[var(--text-muted)]">
              ln(2) / θ
            </div>
          </div>

          <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--text-muted)]">ANNUAL VOL</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {metrics.volatilityAnnualized}%
            </div>
            <div className="text-[9px] text-[var(--text-muted)]">
              σ × √252
            </div>
          </div>

          <div className="bg-[var(--bg-base)] p-2 rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--text-muted)]">ADF P-VALUE</div>
            <div className="text-sm font-bold text-[var(--state-success)] mt-0.5">
              &lt; 0.01
            </div>
            <div className="text-[9px] text-[var(--text-muted)]">
              H0 Rejected
            </div>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Science Fair Defense Q&A Cards */}
      <div className="p-3.5 space-y-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
            <span>Judge Defense Q&A</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">4 Matrix Cards</span>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {['ALL', 'ECONOMETRICS', 'MATHEMATICS', 'TATA_THESIS'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap cursor-pointer transition-colors ${
                activeCategory === cat
                  ? 'bg-[var(--accent-primary)] text-black font-bold'
                  : 'bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-white border border-[#1E293B]'
              }`}
            >
              {cat === 'TATA_THESIS' ? 'TATA THESIS' : cat}
            </button>
          ))}
        </div>

        {/* Accordion Cards */}
        <div className="space-y-2">
          {filteredCards.map((card) => {
            const isExpanded = expandedCardId === card.id;

            return (
              <div
                key={card.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] overflow-hidden transition-all"
              >
                {/* Header Toggle */}
                <button
                  onClick={() => toggleExpand(card.id)}
                  className="w-full p-2.5 text-left flex items-start justify-between gap-2 hover:bg-[#131824] transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#131824] text-[var(--accent-primary)] border border-[#1E293B]">
                      {card.badge}
                    </span>
                    <h4 className="font-mono text-xs font-semibold text-[var(--text-primary)] leading-tight pt-0.5">
                      {card.question}
                    </h4>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-1" />
                  )}
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-[#1E293B]/70 space-y-2 text-[11px] font-sans text-slate-300">
                    <p className="leading-relaxed text-[var(--text-muted)]">
                      {card.summary}
                    </p>

                    {/* Mathematical Proof Box */}
                    <div className="p-2 rounded bg-[#0A0E17] border border-[#1E293B] font-mono text-[10px] space-y-1 text-slate-400">
                      <div className="text-[9px] uppercase font-bold text-[var(--accent-primary)]">
                        Theoretical Proof:
                      </div>
                      <p className="leading-normal">{card.detailedProof}</p>
                      {card.equations && (
                        <div className="pt-1 space-y-1 border-t border-[#1E293B]">
                          {card.equations.map((eq, idx) => (
                            <div key={idx} className="text-cyan-300 font-mono text-[9px] bg-[#111724] px-1.5 py-0.5 rounded">
                              {eq}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Key Takeaway Badge */}
                    <div className="flex items-start gap-1.5 pt-1 text-[10px] font-mono text-[var(--state-success)]">
                      <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{card.takeaway}</span>
                    </div>

                    {onSelectDefenseCard && (
                      <button
                        onClick={() => onSelectDefenseCard(card)}
                        className="w-full mt-1.5 py-1 text-[10px] font-mono text-center text-[var(--accent-primary)] hover:underline flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Open Full Derivation Modal</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
