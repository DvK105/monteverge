# Code Standards

## General

- Keep modules small, deterministic, and single-purpose — mathematical functions must be separated from UI rendering components.
- Fix root causes in stochastic calculations and data pipelines; never layer workarounds or add arbitrary fudge factors to force visual reversion.
- Do not mix unrelated concerns in a single component or route — keep simulation execution, state management, and UI rendering isolated.

## TypeScript

- Strict mode is required throughout the project (`strict: true` in `tsconfig.json`).
- Avoid `any` — use explicit interfaces, type aliases, or narrowly scoped generic types for all financial series, model parameters, and simulation results.
- Validate unknown external input (e.g., raw stock price API payloads, uploaded CSVs) at system boundaries using runtime schema validation before passing data to quantitative routines.

## Next.js (App Router)

- Default to React Server Components (RSC) for layout skeletons, static mathematical documentation, and science fair defense panels.
- Add `'use client'` only when browser interactivity or state (e.g., parameter sliders, interactive charts, Web Worker simulation triggers) requires it.
- Keep route handlers focused on a single responsibility — handle stock data fetching, caching, and rate limiting in dedicated API routes without putting heavy numerical processing on the server main thread.

## Quantitative & Mathematical Code

- Mathematical modules inside `lib/quant/` MUST be pure, side-effect-free functions that take primitive parameters or explicit data structures and return immutable calculation objects.
- Euler-Maruyama SDE solvers must use explicit floating-point numerical safety checks (e.g., guarding against zero volatility, negative variance, or `NaN`/`Infinity` values during log transformations).
- Numerical performance is critical: Monte Carlo simulations (1,000 paths across a 20-day horizon) must complete in under 50ms. Heavy simulation tasks must run inside dedicated Web Workers off the main UI thread.

## Styling & Theme

- Use CSS custom property tokens and Tailwind CSS semantic classes — no hardcoded hex values in component styles.
- Adhere strictly to the Bloomberg/Hedge-Fund dark terminal palette defined in `ui-context.md` (e.g., dark slate background `#0B0F17`, electric cyan accents `#00F0FF`, signal green `#00E676`, and alert red `#FF1744`).
- Follow the consistent border radius (`rounded-lg`, `rounded-xl`) and typography scale defined in `ui-context.md`.

## API Routes & External Data

- Validate and parse request inputs (e.g., date ranges, ticker symbols) before any API or calculation logic runs.
- Return consistent, predictable JSON response shapes across all endpoints, including clear error metadata when external feeds fail.
- Gracefully handle external API downtime (e.g., Yahoo Finance or NSE rate limits) by serving cached historical price datasets stored in server memory or IndexedDB.

## File Organization

- `lib/quant/` — Pure mathematical engine (log price conversions, group index calculation, Z-score standardizations, SDE step functions).
- `lib/simulators/` — Monte Carlo path generators, Web Worker scripts, and empirical backtesting logic.
- `lib/types/` — TypeScript interfaces for stock data, model parameters, simulation results, and chart datasets.
- `components/dashboard/` — Interactive UI layouts, slider controls, live metrics cards, and scenario selector panels.
- `components/charts/` — Chart.js / Recharts components for rendering time-series spreads, Monte Carlo path fan charts, and probability distribution histograms.
- `components/defense/` — Science Fair Judge Q&A matrix, mathematical derivation modals, and cointegration vs. correlation breakdown panels.
- `app/api/` — Next.js serverless route handlers for stock price data fetching and caching.