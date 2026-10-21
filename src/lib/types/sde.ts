export interface SDEParameters {
  theta: number; // Speed of mean reversion [0.01 - 0.50]
  mu: number;    // Long-term mean spread [-0.10 - 0.10]
  sigma: number; // Daily spread volatility [0.005 - 0.08]
  horizon: number; // Horizon in trading days [5 - 60]
  simulationsCount: number; // Number of Monte Carlo paths, typically 1000
  z0: number; // Initial normalized spread / Z-score
}

export interface MetricSummary {
  currentSpread: number;
  currentZScore: number;
  halfLifeDays: number; // ln(2) / theta
  reversionProbability: number; // P(|S_{t+H}| < |S_t|)
  signalRecommendation: 'STRONG_REVERSION_LONG' | 'STRONG_REVERSION_SHORT' | 'NEUTRAL_EQUILIBRIUM' | 'HIGH_VOLATILITY_CAUTION';
  volatilityDaily: number;
  volatilityAnnualized: number;
  benchmarkCorrelation: number;
}
