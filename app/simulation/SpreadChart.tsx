"use client";

import { useState } from "react";

type SpreadPoint = {
  date: string;
  price: number;
  benchmark: number;
  spread: number;
  logPrice: number;
  logBenchmark: number;
};

type SpreadSeries = {
  symbol: string;
  name: string;
  points: SpreadPoint[];
};

export type { SpreadPoint, SpreadSeries };

export function SpreadChart({
  series,
  activeDate,
  compact = false,
}: {
  series?: SpreadSeries;
  activeDate?: string;
  compact?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = series?.points ?? [];
  const width = 900;
  const height = 220;
  const pad = 16;
  const values = points.map(({ spread }) => spread);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const range = Math.max(max - min, Math.abs(max) * 0.02, 0.001);
  const plotMin = min - range * 0.12;
  const plotMax = max + range * 0.12;

  const x = (index: number) => pad + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (width - pad * 2));
  const y = (value: number) => pad + ((plotMax - value) / (plotMax - plotMin)) * (height - pad * 2);

  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.spread).toFixed(1)}`).join(" ");
  const area = points.length ? `${path} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z` : "";

  // Priority to controlled activeDate, else local hover state
  const controlledIdx = activeDate ? points.findIndex(({ date }) => date === activeDate) : -1;
  const activeIndex = controlledIdx >= 0 ? controlledIdx : hoveredIdx !== null ? hoveredIdx : -1;
  const activePoint = activeIndex >= 0 ? points[activeIndex] : null;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, relX));
    const target = Math.round(clamped * (points.length - 1));
    setHoveredIdx(target);
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  return (
    <div className={`simulation-chart${compact ? " simulation-chart--compact" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${series?.name ?? "Stock"} calculated log spread by date`}
        onPointerMove={handlePointer}
        onPointerLeave={handlePointerLeave}
        style={{ cursor: "crosshair", touchAction: "none" }}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const gridY = pad + ((height - pad * 2) * index) / 4;
          return <line key={`grid-${index}`} x1={pad} x2={width - pad} y1={gridY} y2={gridY} className="spread-grid" stroke="var(--market-line)" />;
        })}
        {min <= 0 && max >= 0 && <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} className="spread-zero" stroke="var(--market-line)" />}
        {area && <path d={area} className="spread-area" />}
        {path && <path d={path} pathLength={1} className="spread-line" />}
        {activeIndex >= 0 && activePoint && (
          <g>
            <line x1={x(activeIndex)} x2={x(activeIndex)} y1={pad} y2={height - pad} className="spread-cursor" />
            <circle cx={x(activeIndex)} cy={y(activePoint.spread)} r="5" className="spread-point" />
          </g>
        )}
      </svg>
      <div className="simulation-chart__labels">
        <span>{activePoint ? activePoint.date : points[0]?.date ?? "Waiting for data"}</span>
        <span>
          {activePoint ? (
            <b>Spread: {activePoint.spread.toFixed(4)}</b>
          ) : (
            points.at(-1)?.date ?? ""
          )}
        </span>
      </div>
    </div>
  );
}
