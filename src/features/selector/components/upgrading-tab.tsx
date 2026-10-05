"use client";

// My Upgrading Plan: start with the buyer's current home. Request a
// valuation report (recorded through the enquiry process, never shown as
// received unless it was), and estimate the cash proceeds from selling.
// Calculator entries live in the page so they stay while moving between tabs.

import { useActionState, useState, type ReactNode } from "react";
import { requestValuation } from "@/app/actions";
import { site } from "@/content/site";
import type { SellingInputs } from "../lib/selling";
import { EMPTY_SELLING_INPUTS, estimateProceeds, ILLUSTRATIVE_SELLING_EXAMPLE, sameSellingInputs } from "../lib/selling";
import type { ContactMethod, ValuationState } from "../lib/valuation";
import { ChartCard, Waterfall } from "./charts";
import { btnPrimary, btnSecondary, btnText, card, Disclosure } from "./ui";
import { AmountInput } from "./amount-input";

const sgd = (n: number) => `${n < 0 ? "−" : ""}S$${Math.abs(Math.round(n)).toLocaleString("en-SG")}`;
const input = "mt-1.5 block w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal text-base";
const labelCls = "font-display-normal text-sm font-semibold";

function ValuationRequest({ projectName }: { projectName: string }) {
  const [state, action, pending] = useActionState<ValuationState, FormData>(requestValuation, { status: "idle" });
  const [method, setMethod] = useState<ContactMethod>("mobile");
  const [address, setAddress] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const whatsapp = site.phone ? site.phone.replace(/[^\d]/g, "") : null;
  const waText = encodeURIComponent(
    `Hi TRM, I'd like a valuation report for my home: ${address || "[address or postal code]"}${unitNo ? `, unit ${unitNo}` : ""}.`,
  );

  return (
    <section aria-labelledby="valuation-title" className={`${card} p-5 sm:p-6`}>
      <h3 id="valuation-title" className="font-display text-xl font-extrabold">What could your home sell for?</h3>
      <p className="mt-1 max-w-[64ch] text-[0.9375rem] text-canopy/80">Enter your property address to request a review of its estimated market value.</p>
      <p className="mt-3 max-w-[64ch] rounded-lg bg-mist px-4 py-3 text-sm text-canopy/85">
        <strong>What you&apos;ll get:</strong> an indicative market assessment from TRM, a Huttons Associate, based on recent transactions near your
        home. It is not a formal valuation by a licensed valuer, and it can&apos;t be used for a bank loan or legal purpose. Nothing is worked out
        automatically: a person reviews your home and gets back to you.
      </p>

      {state.status === "sent" ? (
        <div role="status" className="mt-5 rounded-lg border border-reservoir/40 p-5">
          <p className="font-display text-lg font-bold">Request received</p>
          <p className="mt-1 text-canopy/80">Thanks, {state.name}. TRM will review your home and contact you with the assessment.</p>
        </div>
      ) : (
        <form action={action} noValidate className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
          <input type="hidden" name="project" value={projectName} />
          <input type="hidden" name="contactMethod" value={method} />
          <div>
            <label htmlFor="val-address" className={labelCls}>Property address or postal code</label>
            <input id="val-address" name="address" autoComplete="street-address" required value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="val-unit" className={labelCls}>
              Unit number <span className="font-normal text-canopy/60">(if any)</span>
            </label>
            <input id="val-unit" name="unitNumber" placeholder="#08-12" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="val-name" className={labelCls}>Name</label>
            <input id="val-name" name="name" autoComplete="name" required className={input} />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className={labelCls}>How should we contact you?</legend>
            <div role="radiogroup" className="mt-1.5 inline-flex rounded-full border border-canopy/15 bg-paper p-1">
              {(["mobile", "email"] as const).map((m) => (
                <label key={m} className={`cursor-pointer rounded-full px-4 py-1.5 font-display-normal text-sm font-semibold ${method === m ? "bg-canopy text-mist" : "text-canopy/75"}`}>
                  <input type="radio" name="contactChoice" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  {m === "mobile" ? "Mobile" : "Email"}
                </label>
              ))}
            </div>
            <label htmlFor="val-contact" className="sr-only">{method === "mobile" ? "Mobile number" : "Email address"}</label>
            <input
              key={method}
              id="val-contact"
              name="contact"
              type={method === "mobile" ? "tel" : "email"}
              inputMode={method === "mobile" ? "tel" : "email"}
              autoComplete={method === "mobile" ? "tel" : "email"}
              placeholder={method === "mobile" ? "9123 4567" : "name@example.com"}
              required
              className={`${input} sm:max-w-sm`}
            />
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Sending…" : "Request valuation report"}
            </button>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" className={btnSecondary}>
                Request report via WhatsApp
              </a>
            )}
            <a href="#cash-proceeds" className={btnText}>Skip to the cash calculator</a>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-semibold text-[#9b3b1c] sm:col-span-2">{state.message}</p>
          )}
          <p className="text-xs text-stone sm:col-span-2">By sending this request, you agree that TRM may contact you about it.</p>
        </form>
      )}
    </section>
  );
}

function MoneyField({ id, label, help, value, onChange }: { id: string; label: string; help?: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-canopy/70">S$</span>
        <AmountInput
          id={id}
          value={value}
          onChange={onChange}
          aria-describedby={help ? `${id}-help` : undefined}
          className="w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal tabular-nums"
        />
      </div>
      {help && <p id={`${id}-help`} className="mt-1 text-xs text-canopy/65">{help}</p>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2 ${strong ? "border-t border-canopy/20 font-semibold" : ""}`}>
      <dt className="text-canopy/80">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function SellingCalculator({
  inputs,
  onInputs,
  calculated,
  onCalculate,
}: {
  inputs: SellingInputs;
  onInputs: (i: SellingInputs) => void;
  calculated: SellingInputs | null;
  onCalculate: (i: SellingInputs | null) => void;
}) {
  const set = (k: keyof SellingInputs) => (v: number | null) => onInputs({ ...inputs, [k]: v });
  const result = calculated ? estimateProceeds(calculated) : null;
  const stale = calculated !== null && !sameSellingInputs(calculated, inputs);
  const costsEntered = inputs.agentFee !== null || inputs.legalFee !== null || inputs.otherCosts !== null;

  return (
    <section id="cash-proceeds" aria-labelledby="cash-title" className={`${card} scroll-mt-24 p-5 sm:p-6`}>
      <h3 id="cash-title" className="font-display text-xl font-extrabold">How much cash could you receive?</h3>
      <p className="mt-1 max-w-[64ch] text-[0.9375rem] text-canopy/80">
        Enter an estimated selling price, your remaining housing loan, and the total CPF refund for all owners.
      </p>

      <form
        className="mt-5 grid gap-4 [&>*]:min-w-0"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onCalculate(inputs);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
          <MoneyField id="sell-price" label="Estimated selling price" value={inputs.sellingPrice} onChange={set("sellingPrice")} />
          <MoneyField id="sell-loan" label="Outstanding housing loan" help="Enter 0 if the home has no loan." value={inputs.outstandingLoan} onChange={set("outstandingLoan")} />
          <MoneyField
            id="sell-cpf"
            label="Total CPF refund, including accrued interest"
            help="Include all owners' required refunds. You can check your amount in your CPF Home ownership dashboard."
            value={inputs.cpfRefund}
            onChange={set("cpfRefund")}
          />
        </div>

        <Disclosure title="Add selling costs" hint={costsEntered ? "Selling costs added" : "Optional: agent fees, legal fees, other costs or duties"}>
          <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
            <MoneyField id="sell-agent" label="Agent fees" value={inputs.agentFee} onChange={set("agentFee")} />
            <MoneyField id="sell-legal" label="Legal fees" value={inputs.legalFee} onChange={set("legalFee")} />
            <MoneyField id="sell-other" label="Other costs or duties" help="For example, seller's stamp duty if it applies." value={inputs.otherCosts} onChange={set("otherCosts")} />
          </div>
        </Disclosure>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btnPrimary}>Calculate cash proceeds</button>
          <button
            type="button"
            className={btnText}
            onClick={() => {
              onInputs(EMPTY_SELLING_INPUTS);
              onCalculate(null);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-5">
        {result && !result.ok && (
          <div role="alert" className="rounded-lg border border-[#c9a45a] bg-[#fbf3df] px-4 py-3 text-sm text-[#5c3f0c]">
            <p className="font-semibold">A few figures are needed first</p>
            <ul className="mt-1 list-disc pl-5">
              {result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {result?.ok && (
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
            <div className={`rounded-xl p-5 ${result.value.shortfall ? "border-l-4 border-[#b3532e] bg-[#fbeee8]" : "bg-mist"}`}>
              <p className="font-display-normal text-sm text-canopy/75">
                {result.value.afterCosts !== null ? "Estimated cash proceeds after selling costs" : "Estimated cash proceeds before selling costs"}
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{sgd(result.value.headline)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-canopy/65">
                {result.value.afterCosts !== null ? "After selling costs" : "Before selling costs"}
              </p>
              {result.value.shortfall && (
                <p className="mt-3 text-sm text-canopy/90">
                  <strong>Flagged for review:</strong> on these figures, the sale doesn&apos;t cover the loan and CPF refund
                  {result.value.costs !== null ? " and selling costs" : ""}. How a CPF shortfall is treated depends on your circumstances. Talk to
                  TRM and check with CPF Board before you plan around it.
                </p>
              )}
              {stale && <p className="mt-3 text-sm font-semibold text-[#7a5410]">You&apos;ve changed the figures. Calculate again to update.</p>}
            </div>
            <dl className="font-display-normal text-sm">
              <Row label="Estimated selling price" value={sgd(result.value.sellingPrice)} />
              <Row label="Less outstanding housing loan" value={`−${sgd(result.value.outstandingLoan)}`} />
              <Row label="Less CPF refund (goes back to your CPF accounts)" value={`−${sgd(result.value.cpfRefund)}`} />
              <Row label="Estimated cash proceeds before selling costs" value={sgd(result.value.beforeCosts)} strong />
              {result.value.costs !== null && result.value.afterCosts !== null && (
                <>
                  <Row label="Less selling costs" value={`−${sgd(result.value.costs)}`} />
                  <Row label="Estimated cash proceeds after selling costs" value={sgd(result.value.afterCosts)} strong />
                </>
              )}
            </dl>
          </div>
        )}
        {result?.ok && (
          <ChartCard className="mt-4" title="From selling price to cash in hand" subtitle="Each step takes away what must be repaid or paid; the CPF refund goes back to your CPF accounts.">
            <Waterfall
              ariaLabel="Selling price, less the housing loan, CPF refund and selling costs, gives the cash proceeds"
              height={240}
              format={(n) => `${n < 0 ? "−" : ""}S$${Math.abs(n) >= 1_000_000 ? (Math.abs(n) / 1_000_000).toFixed(2) + "M" : Math.round(Math.abs(n) / 1000) + "k"}`}
              steps={[
                { label: "Selling price", value: result.value.sellingPrice, kind: "total" },
                { label: "Housing loan", value: -result.value.outstandingLoan, kind: "change" },
                { label: "CPF refund", value: -result.value.cpfRefund, kind: "change" },
                ...(result.value.costs !== null ? [{ label: "Selling costs", value: -result.value.costs, kind: "change" as const }] : []),
                { label: "Cash proceeds", value: result.value.headline, kind: "total" },
              ]}
            />
          </ChartCard>
        )}
      </div>

      <p className="mt-4 text-xs text-stone">
        Cash proceeds are what&apos;s left in cash after the loan and CPF refund are repaid. This is not profit: it doesn&apos;t take off what you paid
        for the home. The CPF refund is your own money going back to your CPF accounts, where you may be able to use it for your next home.
      </p>

      <div className="mt-4">
        <Disclosure title="See an illustrative example" hint="Example figures only, not yours">
          <table className="w-full max-w-md border-collapse font-display-normal text-sm tabular-nums">
            <caption className="sr-only">Illustrative example of cash proceeds</caption>
            <tbody>
              {[
                ["Estimated selling price", 1_000_000],
                ["Outstanding housing loan", 350_000],
                ["Total CPF refund, including accrued interest", 250_000],
                ["Estimated cash proceeds before selling costs", 400_000],
                ["Optional selling costs", 25_000],
                ["Estimated cash proceeds after selling costs", 375_000],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-canopy/10">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal text-canopy/80">{k}</th>
                  <td className="py-1.5 text-right">{sgd(v as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className={`${btnSecondary} mt-3`}
            onClick={() => {
              onInputs(ILLUSTRATIVE_SELLING_EXAMPLE);
              onCalculate(ILLUSTRATIVE_SELLING_EXAMPLE);
            }}
          >
            Try the example figures
          </button>
        </Disclosure>
      </div>
    </section>
  );
}

export function UpgradingTab({
  projectName,
  selling,
  onSelling,
  calculated,
  onCalculate,
  nextHome,
}: {
  projectName: string;
  selling: SellingInputs;
  onSelling: (i: SellingInputs) => void;
  calculated: SellingInputs | null;
  onCalculate: (i: SellingInputs | null) => void;
  nextHome: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0">
      <ValuationRequest projectName={projectName} />
      <SellingCalculator inputs={selling} onInputs={onSelling} calculated={calculated} onCalculate={onCalculate} />
      {nextHome}
    </div>
  );
}
