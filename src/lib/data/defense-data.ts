export interface DefenseItem {
  id: string;
  category: 'ECONOMETRICS' | 'MATHEMATICS' | 'TATA_THESIS' | 'RISK_REGIMES';
  question: string;
  badge: string;
  summary: string;
  detailedProof: string;
  equations?: string[];
  takeaway: string;
}

export const DEFENSE_QA_CARDS: DefenseItem[] = [
  {
    id: 'cointegration-vs-correlation',
    category: 'ECONOMETRICS',
    badge: 'Stationarity & Spurious Regressions',
    question: 'Why cointegration over high correlation for Tata pairs?',
    summary: 'High correlation only measures directional co-movement and is prone to spurious regression in non-stationary I(1) series. Cointegration proves a stationary linear combination I(0).',
    detailedProof: 'Two non-stationary price series P_A,t and P_B,t can exhibit an empirical Pearson correlation of r > 0.95 while drifting infinitely apart (random walks with drift). Cointegration establishes the existence of a vector [1, -beta] such that the spread S_t = ln(P_A,t) - beta*ln(P_B,t) has finite variance, constant mean mu, and zero root divergence. In our Tata basket, synthetic group benchmark I_t acts as the stochastic common trend.',
    equations: [
      '\\text{Corr}(X_t, Y_t) = \\frac{\\text{Cov}(X_t, Y_t)}{\\sigma_X \\sigma_Y} \\quad \\text{[Subject to Spurious Drift]}',
      'S_t = \\ln(P_{i,t}) - I_t \\sim I(0) \\quad \\text{[Engle-Granger Stationary]}',
    ],
    takeaway: 'Correlation tells you direction; cointegration guarantees a rubber-band mean-reverting anchor.',
  },
  {
    id: 'euler-maruyama-convergence',
    category: 'MATHEMATICS',
    badge: 'Numerical Discretization & Weak Order',
    question: 'Why Euler-Maruyama instead of Milstein or Runge-Kutta?',
    summary: 'Because the Ornstein-Uhlenbeck diffusion term sigma is constant (additive noise), the Milstein correction derivative d(sigma)/dx is zero. Euler-Maruyama is exact to strong order 1.0.',
    detailedProof: 'The general Ito diffusion has SDE dX_t = a(X_t)dt + b(X_t)dW_t. Milstein introduces a correction term 0.5 * b(X_t) * b\'(X_t) * ((dW)^2 - dt). For the Ornstein-Uhlenbeck process, b(X_t) = sigma is constant, meaning b\'(X_t) = 0. Therefore, the Milstein scheme collapses identically to Euler-Maruyama with order 1.0 strong convergence while taking 4x fewer floating-point FLOPs, achieving our <50ms 1,000-path latency budget.',
    equations: [
      'dS_t = \\theta(\\mu - S_t)dt + \\sigma dW_t',
      'S_{t+1} = S_t + \\theta(\\mu - S_t)\\Delta t + \\sigma \\sqrt{\\Delta t}\\, Z_t, \\quad Z_t \\sim \\mathcal{N}(0, 1)',
    ],
    takeaway: 'Euler-Maruyama delivers mathematical exactness for OU additive noise with peak execution efficiency.',
  },
  {
    id: 'tata-group-cross-holdings',
    category: 'TATA_THESIS',
    badge: 'Corporate Conglomerate Economics',
    question: 'What is the real-world economic mechanism anchoring Tata equities?',
    summary: 'Tata Sons holds controlling promoter stakes (30%-75%) and actively redistributes capital, group treasury support, and unified brand governance across subsidiaries.',
    detailedProof: 'Tata Group equities do not drift independently due to structural institutional factors: (1) Tata Sons central promoter stake and unified credit ratings, (2) Tata Capital and group treasury liquidity backstops during cyclical downturns, and (3) Cross-holding synergies (e.g., Tata Motors sourcing batteries from Tata Power, automotive software from TCS, and steel from Tata Steel). These interlinked balance sheets create structural economic cointegration.',
    equations: [
      'I_t = \\frac{1}{N} \\sum_{j=1}^N \\ln(P_{j,t}) \\quad [\\text{Equally-Weighted Conglomerate Index}]',
      '\\Delta S_{i,t} = -\\theta S_{i,t-1} + \\epsilon_t \\quad [\\text{Mean-Reverting Balance Sheet Anchor}]',
    ],
    takeaway: 'Promoter capital pooling and internal supply chains prevent persistent divergence among group entities.',
  },
  {
    id: 'regime-break-risks',
    category: 'RISK_REGIMES',
    badge: 'Structural Shift vs. Temporary Noise',
    question: 'When does the stochastic mean-reversion model fail?',
    summary: 'The model breaks during permanent structural shocks (e.g. JLR EV plant restructuring or long-term demergers) where the true long-term mean mu undergoes a permanent step-shift.',
    detailedProof: 'Standard mean-reversion assumes the parameter vector [theta, mu, sigma] is stationary over the horizon H. However, in events like the Tata Motors demerger (Commercial Vehicles vs. Passenger EV) or severe geopolitical tariffs on Tata Steel UK, the spread exhibits a permanent unit-root step function. Trading pure mean reversion without an ADF stationarity filter or stop-loss bounds risks holding a widening loss.',
    equations: [
      'S_t = \\mu_1 \\cdot \\mathbf{1}_{t < \\tau^*} + \\mu_2 \\cdot \\mathbf{1}_{t \\ge \\tau^*} + \\eta_t \\quad [\\text{Structural Break at } \\tau^*]',
    ],
    takeaway: 'Always apply half-life stopping boundaries; never average down into an unhedged structural regime break.',
  },
];
