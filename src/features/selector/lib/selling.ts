// Cash proceeds from selling a home the buyer already owns.
//
// Only arithmetic on what the seller enters: selling price minus the
// outstanding housing loan minus the CPF refund (principal plus accrued
// interest, for all owners). Missing figures are never treated as zero: the
// loan and CPF refund must be entered, even as 0. The CPF refund goes back
// to the owners' CPF accounts, so it is kept apart from the cash.

export interface SellingInputs {
  sellingPrice: number | null;
  outstandingLoan: number | null;
  cpfRefund: number | null;
  agentFee: number | null;
  legalFee: number | null;
  otherCosts: number | null;
}

export const EMPTY_SELLING_INPUTS: SellingInputs = {
  sellingPrice: null,
  outstandingLoan: null,
  cpfRefund: null,
  agentFee: null,
  legalFee: null,
  otherCosts: null,
};

/** The illustrative example shown on the page (not a visitor's own figures). */
export const ILLUSTRATIVE_SELLING_EXAMPLE: SellingInputs = {
  sellingPrice: 1_000_000,
  outstandingLoan: 350_000,
  cpfRefund: 250_000,
  agentFee: null,
  legalFee: null,
  otherCosts: 25_000,
};

export interface SellingEstimate {
  sellingPrice: number;
  outstandingLoan: number;
  cpfRefund: number;
  beforeCosts: number;
  /** Total selling costs, or null if none were entered. */
  costs: number | null;
  afterCosts: number | null;
  /** The figure to read: after costs if costs were entered, otherwise before. */
  headline: number;
  /** The sale doesn't cover the loan and CPF refund (and costs, if entered). */
  shortfall: boolean;
}

export type SellingResult = { ok: true; value: SellingEstimate } | { ok: false; problems: string[] };

const valid = (n: number | null): n is number => n !== null && Number.isFinite(n);

export function estimateProceeds(i: SellingInputs): SellingResult {
  const problems: string[] = [];
  if (!valid(i.sellingPrice) || i.sellingPrice <= 0) problems.push("Enter an estimated selling price.");
  if (!valid(i.outstandingLoan)) problems.push("Enter your outstanding housing loan (enter 0 if there is none).");
  else if (i.outstandingLoan < 0) problems.push("The outstanding housing loan can't be negative.");
  if (!valid(i.cpfRefund)) problems.push("Enter the total CPF refund for all owners (enter 0 if no CPF was used).");
  else if (i.cpfRefund < 0) problems.push("The CPF refund can't be negative.");
  const costItems = [i.agentFee, i.legalFee, i.otherCosts].filter((c) => c !== null);
  if (costItems.some((c) => !valid(c) || c < 0)) problems.push("Selling costs can't be negative.");
  if (problems.length > 0) return { ok: false, problems };

  const sellingPrice = i.sellingPrice!;
  const outstandingLoan = i.outstandingLoan!;
  const cpfRefund = i.cpfRefund!;
  const beforeCosts = sellingPrice - outstandingLoan - cpfRefund;
  const costs = costItems.length > 0 ? (costItems as number[]).reduce((a, c) => a + c, 0) : null;
  const afterCosts = costs !== null ? beforeCosts - costs : null;
  const headline = afterCosts ?? beforeCosts;
  return { ok: true, value: { sellingPrice, outstandingLoan, cpfRefund, beforeCosts, costs, afterCosts, headline, shortfall: headline < 0 } };
}

export function sameSellingInputs(a: SellingInputs, b: SellingInputs): boolean {
  return (Object.keys(a) as (keyof SellingInputs)[]).every((k) => a[k] === b[k]);
}
