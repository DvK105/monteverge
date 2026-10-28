"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = { date: string; price: number; benchmark: number };
type Stock = { symbol: string; name: string; points: Row[] };

export default function SpreadZScoresPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/simulation", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load market history.");
        setStocks(data.stocks);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load market history."));
  }, []);
  const results = useMemo(() => stocks.map((stock) => {
    const spreads = stock.points.map((point) => Math.log(point.price) - Math.log(point.benchmark));
    const mean = spreads.reduce((sum, value) => sum + value, 0) / Math.max(1, spreads.length);
    const sd = Math.sqrt(spreads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, spreads.length));
    return { ...stock, latest: sd ? ((spreads.at(-1) ?? mean) - mean) / sd : 0, count: spreads.length };
  }), [stocks]);
  return <main className="market-shell simulation-z-shell">
    <header className="market-topbar"><Link href="/market" className="market-brand">Monteverge<span>.</span></Link><Link className="simulation-back" href="/simulation">← Log spreads</Link></header>
    <section className="simulation-overview-heading"><div><h1>Spread z-scores<span>.</span></h1><p>Current stock-to-NIFTY spread relative to its historical mean and variation.</p></div><div className="simulation-status">{error ? "Data unavailable" : stocks.length ? "Historical sample loaded" : "Loading market data"}</div></section>
    {error ? <section className="simulation-error" role="alert"><strong>Could not calculate z-scores</strong><span>{error}</span></section> : <section className="simulation-z-grid" aria-label="Current spread z-scores">{results.map((stock, index) => <article className="simulation-overview-card" key={stock.symbol}><header className="simulation-overview-card__header"><div><h2>{stock.name}</h2><span>{stock.symbol}</span></div><span className="simulation-overview-card__index">0{index + 1}</span></header><div className="simulation-overview-card__metrics"><span>Latest spread z-score <b>{stock.latest >= 0 ? "+" : ""}{stock.latest.toFixed(2)}σ</b></span><span>Daily observations <b>{stock.count}</b></span></div><p>{Math.abs(stock.latest) >= 2 ? "Far from its historical mean (beyond 2σ)." : Math.abs(stock.latest) >= 1 ? "Outside the typical ±1σ range." : "Within the typical ±1σ range."}</p></article>)}</section>}
    <footer className="simulation-z-footer-bar"><Link className="simulation-back" href="/simulation">← Return to log spreads</Link><Link className="landing__button simulation-continue__button" href="/simulation/carts">Stage 03: Historical Mean Reversion <span aria-hidden="true">→</span></Link></footer>
  </main>;
}
