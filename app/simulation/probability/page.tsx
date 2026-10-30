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
  sigma: number; // continuous diffusion coefficient
  halfLife: number; // ln(2)/theta in trading days
  daysTo90: number;
};

type ModelProbability = {
  speed: number;  // reversion-speed multiplier of this equation
  weight: number; // adaptive ensemble weight
  theta: number;  // effective reversion rate of this equation
  halfLife: number; // implied half-life of this equation
  revertProb: number;    // % of paths that reached/crossed equilibrium within the horizon
  terminalProb: number;  // % of paths sitting at equilibrium (±0.5σ) at the horizon
};

type Verdict = {
  signal: "BUY" | "SHORT" | "HOLD";
  strength: "STRONG" | "MODERATE" | "WEAK" | "ABSTAIN";
  label: string;
};

type ProbabilityResult = {
  calibrated: CalibratedOU;
  models: ModelProbability[];
  finalProb: number;         // adaptive-weight mixture reversion probability (%)
  finalTerminalProb: number; // adaptive-weight mixture equilibrium-at-horizon probability (%)
  verdict: Verdict;
};

const COMPANY_COLORS = [
  "#147d72", // Teal
  "#c28a20", // Amber
  "#c9573f", // Terracotta
  "#4169a1", // Slate Blue
  "#8d5da8", // Purple
  "#46534d", // Charcoal
];

// The same 5-equation adaptive OU ensemble used in the Stage 04 model:
// each equation is the same OU SDE run at a different reversion speed.
const EXPERT_SPEEDS = [0.4, 0.7, 1.0, 1.4, 2.0] as const;
const EXPERT_COLORS = ["#4169a1", "#2f9e44", "#c28a20", "#c9573f", "#8d5da8"];

function adaptiveWeights(theta: number): number[] {
  // Softmax over how well each equation's implied half-life matches the
  // stock's own calibrated half-life tau_hat = ln(2)/theta (identical to Stage 04).
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

  // No clamping: if the sample is non-stationary (phi >= 1) or oscillating
  // (phi <= 0), the OU process does not apply and theta is genuinely 0.
  const phi = rawPhi;
  const isStationary = rawPhi > 0 && rawPhi < 1;
  const theta = isStationary ? -Math.log(rawPhi) : 0;

  // Discrete step noise -> continuous diffusion coefficient.
  const residuals = x.map((xv, i) => y[i]! - phi * xv);
  const resVar = residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, residuals.length - 1);
  const stepStd = Math.sqrt(Math.max(1e-7, resVar));
  const sigma =
    theta > 1e-9 ? stepStd * Math.sqrt((2 * theta) / (1 - Math.exp(-2 * theta))) : stepStd;

  return {
    stock,
    latestSpread: centered.at(-1) ?? 0,
    mean,
    theta,
    phi,
    sigma,
    halfLife: isStationary ? Math.log(2) / theta : Number.POSITIVE_INFINITY,
    daysTo90: isStationary ? Math.log(10) / theta : Number.POSITIVE_INFINITY,
  };
}

// Fresh Box-Muller normals from the platform entropy source. No fixed seed:
// every run of the engine is a new Monte Carlo experiment.
function gaussian() {
  const u = Math.max(Math.random(), 1e-12);
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function buildVerdict(finalProb: number, x0: number): Verdict {
  // Direction follows the sign of the spread: a positive X0 means the stock
  // outperformed NIFTY and reversion implies underperformance (SHORT); a
  // negative X0 means underperformance and reversion implies outperformance (BUY).
  if (Math.abs(x0) < 0.02) {
    return { signal: "HOLD", strength: "ABSTAIN", label: "Gap is near normal" };
  }
  const direction = x0 > 0 ? "SHORT" : "BUY";
  if (finalProb >= 75) {
    return {
      signal: direction,
      strength: "STRONG",
      label: `Strong chance the gap shrinks`,
    };
  }
  if (finalProb >= 55) {
    return {
      signal: direction,
      strength: "MODERATE",
      label: `Some chance the gap shrinks`,
    };
  }
  if (finalProb >= 40) {
    return {
      signal: direction,
      strength: "WEAK",
      label: `Weak ${direction} signal`,
    };
  }
  return {
    signal: "HOLD",
    strength: "ABSTAIN",
    label: "Low chance the gap shrinks",
  };
}

function runProbabilityEngine(
  calibrated: CalibratedOU,
  horizon: number,
  totalSimulations: number
): ProbabilityResult {
  const weights = adaptiveWeights(calibrated.theta);
  const x0 = calibrated.latestSpread;
  const sigma = calibrated.sigma;

  // Terminal target: half of the base equation's stationary std sigma^2/(2*theta).
  // Falls back to half the daily diffusion scale when no reversion is detected.
  const stationaryStd =
    calibrated.theta > 1e-9 ? sigma / Math.sqrt(2 * calibrated.theta) : sigma;
  const targetThreshold = Math.max(0.01, stationaryStd * 0.5);

  const models: ModelProbability[] = EXPERT_SPEEDS.map((speed, idx) => {
    const theta = calibrated.theta * speed;
    const expDt = Math.exp(-theta); // exact OU step decay
    const stdDt =
      theta > 1e-6
        ? Math.sqrt((sigma ** 2 / (2 * theta)) * (1 - Math.exp(-2 * theta)))
        : sigma;

    let crossed = 0;
    let terminalAtEquilibrium = 0;

    for (let sim = 0; sim < totalSimulations; sim++) {
      let currentX = x0;
      let didCross = false;
      for (let day = 1; day <= horizon; day++) {
        currentX = currentX * expDt + stdDt * gaussian();
        if ((x0 >= 0 && currentX <= 0) || (x0 < 0 && currentX >= 0)) {
          didCross = true;
        }
      }
      if (didCross) crossed++;
      // Terminal measure is evaluated for every path at the horizon, not only
      // the ones that never touched equilibrium.
      if (Math.abs(currentX) <= targetThreshold) terminalAtEquilibrium++;
    }

    return {
      speed,
      weight: weights[idx]!,
      theta,
      halfLife: theta > 1e-9 ? Math.log(2) / theta : Number.POSITIVE_INFINITY,
      revertProb: (crossed / totalSimulations) * 100,
      terminalProb: (terminalAtEquilibrium / totalSimulations) * 100,
    };
  });

  // Adaptive-weight blend across the 5 equations.
  const finalProb = models.reduce((sum, m) => sum + m.weight * m.revertProb, 0);
  const finalTerminalProb = models.reduce((sum, m) => sum + m.weight * m.terminalProb, 0);
  return {
    calibrated,
    models,
    finalProb,
    finalTerminalProb,
    verdict: buildVerdict(finalProb, x0),
  };
}

export default function ProbabilityEnginePage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Engine controls
  const [horizon, setHorizon] = useState<number>(60);
  const [simulations, setSimulations] = useState<number>(2000);
  // Nonce only forces a fresh entropy draw; it is not fed into the model.
  const [runNonce, setRunNonce] = useState<number>(0);

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

  const engine = useMemo(() => {
    void runNonce; // dependency only: re-runs every model with new random draws
    return calibratedList.map((calibrated) => runProbabilityEngine(calibrated, horizon, simulations));
  }, [calibratedList, horizon, simulations, runNonce]);

  // Portfolio-level aggregation
  const summary = useMemo(() => {
    if (!engine.length) return null;
    const buyCount = engine.filter((r) => r.verdict.signal === "BUY").length;
    const shortCount = engine.filter((r) => r.verdict.signal === "SHORT").length;
    const holdCount = engine.filter((r) => r.verdict.signal === "HOLD").length;
    const avgProb = engine.reduce((sum, r) => sum + r.finalProb, 0) / engine.length;
    const bestConviction = [...engine].sort((a, b) => b.finalProb - a.finalProb)[0];
    return { buyCount, shortCount, holdCount, avgProb, bestConviction };
  }, [engine]);

  const latestSession = engine[0]?.calibrated.stock.points.at(-1)?.date;

  const probColor = (p: number) =>
    p >= 75 ? "var(--market-positive)" : p >= 55 ? "var(--market-accent)" : p >= 40 ? "#c28a20" : "var(--market-negative)";

  const strengthTag = (strength: Verdict["strength"], signal: Verdict["signal"]) => {
    const base = "z-regime-tag";
    if (signal === "HOLD") return `${base} z-regime-tag--neutral`;
    return `${base} ${strength === "STRONG" ? "z-regime-tag--extreme" : strength === "MODERATE" ? "z-regime-tag--moderate" : "z-regime-tag--neutral"}`;
  };

  return (
    <main className="market-shell simulation-stage-shell simulation-probability-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <Link className="simulation-back" href="/briefing/probability">
          &larr; How we count futures
        </Link>
      </header>

      {/* Header & Context */}
      <section className="simulation-stage-header">
        <div className="simulation-stage-title-wrap">
          <div className="simulation-stage-step-tag">
            <span>Stage 05 / Chance</span>
            <span style={{ color: "var(--market-line)" }}>&bull;</span>
            <span>Five model speeds</span>
          </div>
          <h1>Does the gap get smaller?<span>.</span></h1>
        </div>
        <div className="simulation-status">
          <i className={`status-light ${loading ? "status-light--running" : error ? "status-light--error" : "status-light--complete"}`} />
          {loading
            ? "Testing possible futures..."
            : error
              ? "Data unavailable"
              : `${simulations.toLocaleString()} paths × ${engine.length} assets · live closes to ${latestSession ?? "latest session"}`}
        </div>
      </section>

      {error ? (
        <section className="simulation-error" role="alert">
          <strong>Could not check possible futures</strong>
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
          {/* Simulation Controls */}
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
              {[1000, 2000, 5000].map((count) => (
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

          {/* 5-Model Probability Matrix */}
          <section className="simulation-table-wrap">
            <h2 style={{ fontSize: "0.95rem", margin: "0 0 10px" }}>
              Results by stock
            </h2>
            <table className="simulation-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Gap now</th>
                  {EXPERT_SPEEDS.map((s, k) => (
                    <th key={s}>
                      <span style={{ color: EXPERT_COLORS[k] }}>
                        Speed {s}&times;
                      </span>{" "}
                      % closer
                    </th>
                  ))}
                  <th>Chance gap shrinks</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {engine.map((result, idx) => {
                  const { calibrated: c, models, finalProb, verdict } = result;
                  return (
                    <tr key={c.stock.symbol}>
                      <td>
                        <strong style={{ color: COMPANY_COLORS[idx % COMPANY_COLORS.length] }}>
                          {c.stock.name}
                        </strong>
                        <span style={{ display: "block", fontSize: "0.66rem", color: "var(--market-muted)" }}>
                          {c.stock.symbol}
                        </span>
                      </td>
                      <td>
                        <b style={{ color: Math.abs(c.latestSpread) >= 0.05 ? "var(--market-negative)" : "var(--market-ink)" }}>
                          {c.latestSpread >= 0 ? `+${c.latestSpread.toFixed(4)}` : c.latestSpread.toFixed(4)}
                        </b>
                      </td>
                      {models.map((m, k) => (
                        <td key={k}>
                          <span
                            style={{
                              fontFamily: "var(--font-geist-mono), monospace",
                              fontWeight: 700,
                              color: EXPERT_COLORS[k],
                            }}
                          >
                            {m.revertProb.toFixed(1)}%
                          </span>
                          <span style={{ display: "block", fontSize: "0.6rem", color: "var(--market-muted)" }}>
                            w {m.weight.toFixed(2)}
                          </span>
                        </td>
                      ))}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                          <b
                            style={{
                              fontFamily: "var(--font-geist-mono), monospace",
                              fontSize: "1.05rem",
                              color: probColor(finalProb),
                            }}
                          >
                            {finalProb.toFixed(1)}%
                          </b>
                          <span
                            style={{
                              flex: 1,
                              height: "7px",
                              borderRadius: "999px",
                              background: "var(--market-line)",
                              overflow: "hidden",
                              display: "inline-block",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                width: `${Math.min(100, finalProb)}%`,
                                height: "100%",
                                background: probColor(finalProb),
                              }}
                            />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={strengthTag(verdict.strength, verdict.signal)}>
                          {verdict.signal === "HOLD"
                            ? "NO TRADE"
                            : verdict.strength === "STRONG"
                              ? `STRONG ${verdict.signal}`
                              : verdict.strength === "MODERATE"
                                ? `MODERATE ${verdict.signal}`
                                : `WEAK ${verdict.signal}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Per-Stock Reviews: what the 5 models mean + final probability review */}
          <section className="simulation-kpi-grid" aria-label="Per-stock probability reviews">
            {engine.map((result, idx) => {
              const { calibrated: c, models, finalProb, finalTerminalProb, verdict } = result;
              return (
                <article className="simulation-kpi-card" key={c.stock.symbol}>
                  {/* Card heading */}
                  <span className="simulation-kpi-card__label" style={{ color: COMPANY_COLORS[idx % COMPANY_COLORS.length] }}>
                    {c.stock.name} ({c.stock.symbol.split(".")[0]})
                  </span>
                  <span
                    className="simulation-kpi-card__value"
                    style={{ fontSize: "1.4rem", color: probColor(finalProb), fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {finalProb.toFixed(1)}% chance gap shrinks
                  </span>

                  {/* Model-by-model readout */}
                  <div style={{ margin: "10px 0 12px", display: "grid", gap: "4px" }}>
                    {models.map((m, k) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "8px",
                          fontSize: "0.66rem",
                          fontFamily: "var(--font-geist-mono), monospace",
                          borderBottom: "1px dashed var(--market-line)",
                          paddingBottom: "3px",
                        }}
                      >
                        <span style={{ color: EXPERT_COLORS[k]!, fontWeight: 700 }}>
                          Eq-{k + 1} {m.speed}&times;&theta; (&tau;={Number.isFinite(m.halfLife) ? `${m.halfLife.toFixed(0)}d` : "—"})
                        </span>
                        <span>
                          {m.revertProb.toFixed(1)}% got closer
                        </span>
                      </div>
                    ))}
                  </div>



                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span className={strengthTag(verdict.strength, verdict.signal)}>{verdict.label.toUpperCase()}</span>
                    <span style={{ fontSize: "0.62rem", color: "var(--market-muted)" }}>
                      Signal: <b style={{ color: verdict.signal === "BUY" ? "var(--market-positive)" : verdict.signal === "SHORT" ? "var(--market-negative)" : "var(--market-muted)" }}>
                        {verdict.signal === "HOLD" ? "STAND ASIDE" : `${verdict.signal} · ${verdict.strength}`}
                      </b>
                    </span>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Final Portfolio Verdict */}
          {summary && (
            <>
              <section className="simulation-z-summary-bar" aria-label="Portfolio probability summary">
                <article className="simulation-z-summary-card">
                  <span className="simulation-z-summary-card__label">Average chance</span>
                  <span
                    className="simulation-z-summary-card__value"
                    style={{ color: probColor(summary.avgProb), fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {summary.avgProb.toFixed(1)}%
                  </span>
                  <span className="simulation-z-summary-card__sub">Across {engine.length} stocks</span>
                </article>

                <article className="simulation-z-summary-card">
                  <span className="simulation-z-summary-card__label">Highest chance</span>
                  <span className="simulation-z-summary-card__value" style={{ color: "var(--market-ink)" }}>
                    {summary.bestConviction.calibrated.stock.name.split(" ")[0]} ({summary.bestConviction.finalProb.toFixed(1)}%)
                  </span>
                  <span className="simulation-z-summary-card__sub">
                    {summary.bestConviction.verdict.signal === "HOLD" ? "Not actionable at the horizon" : `${summary.bestConviction.verdict.strength} ${summary.bestConviction.verdict.signal} candidate`}
                  </span>
                </article>

                <article className="simulation-z-summary-card">
                  <span className="simulation-z-summary-card__label">Signals</span>
                  <span className="simulation-z-summary-card__value" style={{ color: "var(--market-positive)" }}>
                    {summary.buyCount} BUY / {summary.shortCount} SHORT
                  </span>
                  <span className="simulation-z-summary-card__sub">{summary.holdCount} of {engine.length} assets: stand aside</span>
                </article>
              </section>


            </>
          )}

          {/* Trade Signals Table */}
          <section className="simulation-table-wrap">
            <h2 style={{ fontSize: "0.95rem", margin: "0 0 10px" }}>
              Model signals
            </h2>
            <table className="simulation-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Stock</th>
                  <th>Compared with</th>
                  <th>Gap</th>
                  <th>Chance</th>
                  <th>Strength</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {[...engine]
                  .sort((a, b) => b.finalProb - a.finalProb)
                  .map((result) => {
                    const { calibrated: c, finalProb, verdict } = result;
                    const isBuy = verdict.signal === "BUY";
                    const isShort = verdict.signal === "SHORT";
                    return (
                      <tr key={c.stock.symbol}>
                        <td>
                          <span
                            className={strengthTag(verdict.strength, verdict.signal)}
                            style={isBuy ? { background: "rgba(20, 125, 114, 0.16)", color: "var(--market-positive)" } : undefined}
                          >
                            {verdict.signal}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: isBuy ? "var(--market-positive)" : isShort ? "var(--market-negative)" : "var(--market-muted)" }}>
                            {verdict.signal === "HOLD" ? "—" : `${verdict.signal} ${c.stock.symbol}`}
                          </strong>
                          <span style={{ display: "block", fontSize: "0.62rem", color: "var(--market-muted)" }}>{c.stock.name}</span>
                        </td>
                        <td>NIFTY 50 (^NSEI)</td>
                        <td>{c.latestSpread >= 0 ? `+${c.latestSpread.toFixed(4)}` : c.latestSpread.toFixed(4)}</td>
                        <td>
                          <b style={{ color: probColor(finalProb) }}>{finalProb.toFixed(1)}%</b>
                        </td>
                        <td>{verdict.strength}</td>
                        <td style={{ fontSize: "0.66rem", maxWidth: "240px" }}>{verdict.label}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

          </section>

          {/* Footer */}
          <footer className="simulation-z-footer-bar">
            <Link className="simulation-back" href="/briefing/probability">
              &larr; How we count futures
            </Link>
            <Link className="landing__button simulation-continue__button" href="/briefing/formulas">
              Formulas <span aria-hidden="true">&rarr;</span>
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}
