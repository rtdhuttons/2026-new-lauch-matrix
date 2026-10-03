// Stands in for src/app/actions.ts in the single-page build, which has no
// server: requests can't be recorded, so they are never shown as received.
import type { RegisterState } from "../../src/app/actions";
import { checkValuationRequest, readValuationForm, type ValuationState } from "../../src/features/selector/lib/valuation";

export type { RegisterState };

export async function registerInterest(...args: [RegisterState, FormData]): Promise<RegisterState> {
  void args;
  return { status: "error", message: "Online registration isn't available on this page. Please contact TRM directly." };
}

export async function requestValuation(_prev: ValuationState, formData: FormData): Promise<ValuationState> {
  const problem = checkValuationRequest(readValuationForm(formData));
  if (problem) return { status: "error", message: problem };
  return { status: "error", message: "Online requests aren't available on this page. Please contact TRM directly." };
}
