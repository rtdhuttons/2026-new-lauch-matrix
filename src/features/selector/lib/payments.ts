import type { BuyerProfile } from "./stamp-duty";
import { stampDuty } from "./stamp-duty";

// Payment estimate for one unit from three figures the buyer can change:
// loan-to-value (LTV), interest rate and loan period.
//
// The loan is the price × LTV; the down payment is the rest, paid in cash or
// CPF (the 5% booking fee must be cash). The monthly instalment is a standard
// fixed-rate repayment on the full loan. Stamp duty follows IRAS rates for the
// buyer type chosen. Rules that depend on the buyer's circumstances (the LTV
// they qualify for) are not applied here and are listed as not included.

export interface PaymentInputs {
  /** Who is buying, for Additional Buyer's Stamp Duty. */
  buyer: BuyerProfile;
  /** Loan as a % of the price. */
  ltvPct: number | null;
  interestRatePct: number | null;
  loanYears: number | null;
}

/** Starting figures, all changeable: 75% LTV, 2% a year, 25 years. */
export const DEFAULT_PAYMENT_INPUTS: PaymentInputs = { buyer: "sc-1", ltvPct: 75, interestRatePct: 2, loanYears: 25 };

export interface PaymentEstimate {
  price: number;
  ltvPct: number;
  loanAmount: number;
  /** Price minus loan, paid in cash or CPF. */
  downPayment: number;
  /** The booking fee, which must be paid in cash. */
  minCash: number;
  /** Buyer's Stamp Duty. */
  bsd: number;
  /** Additional Buyer's Stamp Duty, and its rate. */
  absd: number;
  absdRate: number;
  /** Down payment plus stamp duty: what you pay before the loan starts. */
  upfront: number;
  monthlyInstalment: number;
  totalInterest: number;
  months: number;
}

/** The loan for a price at an LTV, rounded down to the nearest dollar. */
export function loanFor(price: number, ltvPct: number): number {
  return Math.floor((price * ltvPct) / 100);
}

/** Fixed monthly repayment for a loan at an annual rate over a number of years. */
export function monthlyInstalment(loan: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0) return NaN;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - (1 + r) ** -n);
}

/**
 * Year-by-year loan balance and what has been paid so far, for a fixed
 * monthly repayment. Year 0 is the start of the loan.
 */
export function loanSchedule(loan: number, annualRatePct: number, years: number): { year: number; balance: number; interestPaid: number; principalPaid: number }[] {
  const n = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  const pay = monthlyInstalment(loan, annualRatePct, years);
  const out = [{ year: 0, balance: loan, interestPaid: 0, principalPaid: 0 }];
  let balance = loan;
  let interest = 0;
  for (let m = 1; m <= n; m++) {
    const i = balance * r;
    interest += i;
    balance = Math.max(0, balance + i - pay);
    if (m % 12 === 0 || m === n) out.push({ year: Math.ceil(m / 12), balance, interestPaid: interest, principalPaid: loan - balance });
  }
  return out;
}

/** Returns the estimate, or a list of problems written as "problem → fix". */
export function estimatePayments(price: number | null, inp: PaymentInputs): { ok: true; value: PaymentEstimate } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (price === null) problems.push("This unit has no price yet. Choose a unit with a price, or wait for the price list.");
  if (inp.ltvPct === null) problems.push("Enter a loan-to-value (LTV) % to calculate your payment.");
  else if (inp.ltvPct < 0 || inp.ltvPct > 95) problems.push("Enter an LTV between 0% and 95%: the 5% booking fee must be paid in cash.");
  if (inp.interestRatePct === null) problems.push("Enter an interest rate to calculate your payment.");
  else if (inp.interestRatePct < 0) problems.push("The interest rate can't be negative. Enter zero or more.");
  if (inp.loanYears === null || inp.loanYears <= 0) problems.push("Enter a loan period to calculate your payment.");
  if (problems.length > 0 || price === null || inp.ltvPct === null || inp.interestRatePct === null || inp.loanYears === null) {
    return { ok: false, problems };
  }
  const loanAmount = loanFor(price, inp.ltvPct);
  const monthly = loanAmount > 0 ? monthlyInstalment(loanAmount, inp.interestRatePct, inp.loanYears) : 0;
  const months = Math.round(inp.loanYears * 12);
  const duty = stampDuty(price, inp.buyer);
  return {
    ok: true,
    value: {
      price,
      ltvPct: inp.ltvPct,
      loanAmount,
      downPayment: price - loanAmount,
      minCash: price * 0.05,
      bsd: duty.bsd,
      absd: duty.absd,
      absdRate: duty.absdRate,
      upfront: price - loanAmount + duty.total,
      monthlyInstalment: monthly,
      totalInterest: monthly * months - loanAmount,
      months,
    },
  };
}

/** What the estimate leaves out, shown next to the result. */
export const PAYMENT_NOT_INCLUDED = [
  "Legal and valuation fees. (Stamp duty is included, at IRAS rates for the buyer type chosen.)",
  "Whether you qualify for the LTV entered: it depends on your age, loan period and other housing loans. Your bank confirms it.",
  "The developer's own payment schedule, if it differs from the standard stages shown.",
  "Maintenance fees and property tax, until they are added for this project.",
];
