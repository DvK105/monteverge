"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpreadChart, type SpreadPoint } from "./SpreadChart";

type InputPoint = { date: string; price: number; benchmark: number };
type StockInput = { symbol: string; name: string; currency: string; points: InputPoint[] };
type StockResult = Omit<StockInput, "points"> & { points: SpreadPoint[]; mean: number; latest: number };
type SimulationPayload = { benchmark: string; benchmarkSymbol: string; fetchedAt: number; stocks: StockInput[] };
type RunStatus = "loading" | "running" | "complete" | "error";

function fixed(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "—";
}

export default function SimulationPage() {
  const [payload, setPayload] = useState<SimulationPayload | null>(null);
  const [computed, setComputed] = useState<StockResult[]>([]);
  const [processed, setProcessed] = useState(0);
  const [status, setStatus] = useState<RunStatus>("loading");
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setStatus("loading");
    setError("");
    setComputed([]);
    setProcessed(0);
    try {
      const response = await fetch("/api/simulation", { cache: "no-store" });
      const data = (await response.json()) as SimulationPayload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load historical market data.");
      setPayload(data);
      setStatus("running");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load historical market data.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void run());
    return () => window.cancelAnimationFrame(frame);
  }, [run]);

  useEffect(() => {
    if (!payload || status !== "running") return;
    let cancelled = false;

    async function calculateSeries() {
      const results = payload!.stocks.map((stock) => ({ ...stock, points: [] as SpreadPoint[], mean: 0, latest: 0 }));
      const sums = payload!.stocks.map(() => 0);
      const batchSize = 12;
      let done = 0;
      const longest = Math.max(...payload!.stocks.map((stock) => stock.points.length));
      for (let start = 0; start < longest; start += batchSize) {
        if (cancelled) return;
        for (let index = 0; index < payload!.stocks.length; index += 1) {
          const source = payload!.stocks[index]!;
          const result = results[index]!;
          for (const row of source.points.slice(start, start + batchSize)) {
            const logPrice = Math.log(row.price);
            const logBenchmark = Math.log(row.benchmark);
            const spread = logPrice - logBenchmark;
            result.points.push({ ...row, logPrice, logBenchmark, spread });
            sums[index] = sums[index]! + spread;
            done += 1;
          }
          result.mean = result.points.length ? sums[index]! / result.points.length : 0;
          result.latest = result.points.at(-1)?.spread ?? 0;
        }
        setComputed(results.map((result) => ({ ...result, points: [...result.points] })));
        setProcessed(done);
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
      if (!cancelled) setStatus("complete");
    }

    void calculateSeries();
    return () => { cancelled = true; };
  }, [payload, status]);

  const totalRows = useMemo(() => payload?.stocks.reduce((sum, stock) => sum + stock.points.length, 0) ?? 0, [payload]);
  const percent = totalRows ? Math.round((processed / totalRows) * 100) : 0;

  return (
    <main className="market-shell simulation-overview-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">Monteverge<span>.</span></Link>
        <Link className="simulation-back" href="/briefing/log-spread">&#8592; How we compare</Link>
      </header>

      <section className="simulation-overview-heading">
        <div><h1>Stock gaps vs NIFTY 50<span>.</span></h1></div>
        <div className="simulation-status"><i className={`status-light status-light--${status}`} />{status === "loading" ? "Loading prices" : status === "running" ? `Calculating ${percent}%` : status === "complete" ? "Done" : "Data unavailable"}</div>
      </section>

      {error ? <section className="simulation-error" role="alert"><strong>Could not load stock data</strong><span>{error}</span><button type="button" className="simulation-retry" onClick={() => void run()}>Retry</button></section> : (
        <>
        <section className="simulation-overview-grid" aria-label="Stock log-spread graphs">
          {(payload?.stocks ?? []).map((stock, index) => {
            const result = computed[index];
            return (
              <Link key={stock.symbol} href={`/simulation/${encodeURIComponent(stock.symbol)}`} className="simulation-overview-link" aria-label={`Open ${stock.name} formula trace`}>
                <article className="simulation-overview-card">
                  <header className="simulation-overview-card__header"><div><h2>{stock.name}</h2><span>{stock.symbol}</span></div><span className="simulation-overview-card__index">0{index + 1}</span></header>
                  <div className="simulation-overview-card__metrics"><span>Latest gap <b>{result?.points.length ? fixed(result.latest) : "—"}</b></span><span>Average gap <b>{result?.points.length ? fixed(result.mean) : "—"}</b></span><span>{result?.points.length ?? 0} of {stock.points.length} days</span></div>
                  <SpreadChart series={result} compact />
                  <div className="simulation-overview-card__action" aria-label="Latest calculated log spread">
                    ln({result?.points.at(-1)?.price.toFixed(2) ?? "stock close"}) - ln({result?.points.at(-1)?.benchmark.toFixed(2) ?? "NIFTY close"}) = {result?.points.length ? fixed(result.latest) : "—"}
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
        {payload?.stocks[0] && <div className="simulation-overview-continue"><Link className="landing__button simulation-continue__button" href="/briefing/z-score">Next: unusual gaps <span aria-hidden="true">&#8594;</span></Link></div>}
        </>
      )}
    </main>
  );
}
