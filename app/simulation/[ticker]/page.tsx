"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SpreadChart, type SpreadPoint, type SpreadSeries } from "../SpreadChart";

type InputPoint = { date: string; price: number; benchmark: number };
type StockInput = { symbol: string; name: string; currency: string; points: InputPoint[] };
type StockResult = SpreadSeries & { points: SpreadPoint[]; mean: number; latest: number };
type RunStatus = "loading" | "running" | "complete" | "error";

function fixed(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "—";
}

function StockSimulationContent() {
  const params = useParams<{ ticker: string }>();
  const symbol = decodeURIComponent(params.ticker).toUpperCase();
  const [stock, setStock] = useState<StockInput>();
  const [series, setSeries] = useState<StockResult>();
  const [activePoint, setActivePoint] = useState<SpreadPoint>();
  const [processed, setProcessed] = useState(0);
  const [status, setStatus] = useState<RunStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus("loading");
      setError("");
      try {
        const response = await fetch("/api/simulation", { cache: "no-store" });
        const data = (await response.json()) as { stocks?: StockInput[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load historical market data.");
        const selected = data.stocks?.find((item) => item.symbol.toUpperCase() === symbol);
        if (!selected) throw new Error(`No historical series found for ${symbol}.`);
        if (cancelled) return;
        setStock(selected);
        setStatus("running");

        const points: SpreadPoint[] = [];
        let sum = 0;
        const total = selected.points.length;
        for (let i = 0; i < total; i += 1) {
          if (cancelled) return;
          const row = selected.points[i]!;
          const logPrice = Math.log(row.price);
          const logBenchmark = Math.log(row.benchmark);
          const spread = logPrice - logBenchmark;
          const item: SpreadPoint = { ...row, logPrice, logBenchmark, spread };
          points.push(item);
          sum += spread;
          setActivePoint(item);
          setProcessed(i + 1);
          setSeries({ symbol: selected.symbol, name: selected.name, points: [...points], mean: sum / points.length, latest: spread });
          if (i % 6 === 0) {
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          }
        }
        if (!cancelled) setStatus("complete");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to compute series.");
          setStatus("error");
        }
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [symbol]);

  const percent = stock?.points.length ? Math.round((processed / stock.points.length) * 100) : 0;

  return (
    <main className="market-shell simulation-detail-shell">
      <header className="market-topbar">
        <Link href="/simulation" className="market-brand">Monteverge<span>.</span></Link>
        <Link className="simulation-back" href="/simulation">&#8592; All stocks</Link>
      </header>

      {error ? <section className="simulation-error" role="alert"><strong>Could not load this stock</strong><span>{error}</span><Link href="/simulation" className="simulation-retry">Back to stocks</Link></section> : (
        <>
          <section className="simulation-detail-heading">
            <div><span className="simulation-eyebrow">HOW WE FIND THE GAP / {stock?.symbol ?? symbol}</span><h1>{stock?.name ?? "Loading stock"}<span>.</span></h1></div>
            <div className="simulation-status"><i className={`status-light status-light--${status}`} />{status === "loading" ? "Loading data" : status === "running" ? `Calculating ${percent}%` : "Calculation complete"}</div>
          </section>

          <section className="simulation-detail-formula" aria-label="Spread equation">
            <div className="simulation-detail-formula__equation"><span>S<sub>i,t</sub></span><b>=</b><span>ln(P<sub>i,t</sub>)</span><b>&minus;</b><span>I<sub>t</sub></span></div>
          </section>

          <section className="simulation-detail-live">
            <header className="simulation-detail-live__header">
              <div><span className="simulation-eyebrow">CALCULATED FROM HISTORICAL CLOSES</span><h2>{stock?.symbol ?? symbol}</h2></div>
              <div className="simulation-detail-live__progress"><strong>{percent}%</strong><span>{processed.toLocaleString()} / {stock?.points.length ?? 0} days</span></div>
            </header>
            <div className="simulation-progress" role="progressbar" aria-label="Stock formula calculation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>

            <div className="simulation-detail-trace" aria-live="polite">
              <div><span>STOCK CLOSE</span><strong>{activePoint ? `ln(${activePoint.price.toFixed(2)})` : "Waiting"}</strong><small>{activePoint?.date ?? ""}</small></div>
              <b>&minus;</b>
            <div><span>NIFTY 50</span><strong>{activePoint ? `ln(${activePoint.benchmark.toFixed(2)})` : "Waiting"}</strong><small>{activePoint ? fixed(activePoint.logBenchmark) : "Same date"}</small></div>
              <b>=</b>
              <div className="simulation-detail-trace__answer"><span>GAP</span><strong>{activePoint ? fixed(activePoint.spread) : "Waiting"}</strong><small>{activePoint ? `${fixed(activePoint.logPrice)} \u2212 ${fixed(activePoint.logBenchmark)}` : "Found for each date"}</small></div>
            </div>

            <div className="simulation-detail-chart">
              <SpreadChart series={series} activeDate={activePoint?.date} />
            </div>
            <footer className="simulation-detail-stats"><span>Latest gap <b>{series?.points.length ? fixed(series.latest) : "—"}</b></span><span>Average gap <b>{series?.points.length ? fixed(series.mean) : "—"}</b></span><span>{stock?.points.length ?? 0} days compared</span></footer>
          </section>
        </>
      )}
    </main>
  );
}

export default function StockSimulationPage() {
  return (
    <Suspense fallback={<main className="market-shell simulation-detail-shell"><header className="market-topbar"><Link href="/simulation" className="market-brand">Monteverge<span>.</span></Link></header><div style={{ padding: "2rem", fontFamily: "var(--font-geist-mono), monospace" }}>Loading stock simulation...</div></main>}>
      <StockSimulationContent />
    </Suspense>
  );
}
