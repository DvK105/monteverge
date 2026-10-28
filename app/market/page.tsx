"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

function MarketChart({ snapshot, name }: { snapshot: MarketSnapshot; name: string }) {
  const candles = snapshot.candles;
  const width = 800;
  const height = 300;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 248;
  const volumeTop = 258;
  const volumeBottom = 292;
  const values = candles.flatMap((candle) => [candle.high, candle.low]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(maximum * 0.002, 0.01);
  const paddedMin = minimum - spread * 0.08;
  const paddedMax = maximum + spread * 0.08;
  const plotWidth = width - left - right;
  const plotHeight = bottom - top;
  const xAt = (index: number) => left + (candles.length <= 1 ? plotWidth / 2 : (index / (candles.length - 1)) * plotWidth);
  const yAt = (price: number) => top + ((paddedMax - price) / (paddedMax - paddedMin)) * plotHeight;
  const maxVolume = Math.max(...candles.map((candle) => candle.volume ?? 0), 1);
  const candleWidth = Math.max(1.5, Math.min(7, (plotWidth / candles.length) * 0.68));
  const priceTicks = Array.from({ length: 5 }, (_, index) => paddedMax - ((paddedMax - paddedMin) * index) / 4);
  const lastTime = candles.at(-1)?.time;

  return (
    <div className="stock-chart">
      <svg className="stock-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${name} price chart`}>
        {priceTicks.map((tick, index) => {
          const y = top + (plotHeight * index) / 4;
          return <line key={`h-${index}`} x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />;
        })}
        {Array.from({ length: 7 }, (_, index) => {
          const x = left + (plotWidth * index) / 6;
          return <line key={`v-${index}`} x1={x} x2={x} y1={top} y2={volumeBottom} className="chart-gridline chart-gridline--vertical" />;
        })}
        {candles.map((candle, index) => {
          const x = xAt(index);
          const up = candle.close >= candle.open;
          const color = up ? "var(--market-positive)" : "var(--market-negative)";
          const bodyTop = Math.min(yAt(candle.open), yAt(candle.close));
          const bodyHeight = Math.max(1, Math.abs(yAt(candle.open) - yAt(candle.close)));
          const volumeHeight = ((candle.volume ?? 0) / maxVolume) * (volumeBottom - volumeTop);
          const delay = `${Math.min(index * 9, 400)}ms`;

          return (
            <g key={candle.time}>
              <line className="candle__wick" style={{ animationDelay: delay }} x1={x} x2={x} y1={yAt(candle.high)} y2={yAt(candle.low)} stroke={color} strokeWidth="1.2" />
              <rect className="candle__body" style={{ animationDelay: delay }} x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} />
              <rect className="candle__volume" style={{ animationDelay: delay }} x={x - candleWidth / 2} y={volumeBottom - volumeHeight} width={candleWidth} height={volumeHeight} fill={color} opacity="0.45" />
            </g>
          );
        })}
        <line x1={left} x2={width - right} y1={yAt(snapshot.price)} y2={yAt(snapshot.price)} className="chart-current-line" />
      </svg>
      <div className="stock-chart__axis stock-chart__axis--price" aria-hidden="true">
        {priceTicks.map((tick) => <span key={tick}>{money(tick, snapshot.currency)}</span>)}
      </div>
      <div className="stock-chart__axis stock-chart__axis--time" aria-hidden="true">
        {lastTime && <>
          <span>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(candles[0].time * 1000)}</span>
          <span>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(lastTime * 1000)}</span>
        </>}
      </div>
    </div>
  );
}

export default function MarketPage() {
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1D");
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const results = await Promise.all(STOCKS.map(async ({ symbol }) => {
      try {
        const response = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load data.");
        return [symbol, data as MarketSnapshot, null] as const;
      } catch (error) {
        return [symbol, null, error instanceof Error ? error.message : "Unable to load data."] as const;
      }
    }));

    setSnapshots((current) => {
      const next = { ...current };
      for (const [symbol, snapshot] of results) if (snapshot) next[symbol] = snapshot;
      return next;
    });
    const nextErrors: Record<string, string> = {};
    for (const [symbol, , error] of results) if (error) nextErrors[symbol] = error;
    setErrors(nextErrors);
    setLoading(false);
  }, [timeframe]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <main className="market-shell">
      <header className="market-topbar">
        <Link href="/" className="market-brand">Monteverge<span>.</span></Link>
        <button className="market-refresh" type="button" onClick={() => { setLoading(true); void refresh(); }} disabled={loading} aria-label="Refresh quotes">&#8635;</button>
      </header>

      <nav className="market-timeframes" aria-label="Chart timeframe">
        {TIMEFRAMES.map((range) => <button key={range} className={timeframe === range ? "timeframe timeframe--active" : "timeframe"} type="button" onClick={() => { setLoading(true); if (range === timeframe) void refresh(); else setTimeframe(range); }}>{range}</button>)}
      </nav>

      <section className="market-grid" aria-label="Tata Group stocks">
        {STOCKS.map(({ symbol, name }) => {
          const snapshot = snapshots[symbol];
          const change = snapshot?.previousClose ? snapshot.price - snapshot.previousClose : null;
          const changePercent = change !== null && snapshot?.previousClose ? (change / snapshot.previousClose) * 100 : null;

          return (
            <article className="stock-card" key={symbol}>
              <header className="stock-card__header">
                <div className="stock-card__identity">
                  <h2>{name}</h2>
                  <span>{symbol}</span>
                </div>
                <div className="stock-card__quote">
                  {snapshot ? <>
                    <TweenNumber value={snapshot.price} format={(value) => money(value, snapshot.currency)} />
                    {change !== null && changePercent !== null && <span className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{money(change, snapshot.currency)} ({changePercent.toFixed(2)}%)</span>}
                  </> : errors[symbol] ? <span className="stock-card__error">{errors[symbol]}</span> : <span className="stock-card__loading">Loading</span>}
                </div>
              </header>
              {snapshot && <MarketChart snapshot={snapshot} name={name} />}
            </article>
          );
        })}
      </section>
      <div className="market-actions">
        <Link className="landing__button market-simulate" href="/simulation">Run simulations <span aria-hidden="true">&#8599;</span></Link>
      </div>
    </main>
  );
}
