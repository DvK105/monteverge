export type BriefingBlock = {
  kind: "lede" | "p" | "note";
  text: string;
};

export type BriefingFormula = {
  label: string;
  equation: string;
  hint: string;
};

export type BriefingExample = {
  label: string;
  value: string;
  unit: string;
  rows: { k: string; v: string }[];
  caption: string;
};

export type BriefingVisual =
  | {
      kind: "gap";
      stockLabel: string;
      stockValue: number;
      marketLabel: string;
      marketValue: number;
      delta: string;
    }
  | { kind: "zscore"; value: number }
  | { kind: "decay"; halfLife: number }
  | { kind: "paths" }
  | { kind: "odds"; hit: number; total: number };

export type BriefingLedgerRow = {
  index: string;
  name: string;
  equation: string;
  meaning: string;
  stage: string;
  href: string;
};

export type BriefingNext = {
  label: string;
  rail: string;
  title: string;
  text: string;
  href: string;
};

export type Briefing = {
  step: string;
  index: number;
  rail: string;
  title: string;
  kicker: string;
  standfirst: string;
  stage: { label: string; href: string; cta: string };
  back: { label: string; href: string };
  blocks: BriefingBlock[];
  formulas: BriefingFormula[];
  example: BriefingExample;
  visual?: BriefingVisual;
  ledger?: BriefingLedgerRow[];
  next?: BriefingNext;
};

export const BRIEFINGS: Briefing[] = [
  {
    step: "log-spread",
    index: 1,
    rail: "Compare",
    title: "How Far Apart Are Stocks?",
    kicker: "Before Stage 01",
    standfirst: "Put every Tata stock on the same scale as NIFTY 50.",
    stage: {
      label: "Stage 01 / Compare stocks",
      href: "/simulation",
      cta: "Open Stage 01",
    },
    back: { label: "Market", href: "/market" },
    next: {
      label: "Slide 02",
      rail: "Unusual gaps",
      title: "Is This Gap Unusual?",
      text: "A gap is only useful when it is unusual. The next slide shows how to judge each gap against that stock's own normal range, counted in 'normal steps' — not rupees.",
      href: "/briefing/z-score",
    },
    blocks: [
      { kind: "lede", text: "How far ahead or behind is each Tata stock?" },
      {
        kind: "p",
        text: "Tata stocks trade at very different prices — some are ₹4,000+, others much less. You can't line them up on one ruler when the numbers are that far apart. So we squeeze each price onto the same scale using its log, then subtract the market (NIFTY 50). What's left is the gap.",
      },
      { kind: "note", text: "Plus = ahead of the market. Minus = behind." },
    ],
    formulas: [
      {
        label: "Change the price",
        equation: "ln(price)",
        hint: "Turns a big price into a comparable number.",
      },
      {
        label: "Market number",
        equation: "group = mean of log prices",
        hint: "One number for the market. Here, NIFTY 50.",
      },
      {
        label: "Find the gap",
        equation: "gap = stock − group",
        hint: "How far one stock sits from the market.",
      },
    ],
    example: {
      label: "TCS in logs",
      value: "8.34",
      unit: "log price",
      rows: [
        { k: "PRICE", v: "₹4,200" },
        { k: "MARKET", v: "8.00" },
        { k: "GAP", v: "8.34 − 8.00 = +0.34" },
      ],
      caption: "Subtract the market number. Plus means ahead.",
    },
    visual: {
      kind: "gap",
      stockLabel: "TCS",
      stockValue: 8.34,
      marketLabel: "NIFTY 50",
      marketValue: 8,
      delta: "+0.34",
    },
  },
  {
    step: "z-score",
    index: 2,
    rail: "Unusual gaps",
    title: "Is This Gap Unusual?",
    kicker: "Before Stage 02",
    standfirst: "Judge every gap against that stock's own normal range.",
    stage: {
      label: "Stage 02 / Find unusual gaps",
      href: "/simulation/continue",
      cta: "Open Stage 02",
    },
    back: { label: "Stage 01 / Compare prices", href: "/simulation" },
    next: {
      label: "Slide 03",
      rail: "Past gaps",
      title: "Does the Gap Shrink?",
      text: "Once a gap is flagged as unusual, the question becomes: does it last? The next slide looks at old gaps to find how quickly a stock's gap shrinks back to normal — measured as a half-life in days.",
      href: "/briefing/reversion",
    },
    blocks: [
      { kind: "lede", text: "A gap only matters when it is unusual for that stock." },
      { kind: "p", text: "Don't judge a gap by how many rupees it is. Judge it by how unusual it is for *that* stock." },
      { kind: "p", text: "We count it in 'normal steps' — how far the gap sits from the stock's own usual, not the rupee amount." },
      { kind: "p", text: "Most gaps land inside the normal band (between −2 and +2 steps). Past +2, it's unusual." },
      { kind: "note", text: "Near 0 is normal. Past ±2 is unusual." },
    ],
    formulas: [
      {
        label: "Compare the gap",
        equation: "z = (gap − average) / spread",
        hint: "How many normal steps the gap sits from usual.",
      },
    ],
    example: {
      label: "The height test",
      value: "+2.0",
      unit: "z-score",
      rows: [
        { k: "AVERAGE", v: "170 cm" },
        { k: "NORMAL RANGE", v: "10 cm" },
        { k: "THIS PERSON", v: "190 cm" },
      ],
      caption: "Same ruler, different stocks. Above +2 is unusual.",
    },
    visual: { kind: "zscore", value: 2 },
  },
  {
    step: "reversion",
    index: 3,
    rail: "Past gaps",
    title: "Does the Gap Shrink?",
    kicker: "Before Stage 03",
    standfirst: "Old gaps reveal how quickly a stock returns to normal.",
    stage: {
      label: "Stage 03 / Check past gaps",
      href: "/simulation/carts",
      cta: "Open Stage 03",
    },
    back: { label: "Stage 02 / Find unusual gaps", href: "/simulation/continue" },
    next: {
      label: "Slide 04",
      rail: "Possible futures",
      title: "How the Model Moves the Gap",
      text: "If gaps shrink, something must drive it. The next slide shows the engine: a pull toward normal plus random shocks, repeated day after day to build many possible futures.",
      href: "/briefing/ou-model",
    },
    blocks: [
      { kind: "lede", text: "Most gaps drift back toward normal." },
      { kind: "p", text: "After a gap appears, the stock usually moves partway back toward its usual level over the next few days." },
      { kind: "p", text: "φ (phi) is the share of the gap still left after one day. The lower φ is, the faster the gap closes." },
      { kind: "p", text: "Half-life tells you how many days it takes for half the gap to disappear." },
      { kind: "note", text: "Short half-life = gap closes quickly. Long half-life = gap lingers." },
    ],
    formulas: [
      {
        label: "One day",
        equation: "tomorrow = φ × today + noise",
        hint: "Part of the gap survives. Noise adds a nudge.",
      },
      {
        label: "Time to halve",
        equation: "t½ = −ln(2) / ln(φ)",
        hint: "Days until half the gap is gone.",
      },
    ],
    example: {
      label: "Half-life in action",
      value: "9",
      unit: "days to halve",
      rows: [
        { k: "TODAY", v: "+0.34" },
        { k: "DAY 9", v: "+0.17" },
        { k: "DAY 18", v: "+0.09" },
      ],
      caption: "A short half-life means the gap closes quickly.",
    },
    visual: { kind: "decay", halfLife: 9 },
  },
  {
    step: "ou-model",
    index: 4,
    rail: "Possible futures",
    title: "How the Model Moves the Gap",
    kicker: "Before Stage 04",
    standfirst: "A pull toward normal, plus a random shove.",
    stage: {
      label: "Stage 04 / Test possible futures",
      href: "/simulation/model",
      cta: "Open Stage 04",
    },
    back: { label: "Stage 03 / Check past gaps", href: "/simulation/carts" },
    next: {
      label: "Slide 05",
      rail: "Chance",
      title: "How Often Does the Gap Shrink?",
      text: "One possible future proves nothing. The next slide runs the model many times over and counts how many of those paths end with a smaller gap — turning the result into a chance.",
      href: "/briefing/probability",
    },
    blocks: [
      { kind: "lede", text: "Where could each Tata stock go from here?" },
      {
        kind: "p",
        text: "A gap doesn't stay where it is. It gets pulled back toward normal — like a ball rolling to the bottom of a bowl. But random shocks keep knocking it off course. The model runs this same step, day after day, on many paths, to build many possible futures.",
      },
      { kind: "note", text: "Each grey line is one possible future. The red line is where they average out." },
    ],
    formulas: [
      {
        label: "The model",
        equation: "change = pull + shock",
        hint: "Pull grows with distance. Shock is random.",
      },
      {
        label: "One day forward",
        equation: "next = now + pull + shock",
        hint: "Repeat for every day, on every path.",
      },
    ],
    example: {
      label: "One day, four moves",
      value: "1",
      unit: "day loop",
      rows: [
        { k: "START", v: "today's gap" },
        { k: "PULL", v: "toward normal" },
        { k: "SHOCK", v: "random kick" },
        { k: "RESULT", v: "tomorrow's gap" },
      ],
      caption: "Repeat the loop to build a possible future.",
    },
    visual: { kind: "paths" },
  },
  {
    step: "probability",
    index: 5,
    rail: "Chance",
    title: "How Often Does the Gap Shrink?",
    kicker: "Before Stage 05",
    standfirst: "Test many futures, then count how many close the gap.",
    stage: {
      label: "Stage 05 / Count results",
      href: "/simulation/probability",
      cta: "Open Stage 05",
    },
    back: { label: "Stage 04 / Test possible futures", href: "/simulation/model" },
    next: {
      label: "Slide 06",
      rail: "Formulas",
      title: "The Seven Steps",
      text: "The pieces are on the table: gaps, unusual gaps, half-lives and a chance. The next slide lines up all seven formulas into one chain, from share price to probability.",
      href: "/briefing/formulas",
    },
    blocks: [
      { kind: "lede", text: "One future proves nothing. So we run many." },
      { kind: "p", text: "We simulate many possible futures — each one is a path the gap could take over the coming days." },
      { kind: "p", text: "Then we count how many of those paths end with a smaller gap than today." },
      { kind: "p", text: "Divide that count by all the paths, and you have the probability — a share, not a certainty." },
      { kind: "note", text: "The answer is a chance, not a promise." },
    ],
    formulas: [
      {
        label: "Probability",
        equation: "P = smaller gaps / all paths",
        hint: "The share of tested futures that closed the gap.",
      },
    ],
    example: {
      label: "The 72% result",
      value: "72%",
      unit: "of 1,000 paths",
      rows: [
        { k: "PATHS", v: "1,000" },
        { k: "DAYS", v: "20" },
        { k: "CLOSED", v: "720" },
      ],
      caption: "A useful edge — never a guarantee.",
    },
    visual: { kind: "odds", hit: 72, total: 100 },
  },
  {
    step: "formulas",
    index: 6,
    rail: "Formulas",
    title: "The Seven Steps",
    kicker: "Before Stage 06",
    standfirst: "One chain from share price to probability.",
    stage: {
      label: "Market",
      href: "/market",
      cta: "Back to market",
    },
    back: { label: "Stage 05 / Count results", href: "/simulation/probability" },
    blocks: [
      { kind: "lede", text: "Seven rules turn prices into a chance the gap will shrink." },
      { kind: "note", text: "Each rule feeds the next one." },
    ],
    formulas: [],
    example: {
      label: "The chain",
      value: "7",
      unit: "formulas",
      rows: [
        { k: "COMPARE", v: "prices and gaps" },
        { k: "CHECK", v: "what is unusual" },
        { k: "TEST", v: "possible futures" },
        { k: "COUNT", v: "how many get closer" },
      ],
      caption: "Each step uses the result from the step before it.",
    },
    ledger: [
      {
        index: "01",
        name: "Log price",
        equation: "ln(P)",
        meaning: "Squeeze any price onto the same ruler.",
        stage: "Stage 01",
        href: "/simulation",
      },
      {
        index: "02",
        name: "Group price",
        equation: "I(t) = (1/N) Σ ln(P)",
        meaning: "One average number for NIFTY 50.",
        stage: "Stage 01",
        href: "/simulation",
      },
      {
        index: "03",
        name: "Gap",
        equation: "gap = ln(P) − I(t)",
        meaning: "How far one stock sits from the market.",
        stage: "Stage 01",
        href: "/simulation",
      },
      {
        index: "04",
        name: "Z-score",
        equation: "z = (gap − μ) / σ",
        meaning: "Is this gap unusual for that stock?",
        stage: "Stage 02",
        href: "/simulation/continue",
      },
      {
        index: "05",
        name: "OU model",
        equation: "dS = θ(μ − S) dt + σ dW",
        meaning: "Pulls the gap back to normal, with random shocks.",
        stage: "Stage 04",
        href: "/simulation/model",
      },
      {
        index: "06",
        name: "One day",
        equation: "S(t+1) = S(t) + θ(μ − S(t))Δt + σ√Δt Z",
        meaning: "Move the gap forward one day at a time.",
        stage: "Stage 04",
        href: "/simulation/model",
      },
      {
        index: "07",
        name: "Probability",
        equation: "P = count(smaller gap) / N",
        meaning: "Share of futures where the gap closes.",
        stage: "Stage 05",
        href: "/simulation/probability",
      },
    ],
  },
];

export function getBriefing(step: string) {
  return BRIEFINGS.find((briefing) => briefing.step === step);
}

export const BRIEFING_RAIL = BRIEFINGS.map(({ step, index, rail }) => ({
  step,
  index,
  rail,
  href: `/briefing/${step}`,
}));
