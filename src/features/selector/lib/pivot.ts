// TRM's PIVOT framework (from the "PIVOT Matrix" e-book): five segments that
// together answer "is this project worth buying?". The framework is shared;
// each project supplies its own scores, reasons and worked figures.
//
// The calculations below reproduce the e-book's worked examples exactly.
// They are conditional estimates built on the stated assumptions, not
// forecasts, and every input stays visible and editable on the page.

import type { PivotCategory, PivotEntryEstimate, PivotInfo } from "../model/project";

export const PIVOT_CATEGORIES: { id: PivotCategory; letter: string; name: string; subtitle: string; question: string }[] = [
  {
    id: "product-mix",
    letter: "P",
    name: "Product mix",
    subtitle: "Bedrooms and facings",
    question: "Find out the unit mix of the bedrooms, and the stack analysis for more premium facings.",
  },
  {
    id: "investment-entry",
    letter: "I",
    name: "Investment entry",
    subtitle: "Land bid and price",
    question: "Find out the estimated price developers may charge based on the land bid, and make sure you're paying a fair price to enter.",
  },
  {
    id: "value-add",
    letter: "V",
    name: "Value-add",
    subtitle: "Amenities",
    question: "Find out the nearby amenities, such as proximity to the MRT, schools and malls. The more convenient, the more growth.",
  },
  {
    id: "opportunity-zone",
    letter: "O",
    name: "Opportunity zone",
    subtitle: "Transformation",
    question: "Identify the opportunities in terms of the area's recent and future transformation.",
  },
  {
    id: "timing-of-exit",
    letter: "T",
    name: "Timing of exit",
    subtitle: "Exit strategy",
    question: "Find out what your exit strategy will be, to ensure a smooth and profitable runway in the future.",
  },
];

/** (land psf ppr + construction) × (1 + margin) × (1 + breakeven uplift). */
export function entryPsfSteps(e: Pick<PivotEntryEstimate, "landPsfPpr" | "constructionPsf" | "profitMargin" | "breakevenUplift">) {
  const cost = e.landPsfPpr + e.constructionPsf;
  const withMargin = cost * (1 + e.profitMargin);
  const estimate = withMargin * (1 + e.breakevenUplift);
  return { cost, withMargin, estimate };
}

/** Simple average of the five scores, shown beside the stated overall rating. */
export function averageScore(p: PivotInfo): number | null {
  if (!p.scores || p.scores.length === 0) return null;
  return p.scores.reduce((a, s) => a + s.score, 0) / p.scores.length;
}

/** Years after purchase shown in the exit projection: from around completion to 10 years. */
export const EXIT_YEARS = [4, 5, 6, 7, 8, 9, 10];

/** Average, middle and spread of the yearly (annualised) returns, i.e. each resale's CAGR. */
export function annualisedSpread(returns: number[]): { q1: number; median: number; q3: number; mean: number; n: number } | null {
  if (returns.length === 0) return null;
  const s = [...returns].sort((a, b) => a - b);
  const q = (p: number) => {
    const pos = (s.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  return { q1: q(0.25), median: q(0.5), q3: q(0.75), mean: s.reduce((a, r) => a + r, 0) / s.length, n: s.length };
}

/**
 * The purchase price grown at a yearly rate: price × (1 + rate)^years.
 * Gross: before stamp duty, fees, interest, loan repayment and CPF refund.
 */
export function exitProjection(price: number, rate: number, years: number[] = EXIT_YEARS) {
  return years.map((y) => {
    const value = price * (1 + rate) ** y;
    return { years: y, value, gain: value - price };
  });
}
