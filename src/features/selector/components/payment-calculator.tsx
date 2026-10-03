"use client";

// Payment estimate for the selected unit. The unit and its price come in
// automatically; the buyer enters their own figures. Inputs stay while the
// buyer moves between tabs (they are not saved in the browser).

import type { PaymentsInfo, ProjectProfile } from "../model/project";
import type { Unit } from "../model/types";
import type { PaymentInputs } from "../lib/payments";
import { EMPTY_PAYMENT_INPUTS, estimatePayments, PAYMENT_NOT_INCLUDED } from "../lib/payments";
import { money } from "../lib/format";
import { EstimateTag, unitNumber } from "./unit-summary";
import { btnSecondary, card, Disclosure } from "./ui";

function Field({
  id,
  label,
  help,
  value,
  onChange,
  prefix,
  suffix,
  step = 1000,
}: {
  id: string;
  label: string;
  help: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="font-display-normal text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-canopy/70">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          aria-describedby={`${id}-help`}
          className="w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal tabular-nums"
        />
        {suffix && <span className="shrink-0 text-canopy/70">{suffix}</span>}
      </div>
      <p id={`${id}-help`} className="text-xs text-canopy/65">{help}</p>
    </div>
  );
}

function Result({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-mist p-4">
      <dt className="font-display-normal text-sm text-canopy/75">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs text-canopy/65">{note}</dd>}
    </div>
  );
}

export function PaymentCalculator({
  unit,
  unitName,
  inputs,
  onInputs,
  payments,
  profile,
}: {
  unit: Unit | null;
  unitName: string | null;
  inputs: PaymentInputs;
  onInputs: (p: PaymentInputs) => void;
  payments: PaymentsInfo;
  profile: ProjectProfile;
}) {
  if (!unit) {
    return (
      <div className={`${card} p-5`}>
        <p className="font-display-normal font-semibold">Choose a unit to see its payment estimate.</p>
      </div>
    );
  }
  const set = (k: keyof PaymentInputs) => (v: number | null) => onInputs({ ...inputs, [k]: v });
  const r = estimatePayments(unit.price, inputs);
  const completion = profile.expectedCompletion;

  return (
    <div className={`${card} p-0`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-canopy/10 px-5 py-4">
        <p className="font-display-normal">
          <span className="text-canopy/70">For </span>
          <span className="font-semibold">Unit {unitNumber(unit)}</span>
          {unitName ? <span className="text-canopy/70"> · {unitName}</span> : null}
          <span className="text-canopy/70"> · </span>
          <span className="font-semibold tabular-nums">{unit.price !== null ? money(unit.price) : "price not published"}</span>{" "}
          {unit.priceIsEstimate && <EstimateTag />}
        </p>
        <button type="button" onClick={() => onInputs(EMPTY_PAYMENT_INPUTS)} className={btnSecondary}>
          Reset
        </button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-4">
          <Field id="pay-cash" label="Cash available" help="Savings you could put towards this purchase." value={inputs.cashAvailable} onChange={set("cashAvailable")} prefix="S$" />
          <Field id="pay-cpf" label="CPF available for this purchase" help="CPF Ordinary Account savings you plan to use for the down payment." value={inputs.cpfAvailable} onChange={set("cpfAvailable")} prefix="S$" />
          <Field id="pay-loan" label="Loan amount" help="What you plan to borrow from a bank. Loan limits depend on official rules and the bank." value={inputs.loanAmount} onChange={set("loanAmount")} prefix="S$" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-rate" label="Interest rate" help="Yearly rate offered by the bank." value={inputs.interestRatePct} onChange={set("interestRatePct")} suffix="% a year" step={0.05} />
            <Field id="pay-years" label="Loan period" help="How many years to repay." value={inputs.loanYears} onChange={set("loanYears")} suffix="years" step={1} />
          </div>
          <Disclosure title="Adjust assumptions" hint="CPF towards the monthly payment">
            <Field
              id="pay-cpf-monthly"
              label="CPF used each month"
              help="CPF you expect to put towards the monthly loan payment. The rest is paid in cash."
              value={inputs.cpfMonthly}
              onChange={set("cpfMonthly")}
              prefix="S$"
              step={100}
            />
          </Disclosure>
        </div>

        <div aria-live="polite">
          {r.ok ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Result label="Cash needed upfront" value={money(r.value.cashUpfront)} note={`Down payment ${money(r.value.downPayment)} (price minus loan), less ${money(r.value.cpfForDownPayment)} from CPF.`} />
                <Result label="Estimated mortgage payment after full loan disbursement" value={`${money(Math.round(r.value.monthlyInstalment))} a month`} note={`${r.value.months} monthly payments; ${money(Math.round(r.value.totalInterest))} interest in total.`} />
                <Result label="Estimated cash payment after CPF" value={`${money(Math.round(r.value.cashMonthlyAfterCpf))} a month`} note={inputs.cpfMonthly ? `After ${money(inputs.cpfMonthly)} a month from CPF.` : "No monthly CPF entered (see Adjust assumptions)."} />
                <Result
                  label="Estimated ongoing expenses"
                  value={payments.maintenance ? "See below" : "Not available"}
                  note={payments.maintenance ? undefined : "Maintenance fees and property tax have not been added for this project."}
                />
              </dl>
              {r.value.cashLeft !== null && (
                <p className={`mt-3 rounded-lg px-4 py-2.5 font-display-normal text-sm ${r.value.cashLeft < 0 ? "bg-[#fbe9e6] text-[#7a231b]" : "bg-mist-deep/70"}`}>
                  {r.value.cashLeft < 0
                    ? `You'd be ${money(-r.value.cashLeft)} short of the cash needed upfront. Add cash or CPF, or raise the loan amount.`
                    : `Cash left after the upfront payment: ${money(r.value.cashLeft)}.`}
                </p>
              )}
              <p className="mt-3 text-xs text-stone">
                The monthly loan payment is what the bank collects; your total household costs also include the ongoing expenses above. {unit.priceIsEstimate ? "The price is an estimate, so every figure here is too." : ""}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-canopy/25 p-4">
              <p className="font-display-normal font-semibold">To calculate your payments:</p>
              <ul className="mt-1 grid list-disc gap-1 pl-5 text-[0.9375rem] text-canopy/85">
                {r.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="font-display-normal text-sm font-semibold">Payments during construction</p>
            <ol className="mt-2 flex items-center gap-2 font-display-normal text-xs text-canopy/75">
              <li className="rounded-full bg-mist px-3 py-1">Purchase</li>
              <li aria-hidden="true" className="h-px flex-1 bg-canopy/20" />
              <li className="rounded-full bg-mist px-3 py-1">Construction (progress payments)</li>
              <li aria-hidden="true" className="h-px flex-1 bg-canopy/20" />
              <li className="rounded-full bg-mist px-3 py-1">
                Completion{completion ? ` (expected ${new Date(`${completion.date}T00:00:00Z`).toLocaleDateString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" })})` : ""}
              </li>
            </ol>
            <p className="mt-2 text-sm text-canopy/80">
              {payments.schedule
                ? "The loan is drawn in stages as the building progresses, so monthly payments start lower and rise to the full amount above."
                : "The developer's payment schedule hasn't been added, so the stage-by-stage payments can't be shown yet. The full-loan payment above is what you'd pay once the whole loan is drawn."}
            </p>
            {completion && <p className="mt-1 text-xs text-stone">Expected date: {completion.provenance.source}. {completion.provenance.note}</p>}
          </div>

          <div className="mt-4">
            <Disclosure title="What this estimate doesn't include">
              <ul className="grid list-disc gap-1 pl-5 text-sm text-canopy/80">
                {PAYMENT_NOT_INCLUDED.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </div>
      </div>
    </div>
  );
}
