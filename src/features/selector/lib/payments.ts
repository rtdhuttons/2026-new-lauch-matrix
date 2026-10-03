// Payment estimate for one unit from the buyer's own figures.
//
// Only arithmetic on what the buyer enters: the down payment is the price
// minus the loan, CPF covers what it can of that, and cash covers the rest.
// The monthly instalment is a standard fixed-rate loan repayment on the full
// loan. Rules that depend on official policy (loan limits, minimum cash
// portion, stamp duty) are not applied here and are listed as not included,
// so the result is never presented as a complete cost.

export interface PaymentInputs {
  cashAvailable: number | null;
  cpfAvailable: number | null;
  loanAmount: number | null;
  interestRatePct: number | null;
  loanYears: number | null;
  /** CPF the buyer expects to put towards the instalment each month. */
  cpfMonthly: number | null;
}

export const EMPTY_PAYMENT_INPUTS: PaymentInputs = {
  cashAvailable: null,
  cpfAvailable: null,
  loanAmount: null,
  interestRatePct: null,
  loanYears: null,
  cpfMonthly: null,
};

export interface PaymentEstimate {
  price: number;
  loanAmount: number;
  downPayment: number;
  cpfForDownPayment: number;
  cashUpfront: number;
  /** Cash left after the upfront cash, or null if cash available wasn't entered. */
  cashLeft: number | null;
  monthlyInstalment: number;
  cashMonthlyAfterCpf: number;
  totalInterest: number;
  months: number;
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
  if (inp.loanAmount === null) problems.push("Enter a loan amount to calculate your payment.");
  if (inp.interestRatePct === null) problems.push("Enter an interest rate to calculate your payment.");
  if (inp.loanYears === null || inp.loanYears <= 0) problems.push("Enter a loan period to calculate your payment.");
  if (price !== null && inp.loanAmount !== null && inp.loanAmount > price) problems.push("The loan is more than the unit price. Lower the loan amount.");
  if (inp.loanAmount !== null && inp.loanAmount < 0) problems.push("The loan amount can't be negative. Enter zero or more.");
  if (inp.interestRatePct !== null && inp.interestRatePct < 0) problems.push("The interest rate can't be negative. Enter zero or more.");
  if (problems.length > 0 || price === null || inp.loanAmount === null || inp.interestRatePct === null || inp.loanYears === null) {
    return { ok: false, problems };
  }
  const downPayment = price - inp.loanAmount;
  const cpfForDownPayment = Math.min(Math.max(0, inp.cpfAvailable ?? 0), downPayment);
  const cashUpfront = downPayment - cpfForDownPayment;
  const monthly = monthlyInstalment(inp.loanAmount, inp.interestRatePct, inp.loanYears);
  const months = Math.round(inp.loanYears * 12);
  return {
    ok: true,
    value: {
      price,
      loanAmount: inp.loanAmount,
      downPayment,
      cpfForDownPayment,
      cashUpfront,
      cashLeft: inp.cashAvailable === null ? null : inp.cashAvailable - cashUpfront,
      monthlyInstalment: monthly,
      cashMonthlyAfterCpf: Math.max(0, monthly - Math.max(0, inp.cpfMonthly ?? 0)),
      totalInterest: monthly * months - inp.loanAmount,
      months,
    },
  };
}

/** What the estimate leaves out, shown next to the result. */
export const PAYMENT_NOT_INCLUDED = [
  "Stamp duty, legal and valuation fees.",
  "Official loan limits and the minimum share of the down payment that must be paid in cash.",
  "The developer's own payment schedule, if it differs from the standard stages shown.",
  "Maintenance fees and property tax, until they are added for this project.",
];
