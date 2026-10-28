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
  sigma: number; // diffusion volatility
  halfLife: number; // ln(2)/theta in trading days
  daysTo90: number; // ln(10)/theta in trading days
};

type SimulationOutput = {
  activeCalibrated: CalibratedOU;
  timeSteps: number[]; // 0 to horizon
  expectedPath: number[]; // E[X_t]
  upper1Sigma: number[];
  lower1Sigma: number[];
  upper2Sigma: number[];
  lower2Sigma: number[];
  samplePaths: number[][]; // [pathIdx][dayIdx]
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
  const rawPhi = denom ? x.reduce((sum, v, i) => sum + v * y[i]!, 0) / denom : 0.95;
  const phi = Math.max(0.01, Math.min(0.995, rawPhi));

  // In continuous OU: phi = exp(-theta * dt). With dt = 1 day, theta = -ln(phi)
  const theta = -Math.log(phi);

  // Residual volatility
  const residuals = x.map((xv, i) => y[i]! - phi * xv);
  const resVar = residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, residuals.length - 2);
  const sigma = Math.sqrt(Math.max(1e-7, resVar));

  const halfLife = Math.log(2) / theta;
  const daysTo90 = Math.log(10) / theta;
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
  speedMultiplier: number,
  seedModifier: number
): SimulationOutput {
  const theta = calibrated.theta * speedMultiplier;
  const x0 = calibrated.latestSpread;
  const sigma = calibrated.sigma;

  // Box-Muller PRNG with deterministic seed
  let seed = ((calibrated.stock.symbol.split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 42) + seedModifier * 1337) >>> 0) || 1;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const standardNormal = () => {
    const u = Math.max(random(), 1e-12);
    const v = random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const timeSteps: number[] = Array.from({ length: horizon + 1 }, (_, i) => i);
  const expectedPath: number[] = [];
  const upper1Sigma: number[] = [];
  const lower1Sigma: number[] = [];
  const upper2Sigma: number[] = [];
  const lower2Sigma: number[] = [];

  // Theoretical exact trajectories and confidence envelopes
  for (let t = 0; t <= horizon; t++) {
    const expVal = x0 * Math.exp(-theta * t);
    // Continuous OU variance at time t: Var(X_t) = (sigma^2 / (2 * theta)) * (1 - exp(-2 * theta * t))
    const varianceT = theta > 1e-6 ? (sigma ** 2 / (2 * theta)) * (1 - Math.exp(-2 * theta * t)) : sigma ** 2 * t;
    const sdT = Math.sqrt(Math.max(0, varianceT));

    expectedPath.push(expVal);
    upper1Sigma.push(expVal + sdT);
    lower1Sigma.push(expVal - sdT);
    upper2Sigma.push(expVal + 2 * sdT);
    lower2Sigma.push(expVal - 2 * sdT);
  }

  // Exact step parameter for OU transition
  const expDt = Math.exp(-theta);
  const stdDt = theta > 1e-6 ? Math.sqrt((sigma ** 2 / (2 * theta)) * (1 - Math.exp(-2 * theta))) : sigma;

  const displayPathCount = Math.min(35, totalSimulations);
  const samplePaths: number[][] = [];
  for (let p = 0; p < displayPathCount; p++) {
    samplePaths.push([x0]);
  }

  let revertedTerminalCount = 0;
  let crossedZeroCount = 0;
  const targetThreshold = (calibrated.sigma / Math.sqrt(2 * theta || 1)) * 0.5;

  for (let sim = 0; sim < totalSimulations; sim++) {
    let currentX = x0;
    let didCrossZero = false;
    const isSample = sim < displayPathCount;

    for (let day = 1; day <= horizon; day++) {
      const shock = standardNormal();
      currentX = currentX * expDt + stdDt * shock;

      if ((x0 >= 0 && currentX <= 0) || (x0 < 0 && currentX >= 0)) {
        didCrossZero = true;
      }

      if (isSample) {
        samplePaths[sim]!.push(currentX);
      }
    }

    if (Math.abs(currentX) <= Math.max(0.01, targetThreshold)) {
      revertedTerminalCount++;
    }
    if (didCrossZero) {
      crossedZeroCount++;
    }
  }

  return {
    activeCalibrated: calibrated,
    timeSteps,
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
  const [seedModifier, setSeedModifier] = useState<number>(1);
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
    if (!activeCalibrated) return null;
    return runOUSimulation(activeCalibrated, horizon, simulations, speedMultiplier, seedModifier);
  }, [activeCalibrated, horizon, simulations, speedMultiplier, seedModifier]);

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
        ...simulation.samplePaths.flatMap((p) => p),
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
  const percentReverted =
    initialDeviation !== 0
      ? Math.max(0, Math.min(100, ((initialDeviation - inspectedExpected) / initialDeviation) * 100))
      : 100;

  return (
    <main className="market-shell simulation-stage-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <Link className="simulation-back" href="/simulation/carts">
          &larr; Stage 03: Historical Reversion Check
        </Link>
      </header>

      {/* Header & Context */}
      <section className="simulation-stage-header">
        <div className="simulation-stage-title-wrap">
          <div className="simulation-stage-step-tag">
            <span>Stage 04 / Stochastic Forecast</span>
            <span style={{ color: "var(--market-line)" }}>&bull;</span>
            <span>Ornstein&ndash;Uhlenbeck Continuous Model</span>
          </div>
          <h1>The Ornstein&ndash;Uhlenbeck Model<span>.</span></h1>
          <p className="simulation-stage-subtitle">
            Simulating forward mean-reverting paths using the calibrated continuous-time SDE:{" "}
            <strong>dX<sub>t</sub> = &theta;(&mu; &minus; X<sub>t</sub>)dt + &sigma;dW<sub>t</sub></strong>.
            Unlike unconstrained geometric Brownian motion, the drift pull actively contracts divergences back to historical equilibrium.
          </p>
        </div>
        <div className="simulation-status">
          <i className={`status-light ${loading ? "status-light--running" : error ? "status-light--error" : "status-light--complete"}`} />
          {loading ? "Calibrating SDE..." : error ? "Data unavailable" : `${simulations.toLocaleString()} Monte Carlo paths calibrated`}
        </div>
      </section>

      {error ? (
        <section className="simulation-error" role="alert">
          <strong>Could not run Ornstein&ndash;Uhlenbeck model</strong>
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
              <span className="simulation-control-label">Horizon:</span>
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
              <span className="simulation-control-label">Monte Carlo Paths:</span>
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
              <span className="simulation-control-label">Reversion Speed:</span>
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
              onClick={() => setSeedModifier((prev) => prev + 1)}
            >
              Re-seed Brownian Motion &orarr;
            </button>
          </section>

          {/* Main Simulation Chart Card */}
          <section className="simulation-main-card">
            <header className="simulation-chart-hud">
              <div>
                <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {activeCalibrated?.stock.name} &mdash; Forward Stochastic OU Trajectories
                </strong>
                <span style={{ display: "block", fontSize: "0.68rem", color: "var(--market-muted)", marginTop: "2px" }}>
                  Anchor Day 0 spread = {activeCalibrated?.latestSpread.toFixed(4)} &middot; Calibrated &theta; = {activeCalibrated?.theta.toFixed(4)}/day &middot; Daily &sigma; = {activeCalibrated?.sigma.toFixed(4)}
                </span>
              </div>

              {/* Chart Legend */}
              <div className="simulation-chart-legend">
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "2.5px solid var(--market-ink)" }} />
                  Expected Decay E[X<sub>t</sub>]
                </span>
                <span className="simulation-legend-item">
                  <span className="simulation-legend-swatch" style={{ background: "rgba(216, 240, 77, 0.45)", borderColor: "#9eb329" }} />
                  &plusmn;1&sigma;(t) Confidence Fan
                </span>
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "1.5px dashed rgba(201, 42, 42, 0.6)" }} />
                  &plusmn;2&sigma;(t) 95% Envelope
                </span>
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "1px solid #708090" }} />
                  35 Sample Brownian Paths
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

                    {/* 35 Stochastic Sample Paths */}
                    {simulation.samplePaths.map((path, pIdx) => {
                      const d = path.map((val, day) => `${day === 0 ? "M" : "L"}${scaleX(day).toFixed(1)},${scaleY(val).toFixed(1)}`).join(" ");
                      return (
                        <path
                          key={pIdx}
                          d={d}
                          fill="none"
                          stroke={pIdx % 2 === 0 ? "#4a6884" : "#457b68"}
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
                <span>EXPECTED SPREAD E[X<sub>t</sub>]: </span>
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
                  <span className="simulation-kpi-card__label">Reversion Speed (&theta;)</span>
                  <span className="simulation-kpi-card__value">{(activeCalibrated.theta * speedMultiplier).toFixed(4)} / d</span>
                  <p className="simulation-kpi-card__desc">
                    Daily pull parameter in continuous SDE. Continuous decay rate = {((1 - Math.exp(-activeCalibrated.theta * speedMultiplier)) * 100).toFixed(2)}% per day.
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Expected Half-Life (&tau;)</span>
                  <span className="simulation-kpi-card__value">{(activeCalibrated.halfLife / speedMultiplier).toFixed(1)} days</span>
                  <p className="simulation-kpi-card__desc">
                    Theoretical time for the current divergence of {activeCalibrated.latestSpread.toFixed(4)} to contract by 50% toward 0.0.
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Diffusion Shock (&sigma;)</span>
                  <span className="simulation-kpi-card__value">{activeCalibrated.sigma.toFixed(4)}</span>
                  <p className="simulation-kpi-card__desc">
                    Daily Brownian noise standard deviation calibrated from historical residual variance.
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">90% Target Convergence</span>
                  <span className="simulation-kpi-card__value">{(activeCalibrated.daysTo90 / speedMultiplier).toFixed(1)} days</span>
                  <p className="simulation-kpi-card__desc">
                    Estimated trading days for spread to contract to within 10% of long-term equilibrium mean.
                  </p>
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
                  <th>Initial Spread X<sub>0</sub></th>
                  <th>Calibrated &theta;</th>
                  <th>Discrete &phi;</th>
                  <th>Diffusion &sigma;</th>
                  <th>Half-Life &tau;</th>
                  <th>90% Convergence</th>
                  <th>Equilibrium Status</th>
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
                      <td>{item.phi.toFixed(3)}</td>
                      <td>{item.sigma.toFixed(4)}</td>
                      <td>{item.halfLife.toFixed(1)} d</td>
                      <td>{item.daysTo90.toFixed(1)} d</td>
                      <td>
                        {Math.abs(item.latestSpread) > 0.05 ? (
                          <span className="z-regime-tag z-regime-tag--extreme">
                            {item.latestSpread > 0 ? "ABOVE MEAN" : "BELOW MEAN"}
                          </span>
                        ) : (
                          <span className="z-regime-tag z-regime-tag--neutral">AT EQUILIBRIUM</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Mathematical & Theoretical Explanation */}
          <section className="simulation-z-banner">
            <div className="simulation-z-banner__formula-box">
              <span className="simulation-z-banner__eyebrow">CONTINUOUS STOCHASTIC FORMULATION</span>
              <div className="simulation-z-banner__equation">
                <span>dX<sub>t</sub></span>
                <b>=</b>
                <span>&theta;(&mu; &minus; X<sub>t</sub>)dt</span>
                <b>+</b>
                <span>&sigma;dW<sub>t</sub></span>
                <span className="z-highlight-tag" style={{ fontSize: "0.85rem" }}>
                  E[X<sub>t</sub>] = &mu; + (X<sub>0</sub> &minus; &mu;)e<sup>&minus;&theta;t</sup>
                </span>
              </div>
              <p className="simulation-z-banner__desc">
                The Ornstein&ndash;Uhlenbeck process possesses a unique mean-reverting property that makes it the industry standard
                for statistical arbitrage, pairs trading, and interest rate modeling (Vasicek model). The drift term{" "}
                <strong>&theta;(&mu; &minus; X<sub>t</sub>)</strong> generates a restoring elastic force proportional to distance from
                equilibrium, guaranteeing that even with perpetual random Brownian shocks <strong>&sigma;dW<sub>t</sub></strong>, the
                process remains stationary with bounded asymptotic variance <strong>Var(X<sub>&infin;</sub>) = &sigma;&sup2; / (2&theta;)</strong>.
              </p>
            </div>
          </section>

          {/* Bottom Actions */}
          <footer className="simulation-z-footer-bar">
            <Link className="simulation-back" href="/simulation/carts">
              &larr; Return to Stage 03: Historical Mean Reversion
            </Link>
            <Link className="landing__button simulation-continue__button" href="/market">
              Return to Market Dashboard <span aria-hidden="true">&rarr;</span>
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}
