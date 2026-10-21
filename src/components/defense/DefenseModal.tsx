'use client';

import React, { useState } from 'react';
import { DEFENSE_QA_CARDS, DefenseItem } from '@/lib/data/defense-data';
import { X, BookOpen, CheckCircle2 } from 'lucide-react';

interface DefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCard?: DefenseItem | null;
}

export const DefenseModal: React.FC<DefenseModalProps> = ({
  isOpen,
  onClose,
  activeCard,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!isOpen) return null;

  const card = activeCard || DEFENSE_QA_CARDS[activeIndex] || DEFENSE_QA_CARDS[0];

  return (
    <div className="apple-fade-in fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-2 backdrop-blur-xl select-none sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="defense-dialog-title" className="apple-reveal relative flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="text-[11px] uppercase font-mono px-2 py-1 rounded bg-muted text-primary border border-border sm:text-xs">
              {card.badge}
            </span>
            <h3 id="defense-dialog-title" className="mt-2 text-base font-medium tracking-tight text-foreground sm:text-lg">
              {card.question}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close theory dialog"
            className="apple-interactive flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Question Selector Tabs */}
        <div className="flex border-b border-border overflow-x-auto text-sm font-mono bg-background px-4">
          {DEFENSE_QA_CARDS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveIndex(i)}
              className={`apple-interactive min-h-12 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 font-medium ${
                activeIndex === i
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.category}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="space-y-7 overflow-y-auto p-5 text-sm leading-relaxed text-foreground/90 sm:p-8 sm:text-base">
          <div>
            <h4 className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Summary</span>
            </h4>
            <p className="leading-relaxed bg-background p-4 rounded-xl border border-border text-foreground/80 font-mono text-xs sm:p-5 sm:text-sm">
              {card.summary}
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Mathematical Derivation
            </h4>
            <div className="bg-background p-4 rounded-xl border border-border space-y-4 font-mono text-xs leading-relaxed text-foreground/80 sm:p-5 sm:text-sm">
              <p className="leading-relaxed">{card.detailedProof}</p>

              {card.equations && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-[11px] text-muted-foreground uppercase sm:text-xs">Formulas & SDE Discretization:</div>
                  {card.equations.map((eq: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded bg-card border border-border text-primary font-mono text-sm tracking-wide"
                    >
                      {eq}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Key Conclusion */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-xs font-bold text-emerald-400 uppercase sm:text-sm">
                Key Takeaway
              </div>
              <p className="font-mono text-xs text-foreground/90 mt-1 sm:text-sm">
                {card.takeaway}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card flex justify-end">
          <button
            onClick={onClose}
            className="apple-interactive min-h-11 cursor-pointer rounded-full border border-border bg-muted px-6 py-2 text-sm font-mono text-foreground hover:border-primary/40 hover:bg-muted/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
