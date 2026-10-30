import { expect, test } from "bun:test";

test("calculates normalized z-score with mean 0 and unit variance", () => {
  const prices = [100, 102, 101, 105, 103, 106, 104, 108];
  const benchmarks = [50, 50.5, 51, 51.5, 52, 52.5, 53, 53.5];

  const spreads = prices.map((p, i) => Math.log(p) - Math.log(benchmarks[i]));
  const n = spreads.length;
  const mean = spreads.reduce((sum, v) => sum + v, 0) / n;
  const variance = spreads.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  const zScores = spreads.map((s) => (s - mean) / stdDev);

  const zMean = zScores.reduce((sum, v) => sum + v, 0) / n;
  const zVar = zScores.reduce((sum, v) => sum + (v - zMean) ** 2, 0) / (n - 1);

  expect(Math.abs(zMean)).toBeLessThan(1e-10);
  expect(Math.abs(zVar - 1.0)).toBeLessThan(1e-10);
});

test("aggregates dense intraday candles without dropping endpoints", () => {
  const candles = Array.from({ length: 360 }, (_, i) => ({
    time: 1700000000 + i * 60,
    open: 100 + (i % 5),
    high: 105 + (i % 5),
    low: 98 + (i % 5),
    close: 102 + (i % 5),
    volume: 1000 + i,
  }));

  const maxBins = 50;
  const binSize = Math.ceil(candles.length / maxBins);
  const aggregated = [];
  for (let i = 0; i < candles.length; i += binSize) {
    const chunk = candles.slice(i, i + binSize);
    if (!chunk.length) continue;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const volume = chunk.reduce((sum, c) => sum + (c.volume ?? 0), 0);
    const time = chunk[chunk.length - 1].time;
    aggregated.push({ open, high, low, close, volume, time });
  }

  expect(aggregated.length).toBeLessThanOrEqual(50);
  expect(aggregated[0].open).toBe(candles[0].open);
  expect(aggregated.at(-1).close).toBe(candles.at(-1).close);
  expect(aggregated.at(-1).time).toBe(candles.at(-1).time);
});
