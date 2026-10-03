// Progressive payments for a new launch bought under the Normal Payment
// Scheme: the price is paid in stages as the building goes up. The stage
// percentages are the standard schedule in Singapore's Housing Developers
// Rules; a project's own schedule (from its sale and purchase agreement)
// replaces them when supplied.
//
// Own money (the down payment: price minus loan) pays the stages first, in
// order; the 5% booking fee is always cash. Once the down payment is used up,
// the bank loan pays each stage, so the monthly loan payment rises as more of
// the loan is drawn.

import type { PaymentScheduleStage } from "../model/project";
import { monthlyInstalment } from "./payments";

export const STANDARD_SCHEDULE: PaymentScheduleStage[] = [
  { stage: "Booking fee (option to purchase)", percent: 5, expected: null, estimatedDate: false },
  { stage: "Sale and purchase agreement (within 8 weeks)", percent: 15, expected: null, estimatedDate: false },
  { stage: "Foundation completed", percent: 10, expected: null, estimatedDate: false },
  { stage: "Reinforced concrete framework", percent: 10, expected: null, estimatedDate: false },
  { stage: "Partition walls", percent: 5, expected: null, estimatedDate: false },
  { stage: "Roofing and ceiling", percent: 5, expected: null, estimatedDate: false },
  { stage: "Doors, windows, wiring and plumbing", percent: 5, expected: null, estimatedDate: false },
  { stage: "Car park, roads and drains", percent: 5, expected: null, estimatedDate: false },
  { stage: "Temporary Occupation Permit (keys)", percent: 25, expected: null, estimatedDate: false },
  { stage: "Certificate of Statutory Completion", percent: 15, expected: null, estimatedDate: false },
];

export const STANDARD_SCHEDULE_SOURCE = "Housing Developers Rules, Normal Payment Scheme (standard stages for new private homes)";

export interface StagePayment {
  stage: string;
  percent: number;
  amount: number;
  cash: number;
  cpf: number;
  loan: number;
  /** Loan drawn after this stage. */
  loanDrawn: number;
  /** Monthly loan payment once this stage's share of the loan is drawn. */
  monthly: number;
  expected: string | null;
  estimatedDate: boolean;
}

export type ProgressiveResult = { ok: true; stages: StagePayment[]; totals: { cash: number; cpf: number; loan: number } } | { ok: false; problems: string[] };

export function progressivePayments(
  price: number,
  i: { loanAmount: number; cpfAvailable: number | null; interestRatePct: number; loanYears: number },
  schedule: PaymentScheduleStage[] = STANDARD_SCHEDULE,
): ProgressiveResult {
  const problems: string[] = [];
  const bookingPct = schedule[0]?.percent ?? 0;
  if (i.loanAmount > price * (1 - bookingPct / 100) + 0.5) {
    problems.push(`The loan is more than ${100 - bookingPct}% of the price, but the ${bookingPct}% booking fee must be paid in cash. Lower the loan amount.`);
  }
  if (Math.abs(schedule.reduce((a, s) => a + s.percent, 0) - 100) > 0.01) problems.push("The payment stages don't add up to 100%. Check the payment schedule.");
  if (problems.length) return { ok: false, problems };

  let ownLeft = price - i.loanAmount;
  let cpfLeft = Math.max(0, i.cpfAvailable ?? 0);
  let drawn = 0;
  const stages = schedule.map((s, idx) => {
    const amount = (price * s.percent) / 100;
    let cash = 0;
    let cpf = 0;
    if (idx === 0) {
      cash = amount;
    } else {
      const own = Math.min(amount, Math.max(0, ownLeft));
      cpf = Math.min(own, cpfLeft);
      cash = own - cpf;
      cpfLeft -= cpf;
    }
    ownLeft -= cash + cpf;
    const loan = amount - cash - cpf;
    drawn += loan;
    return {
      stage: s.stage,
      percent: s.percent,
      amount,
      cash,
      cpf,
      loan,
      loanDrawn: drawn,
      monthly: drawn > 0 ? monthlyInstalment(drawn, i.interestRatePct, i.loanYears) : 0,
      expected: s.expected,
      estimatedDate: s.estimatedDate,
    };
  });
  const sum = (k: "cash" | "cpf" | "loan") => stages.reduce((a, s) => a + s[k], 0);
  return { ok: true, stages, totals: { cash: sum("cash"), cpf: sum("cpf"), loan: sum("loan") } };
}
