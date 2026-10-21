'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, X } from 'lucide-react';

export const MonteCarloTrigger: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center select-none py-4">
      {/* Simple, Clean Action Button */}
      <button
        onClick={() => setModalOpen(true)}
        className="px-6 py-3.5 rounded-xl bg-card hover:bg-muted border border-border hover:border-primary/50 text-foreground transition-all cursor-pointer flex items-center gap-3 text-sm font-medium shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-primary" />
        <Play className="h-4 w-4 text-primary fill-primary" />
        <span>Run 1,000-Path Monte Carlo Simulation</span>
      </button>

      <p className="mt-2 text-xs text-muted-foreground">
        Euler-Maruyama continuous SDE solver • Horizon = 20 Days
      </p>

      {/* Clean Dark Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-primary border border-border">
                  Engine Ready
                </span>
                <h3 className="text-lg font-medium text-foreground mt-1">
                  Monte Carlo Stochastic Simulation
                </h3>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-foreground font-mono">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>1,000 Stochastic trajectories calibrated.</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                Euler-Maruyama discretization generates 1,000 paths across the 20-day horizon using active Tata Group index spread parameters.
              </p>
            </div>

            {/* Spec Highlights */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Horizon</div>
                <div className="font-semibold text-foreground mt-0.5">20 Days</div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Paths</div>
                <div className="font-semibold text-primary mt-0.5">1,000</div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Scheme</div>
                <div className="font-semibold text-foreground mt-0.5">Euler OU</div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
