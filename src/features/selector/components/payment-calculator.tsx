"use client";

// Payment estimate. The buyer chooses a bedroom type, a model and a floor
// (or uses the unit selected above) to get its estimated price, then enters
// their own figures. Shows the full-loan monthly payment and the progressive
// payments due at each construction stage. Inputs stay while the buyer moves
// between tabs (they are not saved in the browser).

import type { PaymentsInfo, ProjectProfile } from "../model/project";
import type { PaymentInputs } from "../lib/payments";
import { DEFAULT_PAYMENT_INPUTS, estimatePayments, loanSchedule, PAYMENT_NOT_INCLUDED } from "../lib/payments";
import type { BuyerProfile } from "../lib/stamp-duty";
import { BUYER_PROFILES, STAMP_DUTY_SOURCE } from "../lib/stamp-duty";
import type { UnitModel } from "../lib/alternatives";
import type { ProgressiveResult } from "../lib/progressive";
import { progressivePayments, STANDARD_SCHEDULE, STANDARD_SCHEDULE_SOURCE } from "../lib/progressive";
import { BarChart, ChartCard, fmtMoney, fmtMoneyShort, LineChart, SERIES, SplitBar, TipRow } from "./charts";
import { money } from "../lib/format";
import { EstimateTag } from "./unit-summary";
import { btnSecondary, btnText, card, Disclosure } from "./ui";

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


export interface CalcPick {
  key: string;
  level: number;
}

const pillCls = (on: boolean) =>
  `rounded-full px-4 py-2 font-display-normal text-sm font-semibold ${on ? "bg-canopy text-mist" : "border border-canopy/20 bg-paper text-canopy/80"}`;

export function PaymentCalculator({
  models,
  pick,
  onPick,
  selected,
  inputs,
  onInputs,
  payments,
  profile,
}: {
  /** Every model (unit type and size) with its floors and prices. */
  models: UnitModel[];
  /** The visitor's own choice; null follows the unit selected elsewhere. */
  pick: CalcPick | null;
  onPick: (p: CalcPick | null) => void;
  /** The unit selected in Step 2, if any. */
  selected: (CalcPick & { label: string }) | null;
  inputs: PaymentInputs;
  onInputs: (p: PaymentInputs) => void;
  payments: PaymentsInfo;
  profile: ProjectProfile;
}) {
  if (models.length === 0) {
    return (
      <div className={`${card} p-5`}>
        <p className="font-display-normal font-semibold">Prices haven&apos;t been added for this project yet, so payments can&apos;t be estimated.</p>
      </div>
    );
  }
  const fallback = { key: models[0].key, level: models[0].levels[0].level };
  const current = [pick, selected, fallback].find((c) => c && models.some((m) => m.key === c.key && m.levels.some((l) => l.level === c.level)))!;
  const model = models.find((m) => m.key === current.key)!;
  const floor = model.levels.find((l) => l.level === current.level)!;
  const price = floor.price;
  const bedroomTypes = [...new Set(models.map((m) => m.bedrooms))];
  const modelsForBed = models.filter((m) => m.bedrooms === model.bedrooms);
  const choose = (m: UnitModel, level: number) => onPick({ key: m.key, level: m.levels.some((l) => l.level === level) ? level : m.levels[0].level });
  const followsSelected = selected && selected.key === current.key && selected.level === current.level;

  const set = (k: keyof PaymentInputs) => (v: number | null) => onInputs({ ...inputs, [k]: v });
  const r = estimatePayments(price, inputs);
  const prog = r.ok ? progressivePayments(price, { loanAmount: r.value.loanAmount, interestRatePct: inputs.interestRatePct!, loanYears: inputs.loanYears! }, payments.schedule ?? STANDARD_SCHEDULE) : null;

  return (
    <div className={`${card} p-0`}>
      {/* Choose the unit */}
      <div className="grid gap-4 border-b border-canopy/10 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display-normal text-base font-semibold">Choose the unit to estimate</p>
          <div className="flex flex-wrap gap-2">
            {selected && !followsSelected && (
              <button type="button" onClick={() => onPick(null)} className={btnText}>
                Use selected unit {selected.label}
              </button>
            )}
            <button type="button" onClick={() => onInputs(DEFAULT_PAYMENT_INPUTS)} className={btnSecondary}>
              Reset to 75% · 2% · 25 years
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-display-normal text-sm text-canopy/70">1. Bedroom type</p>
          <div role="group" aria-label="Bedroom type" className="flex flex-wrap gap-2">
            {bedroomTypes.map((b) => (
              <button key={b} type="button" aria-pressed={model.bedrooms === b} onClick={() => choose(models.find((m) => m.bedrooms === b)!, current.level)} className={pillCls(model.bedrooms === b)}>
                {b} bedrooms
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-display-normal text-sm text-canopy/70">2. Model</p>
          <div role="group" aria-label="Model" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modelsForBed.map((m) => {
              const on = m.key === model.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(m, current.level)}
                  className={`rounded-xl border px-4 py-3 text-left font-display-normal ${on ? "border-canopy bg-canopy text-mist" : "border-canopy/15 bg-paper hover:bg-mist"}`}
                >
                  <span className="block text-sm font-semibold">{m.type}</span>
                  <span className={`block text-xs ${on ? "text-mist/75" : "text-canopy/65"}`}>
                    {m.sizeSqft.toLocaleString("en-SG")} sq ft · levels {m.levels[0].level}–{m.levels[m.levels.length - 1].level}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="grid w-fit gap-1.5 font-display-normal text-sm">
          <span className="text-canopy/70">3. Floor level</span>
          <select
            value={current.level}
            onChange={(e) => onPick({ key: model.key, level: Number(e.target.value) })}
            className="w-44 rounded-lg border border-canopy/25 bg-paper px-3 py-2 text-base"
          >
            {model.levels.map((l) => (
              <option key={l.level} value={l.level}>
                Level {l.level}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The chosen unit's price, on its own row */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-canopy/10 bg-mist px-5 py-4">
        <div>
          <p className="font-display-normal text-sm text-canopy/70">
            {model.type} · level {current.level} · {model.sizeSqft.toLocaleString("en-SG")} sq ft
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-display text-3xl font-extrabold tabular-nums">
            {money(price)} {floor.isEstimate && <EstimateTag />}
          </p>
        </div>
        <p className="font-display-normal text-sm tabular-nums text-canopy/75">S${Math.round(price / model.sizeSqft).toLocaleString("en-SG")} per sq ft</p>
      </div>

      <div className="grid grid-cols-1 gap-8 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
        {/* Your figures */}
        <div className="grid grid-cols-1 content-start gap-5">
          <label className="grid gap-1.5 font-display-normal text-sm">
            <span className="font-semibold">Who is buying</span>
            <select value={inputs.buyer} onChange={(e) => onInputs({ ...inputs, buyer: e.target.value as BuyerProfile })} className="w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 text-base">
              {BUYER_PROFILES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-canopy/65">Sets the Additional Buyer&apos;s Stamp Duty.</span>
          </label>
          <Field
            id="pay-ltv"
            label="Loan-to-value (LTV)"
            help="75% is usual for a first housing loan; your bank confirms what you qualify for."
            value={inputs.ltvPct}
            onChange={set("ltvPct")}
            suffix="% of price"
            step={5}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-rate" label="Interest rate" help="Yearly rate from the bank." value={inputs.interestRatePct} onChange={set("interestRatePct")} suffix="% a year" step={0.05} />
            <Field id="pay-years" label="Loan period" help="Years to repay." value={inputs.loanYears} onChange={set("loanYears")} suffix="years" step={1} />
          </div>
        </div>

        {/* Results: one main figure, then a clear list */}
        <div aria-live="polite">
          {r.ok ? (
            <>
              <div className="rounded-2xl bg-canopy p-5 text-mist">
                <p className="font-display-normal text-sm text-mist/75">Monthly loan payment, once the full loan is drawn</p>
                <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-white">{money(Math.round(r.value.monthlyInstalment))}</p>
                <p className="font-display-normal text-base text-mist/85">a month</p>
                <p className="mt-2 text-xs text-mist/70">
                  {r.value.months} payments on a {money(r.value.loanAmount)} loan at {inputs.interestRatePct}% a year.
                </p>
              </div>
              <dl className="mt-4 grid font-display-normal text-[0.9375rem] tabular-nums">
                {[
                  ["Loan amount", `${money(r.value.loanAmount)}`, `${r.value.ltvPct}% of the price`],
                  ["Down payment", money(r.value.downPayment), `Cash or CPF; at least ${money(r.value.minCash)} in cash`],
                  ["Buyer's Stamp Duty", money(r.value.bsd), "IRAS rates"],
                  [`Additional Buyer's Stamp Duty (${Math.round(r.value.absdRate * 100)}%)`, money(r.value.absd), BUYER_PROFILES.find((b) => b.id === inputs.buyer)?.label ?? ""],
                ].map(([k, v, note]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-canopy/10 py-2.5">
                    <dt>
                      <span className="text-canopy/85">{k}</span>
                      <span className="block text-xs text-canopy/55">{note}</span>
                    </dt>
                    <dd className="shrink-0 font-semibold">{v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt>
                    <span className="font-semibold">Total needed before the loan starts</span>
                    <span className="block text-xs text-canopy/55">Down payment plus stamp duty, due within weeks of signing</span>
                  </dt>
                  <dd className="shrink-0 font-display text-xl font-extrabold">{money(r.value.upfront)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-canopy/10 py-2.5 text-sm">
                  <dt className="text-canopy/70">Total interest over the loan</dt>
                  <dd className="shrink-0">{money(Math.round(r.value.totalInterest))}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
                  <dt className="text-canopy/70">Maintenance fees and property tax</dt>
                  <dd className="shrink-0 text-canopy/60">{payments.maintenance ? "See below" : "Not added yet"}</dd>
                </div>
              </dl>
              <PaymentCharts price={r.value.price} down={r.value.downPayment} loan={r.value.loanAmount} rate={inputs.interestRatePct!} years={inputs.loanYears!} />
              <p className="mt-3 text-xs text-stone">
                Stamp duty: {STAMP_DUTY_SOURCE}. {floor.isEstimate ? "The price is an estimate, so every figure here is too." : ""}
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

      <ProgressiveSection prog={prog} payments={payments} profile={profile} />
    </div>
  );
}

/** Stage-by-stage payments as the building goes up (Normal Payment Scheme). */
function ProgressiveSection({ prog, payments, profile }: { prog: ProgressiveResult | null; payments: PaymentsInfo; profile: ProjectProfile }) {
  const completion = profile.expectedCompletion;
  const keysDate = completion ? new Date(`${completion.date}T00:00:00Z`).toLocaleDateString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
  const source = payments.schedule ? (payments.scheduleProvenance?.source ?? "The developer's payment schedule") : STANDARD_SCHEDULE_SOURCE;
  return (
    <section aria-labelledby="progressive-title" className="border-t border-canopy/10 p-5">
      <h4 id="progressive-title" className="font-display text-lg font-extrabold">Progressive payments as the building goes up</h4>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        A new launch is paid in stages. Your down payment (cash or CPF) pays the first stages, and the 5% booking fee is always cash; after that, the bank loan pays each stage,
        so your monthly loan payment rises as more of the loan is drawn.
        {keysDate ? ` Keys are expected at the Temporary Occupation Permit, around ${keysDate}.` : ""}
      </p>
      {!prog ? (
        <p className="mt-3 rounded-lg border border-dashed border-canopy/25 px-4 py-3 text-sm text-canopy/75">Enter an LTV, interest rate and loan period above to see the payment at each stage.</p>
      ) : !prog.ok ? (
        <ul className="mt-3 grid list-disc gap-1 rounded-lg border border-[#c9a45a] bg-[#fbf3df] px-4 py-3 pl-8 text-sm text-[#5c3f0c]">
          {prog.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
          <ChartCard title="Monthly loan payment after each stage" subtitle="Approximate: the amount drawn so far, repaid over the full loan period">
            <BarChart
              ariaLabel="Monthly loan payment after each construction stage"
              format={(n) => money(Math.round(n))}
              bars={prog.stages.map((s, i) => ({
                id: String(i),
                label: s.stage,
                sub: `${s.percent}% · ${fmtMoneyShort(s.amount)}`,
                value: s.monthly,
                color: s.loan > 0 ? SERIES[0] : "#c9d3cc",
                detail: <TipRow value={fmtMoneyShort(s.loanDrawn)} label="loan drawn so far" />,
              }))}
            />
          </ChartCard>
          <div className="relative overflow-x-auto rounded-xl border border-canopy/10">
            <table className="w-full min-w-[480px] border-collapse bg-paper font-display-normal text-sm tabular-nums">
              <caption className="sr-only">Payment at each stage, and how it is paid</caption>
              <thead>
                <tr className="bg-canopy text-left text-xs uppercase tracking-[0.06em] text-mist">
                  <th scope="col" className="px-3 py-2.5 font-semibold">Stage</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cash or CPF</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Bank loan</th>
                </tr>
              </thead>
              <tbody>
                {prog.stages.map((s, i) => (
                  <tr key={i} className="border-t border-canopy/10">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="font-semibold">{s.percent}%</span> {s.stage}
                    </th>
                    <td className="px-3 py-2 text-right font-semibold">{fmtMoney(s.amount)}</td>
                    <td className="px-3 py-2 text-right">
                      {s.own ? fmtMoney(s.own) : "—"}
                      {s.cashOnly && <span className="block text-xs text-canopy/60">cash only</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{s.loan ? fmtMoney(s.loan) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-canopy/25 font-semibold">
                  <th scope="row" className="px-3 py-2 text-left">Total</th>
                  <td className="px-3 py-2 text-right">{fmtMoney(prog.totals.own + prog.totals.loan)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(prog.totals.own)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(prog.totals.loan)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-stone">
        Stages: {source}.{payments.schedule ? "" : " Confirm against the project's sale and purchase agreement."} Stage dates depend on construction progress and
        aren&apos;t known yet. CPF can also go towards monthly loan payments.
      </p>
    </section>
  );
}

/** How the price is paid, and how the loan comes down over the years. */
function PaymentCharts({ price, down, loan, rate, years }: { price: number; down: number; loan: number; rate: number; years: number }) {
  const sched = loan > 0 ? loanSchedule(loan, rate, years) : [];
  const halfway = sched.find((p) => p.principalPaid >= loan / 2);
  return (
    <div className="mt-4 grid gap-4">
      <ChartCard title="How the price is paid" subtitle={`${money(price)} in total`}>
        <SplitBar
          ariaLabel="How the price is paid: down payment and bank loan"
          format={fmtMoney}
          segments={[
            { label: "Down payment (cash or CPF)", value: down, color: SERIES[1] },
            { label: "Bank loan", value: loan, color: SERIES[0] },
          ]}
        />
      </ChartCard>
      {sched.length > 1 && (
        <ChartCard
          title="Your loan over the years"
          subtitle={halfway ? `Half the loan is repaid after about ${halfway.year} years; interest is front-loaded.` : undefined}
          legend={[
            { label: "Loan still owed", color: SERIES[0] },
            { label: "Interest paid so far", color: SERIES[1], shape: "dashed" },
          ]}
          table={{
            caption: "Loan balance and interest paid by year",
            columns: ["Year", "Still owed", "Interest paid so far"],
            rows: sched.filter((p) => p.year % 5 === 0 || p.year === years).map((p) => [p.year, fmtMoney(p.balance), fmtMoney(p.interestPaid)]),
          }}
        >
          <LineChart
            ariaLabel="Loan balance and total interest paid, year by year"
            height={220}
            yFromZero
            xFormat={(x) => `Year ${x}`}
            yFormat={fmtMoneyShort}
            series={[
              { id: "bal", label: "still owed", color: SERIES[0], points: sched.map((p) => ({ x: p.year, y: p.balance })) },
              { id: "int", label: "interest paid so far", color: SERIES[1], dashed: true, endLabel: true, points: sched.map((p) => ({ x: p.year, y: p.interestPaid })) },
            ]}
          />
        </ChartCard>
      )}
    </div>
  );
}
