# Mean Reversion in Tata Group Equities: Stochastic Modeling via Ornstein-Uhlenbeck Process

## Overview

This application is an interactive quantitative finance research dashboard and simulation platform designed to identify, analyze, and visualize temporary relative mispricings among six major Tata Group equities (TCS, Tata Motors, Tata Steel, Tata Power, Tata Consumer, and Titan). Engineered as an advanced STEM/Science Fair entry and quantitative portfolio tool, it transforms daily stock price data into logarithmic spread series relative to a synthesized group benchmark index, fits continuous-time Ornstein-Uhlenbeck stochastic differential equations ($dS_t = \theta(\mu - S_t)dt + \sigma dW_t$), and runs 1,000-path Monte Carlo simulations using Euler-Maruyama discretization. The system calculates empirical mean-reversion probabilities over configurable horizons while providing judges and users with deep theoretical derivations, historical case studies, and an interactive Q&A defense matrix.

## Goals

1. **Sub-50ms Simulation Performance**: Execute 1,000 parallel 20-day stochastic Monte Carlo paths off the main render thread (via Web Workers) with zero UI frame drops (>60 FPS).
2. **Mathematical Precision & Rigor**: Provide 1:1 fidelity between theoretical formulas ($\ln P_{i,t}$, $I_t$, Z-scores, OU SDEs) and the pure, unit-tested TypeScript stochastic engine.
3. **High-Impact Presentation & Defense**: Equip science fair judges with interactive mathematical derivation modals, empirical backtest scenario analysis (Noise vs. Structural Shifts), and a searchable defense matrix addressing key quantitative finance edge cases.

## Core User Flow

1. **Overview & Ticker Universe Monitor**: User opens the app (in dark Bloomberg-terminal theme) to inspect real-time/cached price metrics, group index weights, and active stock spread Z-scores across the six Tata equities.
2. **Interactive Stochastic Sandbox**: User adjusts SDE parameters—Speed of Reversion ($\theta$), Target Mean ($\mu$), Daily Volatility ($\sigma$), and Initial Z-Score ($z_0$)—via live slider controls.
3. **Off-Thread Simulation Execution**: Web Workers trigger 1,000 Monte Carlo paths; the UI instantly renders fan chart confidence bands (10th, 50th, 90th percentiles) and outputs the calculated Reversion Probability ($P(\text{reversion})$).
4. **Historical Backtest Analysis**: User toggles historical market scenarios (e.g., Earnings Noise vs. Structural JLR Supply Chain Shocks) to observe where statistical mean-reversion holds vs. breaks down.
5. **Science Fair Defense & Judge Q&A**: User or judge clicks into the Defense Panel to query edge-case cards (e.g., Cointegration vs. Correlation, ADF stationarity tests, transaction cost slippage, and adaptive model ensembles).

## Features

### Quantitative Engine & Stochastic Modeling

- **Log Transformation & Group Index Builder**: Converts raw price feeds into log scale $\ln(P_{i,t})$ and computes daily arithmetic group mean index $I_t = \frac{1}{N}\sum \ln(P_{i,t})$.
- **Z-Score Standardization**: Normalizes log spread deviations ($S_{i,t} = \ln(P_{i,t}) - I_t$) into historical standard deviation units ($z = (S - \mu)/\sigma$).
- **Euler-Maruyama OU Solver**: Solves continuous SDE step $S_{t+1} = S_t + \theta(\mu - S_t)\Delta t + \sigma\sqrt{\Delta t} \times Z$ with Box-Muller Gaussian random noise generation.
- **Monte Carlo Probability Engine**: Calculates $P(\text{reversion}) = \frac{\text{\# paths where } \vert{}S_{t+H}\vert{} < \vert{}S_t\vert{}}{1000}$ across a 20-day horizon $H$.

### Interactive Dashboard & Charting

- **Real-Time Path Fan Chart**: Visualizes 1,000 simulated stochastic trajectories with highlighted mean path and 10th/90th confidence percentile corridors using HTML5 Canvas / Chart.js.
- **Dynamic Parameter Controls**: Interactive sliders for $\theta \in [0.01, 0.50]$, $\mu \in [-0.10, 0.10]$, $\sigma \in [0.005, 0.08]$, and horizon $H \in [5, 60\text{ days}]$.
- **Signal Indicator Panel**: Displays automated trading recommendation flags (Strong Reversion Signal vs. Weak/Avoid Signal) based on threshold boundaries.

### Science Fair Defense & Empirical Backtesting

- **Interactive LaTeX Math Derivations**: Step-by-step mathematical proof breakdown for log compressions, group balancing, and SDE discretization.
- **Historical Case Study Selector**: Side-by-side empirical comparison showing model success during temporary noise vs. failure during fundamental corporate restructurings.
- **Judge Defense Q&A Matrix**: Searchable card index answering complex quantitative questions regarding cointegration breakdown, regime shifts, and execution slippage.

## Scope

### In Scope

- Full quantitative pipeline for 6 Tata Group stocks (TCS, Tata Motors, Tata Steel, Tata Power, Tata Consumer, Titan).
- Client-side Web Worker execution of 1,000-path Monte Carlo simulations under 50ms.
- Full offline science fair presentation mode with pre-cached historical price datasets and static JSON fallbacks.
- Interactive Chart.js fan charts, confidence corridors, and probability metrics.
- Complete science fair judge defense matrix and mathematical derivation modal system.

### Out of Scope

- Live automated execution with brokerage APIs (e.g., Zerodha, Interactive Brokers).
- Expansion to non-Tata stocks or international multi-asset portfolios.
- Complex high-frequency microsecond order book simulation.

## Success Criteria

1. **Sub-50ms Execution**: 1,000-path Monte Carlo simulation completes in under 50ms on standard hardware without main-thread UI lag.
2. **Zero Build & Type Errors**: Project builds cleanly with `npm run build` using strict TypeScript mode.
3. **100% Offline Reliability**: App functions completely without internet connectivity during science fair exhibitions using cached data fixtures.
4. **Interactive Fidelity**: Adjusting any SDE slider instantly updates the Monte Carlo fan chart and probability readout in real time.