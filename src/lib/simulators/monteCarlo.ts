import { eulerMaruyamaStep } from '@/lib/quant/stochasticEngine';

export interface MonteCarloInput {
  initialSpread: number;
  mean: number;
  theta: number;
  sigma: number;
  groupIndex: number;
  currentPrice: number;
  horizon: number;
  pathCount: number;
  seed: number;
}

export interface MonteCarloResult {
  reversionProbability: number;
  revertedPaths: number;
  pathCount: number;
  horizon: number;
  seed: number;
  bands: Array<{ day: number; p10: number; p50: number; p90: number }>;
  samplePath: MonteCarloPathPoint[];
  firstStep: { shock: number; drift: number; noise: number; nextSpread: number; nextPrice: number };
}

export interface MonteCarloPathPoint {
  day: number;
  spread: number;
  shock: number;
  drift: number;
  noise: number;
}

export interface MonteCarloProgress {
  completedPaths: number;
  totalPaths: number;
  sampleDay?: number;
  samplePath?: MonteCarloPathPoint[];
}

export type MonteCarloWorkerMessage =
  | { type: 'progress'; progress: MonteCarloProgress }
  | { type: 'complete'; result: MonteCarloResult }
  | { type: 'error'; message: string };

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createGaussian(random: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let u = 0;
    let v = 0;
    while (u <= Number.EPSILON) u = random();
    while (v <= Number.EPSILON) v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function quantile(sortedValues: number[], probability: number): number {
  const index = (sortedValues.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[Math.min(lower + 1, sortedValues.length - 1)] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * fraction;
}

export function* runMonteCarloWithProgress(
  input: MonteCarloInput,
): Generator<MonteCarloProgress, MonteCarloResult, void> {
  const pathCount = Math.max(1, Math.floor(input.pathCount));
  const horizon = Math.max(1, Math.floor(input.horizon));
  const random = createRandom(input.seed);
  const gaussian = createGaussian(random);
  const valuesByDay: number[][] = Array.from({ length: horizon + 1 }, () => []);
  const samplePath: MonteCarloPathPoint[] = [];
  const progressInterval = Math.max(1, Math.ceil(pathCount / 20));
  let revertedPaths = 0;
  let firstStep: MonteCarloResult['firstStep'] | null = null;

  for (let path = 0; path < pathCount; path++) {
    let spread = input.initialSpread;
    valuesByDay[0].push(spread);
    for (let day = 1; day <= horizon; day++) {
      const previousSpread = spread;
      const shock = gaussian();
      spread = eulerMaruyamaStep(
        spread,
        input.theta,
        input.mean,
        input.sigma,
        1,
        shock,
      );
      if (path === 0) {
        const drift = input.theta * (input.mean - previousSpread);
        const noise = input.sigma * shock;
        samplePath.push({ day, spread, shock, drift, noise });
        if (day === 1) {
          firstStep = {
            shock,
            drift,
            noise,
            nextSpread: spread,
            nextPrice: Math.exp(spread + input.groupIndex),
          };
        }
        yield {
          completedPaths: path,
          totalPaths: pathCount,
          sampleDay: day,
          samplePath: [
            { day: 0, spread: input.initialSpread, shock: 0, drift: 0, noise: 0 },
            ...samplePath,
          ],
        };
      }
      valuesByDay[day].push(spread);
    }
    if (Math.abs(spread) < Math.abs(input.initialSpread)) revertedPaths += 1;

    if (path === 0 || (path + 1) % progressInterval === 0 || path + 1 === pathCount) {
      yield {
        completedPaths: path + 1,
        totalPaths: pathCount,
        ...(path === 0 ? {
          samplePath: [
            { day: 0, spread: input.initialSpread, shock: 0, drift: 0, noise: 0 },
            ...samplePath,
          ],
        } : {}),
      };
    }
  }

  const bands = valuesByDay.map((values, day) => {
    values.sort((left, right) => left - right);
    return {
      day,
      p10: quantile(values, 0.1),
      p50: quantile(values, 0.5),
      p90: quantile(values, 0.9),
    };
  });

  return {
    reversionProbability: revertedPaths / pathCount,
    revertedPaths,
    pathCount,
    horizon,
    seed: input.seed,
    bands,
    samplePath: [
      { day: 0, spread: input.initialSpread, shock: 0, drift: 0, noise: 0 },
      ...samplePath,
    ],
    firstStep: firstStep ?? { shock: 0, drift: 0, noise: 0, nextSpread: input.initialSpread, nextPrice: input.currentPrice },
  };
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const simulation = runMonteCarloWithProgress(input);
  let state = simulation.next();
  while (!state.done) state = simulation.next();
  return state.value;
}
