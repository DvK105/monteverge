# Architecture Context

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript | Full-stack application foundation, server-side API endpoints, and client-side reactive component rendering |
| UI & Styling | Tailwind CSS v4 + shadcn/ui + Lucide Icons | Responsive Apple-like dark UI using the existing `index.css` tokens, spacious cards, subtle motion, and accessible dialogs |
| Data Visualization | Chart.js / Recharts + HTML5 Canvas API | Real-time interactive chart rendering for 1,000 Monte Carlo simulation paths, confidence intervals, and probability distributions |
| Compute Engine | Web Workers / Pure TypeScript Modules | Off-thread parallel execution of Euler-Maruyama stochastic differential equations ensuring execution completes under 50ms |
| Local State / Storage | Zustand + React Context + IndexedDB | Client-side simulation parameter state management, custom scenario saving, backtest caching, and offline persistence |

## System Boundaries

- `lib/quant/` — Pure mathematical engine. Owns log price transformations ($\ln(P_{i,t})$), group index calculations ($I_t$), Z-score standardizations ($z$), and Euler-Maruyama SDE solvers. Strictly isolated with zero React or DOM dependencies.
- `lib/simulators/` — Monte Carlo path generators, parallelized Web Worker orchestration with computed path-count snapshots and a sampled path trace, probability aggregation, and empirical backtesting logic.
- `components/simulation/` and `app/simulation/[ticker]/` — Dedicated per-equity simulation route, worker lifecycle, result interpretation, and responsive quantile fan chart.
- `components/dashboard/` — Interactive UI layouts, parameter slider controls ($\theta, \mu, \sigma$), live metrics cards, and scenario selector panels.
- `components/charts/` — Visual rendering layer for time-series stock spreads, Monte Carlo path fan charts, and comparative histograms.
- `components/defense/` — Science Fair Judge Q&A matrix, interactive mathematical derivation modals, and cointegration vs correlation breakdown panels.
- `app/api/` — Next.js API routes for fetching daily historical stock price data for the 6 Tata Group equities (TCS, Tata Motors, Tata Steel, Tata Power, Tata Consumer, Titan) via Yahoo Finance / NSE feeds.

## Storage Model

- **Client State (Zustand & React Context)**: Active OU parameters ($\theta$, $\mu$, $\sigma$), simulation horizon ($H$), stock weighting matrices, and real-time simulation output cache.
- **Local Storage / IndexedDB**: Saved custom market scenarios, historical backtest snapshots, parameter presets, and science fair presentation notes.
- **Server Cache / Memory**: In-memory caching of 1-year daily close prices for the 6 Tata stocks to minimize external API rate limits and ensure instant offline loading during exhibition demos. The `/api/stocks` response is also cached by browsers and shared HTTP caches for 15 minutes, with stale-while-revalidate for a further 5 minutes.

## Auth and Access Model

- Client-first architecture designed for local execution, zero-latency offline science fair demo capabilities, and immediate presentation loading.
- No user login, registration, or authentication requirements; full system access and simulation control is available directly upon page load.

## Invariants

1. `lib/quant/` modules MUST be pure, deterministic functions with zero external side effects, network requests, or UI imports to ensure sub-millisecond unit test validation.
2. The Monte Carlo simulation execution (1,000 parallel paths across a 20-day horizon) MUST complete in under 50ms and run off the main render thread to prevent UI frame drops.
3. Every mathematical model presentation on the UI MUST maintain 1:1 mathematical accuracy with the underlying code formulas (e.g., $dS_t = \theta(\mu - S_t)dt + \sigma dW_t$).
4. Absolute value boundaries ($\vert{}S_{t+H}\vert{} < \vert{}S_t\vert{}$) for reversion probability calculations MUST account for both long and short trade legs symmetrically without bias.
5. The overview's Monte Carlo action MUST navigate to `/simulation/[ticker]`; the result route runs 1,000 Euler-Maruyama paths over 20 trading days in a Web Worker and labels the probability as a model estimate.
