// Premium & resale scenario calculator. Assumptions, not forecasts.
//
// The selected unit's price is split into two parts:
//   size-adjusted base = reference PSF × selected area
//   premium            = selected price − size-adjusted base
// Market growth applies once to the whole price. The "retained premium"
// share applies only to the premium part, so the premium is never grown
// twice or counted as extra market growth:
//   reference resale = reference price × (1 + g)^n
//   selected resale  = (base + premium × retained) × (1 + g)^n
//
// Required resale price for the selected unit to match the reference
// unit's gross percentage return:
//   required = selected price × (reference resale ÷ reference price)

export interface ScenarioAssumptions {
  growthPct: number;
  retainedPremiumPct: number;
}

export const SCENARIO_PRESETS: Record<"downside" | "base" | "upside", ScenarioAssumptions> = {
  downside: { growthPct: -1, retainedPremiumPct: 50 },
  base: { growthPct: 2, retainedPremiumPct: 80 },
  upside: { growthPct: 3.5, retainedPremiumPct: 100 },
};

export interface CostInputs {
  absdPct: number;
  legalBuy: number;
  loanToValuePct: number;
  interestPct: number;
  loanTenureYears: number;
  monthlyHolding: number;
  agentFeePct: number;
  legalSell: number;
  /** Seller's stamp duty; null means use the default schedule. */
  ssdPct: number | null;
}

export const DEFAULT_COSTS: CostInputs = {
  absdPct: 0,
  legalBuy: 3000,
  loanToValuePct: 75,
  interestPct: 3,
  loanTenureYears: 30,
  monthlyHolding: 450,
  agentFeePct: 2,
  legalSell: 3000,
  ssdPct: null,
};

/** Residential buyer's stamp duty bands (from 15 Feb 2023). */
export function buyerStampDuty(price: number): number {
  const bands: [number, number][] = [
    [180_000, 0.01],
    [180_000, 0.02],
    [640_000, 0.03],
    [500_000, 0.04],
    [1_500_000, 0.05],
    [Infinity, 0.06],
  ];
  let left = price;
  let duty = 0;
  for (const [size, rate] of bands) {
    const part = Math.min(left, size);
    duty += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  return duty;
}

/**
 * Seller's stamp duty for residential property bought on or after
 * 4 July 2025: 16%, 12%, 8%, 4% if sold within years 1–4. Check IRAS.
 */
export function defaultSsdPct(holdingYears: number): number {
  if (holdingYears < 1) return 16;
  if (holdingYears < 2) return 12;
  if (holdingYears < 3) return 8;
  if (holdingYears < 4) return 4;
  return 0;
}

/** Interest paid over the first `months` of a standard amortising loan. */
export function interestPaid(loan: number, ratePct: number, tenureYears: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  const n = tenureYears * 12;
  if (r === 0) return 0;
  const payment = (loan * r) / (1 - Math.pow(1 + r, -n));
  let balance = loan;
  let interest = 0;
  for (let m = 0; m < Math.min(months, n); m++) {
    const i = balance * r;
    interest += i;
    balance -= payment - i;
  }
  return interest;
}

export interface Costs {
  acquisition: number;
  financing: number;
  holding: number;
  selling: number;
  total: number;
}

export function costsFor(price: number, resale: number, years: number, c: CostInputs): Costs {
  const acquisition = buyerStampDuty(price) + (price * c.absdPct) / 100 + c.legalBuy;
  const financing = interestPaid(
    (price * c.loanToValuePct) / 100,
    c.interestPct,
    c.loanTenureYears,
    Math.round(years * 12),
  );
  const holding = c.monthlyHolding * Math.round(years * 12);
  const ssd = c.ssdPct ?? defaultSsdPct(years);
  const selling = (resale * c.agentFeePct) / 100 + c.legalSell + (resale * ssd) / 100;
  return {
    acquisition,
    financing,
    holding,
    selling,
    total: acquisition + financing + holding + selling,
  };
}

export interface UnitOutcome {
  price: number;
  resale: number;
  grossGain: number;
  grossPct: number;
  costs: Costs;
  netGain: number;
}

export interface ScenarioResult {
  reference: UnitOutcome;
  selected: UnitOutcome;
  sizeAdjustedBase: number;
  premium: number;
  growthFactor: number;
  requiredResale: number;
  /** Positive when the scenario resale falls short of the required price. */
  shortfall: number;
}

function outcome(price: number, resale: number, years: number, c: CostInputs): UnitOutcome {
  const costs = costsFor(price, resale, years, c);
  const grossGain = resale - price;
  return {
    price,
    resale,
    grossGain,
    grossPct: (grossGain / price) * 100,
    costs,
    netGain: grossGain - costs.total,
  };
}

export function runScenario(
  reference: { price: number; areaSqft: number },
  selected: { price: number; areaSqft: number },
  years: number,
  a: ScenarioAssumptions,
  c: CostInputs,
): ScenarioResult {
  const growthFactor = Math.pow(1 + a.growthPct / 100, years);
  const refPsf = reference.price / reference.areaSqft;
  const sizeAdjustedBase = refPsf * selected.areaSqft;
  const premium = selected.price - sizeAdjustedBase;
  const refResale = reference.price * growthFactor;
  const selResale =
    (sizeAdjustedBase + premium * (a.retainedPremiumPct / 100)) * growthFactor;
  const requiredResale = selected.price * (refResale / reference.price);
  return {
    reference: outcome(reference.price, refResale, years, c),
    selected: outcome(selected.price, selResale, years, c),
    sizeAdjustedBase,
    premium,
    growthFactor,
    requiredResale,
    shortfall: requiredResale - selResale,
  };
}
