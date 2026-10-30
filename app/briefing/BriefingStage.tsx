import Link from "next/link";
import type { Briefing, BriefingVisual } from "./briefings";

type RailItem = { step: string; index: number; rail: string; href: string };

function GapVisual({
  visual,
}: {
  visual: Extract<BriefingVisual, { kind: "gap" }>;
}) {
  const low = Math.min(visual.stockValue, visual.marketValue) - 0.24;
  const high = Math.max(visual.stockValue, visual.marketValue) + 0.24;
  const x = (value: number) => 58 + ((value - low) / (high - low)) * 444;
  const stockX = x(visual.stockValue);
  const marketX = x(visual.marketValue);

  return (
    <svg viewBox="0 0 560 210" className="briefing-visual__svg" role="img" aria-label={`${visual.stockLabel} is ${visual.delta} above ${visual.marketLabel} on the log scale`}>
      <text x="58" y="26" className="briefing-visual__micro">SAME SCALE</text>
      <text x="502" y="26" textAnchor="end" className="briefing-visual__micro">LOG PRICE</text>

      <line x1="58" x2="502" y1="126" y2="126" className="briefing-visual__rule" />
      <line x1={marketX} x2={marketX} y1="78" y2="126" className="briefing-visual__stem" />
      <line x1={stockX} x2={stockX} y1="56" y2="126" className="briefing-visual__stem briefing-visual__stem--accent" />
      <circle cx={marketX} cy="126" r="5" className="briefing-visual__dot" />
      <circle cx={stockX} cy="126" r="6" className="briefing-visual__dot briefing-visual__dot--accent" />

      <path d={`M${marketX} 70 H${stockX}`} className="briefing-visual__measure" />
      <path d={`M${stockX - 5} 70 l10 0 M${stockX} 65 v10`} className="briefing-visual__measure" />
      <text x={(marketX + stockX) / 2} y="55" textAnchor="middle" className="briefing-visual__delta">
        {visual.delta}
      </text>

      <text x={marketX} y="152" textAnchor="middle" className="briefing-visual__name">
        {visual.marketLabel}
      </text>
      <text x={marketX} y="172" textAnchor="middle" className="briefing-visual__value">
        {visual.marketValue.toFixed(2)}
      </text>

      <text x={stockX} y="152" textAnchor="middle" className="briefing-visual__name">
        {visual.stockLabel}
      </text>
      <text x={stockX} y="172" textAnchor="middle" className="briefing-visual__value">
        {visual.stockValue.toFixed(2)}
      </text>

      <text x="58" y="196" className="briefing-visual__micro">MARKET NUMBER</text>
      <text x="502" y="196" textAnchor="end" className="briefing-visual__micro">STOCK NUMBER</text>
    </svg>
  );
}

function ZScoreVisual({ visual }: { visual: Extract<BriefingVisual, { kind: "zscore" }> }) {
  const x = (value: number) => 44 + ((value + 3.2) / 6.4) * 472;
  const markerX = x(visual.value);
  const ticks = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <svg viewBox="0 0 560 210" className="briefing-visual__svg" role="img" aria-label={`A z-score of ${visual.value} sits past the unusual threshold of plus two`}>
      <text x="44" y="26" className="briefing-visual__micro">NORMAL RANGE</text>
      <text x="516" y="26" textAnchor="end" className="briefing-visual__micro">UNUSUAL</text>

      <rect x={x(-2)} y="76" width={x(2) - x(-2)} height="54" className="briefing-visual__band" />
      <line x1="44" x2="516" y1="110" y2="110" className="briefing-visual__rule" />

      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={tick === 0 ? 96 : 102} y2="120" className="briefing-visual__tick" />
          <text x={x(tick)} y="140" textAnchor="middle" className="briefing-visual__value">
            {tick > 0 ? `+${tick}` : tick}
          </text>
        </g>
      ))}

      <line x1={markerX} x2={markerX} y1="58" y2="110" className="briefing-visual__stem briefing-visual__stem--accent" />
      <path d={`M${markerX - 7} 58 L${markerX + 7} 58 L${markerX} 70 Z`} className="briefing-visual__pin" />
      <text x={markerX} y="48" textAnchor="middle" className="briefing-visual__delta">
        {visual.value > 0 ? `+${visual.value.toFixed(1)}` : visual.value.toFixed(1)}
      </text>

      <text x={x(0)} y="166" textAnchor="middle" className="briefing-visual__micro">AVERAGE</text>
      <text x={x(-2.9)} y="190" className="briefing-visual__micro">LOW</text>
      <text x={x(2.9)} y="190" textAnchor="end" className="briefing-visual__micro">HIGH</text>
      <text x={x(2)} y="190" textAnchor="middle" className="briefing-visual__micro">+2 THRESHOLD</text>
    </svg>
  );
}

function DecayVisual({ visual }: { visual: Extract<BriefingVisual, { kind: "decay" }> }) {
  const startX = 48;
  const endX = 512;
  const topY = 54;
  const baseY = 166;
  const span = visual.halfLife * 3;
  const x = (day: number) => startX + (day / span) * (endX - startX);
  const y = (day: number) => baseY - (baseY - topY) * Math.exp((-Math.LN2 * day) / visual.halfLife);
  const points = Array.from({ length: 37 }, (_, index) => {
    const day = (span * index) / 36;
    return `${index === 0 ? "M" : "L"}${x(day).toFixed(1)} ${y(day).toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 560 210" className="briefing-visual__svg" role="img" aria-label={`The gap halves every ${visual.halfLife} days until it reaches normal`}>
      <text x="48" y="26" className="briefing-visual__micro">GAP SIZE</text>
      <text x="512" y="26" textAnchor="end" className="briefing-visual__micro">TIME</text>

      <line x1="48" x2="512" y1={baseY} y2={baseY} className="briefing-visual__rule" />
      <line x1="48" x2="512" y1={(topY + baseY) / 2} y2={(topY + baseY) / 2} className="briefing-visual__guide" strokeDasharray="3 5" />

      <path d={points} className="briefing-visual__curve" />

      {[1, 2].map((multiple) => (
        <g key={multiple}>
          <line
            x1={x(visual.halfLife * multiple)}
            x2={x(visual.halfLife * multiple)}
            y1={topY}
            y2={baseY}
            className="briefing-visual__guide"
            strokeDasharray="3 5"
          />
          <text x={x(visual.halfLife * multiple)} y="146" textAnchor="middle" className="briefing-visual__micro">
            {visual.halfLife * multiple} D
          </text>
        </g>
      ))}

      <circle cx={x(visual.halfLife)} cy={y(visual.halfLife)} r="6" className="briefing-visual__dot briefing-visual__dot--accent" />
      <text x={x(visual.halfLife) + 14} y={y(visual.halfLife) - 12} className="briefing-visual__delta">
        HALF-LIFE {visual.halfLife} DAYS
      </text>

      <text x="48" y="190" className="briefing-visual__micro">TODAY</text>
      <text x="512" y="190" textAnchor="end" className="briefing-visual__micro">
        {span} DAYS
      </text>
      <text x="512" y={baseY - 8} textAnchor="end" className="briefing-visual__micro">
        NORMAL
      </text>
    </svg>
  );
}

function PathsVisual() {
  const width = 464;
  const startX = 48;
  const baseY = 166;
  const paths = Array.from({ length: 16 }, (_, index) => {
    const startY = 64 + index * 3.6;
    const endY = baseY + Math.sin(index * 2.1) * 10;
    const points = Array.from({ length: 26 }, (__, step) => {
      const t = step / 25;
      const settle = 1 - (1 - t) ** 1.7;
      const value =
        startY + (endY - startY) * settle + Math.sin(t * 8 + index * 1.63) * (1 - t) * 24;
      const x = startX + t * width;
      return `${step === 0 ? "M" : "L"}${x.toFixed(1)} ${value.toFixed(1)}`;
    }).join(" ");
    return { path: points, accent: index === 5 };
  });

  return (
    <svg viewBox="0 0 560 210" className="briefing-visual__svg" role="img" aria-label="Many possible futures move the gap around, then pull it back toward normal">
      <text x="48" y="26" className="briefing-visual__micro">MANY POSSIBLE FUTURES</text>
      <text x="512" y="26" textAnchor="end" className="briefing-visual__micro">ONE MODEL</text>

      <line x1="48" x2="512" y1={baseY} y2={baseY} className="briefing-visual__guide" strokeDasharray="3 5" />
      <text x="512" y={baseY - 8} textAnchor="end" className="briefing-visual__micro">
        NORMAL
      </text>

      {paths.map((item, index) => (
        <path
          key={index}
          d={item.path}
          className={
            item.accent
              ? "briefing-visual__path briefing-visual__path--accent"
              : "briefing-visual__path"
          }
        />
      ))}

      <text x="48" y="190" className="briefing-visual__micro">TODAY</text>
      <text x="512" y="190" textAnchor="end" className="briefing-visual__micro">20 DAYS</text>
    </svg>
  );
}

function OddsVisual({ visual }: { visual: Extract<BriefingVisual, { kind: "odds" }> }) {
  const cells = 100;
  const filled = Math.round((visual.hit / visual.total) * cells);

  return (
    <div className="briefing-odds" role="img" aria-label={`${visual.hit} of every ${visual.total} paths close the gap`}>
      <div className="briefing-odds__grid" aria-hidden="true">
        {Array.from({ length: cells }, (_, index) => (
          <span key={index} className={index < filled ? "is-filled" : undefined} />
        ))}
      </div>
      <div className="briefing-odds__legend" aria-hidden="true">
        <span>
          <i className="is-filled" /> gap closed — {filled}
        </span>
        <span>
          <i /> still open — {cells - filled}
        </span>
      </div>
    </div>
  );
}

function BriefingVisual({ visual }: { visual?: BriefingVisual }) {
  if (!visual) return null;

  return (
    <div className="briefing-visual">
      {visual.kind === "gap" && <GapVisual visual={visual} />}
      {visual.kind === "zscore" && <ZScoreVisual visual={visual} />}
      {visual.kind === "decay" && <DecayVisual visual={visual} />}
      {visual.kind === "paths" && <PathsVisual />}
      {visual.kind === "odds" && <OddsVisual visual={visual} />}
    </div>
  );
}

export function BriefingStage({ briefing, rail }: { briefing: Briefing; rail: RailItem[] }) {
  const [lede, ...points] = briefing.blocks;

  return (
    <main className="briefing-shell">
      <header className="market-topbar">
        <Link href="/market" className="market-brand">
          Monteverge<span>.</span>
        </Link>
        <Link className="simulation-back" href={briefing.back.href}>
          &larr; {briefing.back.label}
        </Link>
      </header>

      <section className="briefing-head">
        <div className="briefing-head__title">
          <span className="briefing-kicker">
            <i className="briefing-kicker__mark" aria-hidden="true" />
            {briefing.kicker}
          </span>
          <h1>
            {briefing.title}
            <span>.</span>
          </h1>
          <p>{briefing.standfirst}</p>
        </div>
        <div className="briefing-head__meta">
          <span className="briefing-filetag">Step {briefing.index} of 6</span>
          <span className="briefing-head__stage">{briefing.stage.label}</span>
        </div>
      </section>

      <nav className="briefing-rail" aria-label="Briefings">
        {rail.map((item) => (
          <Link
            key={item.step}
            href={item.href}
            aria-current={item.step === briefing.step ? "page" : undefined}
          >
            <b>{String(item.index).padStart(2, "0")}</b>
            <span>{item.rail}</span>
          </Link>
        ))}
      </nav>

      {briefing.ledger ? (
        <section className="briefing-ledger-panel" aria-label="Formula ledger">
          <header className="briefing-ledger-bar">
            <span>
              <b>Seven rules</b>
            </span>
            <span>Choose one to open its stage</span>
          </header>
          <div className="briefing-ledger">
            {briefing.ledger.map((row) => (
              <Link className="briefing-ledger__card" href={row.href} key={row.index}>
                <div className="briefing-ledger__top">
                  <span>{row.index}</span>
                  <span>{row.stage}</span>
                </div>
                <h2>{row.name}</h2>
                <div className="briefing-eq">{row.equation}</div>
                <p>{row.meaning}</p>
                <span className="briefing-ledger__open">Open &rarr;</span>
              </Link>
            ))}
            <Link className="briefing-ledger__card briefing-ledger__card--cta" href={briefing.stage.href}>
              <div className="briefing-ledger__top">
                <span>08</span>
                <span>Finish</span>
              </div>
              <h2>{briefing.stage.cta}</h2>
              <p>The chain is yours to run.</p>
              <span className="briefing-ledger__open">Close the dossier &rarr;</span>
            </Link>
          </div>
        </section>
      ) : (
        <div className="briefing-grid">
          <section className="briefing-panel briefing-panel--brief" aria-label="In plain English">
            <header className="briefing-panel__head">
              <span className="briefing-panel__title">
                <b>In plain English</b>
              </span>
              <span className="briefing-panel__meta">{briefing.blocks.length} notes</span>
            </header>

            <div className="briefing-brief__body">
              <p className="briefing-brief__lede">{lede?.text}</p>
              <ul className="briefing-points">
                {points.map((point, index) => (
                  <li className={`briefing-point briefing-point--${point.kind}`} key={index}>
                    <span className="briefing-point__mark" aria-hidden="true">
                      {point.kind === "note" ? "!" : "→"}
                    </span>
                    <p>{point.text}</p>
                  </li>
                ))}
              </ul>
              <BriefingVisual visual={briefing.visual} />
            </div>

            <footer className="briefing-brief__foot">
              <div className="briefing-foot__next">
                <span>Next</span>
                <b>{briefing.stage.label}</b>
              </div>
              <Link className="landing__button briefing-cta" href={briefing.stage.href}>
                {briefing.stage.cta} <span aria-hidden="true">&#8594;</span>
              </Link>
            </footer>
          </section>

          <aside className="briefing-side">
            <section className="briefing-panel briefing-panel--rule">
              <header className="briefing-panel__head">
                <span className="briefing-panel__title">
                  <b>The rule</b>
                </span>
                <span className="briefing-panel__meta">
                  {briefing.formulas.length} step{briefing.formulas.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="briefing-rule-list" data-count={briefing.formulas.length}>
                {briefing.formulas.map((formula, index) => (
                  <article className="briefing-rule" key={formula.label}>
                    <span className="briefing-rule__num">{String(index + 1).padStart(2, "0")}</span>
                    <div className="briefing-rule__content">
                      <span className="briefing-rule__label">{formula.label}</span>
                      <div className="briefing-eq">{formula.equation}</div>
                      <p className="briefing-rule__hint">{formula.hint}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="briefing-panel briefing-panel--example">
              <header className="briefing-panel__head">
                <span className="briefing-panel__title">
                  <b>Worked example</b>
                </span>
                <span className="briefing-panel__meta">{briefing.example.label}</span>
              </header>
              <div className="briefing-example">
                <div className="briefing-example__hero">
                  <div className="briefing-example__value">
                    {briefing.example.value}
                    <small>{briefing.example.unit}</small>
                  </div>
                </div>
                <dl className="briefing-example__rows">
                  {briefing.example.rows.map((row) => (
                    <div key={row.k}>
                      <dt>{row.k}</dt>
                      <dd>{row.v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="briefing-example__caption">{briefing.example.caption}</p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
