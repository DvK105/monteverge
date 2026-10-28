"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = { date: string; price: number; benchmark: number };
type Stock = { symbol: string; name: string; currency: string; points: Row[] };

type ReversionSeries = {
  stock: Stock;
  spreads: number[];
  zScores: number[];
  mean: number;
  stdDev: number;
  phi: number;
  halfLife: number;
  zeroCrossings: number;
  latestZ: number;
  status: "strong" | "moderate" | "weak";
  verdict: string;
};

const COMPANY_COLORS = [
  "#147d72", // Teal
  "#c28a20", // Amber
  "#c9573f", // Terracotta
  "#4169a1", // Slate Blue
  "#8d5da8", // Purple
  "#46534d", // Charcoal
];

function calculateReversion(stock: Stock): ReversionSeries {
  const points = stock.points;
  const rawSpreads = points.map((p) => Math.log(p.price) - Math.log(p.benchmark));
  const n = rawSpreads.length || 1;
  const mean = rawSpreads.reduce((sum, v) => sum + v, 0) / n;
  const variance = rawSpreads.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1 || 1);
  const stdDev = Math.sqrt(Math.max(variance, 1e-8));

  const zScores = rawSpreads.map((s) => (s - mean) / stdDev);

  // Lag-1 Autoregression: z_t = phi * z_{t-1} + error
  const x = zScores.slice(0, -1);
  const y = zScores.slice(1);
  const denom = x.reduce((sum, v) => sum + v * v, 0);
  const rawPhi = denom ? x.reduce((sum, v, i) => sum + v * y[i]!, 0) / denom : 0;
  const phi = Math.max(-0.999, Math.min(0.999, rawPhi));

  // Half-life t_1/2 = -ln(2) / ln(phi) in trading days
  let halfLife = NaN;
  if (phi > 0 && phi < 1) {
    halfLife = -Math.log(2) / Math.log(phi);
  }

  // Zero-crossings
  let zeroCrossings = 0;
  for (let i = 1; i < zScores.length; i++) {
    if ((zScores[i]! >= 0 && zScores[i - 1]! < 0) || (zScores[i]! < 0 && zScores[i - 1]! >= 0)) {
      zeroCrossings++;
    }
  }

  const latestZ = zScores.at(-1) ?? 0;

  let status: "strong" | "moderate" | "weak" = "weak";
  let verdict = "Weak Reversion / High Persistence";
  if (phi > 0 && phi <= 0.94 && halfLife < 45) {
    status = "strong";
    verdict = "Confirmed Mean-Reverting: Fast Decay";
  } else if (phi > 0 && phi < 0.985) {
    status = "moderate";
    verdict = "Moderate Mean-Reverting: Gradual Drift";
  }

  return {
    stock,
    spreads: rawSpreads,
    zScores,
    mean,
    stdDev,
    phi,
    halfLife,
    zeroCrossings,
    latestZ,
    status,
    verdict,
  };
}

export default function HistoricalMeanReversionPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("TCS.NS");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/simulation", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load market history.");
        if (cancelled) return;
        setStocks(data.stocks || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load market history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const analyzed = useMemo(() => stocks.map(calculateReversion), [stocks]);

  const activeSeries = useMemo(() => {
    return analyzed.find((s) => s.stock.symbol === activeTab) ?? analyzed[0];
  }, [analyzed, activeTab]);

  // Dimensions for Chart
  const width = 1000;
  const height = 400;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 35;

  const maxPoints = Math.max(2, ...analyzed.map((a) => a.zScores.length));
  const minBound = -3.2;
  const maxBound = 3.2;

  const scaleX = (idx: number) =>
    padLeft + (idx / Math.max(1, maxPoints - 1)) * (width - padLeft - padRight);
  const scaleY = (val: number) =>
    padTop + ((maxBound - val) / (maxBound - minBound)) * (height - padTop - padBottom);

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeSeries || !activeSeries.zScores.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, relX));
    const target = Math.round(clamped * (activeSeries.zScores.length - 1));
    setHoveredIdx(target);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const inspectedIdx = hoveredIdx !== null ? hoveredIdx : (activeSeries?.zScores.length ? activeSeries.zScores.length - 1 : null);
  const inspectedPoint = inspectedIdx !== null && activeSeries ? activeSeries.stock.points[inspectedIdx] : null;
  const inspectedZ = inspectedIdx !== null && activeSeries ? activeSeries.zScores[inspectedIdx] : null;
  const inspectedSpread = inspectedIdx !== null && activeSeries ? activeSeries.spreads[inspectedIdx] : null;

  return (
    <main className="market-shell simulation-stage-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <Link className="simulation-back" href="/simulation/continue">
          &larr; Stage 02: Spread z-scores
        </Link>
      </header>

      {/* Header and Step Indicator */}
      <section className="simulation-stage-header">
        <div className="simulation-stage-title-wrap">
          <div className="simulation-stage-step-tag">
            <span>Stage 03 / Statistical Verification</span>
            <span style={{ color: "var(--market-line)" }}>&bull;</span>
            <span>Historical Mean Reversion Check</span>
          </div>
          <h1>Historical Mean Reversion<span>.</span></h1>
          <p className="simulation-stage-subtitle">
            Rigorous empirical check on historical spread time-series. We test whether log price spreads against NIFTY 50
            oscillate around a stable equilibrium mean, or whether they wander non-stationarily.
          </p>
        </div>
        <div className="simulation-status">
          <i className={`status-light ${loading ? "status-light--running" : error ? "status-light--error" : "status-light--complete"}`} />
          {loading ? "Loading market data..." : error ? "Data unavailable" : `${stocks.length} assets verified`}
        </div>
      </section>

      {error ? (
        <section className="simulation-error" role="alert">
          <strong>Could not verify historical mean reversion</strong>
          <span>{error}</span>
        </section>
      ) : (
        <>
          {/* Stock Tabs Switcher */}
          <section className="simulation-tabs-bar" aria-label="Select asset to inspect">
            {analyzed.map((item, idx) => (
              <button
                key={item.stock.symbol}
                type="button"
                className={`simulation-tab-button ${activeTab === item.stock.symbol ? "simulation-tab-button--active" : ""}`}
                onClick={() => {
                  setActiveTab(item.stock.symbol);
                  setHoveredIdx(null);
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
            <button
              type="button"
              className={`simulation-tab-button ${activeTab === "ALL" ? "simulation-tab-button--active" : ""}`}
              onClick={() => {
                setActiveTab("ALL");
                setHoveredIdx(null);
              }}
            >
              All 6 Assets Compared
            </button>
          </section>

          {/* Main Chart Card */}
          <section className="simulation-main-card">
            <header className="simulation-chart-hud">
              <div>
                <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {activeTab === "ALL" ? "Comparative Multi-Asset Reversion Analysis" : `${activeSeries?.stock.name} (${activeSeries?.stock.symbol})`}
                </strong>
                <span style={{ display: "block", fontSize: "0.68rem", color: "var(--market-muted)", marginTop: "2px" }}>
                  {activeTab === "ALL"
                    ? "Standardized daily log spreads (z-scores) relative to NIFTY 50"
                    : `Spread mean = ${activeSeries?.mean.toFixed(4)} \u00B7 \u03C3 = ${activeSeries?.stdDev.toFixed(4)} \u00B7 ${activeSeries?.stock.points.length} trading days`}
                </span>
              </div>

              {/* Chart Legend */}
              <div className="simulation-chart-legend">
                <span className="simulation-legend-item">
                  <span className="simulation-legend-swatch" style={{ background: "rgba(216, 240, 77, 0.4)", borderColor: "#9eb329" }} />
                  &plusmn;1&sigma; Equilibrium Channel
                </span>
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "2px dashed #c92a2a" }} />
                  &plusmn;2&sigma; Reversion Boundary
                </span>
                <span className="simulation-legend-item">
                  <span style={{ width: "16px", height: "0", borderTop: "2px solid var(--market-ink)" }} />
                  0.0 Equilibrium Baseline
                </span>
              </div>
            </header>

            {/* Interactive SVG Main Chart */}
            <div className="simulation-interactive-svg-wrap">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Historical standardized spread time-series"
                onPointerMove={handlePointer}
                onPointerLeave={handlePointerLeave}
              >
                <defs>
                  <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d8f04d" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#d8f04d" stopOpacity="0.12" />
                  </linearGradient>
                </defs>

                {/* 1-Sigma Equilibrium Shaded Band */}
                <rect
                  x={padLeft}
                  y={scaleY(1)}
                  width={width - padLeft - padRight}
                  height={Math.abs(scaleY(-1) - scaleY(1))}
                  fill="url(#eqGradient)"
                  stroke="#c5de38"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Horizontal Reference Lines & Labels */}
                {[-2, -1, 0, 1, 2].map((lvl) => {
                  const yPos = scaleY(lvl);
                  const isZero = lvl === 0;
                  const isBoundary = Math.abs(lvl) === 2;
                  return (
                    <g key={lvl}>
                      <line
                        x1={padLeft}
                        x2={width - padRight}
                        y1={yPos}
                        y2={yPos}
                        stroke={isZero ? "var(--market-ink)" : isBoundary ? "#c92a2a" : "#dddcd4"}
                        strokeWidth={isZero ? 1.75 : 1}
                        strokeDasharray={isBoundary ? "5 4" : undefined}
                      />
                      <text
                        x={padLeft - 10}
                        y={yPos + 4}
                        textAnchor="end"
                        fontSize="11"
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight={isZero ? "700" : "500"}
                        fill={isZero ? "var(--market-ink)" : isBoundary ? "#c92a2a" : "#7b7c74"}
                      >
                        {lvl === 0 ? "0.0 \u03BC" : `${lvl > 0 ? "+" : ""}${lvl}\u03C3`}
                      </text>
                    </g>
                  );
                })}

                {/* Trajectories */}
                {activeTab === "ALL" ? (
                  // Comparative view: all 6 assets
                  analyzed.map((item, idx) => {
                    const color = COMPANY_COLORS[idx % COMPANY_COLORS.length]!;
                    const pts = item.zScores;
                    const pathD = pts
                      .map((z, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(Math.max(minBound, Math.min(maxBound, z))).toFixed(1)}`)
                      .join(" ");
                    return (
                      <g key={item.stock.symbol}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.88"
                        />
                      </g>
                    );
                  })
                ) : activeSeries ? (
                  // Single asset focused view
                  (() => {
                    const pts = activeSeries.zScores;
                    const pathD = pts
                      .map((z, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(Math.max(minBound, Math.min(maxBound, z))).toFixed(1)}`)
                      .join(" ");

                    return (
                      <g>
                        <path
                          d={pathD}
                          fill="none"
                          stroke="var(--market-ink)"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    );
                  })()
                ) : null}

                {/* Interactive cursor line & dot */}
                {inspectedIdx !== null && activeSeries && (
                  <g>
                    <line
                      x1={scaleX(inspectedIdx)}
                      x2={scaleX(inspectedIdx)}
                      y1={padTop}
                      y2={height - padBottom}
                      stroke="var(--market-ink)"
                      strokeWidth="1.25"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={scaleX(inspectedIdx)}
                      cy={scaleY(activeSeries.zScores[inspectedIdx] ?? 0)}
                      r="6"
                      fill="var(--market-accent)"
                      stroke="var(--market-ink)"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* X-Axis labels */}
                {activeSeries && activeSeries.stock.points.length > 0 && (
                  <>
                    <text x={padLeft} y={height - 10} fontSize="11" fontFamily="var(--font-geist-mono), monospace" fill="#7b7c74">
                      {activeSeries.stock.points[0]?.date} (Inception)
                    </text>
                    <text x={width - padRight} y={height - 10} textAnchor="end" fontSize="11" fontFamily="var(--font-geist-mono), monospace" fill="#7b7c74">
                      {activeSeries.stock.points.at(-1)?.date} (Latest Session)
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* Scrub Telemetry Bar */}
            <div className="simulation-scrub-bar">
              <div>
                <span>INSPECTED DATE: </span>
                <b>{inspectedPoint ? inspectedPoint.date : "Hover over chart"}</b>
              </div>
              {inspectedPoint && inspectedZ !== null && inspectedSpread !== null && (
                <>
                  <div>
                    <span>STOCK CLOSE: </span>
                    <b>\u20B9{inspectedPoint.price.toFixed(2)}</b>
                  </div>
                  <div>
                    <span>NIFTY 50: </span>
                    <b>{inspectedPoint.benchmark.toFixed(2)}</b>
                  </div>
                  <div>
                    <span>LOG SPREAD: </span>
                    <b>{inspectedSpread.toFixed(4)}</b>
                  </div>
                  <div>
                    <span>STANDARDIZED Z: </span>
                    <b style={{ color: Math.abs(inspectedZ) >= 2 ? "#ff8787" : "var(--market-accent)" }}>
                      {inspectedZ >= 0 ? `+${inspectedZ.toFixed(2)}` : inspectedZ.toFixed(2)}&sigma;
                    </b>
                  </div>
                  <div>
                    <span>REGIME: </span>
                    <b>
                      {Math.abs(inspectedZ) >= 2
                        ? "EXTREME DEVIATION (POTENTIAL REVERSAL)"
                        : Math.abs(inspectedZ) >= 1
                        ? "ELEVATED DRIFT"
                        : "IN EQUILIBRIUM CHANNEL"}
                    </b>
                  </div>
                </>
              )}
            </div>

            {/* 4 Statistical KPI Metrics for Active Stock */}
            {activeSeries && (
              <div className="simulation-kpi-grid">
                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Lag-1 Autoregression (&phi;)</span>
                  <span className="simulation-kpi-card__value">{activeSeries.phi.toFixed(3)}</span>
                  <p className="simulation-kpi-card__desc">
                    {activeSeries.phi < 1
                      ? `\u03C6 < 1.0 confirms statistical stationary reversion. Spread contracts toward mean at ${(1 - activeSeries.phi).toFixed(3)}/day.`
                      : "Unit root detected; spread behaves as a non-stationary random walk."}
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Reversion Half-Life (t&frac12;)</span>
                  <span className="simulation-kpi-card__value">
                    {Number.isFinite(activeSeries.halfLife) ? `${activeSeries.halfLife.toFixed(1)} d` : "Not bounded"}
                  </span>
                  <p className="simulation-kpi-card__desc">
                    Estimated trading days required for any spread shock to decay halfway back to its equilibrium baseline.
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Equilibrium Zero-Crossings</span>
                  <span className="simulation-kpi-card__value">{activeSeries.zeroCrossings} times</span>
                  <p className="simulation-kpi-card__desc">
                    Historical returns through the zero mean line across the 1-year sample ({((activeSeries.zeroCrossings / activeSeries.zScores.length) * 100).toFixed(1)}% oscillation frequency).
                  </p>
                </article>

                <article className="simulation-kpi-card">
                  <span className="simulation-kpi-card__label">Stationary Test Verdict</span>
                  <span
                    className="simulation-kpi-card__value"
                    style={{
                      fontSize: "clamp(0.95rem, 1.4vw, 1.2rem)",
                      color: activeSeries.status === "strong" ? "var(--market-positive)" : "var(--market-ink)",
                    }}
                  >
                    {activeSeries.status === "strong" ? "HIGH REVERSION" : "MODERATE REVERSION"}
                  </span>
                  <p className="simulation-kpi-card__desc">{activeSeries.verdict}</p>
                </article>
              </div>
            )}
          </section>

          {/* Comparative Table of All 6 Stocks */}
          <section className="simulation-table-wrap">
            <table className="simulation-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Symbol</th>
                  <th>Current Z-Score</th>
                  <th>Lag-1 &phi;</th>
                  <th>Half-Life</th>
                  <th>Mean Crossings</th>
                  <th>Reversion Verdict</th>
                  <th>Signal Regime</th>
                </tr>
              </thead>
              <tbody>
                {analyzed.map((item, idx) => {
                  const z = item.latestZ;
                  return (
                    <tr
                      key={item.stock.symbol}
                      style={{
                        background: activeTab === item.stock.symbol ? "#f3f7d8" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => setActiveTab(item.stock.symbol)}
                    >
                      <td>
                        <strong style={{ color: COMPANY_COLORS[idx % COMPANY_COLORS.length] }}>
                          {item.stock.name}
                        </strong>
                      </td>
                      <td>{item.stock.symbol}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: "700",
                            color: Math.abs(z) >= 2 ? "var(--market-negative)" : Math.abs(z) >= 1 ? "#c28a20" : "var(--market-positive)",
                          }}
                        >
                          {z >= 0 ? `+${z.toFixed(2)}` : z.toFixed(2)}&sigma;
                        </span>
                      </td>
                      <td>{item.phi.toFixed(3)}</td>
                      <td>{Number.isFinite(item.halfLife) ? `${item.halfLife.toFixed(1)} days` : "\u2014"}</td>
                      <td>{item.zeroCrossings} times</td>
                      <td>{item.verdict}</td>
                      <td>
                        {Math.abs(z) >= 2 ? (
                          <span className="z-regime-tag z-regime-tag--extreme">
                            {z > 0 ? "SELL OVERBOUGHT" : "BUY OVERSOLD"}
                          </span>
                        ) : Math.abs(z) >= 1 ? (
                          <span className="z-regime-tag z-regime-tag--moderate">ELEVATED DRIFT</span>
                        ) : (
                          <span className="z-regime-tag z-regime-tag--neutral">IN EQUILIBRIUM</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Explanatory callout */}
          <section className="simulation-z-banner">
            <div className="simulation-z-banner__formula-box">
              <span className="simulation-z-banner__eyebrow">THEORY &middot; FIRST PRINCIPLES</span>
              <div className="simulation-z-banner__equation">
                <span>z<sub>t</sub></span>
                <b>=</b>
                <span>&phi; &middot; z<sub>t&minus;1</sub></span>
                <b>+</b>
                <span>&epsilon;<sub>t</sub></span>
                <span className="z-highlight-tag" style={{ fontSize: "0.85rem" }}>
                  Mean Reversion holds if |&phi;| &lt; 1
                </span>
              </div>
              <p className="simulation-z-banner__desc">
                When two economically linked assets drift apart, market arbitrageurs step in to short the outperformer and buy the
                underperformer. If the spread is cointegrated, the lag coefficient <strong>&phi;</strong> will remain bounded below unity,
                and deviations will decay back to 0. In the next stage, we formalize this continuous-time reversion using the
                <strong> Ornstein&ndash;Uhlenbeck stochastic differential equation</strong>.
              </p>
            </div>
          </section>

          {/* Bottom Actions */}
          <footer className="simulation-z-footer-bar">
            <Link className="simulation-back" href="/simulation/continue">
              &larr; Back to Stage 02: Spread z-scores
            </Link>
            <Link className="landing__button simulation-continue__button" href="/simulation/model">
              Continue to Stage 04: The Ornstein&ndash;Uhlenbeck Model <span aria-hidden="true">&rarr;</span>
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}
