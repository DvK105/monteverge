"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type MarketSnapshot = {
  symbol: string;
  currency: string;
  exchange: string;
  price: number;
  previousClose: number | null;
  marketTime: number | null;
  candles: Candle[];
  fetchedAt: number;
};

const REFRESH_MS = 30_000;
const TIMEFRAMES = ["1D", "5D", "1M", "1Y"] as const;
const STOCKS = [
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "TMCV.NS", name: "Tata Motors" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel" },
  { symbol: "TATAPOWER.NS", name: "Tata Power" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products" },
  { symbol: "TITAN.NS", name: "Titan Company" },
];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)} Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)} L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}k`;
  return vol.toLocaleString();
}

function formatTimeAxis(timestamp: number, timeframe: string): string {
  const d = new Date(timestamp * 1000);
  if (timeframe === "1D") {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }
  if (timeframe === "5D") {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

// Tweens the quote between refreshes and flashes green/red on direction change.
function TweenNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const [display, setDisplay] = useState(value);
  const [tick, setTick] = useState<"up" | "down" | null>(null);
  const previous = useRef(value);
  const origin = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    if (previous.current === value) return;
    const from = previous.current;
    previous.current = value;
    origin.current = from;
    setTick(value > from ? "up" : "down");

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 650);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(origin.current + (value - origin.current) * eased);
      if (progress < 1) frame.current = window.requestAnimationFrame(step);
    };
    frame.current = window.requestAnimationFrame(step);
    const flash = window.setTimeout(() => setTick(null), 800);
    return () => {
      window.cancelAnimationFrame(frame.current);
      window.clearTimeout(flash);
    };
  }, [value]);

  return <strong className={`quote-tick${tick ? ` quote-tick--${tick}` : ""}`}>{format(display)}</strong>;
}

// Downsamples high-density candles (e.g. 360+ 1m intraday points) into clean, non-overlapping OHLC bins
function aggregateCandles(candles: Candle[], maxBins = 55): Candle[] {
  if (candles.length <= maxBins) return candles;
  const binSize = Math.ceil(candles.length / maxBins);
  const aggregated: Candle[] = [];
  for (let i = 0; i < candles.length; i += binSize) {
    const chunk = candles.slice(i, i + binSize);
    if (!chunk.length) continue;
    const open = chunk[0]!.open;
    const close = chunk[chunk.length - 1]!.close;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const volume = chunk.reduce((sum, c) => sum + (c.volume ?? 0), 0);
    const time = chunk[chunk.length - 1]!.time;
    aggregated.push({ open, high, low, close, volume, time });
  }
  return aggregated;
}

function MarketChart({
  snapshot,
  name,
  timeframe,
  chartType,
}: {
  snapshot: MarketSnapshot;
  name: string;
  timeframe: string;
  chartType: "candles" | "area";
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rawCandles = snapshot.candles;
  // Adaptive candles for candlestick view (clean spacing without overlap)
  const displayCandles = useMemo(() => {
    return chartType === "candles" ? aggregateCandles(rawCandles, 52) : rawCandles;
  }, [rawCandles, chartType]);

  // Chart coordinate space
  const width = 800;
  const height = 280;
  const plotLeft = 12;
  const plotRight = 72; // dedicated space on right for price axis labels & badge
  const plotTop = 16;
  const plotBottom = 216; // bottom of price plot
  const volumeTop = 224; // top of volume histogram
  const volumeBottom = 254; // bottom of volume histogram
  const timeAxisY = 270;

  const plotWidth = width - plotLeft - plotRight;
  const plotHeight = plotBottom - plotTop;

  // Compute symmetric padded price scale including current price & previous close
  const allPrices = [
    ...rawCandles.flatMap((c) => [c.high, c.low, c.open, c.close]),
    snapshot.price,
    ...(snapshot.previousClose ? [snapshot.previousClose] : []),
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const spread = maxPrice - minPrice || Math.max(maxPrice * 0.005, 0.05);
  const paddedMin = minPrice - spread * 0.08;
  const paddedMax = maxPrice + spread * 0.08;

  const xAt = (index: number, total: number) =>
    plotLeft + (total <= 1 ? plotWidth / 2 : (index / (total - 1)) * plotWidth);

  const yAt = (price: number) =>
    plotTop + ((paddedMax - Math.max(paddedMin, Math.min(paddedMax, price))) / (paddedMax - paddedMin)) * plotHeight;

  // Volume scale with 95th-percentile cap to prevent closing auction spikes from flattening intraday volume
  const sortedVolumes = rawCandles.map((c) => c.volume ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const p95Volume = sortedVolumes[Math.floor(sortedVolumes.length * 0.95)] || 1;
  const effectiveMaxVolume = Math.max(p95Volume * 2.2, 1);

  // 5 Evenly spaced horizontal price grid levels
  const priceTicks = Array.from({ length: 5 }, (_, i) => paddedMax - ((paddedMax - paddedMin) * i) / 4);

  // 4 Time axis ticks across the plot
  const timeTickIndices = [
    0,
    Math.round((rawCandles.length - 1) * 0.33),
    Math.round((rawCandles.length - 1) * 0.66),
    rawCandles.length - 1,
  ];

  // Continuous line/area coordinates for Area mode
  const areaPathD = useMemo(() => {
    if (!rawCandles.length) return "";
    const points = rawCandles.map((c, i) => `${i === 0 ? "M" : "L"}${xAt(i, rawCandles.length).toFixed(1)},${yAt(c.close).toFixed(1)}`).join(" ");
    return points;
  }, [rawCandles, plotWidth, plotHeight, paddedMax, paddedMin]);

  const areaFillD = useMemo(() => {
    if (!rawCandles.length || !areaPathD) return "";
    const firstX = xAt(0, rawCandles.length).toFixed(1);
    const lastX = xAt(rawCandles.length - 1, rawCandles.length).toFixed(1);
    return `${areaPathD} L${lastX},${plotBottom} L${firstX},${plotBottom} Z`;
  }, [areaPathD, rawCandles.length, plotBottom]);

  // Overall session change direction
  const isPositive = snapshot.previousClose ? snapshot.price >= snapshot.previousClose : (rawCandles.at(-1)?.close ?? 0) >= (rawCandles[0]?.open ?? 0);
  const themeColor = isPositive ? "var(--market-positive)" : "var(--market-negative)";

  // Mouse / Pointer handler for interactive HUD & crosshair
  const activeCandlesList = chartType === "candles" ? displayCandles : rawCandles;
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeCandlesList.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, relX));
    const targetIdx = Math.round(clamped * (activeCandlesList.length - 1));
    setHoveredIdx(targetIdx);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const activeCandle = hoveredIdx !== null ? activeCandlesList[hoveredIdx] : null;
  const candleWidth = Math.max(3, Math.min(8.5, (plotWidth / displayCandles.length) * 0.68));

  // Current live price Y coordinate
  const currentPriceY = yAt(snapshot.price);

  return (
    <div className="stock-chart">
      {/* Interactive Tooltip HUD Header */}
      <div className="market-chart-hud" aria-live="polite">
        {activeCandle ? (
          <>
            <span>{formatTimeAxis(activeCandle.time, timeframe)}</span>
            <span>O: <b>{money(activeCandle.open, snapshot.currency)}</b></span>
            <span>H: <b>{money(activeCandle.high, snapshot.currency)}</b></span>
            <span>L: <b>{money(activeCandle.low, snapshot.currency)}</b></span>
            <span>C: <b>{money(activeCandle.close, snapshot.currency)}</b></span>
            <span>Volume: <b>{formatVolume(activeCandle.volume ?? 0)}</b></span>
          </>
        ) : (
          <>
            <span>Today&apos;s range: <b>{money(minPrice, snapshot.currency)}</b> &mdash; <b>{money(maxPrice, snapshot.currency)}</b></span>
            <span>Exchange: <b>{snapshot.exchange}</b></span>
            {snapshot.previousClose && <span>Prev: <b>{money(snapshot.previousClose, snapshot.currency)}</b></span>}
            <span>Candles: <b>{rawCandles.length}</b></span>
          </>
        )}
      </div>

      {/* SVG Canvas */}
      <svg
        className="stock-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${name} (${snapshot.symbol}) ${timeframe} price chart`}
        onPointerMove={handlePointer}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id={`areaGrad-${snapshot.symbol.replace(/[^a-zA-Z0-9]/g, "_")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? "#607d1c" : "#ca4633"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={isPositive ? "#607d1c" : "#ca4633"} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal Price Gridlines & Integrated Price Labels */}
        {priceTicks.map((tick, index) => {
          const y = plotTop + (plotHeight * index) / 4;
          return (
            <g key={`h-grid-${index}`}>
              <line x1={plotLeft} x2={width - plotRight} y1={y} y2={y} className="chart-gridline" />
              <text x={width - 8} y={y + 3.5} textAnchor="end" className="chart-axis-price">
                {money(tick, snapshot.currency)}
              </text>
            </g>
          );
        })}

        {/* Previous Close Horizontal Baseline (if available) */}
        {snapshot.previousClose && (
          <line
            x1={plotLeft}
            x2={width - plotRight}
            y1={yAt(snapshot.previousClose)}
            y2={yAt(snapshot.previousClose)}
            stroke="#a6a49b"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        )}

        {/* Vertical Gridlines */}
        {Array.from({ length: 6 }, (_, index) => {
          const x = plotLeft + (plotWidth * index) / 5;
          return (
            <line
              key={`v-grid-${index}`}
              x1={x}
              x2={x}
              y1={plotTop}
              y2={volumeBottom}
              className="chart-gridline chart-gridline--vertical"
            />
          );
        })}

        {/* Volume Subplot Bars */}
        {displayCandles.map((candle, index) => {
          const x = xAt(index, displayCandles.length);
          const up = candle.close >= candle.open;
          const color = up ? "var(--market-positive)" : "var(--market-negative)";
          const vol = candle.volume ?? 0;
          const normVol = Math.min(vol, effectiveMaxVolume);
          const barHeight = Math.max(1, (normVol / effectiveMaxVolume) * (volumeBottom - volumeTop));
          const barWidth = Math.max(1.5, candleWidth * 0.85);

          return (
            <rect
              key={`vol-${candle.time}-${index}`}
              x={x - barWidth / 2}
              y={volumeBottom - barHeight}
              width={barWidth}
              height={barHeight}
              fill={color}
              opacity={hoveredIdx === index ? "0.85" : "0.38"}
            />
          );
        })}

        {/* Volume Subplot Separator Line */}
        <line x1={plotLeft} x2={width - plotRight} y1={volumeTop - 4} y2={volumeTop - 4} stroke="var(--market-line)" strokeWidth="0.8" />

        {/* Chart Trajectory: Area Mode or Candlestick Mode */}
        {chartType === "area" ? (
          <>
            {/* Shaded Area Fill */}
            {areaFillD && (
              <path
                d={areaFillD}
                fill={`url(#areaGrad-${snapshot.symbol.replace(/[^a-zA-Z0-9]/g, "_")})`}
              />
            )}
            {/* Smooth Price Path Line */}
            {areaPathD && (
              <path
                d={areaPathD}
                fill="none"
                stroke={themeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </>
        ) : (
          /* Candlestick Mode: Non-overlapping, cleanly spaced OHLC candles */
          displayCandles.map((candle, index) => {
            const x = xAt(index, displayCandles.length);
            const up = candle.close >= candle.open;
            const color = up ? "var(--market-positive)" : "var(--market-negative)";
            const bodyTop = Math.min(yAt(candle.open), yAt(candle.close));
            const bodyHeight = Math.max(1.2, Math.abs(yAt(candle.open) - yAt(candle.close)));

            return (
              <g key={`candle-${candle.time}-${index}`}>
                {/* Candle Wick (High to Low) */}
                <line
                  x1={x}
                  x2={x}
                  y1={yAt(candle.high)}
                  y2={yAt(candle.low)}
                  stroke={color}
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
                {/* Candle Body (Open to Close) */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth="0.5"
                />
              </g>
            );
          })
        )}

        {/* Current Market Price Reference Line & Right Axis Pill Badge */}
        <line
          x1={plotLeft}
          x2={width - plotRight}
          y1={currentPriceY}
          y2={currentPriceY}
          className="chart-current-line"
        />
        <g transform={`translate(${width - plotRight + 2}, ${currentPriceY - 8})`}>
          <rect
            x={0}
            y={0}
            width={plotRight - 4}
            height={16}
            fill="var(--market-alert)"
            rx={2}
          />
          <text
            x={(plotRight - 4) / 2}
            y={11.5}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="var(--font-geist-mono), monospace"
            fontSize="9.5"
            fontWeight="700"
          >
            {money(snapshot.price, snapshot.currency)}
          </text>
        </g>

        {/* Interactive Hover Crosshair & Point Indicator */}
        {hoveredIdx !== null && activeCandle && (
          <g>
            <line
              x1={xAt(hoveredIdx, activeCandlesList.length)}
              x2={xAt(hoveredIdx, activeCandlesList.length)}
              y1={plotTop}
              y2={volumeBottom}
              className="chart-crosshair"
            />
            <circle
              cx={xAt(hoveredIdx, activeCandlesList.length)}
              cy={yAt(activeCandle.close)}
              r="4.5"
              fill="var(--market-accent)"
              stroke="var(--market-ink)"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Time Axis Labels along Bottom of SVG */}
        {timeTickIndices.map((cIdx, i) => {
          const candle = rawCandles[cIdx];
          if (!candle) return null;
          const x = xAt(cIdx, rawCandles.length);
          const anchor = i === 0 ? "start" : i === timeTickIndices.length - 1 ? "end" : "middle";
          return (
            <text
              key={`time-tick-${i}`}
              x={x}
              y={timeAxisY}
              textAnchor={anchor}
              className="chart-axis-time"
            >
              {formatTimeAxis(candle.time, timeframe)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function MarketPage() {
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1D");
  const [chartType, setChartType] = useState<"candles" | "area">("candles");
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      STOCKS.map(async ({ symbol }) => {
        try {
          const response = await fetch(
            `/api/market?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
            { cache: "no-store" }
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Unable to load data.");
          return [symbol, data as MarketSnapshot, null] as const;
        } catch (error) {
          return [symbol, null, error instanceof Error ? error.message : "Unable to load data."] as const;
        }
      })
    );

    setSnapshots((current) => {
      const next = { ...current };
      for (const [symbol, snapshot] of results) if (snapshot) next[symbol] = snapshot;
      return next;
    });
    const nextErrors: Record<string, string> = {};
    for (const [symbol, , error] of results) if (error) nextErrors[symbol] = error;
    setErrors(nextErrors);
    setLoading(false);
    setLastUpdated(new Date());
  }, [timeframe]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  // Market telemetry summary calculations
  const summary = useMemo(() => {
    const loaded = Object.values(snapshots);
    if (!loaded.length) return null;

    const changes = loaded.map((s) => {
      const change = s.previousClose ? s.price - s.previousClose : 0;
      const pct = s.previousClose ? (change / s.previousClose) * 100 : 0;
      return { symbol: s.symbol, change, pct, name: STOCKS.find((x) => x.symbol === s.symbol)?.name ?? s.symbol };
    });

    const sortedByPct = [...changes].sort((a, b) => b.pct - a.pct);
    const topGainer = sortedByPct[0];
    const topLoser = sortedByPct[sortedByPct.length - 1];
    const advances = changes.filter((c) => c.change >= 0).length;
    const declines = changes.filter((c) => c.change < 0).length;

    return {
      topGainer,
      topLoser,
      advances,
      declines,
      loadedCount: loaded.length,
    };
  }, [snapshots]);

  return (
    <main className="market-shell">
      {/* Top Header */}
      <header className="market-topbar">
        <Link href="/" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          {lastUpdated && (
            <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-geist-mono), monospace", color: "var(--market-muted)" }}>
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            className="market-refresh"
            type="button"
            onClick={() => {
              setLoading(true);
              void refresh();
            }}
            disabled={loading}
            aria-label="Refresh quotes"
            title="Refresh live quotes"
          >
            &#8635;
          </button>
        </div>
      </header>

      {/* Top Controls: Market Telemetry & Chart Mode Switcher */}
      <section className="market-top-controls" aria-label="Market controls and summary">
        {summary && (
          <div className="market-telemetry-bar">
            <span className="market-pill">
              <span className="status-light status-light--complete" />
              Tata stocks on NSE
            </span>
            <span className="market-pill">
              Biggest rise:{" "}
              <b className={summary.topGainer.pct >= 0 ? "positive" : "negative"}>
                {summary.topGainer.name.split(" ")[0]} ({summary.topGainer.pct >= 0 ? "+" : ""}
                {summary.topGainer.pct.toFixed(2)}%)
              </b>
            </span>
            <span className="market-pill">
              Rising / falling: <b>{summary.advances} / {summary.declines}</b>
            </span>
          </div>
        )}

        <div className="market-top-controls__right">
          {/* Timeframe Selector Nav */}
          <nav className="market-timeframes" aria-label="Chart timeframe">
            {TIMEFRAMES.map((range) => (
              <button
                key={range}
                className={timeframe === range ? "timeframe timeframe--active" : "timeframe"}
                type="button"
                onClick={() => {
                  setLoading(true);
                  if (range === timeframe) void refresh();
                  else setTimeframe(range);
                }}
              >
                {range}
              </button>
            ))}
          </nav>

          {/* Chart View Toggle (Candles vs Area Line) */}
          <div className="chart-mode-group" role="group" aria-label="Chart representation">
            <button
              type="button"
              className={`chart-mode-btn ${chartType === "candles" ? "chart-mode-btn--active" : ""}`}
              onClick={() => setChartType("candles")}
            >
              Bars
            </button>
            <button
              type="button"
              className={`chart-mode-btn ${chartType === "area" ? "chart-mode-btn--active" : ""}`}
              onClick={() => setChartType("area")}
            >
              Line
            </button>
          </div>
        </div>
      </section>

      {/* Stock Cards 6-Grid */}
      <section className="market-grid" aria-label="Tata Group stocks">
        {STOCKS.map(({ symbol, name }) => {
          const snapshot = snapshots[symbol];
          const change = snapshot?.previousClose ? snapshot.price - snapshot.previousClose : null;
          const changePercent =
            change !== null && snapshot?.previousClose ? (change / snapshot.previousClose) * 100 : null;

          return (
            <article className="stock-card" key={symbol}>
              <header className="stock-card__header">
                <div className="stock-card__identity">
                  <h2>{name}</h2>
                  <span>{symbol} &middot; NSE</span>
                </div>
                <div className="stock-card__quote">
                  {snapshot ? (
                    <>
                      <TweenNumber value={snapshot.price} format={(value) => money(value, snapshot.currency)} />
                      {change !== null && changePercent !== null && (
                        <span className={change >= 0 ? "positive" : "negative"}>
                          {change >= 0 ? "+" : ""}
                          {money(change, snapshot.currency)} ({changePercent >= 0 ? "+" : ""}
                          {changePercent.toFixed(2)}%)
                        </span>
                      )}
                    </>
                  ) : errors[symbol] ? (
                    <span className="stock-card__error">{errors[symbol]}</span>
                  ) : (
                    <span className="stock-card__loading">Loading</span>
                  )}
                </div>
              </header>

              {snapshot && (
                <MarketChart
                  snapshot={snapshot}
                  name={name}
                  timeframe={timeframe}
                  chartType={chartType}
                />
              )}
            </article>
          );
        })}
      </section>

      {/* Market Action Link to the first pre-simulation briefing */}
      <div className="market-actions">
        <Link className="landing__button market-simulate" href="/briefing/log-spread">
          See how it works <span aria-hidden="true">&#8599;</span>
        </Link>
      </div>
    </main>
  );
}
