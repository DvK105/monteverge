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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
          <div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-muted text-primary border border-border">
              {card.badge}
            </span>
            <h3 className="text-base font-medium text-foreground mt-1.5">
              {card.question}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Question Selector Tabs */}
        <div className="flex border-b border-border overflow-x-auto text-xs font-mono bg-background px-4">
          {DEFENSE_QA_CARDS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveIndex(i)}
              className={`px-3 py-2.5 whitespace-nowrap border-b-2 font-medium transition-colors cursor-pointer ${
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-foreground/90">
          <div>
            <h4 className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Summary</span>
            </h4>
            <p className="leading-relaxed bg-background p-3.5 rounded-xl border border-border text-foreground/80 font-mono text-[11px]">
              {card.summary}
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Mathematical Derivation
            </h4>
            <div className="bg-background p-4 rounded-xl border border-border space-y-3 font-mono text-[11px] text-foreground/80">
              <p className="leading-relaxed">{card.detailedProof}</p>

              {card.equations && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Formulas & SDE Discretization:</div>
                  {card.equations.map((eq: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-card border border-border text-primary font-mono text-xs tracking-wide"
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
              <div className="font-mono text-[11px] font-bold text-emerald-400 uppercase">
                Key Takeaway
              </div>
              <p className="font-mono text-[11px] text-foreground/90 mt-0.5">
                {card.takeaway}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-mono text-foreground cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
