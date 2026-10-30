"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = { date: string; price: number; benchmark: number };
type Stock = { symbol: string; name: string; currency: string; points: Row[] };

type ZScoreSeries = {
  stock: Stock;
  spreads: number[];
  zScores: number[];
  mean: number;
  variance: number;
  stdDev: number;
  latestSpread: number;
  latestZ: number;
  minZ: number;
  maxZ: number;
  inEquilibriumPct: number;
  extremeCount: number;
  regime: "neutral" | "moderate" | "extreme";
  regimeLabel: string;
};

function calculateZScores(stock: Stock): ZScoreSeries {
  const points = stock.points;
  const spreads = points.map((p) => Math.log(p.price) - Math.log(p.benchmark));
  const n = spreads.length || 1;
  const mean = spreads.reduce((sum, v) => sum + v, 0) / n;
  const variance = spreads.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, n - 1);
  const stdDev = Math.sqrt(Math.max(variance, 1e-8));

  const zScores = spreads.map((s) => (s - mean) / stdDev);
  const latestSpread = spreads.at(-1) ?? 0;
  const latestZ = zScores.at(-1) ?? 0;
  const minZ = Math.min(...zScores);
  const maxZ = Math.max(...zScores);

  const inEqCount = zScores.filter((z) => Math.abs(z) <= 1.0).length;
  const inEquilibriumPct = (inEqCount / n) * 100;
  const extremeCount = zScores.filter((z) => Math.abs(z) >= 2.0).length;

  let regime: "neutral" | "moderate" | "extreme" = "neutral";
  let regimeLabel = "NEAR NORMAL";
  if (Math.abs(latestZ) >= 2.0) {
    regime = "extreme";
    regimeLabel = latestZ > 0 ? "MUCH HIGHER" : "MUCH LOWER";
  } else if (Math.abs(latestZ) >= 1.0) {
    regime = "moderate";
    regimeLabel = latestZ > 0 ? "A BIT HIGH" : "A BIT LOW";
  }

  return {
    stock,
    spreads,
    zScores,
    mean,
    variance,
    stdDev,
    latestSpread,
    latestZ,
    minZ,
    maxZ,
    inEquilibriumPct,
    extremeCount,
    regime,
    regimeLabel,
  };
}

export default function SpreadZScoresPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoveredStates, setHoveredStates] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchHistoricalData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/simulation", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load market history.");
        if (cancelled) return;
        setStocks(data.stocks || []);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load market history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistoricalData();
    return () => {
      cancelled = true;
    };
  }, []);

  const analyzed = useMemo(() => stocks.map(calculateZScores), [stocks]);

  // Chart coordinates
  const chartWidth = 520;
  const chartHeight = 160;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 24;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  // Symmetric standard deviation bounds (-3.2σ to +3.2σ)
  const zMin = -3.2;
  const zMax = 3.2;

  const scaleX = (index: number, total: number) =>
    padLeft + (total <= 1 ? plotWidth / 2 : (index / (total - 1)) * plotWidth);

  const scaleY = (z: number) =>
    padTop + ((zMax - Math.max(zMin, Math.min(zMax, z))) / (zMax - zMin)) * plotHeight;

  return (
    <main className="market-shell simulation-z-shell">
      {/* Top Navigation */}
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <Link className="simulation-back" href="/briefing/z-score">
          &larr; How to read the score
        </Link>
      </header>

      {/* Stage Header */}
      <section className="simulation-stage-header simulation-z-heading">
        <h1>
          Which gaps are unusual?<span>.</span>
        </h1>
        <div className="simulation-status">
          <i
            className={`status-light ${
              loading ? "status-light--running" : error ? "status-light--error" : "status-light--complete"
            }`}
          />
          {loading ? "Normalizing spreads..." : error ? "Data unavailable" : `${stocks.length} assets · live closes to ${stocks[0]?.points.at(-1)?.date ?? "latest"}`}
        </div>
      </section>

      {error ? (
        <section className="simulation-error" role="alert">
          <strong>Could not check the gaps</strong>
          <span>{error}</span>
          <button
            type="button"
            className="simulation-retry"
            onClick={() => {
              setLoading(true);
              setError("");
              window.location.reload();
            }}
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          {/* 6-Card Z-Score Graphs Grid */}
          <section className="simulation-z-grid" aria-label="Normalized z-score charts for all assets">
            {analyzed.map((item, index) => {
              const { stock, zScores, spreads, mean, stdDev, latestZ, regime, regimeLabel, inEquilibriumPct } = item;
              const points = stock.points;
              const totalPoints = points.length;
              const activeHoverIdx = hoveredStates[stock.symbol] ?? null;
              const inspectedIdx = activeHoverIdx !== null ? activeHoverIdx : totalPoints - 1;
              const inspectedPoint = points[inspectedIdx];
              const inspectedZ = zScores[inspectedIdx] ?? 0;
              const inspectedSpread = spreads[inspectedIdx] ?? 0;

              // Build continuous trajectory path
              const pathD = zScores
                .map((z, i) => `${i === 0 ? "M" : "L"}${scaleX(i, totalPoints).toFixed(1)},${scaleY(z).toFixed(1)}`)
                .join(" ");

              // Shaded ±1σ equilibrium band polygon
              const bandTopY = scaleY(1.0);
              const bandBottomY = scaleY(-1.0);
              const bandLeftX = scaleX(0, totalPoints);
              const bandRightX = scaleX(totalPoints - 1, totalPoints);

              const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = (e.clientX - rect.left) / rect.width;
                const clamped = Math.max(0, Math.min(1, relX));
                const target = Math.round(clamped * (totalPoints - 1));
                setHoveredStates((prev) => ({ ...prev, [stock.symbol]: target }));
              };

              const handlePointerLeave = () => {
                setHoveredStates((prev) => ({ ...prev, [stock.symbol]: null }));
              };

              return (
                <article className="simulation-z-card" key={stock.symbol}>
                  {/* Card Header */}
                  <header className="simulation-z-card__header">
                    <div className="simulation-z-card__identity">
                      <h2 className="simulation-z-card__title" title={stock.name}>
                        {stock.name}
                      </h2>
                      <span className="simulation-z-card__symbol">{stock.symbol} &middot; NSE</span>
                    </div>
                    <div className="simulation-z-card__badges">
                      <span className="simulation-z-card__index">0{index + 1}</span>
                      <span className={`z-regime-tag z-regime-tag--${regime}`}>
                        {regime === "extreme" ? (
                          <span style={{ color: "var(--market-negative)", fontWeight: 800 }}>&bull;</span>
                        ) : regime === "moderate" ? (
                          <span style={{ color: "#c28a20" }}>&bull;</span>
                        ) : (
                          <span style={{ color: "var(--market-positive)" }}>&bull;</span>
                        )}
                        {regimeLabel}
                      </span>
                    </div>
                  </header>

                  {/* 4-Item Metrics Strip */}
                  <div className="simulation-z-metrics-row">
                    <div className="simulation-z-metric-item">
                      <span className="simulation-z-metric-item__label">How unusual</span>
                      <span
                        className={`simulation-z-metric-item__value ${
                          Math.abs(latestZ) >= 2.0
                            ? "simulation-z-metric-item__value--alert"
                            : "simulation-z-metric-item__value--neutral"
                        }`}
                      >
                        {latestZ >= 0 ? `+${latestZ.toFixed(2)}` : latestZ.toFixed(2)}&sigma;
                      </span>
                    </div>
                    <div className="simulation-z-metric-item">
                      <span className="simulation-z-metric-item__label">Average gap</span>
                      <span className="simulation-z-metric-item__value">{mean.toFixed(4)}</span>
                    </div>
                    <div className="simulation-z-metric-item">
                      <span className="simulation-z-metric-item__label">Typical movement</span>
                      <span className="simulation-z-metric-item__value">{stdDev.toFixed(4)}</span>
                    </div>
                    <div className="simulation-z-metric-item">
                      <span className="simulation-z-metric-item__label">Days near normal</span>
                      <span className="simulation-z-metric-item__value">{inEquilibriumPct.toFixed(0)}% days</span>
                    </div>
                  </div>

                  {/* Interactive SVG Chart */}
                  <div className="simulation-z-chart-container">
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${stock.name} standardized z-score trajectory over 1 year`}
                      onPointerMove={handlePointer}
                      onPointerLeave={handlePointerLeave}
                    >
                      <defs>
                        <linearGradient id={`zBandGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d8f04d" stopOpacity="0.35" />
                          <stop offset="50%" stopColor="#d8f04d" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#d8f04d" stopOpacity="0.35" />
                        </linearGradient>
                      </defs>

                      {/* Equilibrium ±1σ Corridor Shaded Band */}
                      <rect
                        x={bandLeftX}
                        y={bandTopY}
                        width={Math.max(1, bandRightX - bandLeftX)}
                        height={Math.max(1, bandBottomY - bandTopY)}
                        fill={`url(#zBandGrad-${index})`}
                        stroke="#c4db33"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />

                      {/* Horizontal Reference Lines & Y-Axis Labels */}
                      {[-2, -1, 0, 1, 2].map((lvl) => {
                        const yPos = scaleY(lvl);
                        const isZero = lvl === 0;
                        const isBoundary = Math.abs(lvl) === 2;
                        return (
                          <g key={lvl}>
                            <line
                              x1={padLeft}
                              x2={chartWidth - padRight}
                              y1={yPos}
                              y2={yPos}
                              className={
                                isZero
                                  ? "z-chart-grid-line z-chart-grid-line--zero"
                                  : isBoundary
                                  ? "z-chart-grid-line z-chart-grid-line--boundary"
                                  : "z-chart-grid-line"
                              }
                            />
                            <text
                              x={padLeft - 6}
                              y={yPos + 3.5}
                              textAnchor="end"
                              className={`z-chart-axis-label ${isZero ? "z-chart-axis-label--center" : ""}`}
                              fill={isZero ? "var(--market-ink)" : isBoundary ? "#c92a2a" : "#77766f"}
                            >
                              {lvl === 0 ? "0.0μ" : `${lvl > 0 ? "+" : ""}${lvl}σ`}
                            </text>
                          </g>
                        );
                      })}

                      {/* Continuous Z-Score Path */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="var(--market-ink)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Current / Hovered Pointer Indicator */}
                      {inspectedIdx !== null && (
                        <g>
                          <line
                            x1={scaleX(inspectedIdx, totalPoints)}
                            x2={scaleX(inspectedIdx, totalPoints)}
                            y1={padTop}
                            y2={chartHeight - padBottom}
                            stroke="var(--market-ink)"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={scaleX(inspectedIdx, totalPoints)}
                            cy={scaleY(inspectedZ)}
                            r="5"
                            fill="var(--market-accent)"
                            stroke="var(--market-ink)"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </svg>

                    {/* Chart Start & End Date Labels */}
                    <div className="simulation-z-chart-labels">
                      <span>{points[0]?.date ? `${points[0].date} (Inception)` : ""}</span>
                      <span>{points.at(-1)?.date ? `${points.at(-1)?.date} (Latest Session)` : ""}</span>
                    </div>
                  </div>

                  {/* Dynamic Action Readout HUD */}
                  <div className="simulation-z-action-bar">
                    {inspectedPoint ? (
                      <div className="simulation-z-action-bar__formula" title={`Formula trace on ${inspectedPoint.date}`}>
                        ln({inspectedPoint.price.toFixed(2)}) &minus; ln({inspectedPoint.benchmark.toFixed(2)}) ={" "}
                        <b>{inspectedSpread.toFixed(5)}</b>
                      </div>
                    ) : (
                      <span className="simulation-z-action-bar__prompt">
                        Hover to inspect &middot; Latest: {latestZ >= 0 ? "+" : ""}
                        {latestZ.toFixed(2)}&sigma;
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {/* Footer Navigation Bar */}
          <footer className="simulation-z-footer-bar">
            <Link className="landing__button simulation-continue__button" href="/briefing/reversion">
              Next: do gaps shrink? <span aria-hidden="true">&rarr;</span>
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}
