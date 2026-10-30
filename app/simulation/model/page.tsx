"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = { date: string; price: number; benchmark: number };
type Stock = { symbol: string; name: string; currency: string; points: Row[] };

type CalibratedOU = {
  stock: Stock;
  latestSpread: number;
  mean: number;
  theta: number; // continuous reversion rate per day
  phi: number;   // discrete AR(1) coefficient e^(-theta)
  sigma: number; // continuous diffusion coefficient (Brownian noise intensity)
  halfLife: number; // ln(2)/theta in trading days
  daysTo90: number; // ln(10)/theta in trading days
};

type ExpertEnsemble = {
  speed: number;          // reversion-speed multiplier for this equation
  weight: number;         // adaptive weight derived from the stock's calibration
  theta: number;          // effective reversion rate of this equation
  expDt: number;          // exact OU step decay e^(-theta)
  stdDt: number;          // exact OU per-step shock std
  expectedPath: number[]; // E[X_t] for this single equation
};

type SimulationOutput = {
  activeCalibrated: CalibratedOU;
  timeSteps: number[]; // 0 to horizon
  weights: number[];   // adaptive ensemble weights (sum to 1)
  experts: ExpertEnsemble[]; // the 5 weighted OU equations
  expectedPath: number[]; // weight mixture E[X_t]
  upper1Sigma: number[];
  lower1Sigma: number[];
  upper2Sigma: number[];
  lower2Sigma: number[];
  samplePaths: { expert: number; values: number[] }[]; // display paths tagged by equation
  terminalRevertedPct: number; // % of paths within +/- 0.5 sigma of mean at horizon
  meanCrossedPct: number;      // % of paths that reached/crossed 0
};

const COMPANY_COLORS = [
  "#147d72", // Teal
  "#c28a20", // Amber
  "#c9573f", // Terracotta
  "#4169a1", // Slate Blue
  "#8d5da8", // Purple
  "#46534d", // Charcoal
];

// 5-equation adaptive OU ensemble: each equation is the same OU SDE run at a
// different reversion speed, and the weights are adapted per stock (below).
const EXPERT_SPEEDS = [0.4, 0.7, 1.0, 1.4, 2.0] as const;
const EXPERT_COLORS = ["#4169a1", "#2f9e44", "#c28a20", "#c9573f", "#8d5da8"];

function adaptiveWeights(theta: number): number[] {
  // Weight each equation by how well its implied half-life matches the stock's
  // own calibrated half-life tau_hat = ln(2)/theta, via a softmax. The
  // temperature scales with tau_hat, so persistent (slow) stocks and
  // fast-cycling anchors get differently shaped weight mixtures.
  const tauHat = Math.log(2) / Math.max(theta, 1e-9);
  const temperature = Math.max(tauHat * 0.35, 0.75);
  const tauK = EXPERT_SPEEDS.map((s) => Math.log(2) / Math.max(theta * s, 1e-9));
  const scores = tauK.map((tau) => -Math.abs(tau - tauHat) / temperature);
  const shift = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - shift));
  const norm = exps.reduce((sum, e) => sum + e, 0);
  return exps.map((e) => e / norm);
}

function calibrateOU(stock: Stock): CalibratedOU {
  const points = stock.points;
  const raw = points.map((p) => Math.log(p.price) - Math.log(p.benchmark));
  const n = raw.length || 1;
  const mean = raw.reduce((sum, v) => sum + v, 0) / n;
  const centered = raw.map((v) => v - mean);

  // OLS AR(1): x_t = phi * x_{t-1} + e_t
  const x = centered.slice(0, -1);
  const y = centered.slice(1);
  const denom = x.reduce((sum, v) => sum + v * v, 0);
  const rawPhi = denom ? x.reduce((sum, v, i) => sum + v * y[i]!, 0) / denom : 1;

  // The OU process only exists for 0 < phi < 1. The estimate is never clamped:
  // if the sample says the spread is non-stationary (phi >= 1) or oscillating
  // (phi <= 0), that is reported honestly and theta collapses to 0 (no pull).
  const phi = rawPhi;
  const isStationary = rawPhi > 0 && rawPhi < 1;
  const theta = isStationary ? -Math.log(rawPhi) : 0;

  // Residual volatility: one-step conditional noise of the discrete AR(1).
  // For OU discretized at dt = 1 day: X_{t+1} | X_t ~ N(phi*X_t, s^2) with
  // s^2 = sigma_sde^2 * (1 - e^{-2*theta}) / (2*theta), where sigma_sde is the
  // continuous diffusion coefficient in dX = theta*(mu - X)dt + sigma_sde*dW.
  const residuals = x.map((xv, i) => y[i]! - phi * xv);
  const resVar = residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, residuals.length - 1);
  const stepStd = Math.sqrt(Math.max(1e-7, resVar));
  // Convert discrete step noise -> continuous diffusion coefficient so that all
  // downstream OU formulas (per-step shock size, variance fan, stationary
  // variance sigma^2/(2*theta)) share one consistent parameterization. As
  // theta -> 0 the conversion factor tends to 1 (plain random-walk diffusion).
  const sigma =
    theta > 1e-9 ? stepStd * Math.sqrt((2 * theta) / (1 - Math.exp(-2 * theta))) : stepStd;

  const halfLife = isStationary ? Math.log(2) / theta : Number.POSITIVE_INFINITY;
  const daysTo90 = isStationary ? Math.log(10) / theta : Number.POSITIVE_INFINITY;
  const latestSpread = centered.at(-1) ?? 0;

  return {
    stock,
    latestSpread,
    mean,
    theta,
    phi,
    sigma,
    halfLife,
    daysTo90,
  };
}

function runOUSimulation(
  calibrated: CalibratedOU,
  horizon: number,
  totalSimulations: number,
  speedMultiplier: number
): SimulationOutput {
  const baseTheta = calibrated.theta * speedMultiplier;
  const weights = adaptiveWeights(calibrated.theta);
  const x0 = calibrated.latestSpread;
  const sigma = calibrated.sigma;

  // Fresh Box-Muller normals straight from the platform entropy source on every
  // run. No fixed seed: each render after "re-run" is a genuinely new draw, so
  // the reported probabilities are an actual Monte Carlo estimate, not a
  // reproducible replay of one canned sample.
  const standardNormal = () => {
    const u = Math.max(Math.random(), 1e-12);
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const timeSteps: number[] = Array.from({ length: horizon + 1 }, (_, i) => i);

  // Exact transition parameters and expected path for each equation in the
  // adaptive ensemble. Each equation reuses the calibrated continuous diffusion
  // sigma; only the reversion speed differs.
  const experts: ExpertEnsemble[] = EXPERT_SPEEDS.map((speed, idx) => {
    const theta = baseTheta * speed;
    const expDt = Math.exp(-theta);
    const stdDt = theta > 1e-6 ? Math.sqrt((sigma ** 2 / (2 * theta)) * (1 - Math.exp(-2 * theta))) : sigma;
    const expectedPath: number[] = [];
    for (let t = 0; t <= horizon; t++) {
      expectedPath.push(x0 * Math.exp(-theta * t));
    }
    return { speed, weight: weights[idx]!, theta, expDt, stdDt, expectedPath };
  });

  // Mixture mean and variance envelopes across the 5 weighted equations
  // (law of total variance):
  //   E_mix(t)  = Σ w_k E_k(t)
  //   Var_mix(t) = Σ w_k [ Var_k(t) + (E_k(t) − E_mix(t))² ]
  //   Var_k(t) = (σ² / (2·θ_k)) · (1 − e^(−2·θ_k·t))
  const expectedPath: number[] = [];
  const upper1Sigma: number[] = [];
  const lower1Sigma: number[] = [];
  const upper2Sigma: number[] = [];
  const lower2Sigma: number[] = [];

  for (let t = 0; t <= horizon; t++) {
    const mixMean = experts.reduce((sum, exp) => sum + exp.weight * exp.expectedPath[t]!, 0);
    let mixVar = 0;
    for (const exp of experts) {
      const varianceT =
        exp.theta > 1e-6
          ? (sigma ** 2 / (2 * exp.theta)) * (1 - Math.exp(-2 * exp.theta * t))
          : sigma ** 2 * t;
      mixVar += exp.weight * (varianceT + (exp.expectedPath[t]! - mixMean) ** 2);
    }
    const sdT = Math.sqrt(Math.max(0, mixVar));

    expectedPath.push(mixMean);
    upper1Sigma.push(mixMean + sdT);
    lower1Sigma.push(mixMean - sdT);
    upper2Sigma.push(mixMean + 2 * sdT);
    lower2Sigma.push(mixMean - 2 * sdT);
  }

  // Terminal target: half of the base equation's stationary std sigma^2/(2*theta).
  // With no detected reversion (theta = 0) the process is a random walk, so the
  // yardstick falls back to half the one-day diffusion scale instead of dividing
  // by zero.
  const stationaryStd = baseTheta > 1e-9 ? sigma / Math.sqrt(2 * baseTheta) : sigma;
  const targetThreshold = Math.max(0.01, stationaryStd * 0.5);

  // Cumulative weight table for sampling which equation each path follows
  const cumWeights = experts.reduce<number[]>((acc, exp, idx) => {
    acc.push((acc[idx - 1] ?? 0) + exp.weight);
    return acc;
  }, []);

  const displayPathCount = Math.min(35, totalSimulations);
  const samplePaths: { expert: number; values: number[] }[] = [];

  let revertedTerminalCount = 0;
  let crossedZeroCount = 0;

  for (let sim = 0; sim < totalSimulations; sim++) {
    // Every path — including the ones drawn on the chart — selects its equation
    // from the adaptive weight distribution. Nothing is hand-picked.
    const draw = Math.random();
    const found = cumWeights.findIndex((c) => draw <= c);
    const expertIdx = found >= 0 ? found : experts.length - 1;
    const expert = experts[expertIdx]!;

    let currentX = x0;
    let didCrossZero = false;
    const displayValues: number[] = [x0];

    for (let day = 1; day <= horizon; day++) {
      const shock = standardNormal();
      currentX = currentX * expert.expDt + expert.stdDt * shock;

      if ((x0 >= 0 && currentX <= 0) || (x0 < 0 && currentX >= 0)) {
        didCrossZero = true;
      }

      if (sim < displayPathCount) displayValues.push(currentX);
    }

    if (sim < displayPathCount) samplePaths.push({ expert: expertIdx, values: displayValues });

    if (Math.abs(currentX) <= targetThreshold) {
      revertedTerminalCount++;
    }
    if (didCrossZero) {
      crossedZeroCount++;
    }
  }

  return {
    activeCalibrated: calibrated,
    timeSteps,
    weights,
    experts,
    expectedPath,
    upper1Sigma,
    lower1Sigma,
    upper2Sigma,
    lower2Sigma,
    samplePaths,
    terminalRevertedPct: (revertedTerminalCount / totalSimulations) * 100,
    meanCrossedPct: (crossedZeroCount / totalSimulations) * 100,
  };
}

export default function OrnsteinUhlenbeckModelPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Simulation controls
  const [activeSymbol, setActiveSymbol] = useState<string>("TCS.NS");
  const [horizon, setHorizon] = useState<number>(60);
  const [simulations, setSimulations] = useState<number>(1000);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  // Nonce only forces a fresh entropy draw; it is not fed into the model.
  const [runNonce, setRunNonce] = useState<number>(0);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarket() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/simulation", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load market data.");
        if (cancelled) return;
        setStocks(data.stocks || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load market data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarket();
    return () => {
      cancelled = true;
    };
  }, []);

  const calibratedList = useMemo(() => stocks.map(calibrateOU), [stocks]);

  const activeCalibrated = useMemo(() => {
    return calibratedList.find((c) => c.stock.symbol === activeSymbol) ?? calibratedList[0];
  }, [calibratedList, activeSymbol]);

  const simulation = useMemo(() => {
    void runNonce; // dependency only: re-runs the simulation with new random draws
    if (!activeCalibrated) return null;
    return runOUSimulation(activeCalibrated, horizon, simulations, speedMultiplier);
  }, [activeCalibrated, horizon, simulations, speedMultiplier, runNonce]);

  // Chart coordinate scalers
  const chartWidth = 1000;
  const chartHeight = 440;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  // Compute symmetric Y bounds based on simulation paths and initial spread
  const allValues = simulation
    ? [
        ...simulation.upper2Sigma,
        ...simulation.lower2Sigma,
        simulation.activeCalibrated.latestSpread,
        0,
        ...simulation.samplePaths.flatMap((p) => p.values),
      ]
    : [-0.1, 0.1];
  const maxAbs = Math.max(0.04, ...allValues.map(Math.abs)) * 1.15;
  const yMin = -maxAbs;
  const yMax = maxAbs;

  const scaleX = (day: number) =>
    padLeft + (day / Math.max(1, horizon)) * (chartWidth - padLeft - padRight);
  const scaleY = (val: number) =>
    padTop + ((yMax - val) / (yMax - yMin)) * (chartHeight - padTop - padBottom);

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!simulation) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, relX));
    const targetDay = Math.round(clamped * horizon);
    setHoveredDay(targetDay);
  };

  const handlePointerLeave = () => {
    setHoveredDay(null);
  };

  const inspectedDay = hoveredDay !== null ? hoveredDay : Math.min(horizon, Math.round(horizon / 2));
  const inspectedExpected = simulation?.expectedPath[inspectedDay] ?? 0;
  const inspectedUpper2 = simulation?.upper2Sigma[inspectedDay] ?? 0;
  const inspectedLower2 = simulation?.lower2Sigma[inspectedDay] ?? 0;
  const initialDeviation = activeCalibrated?.latestSpread ?? 0;
  const latestSession = activeCalibrated?.stock.points.at(-1)?.date;
  const hasReversion = Number.isFinite(activeCalibrated?.halfLife ?? Number.POSITIVE_INFINITY);
  const oneStepShock = activeCalibrated
    ? activeCalibrated.theta > 1e-9
      ? activeCalibrated.sigma *
        Math.sqrt((1 - Math.exp(-2 * activeCalibrated.theta)) / (2 * activeCalibrated.theta))
      : activeCalibrated.sigma
    : 0;
  const percentReverted =
    initialDeviation !== 0
      ? Math.max(0, Math.min(100, ((initialDeviation - inspectedExpected) / initialDeviation) * 100))
      : 100;

  return (
    <main className="market-shell simulation-stage-shell simulation-model-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
          <Link className="simulation-back" href="/briefing/ou-model">
          &larr; How the model works
        </Link>
      </header>

      {/* Header & Context */}
      <section className="simulation-stage-header">
        <div className="simulation-stage-title-wrap">
          <div className="simulation-stage-step-tag">
            <span>Stage 04 / Possible futures</span>
            <span style={{ color: "var(--market-line)" }}>&bull;</span>
            <span>Gap model</span>
          </div>
          <h1>Possible futures<span>.</span></h1>
        </div>
        <div className="simulation-status">
          <i className={`status-light ${loading ? "status-light--running" : error ? "status-light--error" : "status-light--complete"}`} />
          {loading ? "Setting up the model..." : error ? "Data unavailable" : `${simulations.toLocaleString()} paths · prices through ${latestSession ?? "latest close"}`}
        </div>
      </section>

      {error ? (
        <section className="simulation-error" role="alert">
          <strong>Could not run the model</strong>
          <span>{error}</span>
        </section>
      ) : (
        <>
          {/* Stock Tabs Switcher */}
          <section className="simulation-tabs-bar" aria-label="Select asset for OU model simulation">
            {calibratedList.map((item, idx) => (
              <button
                key={item.stock.symbol}
                type="button"
                className={`simulation-tab-button ${activeSymbol === item.stock.symbol ? "simulation-tab-button--active" : ""}`}
                onClick={() => {
                  setActiveSymbol(item.stock.symbol);
                  setHoveredDay(null);
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: COMPANY_COLORS[idx % COMPANY_COLORS.length],
                  }}
                />
                {item.stock.name.split(" ")[0]} ({item.stock.symbol.split(".")[0]})
              </button>
            ))}
          </section>

          {/* Interactive Simulation Controls */}
          <section className="simulation-controls-row">
            <div className="simulation-control-group">
              <span className="simulation-control-label">Days ahead:</span>
              {[30, 60, 90, 120].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`simulation-select-btn ${horizon === d ? "simulation-select-btn--active" : ""}`}
                  onClick={() => setHorizon(d)}
                >
                  {d} Days
                </button>
              ))}
            </div>

            <div className="simulation-control-group">
              <span className="simulation-control-label">Futures to test:</span>
              {[500, 1000, 2500].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`simulation-select-btn ${simulations === count ? "simulation-select-btn--active" : ""}`}
                  onClick={() => setSimulations(count)}
                >
                  {count.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="simulation-control-group">
              <span className="simulation-control-label">Pull-back speed:</span>
              {[
                { label: "0.5\u00D7 (Weak)", val: 0.5 },
                { label: "1.0\u00D7 (Calibrated)", val: 1.0 },
                { label: "1.5\u00D7 (Strong)", val: 1.5 },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`simulation-select-btn ${speedMultiplier === s.val ? "simulation-select-btn--active" : ""}`}
                  onClick={() => setSpeedMultiplier(s.val)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="landing__button simulation-continue__button"
              style={{
                minHeight: "2rem",
                padding: "0.35rem 0.85rem",
                fontSize: "0.68rem",
              }}
              onClick={() => setRunNonce((prev) => prev + 1)}
            >
              Try again &orarr;
            </button>
          </section>

          {/* Main Simulation Chart Card */}
          <section className="simulation-main-card">
            <header className="simulation-chart-hud">
              <div>
                <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {activeCalibrated?.stock.name} &mdash; possible futures
                </strong>
                <span style={{ display: "block", fontSize: "0.68rem", color: "var(--market-muted)", marginTop: "2px" }}>
                  {activeCalibrated?.stock.points.length} days of prices through {latestSession} &middot; today&apos;s gap {activeCalibrated?.latestSpread.toFixed(4)} &middot; speed {activeCalibrated?.theta.toFixed(4)} &middot; noise {activeCalibrated?.sigma.toFixed(4)}
                </span>
                <span style={{ display: "block", fontSize: "0.64rem", marginTop: "4px", fontFamily: "var(--font-geist-mono), monospace" }}>
                  HOW EACH SPEED COUNTS:{" "}
                  {simulation?.experts.map((exp, k) => (
                    <b key={k} style={{ color: EXPERT_COLORS[k]!, marginRight: "8px", fontWeight: 700 }}>
                      {exp.speed}&times;&theta;&thinsp;{(exp.weight * 100).toFixed(1)}%
                    </b>
                  ))}
                  <i style={{ color: "var(--market-muted)" }}>(softmax weights adapt to this stock&rsquo;s calibrated half-life)</i>
                </span>
              </div>

              {/* Chart Legend */}
              <div className="simulation-chart-legend">
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "2.5px solid var(--market-ink)" }} />
                  Mixture E[X<sub>t</sub>]
                </span>
                {EXPERT_SPEEDS.map((s, k) => (
                  <span key={s} className="simulation-legend-item">
                    <span style={{ width: "16px", height: "0", borderTop: `2px dashed ${EXPERT_COLORS[k]}` }} />
                    Eq-{k + 1} ({s}&times;&theta;)
                  </span>
                ))}
                <span className="simulation-legend-item">
                  <span className="simulation-legend-swatch" style={{ background: "rgba(216, 240, 77, 0.45)", borderColor: "#9eb329" }} />
                  &plusmn;1&sigma;(t) Confidence Fan
                </span>
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "1.5px dashed rgba(201, 42, 42, 0.6)" }} />
                  &plusmn;2&sigma;(t) 95% Envelope
                </span>
              </div>
            </header>

            {/* Interactive SVG Forward Chart */}
            <div className="simulation-interactive-svg-wrap">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Ornstein-Uhlenbeck forward simulation chart"
                onPointerMove={handlePointer}
                onPointerLeave={handlePointerLeave}
              >
                <defs>
                  <linearGradient id="ouFanGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d8f04d" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#d8f04d" stopOpacity="0.18" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Horizontal Grid & Ticks */}
                {[-1, -0.5, 0, 0.5, 1].map((f) => {
                  const val = yMax * f;
                  const yPos = scaleY(val);
                  const isZero = f === 0;
                  return (
                    <g key={f}>
                      <line
                        x1={padLeft}
                        x2={chartWidth - padRight}
                        y1={yPos}
                        y2={yPos}
                        stroke={isZero ? "var(--market-ink)" : "#dedcd4"}
                        strokeWidth={isZero ? 1.75 : 1}
                        strokeDasharray={isZero ? undefined : "4 4"}
                      />
                      <text
                        x={padLeft - 10}
                        y={yPos + 4}
                        textAnchor="end"
                        fontSize="11"
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight={isZero ? "700" : "500"}
                        fill={isZero ? "var(--market-ink)" : "#7a7b74"}
                      >
                        {isZero ? "0.0 (\u03BC)" : val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Confidence Fans */}
                {simulation && (
                  <>
                    {/* 2-Sigma 95% Confidence Envelope */}
                    <path
                      d={`
                        ${simulation.upper2Sigma.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                        ${simulation.lower2Sigma.slice().reverse().map((v, i) => `L${scaleX(horizon - i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                        Z
                      `}
                      fill="rgba(201, 42, 42, 0.05)"
                      stroke="rgba(201, 42, 42, 0.35)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />

                    {/* 1-Sigma Typical Confidence Fan */}
                    <path
                      d={`
                        ${simulation.upper1Sigma.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                        ${simulation.lower1Sigma.slice().reverse().map((v, i) => `L${scaleX(horizon - i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                        Z
                      `}
                      fill="url(#ouFanGradient)"
                      stroke="#bdd435"
                      strokeWidth="1"
                    />

                    {/* Per-equation expected decay lines E_k[X_t] */}
                    {simulation.experts.map((exp, k) => (
                      <path
                        key={`expert-eq-${k}`}
                        d={exp.expectedPath.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                        fill="none"
                        stroke={EXPERT_COLORS[k]!}
                        strokeWidth="1.5"
                        strokeDasharray="7 5"
                        opacity="0.7"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Adaptive Ensemble Stochastic Sample Paths (tagged by equation) */}
                    {simulation.samplePaths.map((path, pIdx) => {
                      const d = path.values.map((val, day) => `${day === 0 ? "M" : "L"}${scaleX(day).toFixed(1)},${scaleY(val).toFixed(1)}`).join(" ");
                      return (
                        <path
                          key={pIdx}
                          d={d}
                          fill="none"
                          stroke={EXPERT_COLORS[path.expert]!}
                          strokeWidth="1.1"
                          opacity="0.32"
                          strokeLinecap="round"
                        />
                      );
                    })}

                    {/* Theoretical Expected Mean Reversion Decay Path */}
                    <path
                      d={simulation.expectedPath.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")}
                      fill="none"
                      stroke="var(--market-ink)"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Day 0 Anchor Marker */}
                    <circle
                      cx={scaleX(0)}
                      cy={scaleY(simulation.activeCalibrated.latestSpread)}
                      r="6"
                      fill="var(--market-negative)"
                      stroke="var(--market-ink)"
                      strokeWidth="2"
                    />
                  </>
                )}

                {/* Vertical Inspection Cursor */}
                {inspectedDay !== null && simulation && (
                  <g>
                    <line
                      x1={scaleX(inspectedDay)}
                      x2={scaleX(inspectedDay)}
                      y1={padTop}
                      y2={chartHeight - padBottom}
                      stroke="var(--market-ink)"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={scaleX(inspectedDay)}
                      cy={scaleY(simulation.expectedPath[inspectedDay] ?? 0)}
                      r="6"
                      fill="var(--market-accent)"
                      stroke="var(--market-ink)"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* X-Axis Ticks & Labels */}
                {simulation && (
                  <>
                    {[0, Math.round(horizon * 0.25), Math.round(horizon * 0.5), Math.round(horizon * 0.75), horizon].map((d) => (
                      <g key={d}>
                        <line x1={scaleX(d)} x2={scaleX(d)} y1={chartHeight - padBottom} y2={chartHeight - padBottom + 5} stroke="var(--market-ink)" strokeWidth="1" />
                        <text
                          x={scaleX(d)}
                          y={chartHeight - padBottom + 18}
                          textAnchor={d === 0 ? "start" : d === horizon ? "end" : "middle"}
                          fontSize="11"
                          fontFamily="var(--font-geist-mono), monospace"
                          fill="#7a7b74"
                        >
                          {d === 0 ? "Day 0 (Latest Close)" : `+${d} Days`}
                        </text>
                      </g>
                    ))}
                  </>
                )}
              </svg>
            </div>

            {/* Scrub HUD / Dynamic Telemetry Inspector */}
            <div className="simulation-scrub-bar">
              <div>
                <span>FORECAST HORIZON: </span>
                <b>Day +{inspectedDay} ({inspectedDay} trading days out)</b>
              </div>
              <div>
                <span>MIXTURE E[&Sigma;w&middot;X<sub>t</sub>]: </span>
                <b>{inspectedExpected.toFixed(4)}</b>
              </div>
              <div>
                <span>REVERSION PROGRESS: </span>
                <b style={{ color: "var(--market-accent)" }}>{percentReverted.toFixed(1)}% reverted</b>
              </div>
              <div>
                <span>95% CONFIDENCE ENVELOPE: </span>
                <b>
                  [{inspectedLower2.toFixed(3)}, {inspectedUpper2.toFixed(3)}]
                </b>
              </div>
              <div>
                <span>CROSS-EQUILIBRIUM PROBABILITY: </span>
                <b>{simulation?.meanCrossedPct.toFixed(1)}%</b>
              </div>
            </div>

            {/* 4 Calibrated OU Parameters Dashboard */}
            {activeCalibrated && (
              <div className="simulation-kpi-grid">
                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Pull-back speed (&theta;)</span>
                  <span className="simulation-kpi-card__value">{(activeCalibrated.theta * speedMultiplier).toFixed(4)} / d</span>

                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Days to shrink by half (&tau;)</span>
                  <span className="simulation-kpi-card__value">
                    {hasReversion ? `${(activeCalibrated.halfLife / speedMultiplier).toFixed(1)} days` : "Not stationary"}
                  </span>

                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Random change size (&sigma;)</span>
                  <span className="simulation-kpi-card__value">{activeCalibrated.sigma.toFixed(4)}</span>

                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Days to get near normal</span>
                  <span className="simulation-kpi-card__value">
                    {hasReversion ? `${(activeCalibrated.daysTo90 / speedMultiplier).toFixed(1)} days` : "—"}
                  </span>

                </article>
              </div>
            )}
          </section>

          {/* Comparative Table of All 6 Stocks Calibrated Under OU */}
          <section className="simulation-table-wrap">
            <table className="simulation-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Symbol</th>
                  <th>Gap now</th>
                  <th>Pull speed</th>
                  <th>Random change</th>
                  <th>Days to halve</th>
                  <th>Fit at five speeds</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {calibratedList.map((item, idx) => {
                  const isCurrent = item.stock.symbol === activeSymbol;
                  return (
                    <tr
                      key={item.stock.symbol}
                      style={{
                        background: isCurrent ? "#f3f7d8" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setActiveSymbol(item.stock.symbol);
                        setHoveredDay(null);
                      }}
                    >
                      <td>
                        <strong style={{ color: COMPANY_COLORS[idx % COMPANY_COLORS.length] }}>
                          {item.stock.name}
                        </strong>
                      </td>
                      <td>{item.stock.symbol}</td>
                      <td>
                        <b style={{ color: Math.abs(item.latestSpread) >= 0.05 ? "var(--market-negative)" : "var(--market-ink)" }}>
                          {item.latestSpread >= 0 ? `+${item.latestSpread.toFixed(4)}` : item.latestSpread.toFixed(4)}
                        </b>
                      </td>
                      <td>{item.theta.toFixed(4)}</td>
                      <td>{item.sigma.toFixed(4)}</td>
                      <td>{Number.isFinite(item.halfLife) ? `${item.halfLife.toFixed(1)} d` : "—"}</td>
                      <td>
                        <span style={{ display: "inline-flex", gap: "7px", fontFamily: "var(--font-geist-mono), monospace" }}>
                          {adaptiveWeights(item.theta).map((w, k) => (
                            <span key={k} style={{ fontSize: "0.62rem", fontWeight: 700, color: EXPERT_COLORS[k] }}>
                              {(w * 100).toFixed(0)}%
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        {!Number.isFinite(item.halfLife) ? (
                          <span className="z-regime-tag z-regime-tag--extreme">NO STEADY PATTERN</span>
                        ) : Math.abs(item.latestSpread) > 0.05 ? (
                          <span className="z-regime-tag z-regime-tag--extreme">
                            {item.latestSpread > 0 ? "ABOVE NORMAL" : "BELOW NORMAL"}
                          </span>
                        ) : (
                          <span className="z-regime-tag z-regime-tag--neutral">NEAR NORMAL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>



          {/* Bottom Actions */}
          <footer className="simulation-z-footer-bar">
            <Link className="simulation-back" href="/briefing/ou-model">
              &larr; How the model works
            </Link>
            <Link className="landing__button simulation-continue__button" href="/briefing/probability">
              Next: count results <span aria-hidden="true">&rarr;</span>
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}
