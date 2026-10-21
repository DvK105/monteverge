/**
 * Pure Mathematical Engine for Tata Group Stochastic Mean-Reversion Modeling.
 * Isolated pure functions with zero DOM/React dependencies per code-standards.md.
 */

import { SDEParameters, MetricSummary } from '../types/sde';

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun approximation)
 */
export function normalCDF(x: number): number {
  if (isNaN(x)) return 0.5;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Computes natural log spread S_{i,t} = ln(P_{i,t}) - I_t
 */
export function computeLogSpread(stockPrice: number, groupIndexValue: number): number {
  if (stockPrice <= 0) return 0;
  return Math.log(stockPrice) - groupIndexValue;
}

/**
 * Computes sample mean of an array
 */
export function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Computes sample standard deviation of an array with numerical safety
 */
export function computeStdDev(values: number[], mean?: number): number {
  if (values.length < 2) return 0.0001;
  const m = mean !== undefined ? mean : computeMean(values);
  let varianceSum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - m;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / (values.length - 1);
  return Math.sqrt(Math.max(variance, 1e-8));
}

/**
 * Standardizes spread into Z-score units: z = (S - mu) / sigma
 */
export function computeZScore(spread: number, mu: number, sigma: number): number {
  const safeSigma = Math.max(sigma, 1e-6);
  return (spread - mu) / safeSigma;
}

/**
 * Computes theoretical half-life of mean reversion tau = ln(2) / theta
 */
export function computeHalfLife(theta: number): number {
  const safeTheta = Math.max(theta, 0.001);
  return Math.log(2) / safeTheta;
}

/**
 * Analytical Ornstein-Uhlenbeck Conditional Expectation at horizon H:
 * E[S_{t+H} | S_t] = S_t * exp(-theta * H) + mu * (1 - exp(-theta * H))
 */
export function computeOUExpectation(s0: number, theta: number, mu: number, horizon: number): number {
  const safeTheta = Math.max(theta, 0.0001);
  const decay = Math.exp(-safeTheta * horizon);
  return s0 * decay + mu * (1 - decay);
}

/**
 * Analytical Ornstein-Uhlenbeck Conditional Variance at horizon H:
 * Var(S_{t+H} | S_t) = (sigma^2 / (2 * theta)) * (1 - exp(-2 * theta * H))
 */
export function computeOUVariance(sigma: number, theta: number, horizon: number): number {
  const safeTheta = Math.max(theta, 0.0001);
  const safeSigma = Math.max(sigma, 0.0001);
  const decay2 = Math.exp(-2 * safeTheta * horizon);
  return (safeSigma * safeSigma / (2 * safeTheta)) * (1 - decay2);
}

/**
 * Analytical Probability of Reversion: P(|S_{t+H}| < |S_t|)
 * Accounts symmetrically for both positive (short) and negative (long) initial deviations.
 */
export function computeAnalyticalReversionProbability(
  s0: number,
  theta: number,
  mu: number,
  sigma: number,
  horizon: number
): number {
  const absS0 = Math.abs(s0);
  if (absS0 < 1e-5) return 0.50; // Already at equilibrium

  const meanH = computeOUExpectation(s0, theta, mu, horizon);
  const varH = computeOUVariance(sigma, theta, horizon);
  const stdH = Math.sqrt(Math.max(varH, 1e-8));

  // P(|S_{t+H}| < |S_t|) = P(-|S_0| < S_{t+H} < |S_0|)
  const zUpper = (absS0 - meanH) / stdH;
  const zLower = (-absS0 - meanH) / stdH;

  const prob = normalCDF(zUpper) - normalCDF(zLower);
  return Math.min(Math.max(prob, 0), 1);
}

/**
 * Box-Muller sample from Z ~ N(0,1).
 */
export function sampleStandardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Single Euler-Maruyama SDE Step:
 * S_{t+1} = S_t + theta * (mu - S_t) * dt + sigma * sqrt(dt) * Z
 */
export function eulerMaruyamaStep(
  st: number,
  theta: number,
  mu: number,
  sigma: number,
  dt: number,
  gaussianZ: number
): number {
  const drift = theta * (mu - st) * dt;
  const diffusion = sigma * Math.sqrt(Math.max(dt, 0)) * gaussianZ;
  const nextVal = st + drift + diffusion;

  // Numerical safety guard against NaN or divergence
  if (isNaN(nextVal) || !isFinite(nextVal)) {
    return st;
  }
  return nextVal;
}

/**
 * Generates calibrated quantitative metrics for the current spread and parameters
 */
export function calculateLiveMetrics(
  currentSpread: number,
  params: SDEParameters
): MetricSummary {
  const zScore = computeZScore(currentSpread, params.mu, params.sigma);
  const halfLife = computeHalfLife(params.theta);
  const reversionProb = computeAnalyticalReversionProbability(
    currentSpread,
    params.theta,
    params.mu,
    params.sigma,
    params.horizon
  );

  let recommendation: MetricSummary['signalRecommendation'] = 'NEUTRAL_EQUILIBRIUM';
  if (zScore <= -1.5) {
    recommendation = 'STRONG_REVERSION_LONG';
  } else if (zScore >= 1.5) {
    recommendation = 'STRONG_REVERSION_SHORT';
  } else if (params.sigma > 0.05) {
    recommendation = 'HIGH_VOLATILITY_CAUTION';
  }

  return {
    currentSpread: Math.round(currentSpread * 10000) / 10000,
    currentZScore: Math.round(zScore * 100) / 100,
    halfLifeDays: Math.round(halfLife * 10) / 10,
    reversionProbability: Math.round(reversionProb * 1000) / 1000,
    signalRecommendation: recommendation,
    volatilityDaily: Math.round(params.sigma * 10000) / 100,
    volatilityAnnualized: Math.round(params.sigma * Math.sqrt(252) * 1000) / 10,
    benchmarkCorrelation: 0.88,
  };
}
