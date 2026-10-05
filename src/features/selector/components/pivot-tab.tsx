"use client";

// PIVOT: TRM's five-segment assessment. Scores and reasons come from the
// project's own assessment; the entry-price and exit-benchmark workings
// reproduce TRM's e-book and every input can be changed. These are
// conditional estimates, never promised returns.

import { useState } from "react";
import type { PivotInfo } from "../model/project";
import { floorBand, FLOOR_BANDS } from "../lib/comparable";
import type { UnitModel } from "../lib/alternatives";
import { annualisedSpread, averageScore, entryPsfSteps, exitPsfSteps, exitProjection, PIVOT_CATEGORIES } from "../lib/pivot";
import { BarChart, ChartCard, LineChart, SERIES, Waterfall } from "./charts";
import { NotSupplied } from "./tabs";
import { EstimateTag } from "./unit-summary";
import { card, Disclosure } from "./ui";

const psf = (n: number) => `$${Math.round(n).toLocaleString("en-SG")} psf`;
const exact = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 1 })}`;

function NumberField({ id, label, value, onChange, step = 1, suffix }: { id: string; label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <label htmlFor={id} className="grid gap-1 font-display-normal text-sm">
      <span className="text-canopy/75">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-28 rounded-lg border border-canopy/20 bg-paper px-3 py-1.5 tabular-nums"
        />
        {suffix && <span className="text-canopy/70">{suffix}</span>}
      </span>
    </label>
  );
}

export interface PivotUnit {
  name: string;
  price: number | null;
  areaSqft: number | null;
  isEstimate: boolean;
  level: number;
}

export interface ExitEvidence {
  project: string;
  /** Floor and yearly return of each recorded resale. */
  resales: { floor: number; annualised: number }[];
  asAt: string;
}

export function PivotTab({
  pivot,
  projectName,
  unit,
  onChooseUnit,
  evidence,
  completionDate,
  photo,
  models,
  start,
}: {
  /** Unit models with floors and prices, for the exit projection. */
  models: UnitModel[];
  /** The selected unit's model and floor, to start the exit projection from. */
  start: { key: string; level: number } | null;
  /** A photo between the unit assessment and the PIVOT scores. */
  photo?: React.ReactNode;
  pivot: PivotInfo;
  projectName: string;
  unit: PivotUnit | null;
  onChooseUnit: () => void;
  /** Resale returns at a comparison project, for the exit projection. */
  evidence: ExitEvidence | null;
  /** Expected completion (ISO date), to mark the year around completion. */
  completionDate: string | null;
}) {
  const entry = pivot.entry;
  const [exit, setExit] = useState(pivot.exit);
  const avg = averageScore(pivot);

  if (!pivot.scores && !pivot.entry && !pivot.exit) {
    return (
      <div className="grid gap-6">
        <NotSupplied
          title={`A PIVOT assessment has not been added for ${projectName}.`}
          needed={["TRM's scores and reasons for the five segments.", "Land bid evidence for the entry-price working.", "An older nearby project's prices for the exit benchmark."]}
        />
      </div>
    );
  }

  const e = entry ? entryPsfSteps(entry) : null;
  const x = exit ? exitPsfSteps(exit) : null;

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      <UnitAssessment unit={unit} entry={e?.estimate ?? null} exit={x?.estimate ?? null} onChooseUnit={onChooseUnit} />

      {unit && unit.price !== null && unit.areaSqft && (e || x) && (
        <ChartCard
          title="Price per sq ft: entry, this unit and exit"
          subtitle={`${unit.name} against TRM's fair-entry estimate from the land bid and the exit benchmark at completion`}
          note={unit.isEstimate ? "This unit's price is an estimate, not the developer's price." : undefined}
        >
          <BarChart
            ariaLabel="Price per square foot: fair entry estimate, this unit and the exit benchmark"
            format={(n) => `$${Math.round(n).toLocaleString("en-SG")}`}
            bars={[
              ...(e ? [{ id: "entry", label: "Fair entry (land bid)", sub: "TRM estimate", value: e.estimate, color: SERIES[1] }] : []),
              { id: "unit", label: unit.name, sub: unit.isEstimate ? "estimated price" : "price", value: unit.price / unit.areaSqft, color: SERIES[0], emphasis: true },
              ...(x && exit ? [{ id: "exit", label: "Exit benchmark", sub: `at completion, from ${exit.comparable}`, value: x.estimate, color: SERIES[2] }] : []),
            ]}
          />
        </ChartCard>
      )}

      {evidence && models.length > 0 && <ExitOutcomes models={models} start={start} evidence={evidence} completionDate={completionDate} />}

      {photo}

      <p className="-mb-4 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        PIVOT is TRM&apos;s five-part way to judge whether {projectName} is worth buying. Scores and workings below are from TRM&apos;s PIVOT e-book; change
        any input to test it.
      </p>

      {pivot.scores && (
        <div className={`${card} p-0`}>
          <ol className="divide-y divide-canopy/10">
            {PIVOT_CATEGORIES.map((c) => {
              const s = pivot.scores!.find((x) => x.category === c.id);
              return (
                <li key={c.id} className="grid grid-cols-[3rem_1fr_auto] items-start gap-3 px-5 py-4 sm:px-6">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-canopy font-display text-lg font-extrabold text-[#ffbc36]">{c.letter}</span>
                  <div className="min-w-0">
                    <p className="font-display-normal font-semibold">
                      {c.name} <span className="font-normal text-canopy/65">· {c.subtitle}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-canopy/70">{c.question}</p>
                    {s && <p className="mt-1.5 text-[0.9375rem]">{s.reason}</p>}
                  </div>
                  <div className="w-16 text-right sm:w-24">
                    <p className="font-display text-xl font-extrabold tabular-nums">{s ? `${s.score}/10` : "—"}</p>
                    {s && (
                      <div aria-hidden="true" className="mt-1.5 flex h-2 w-full gap-[2px]">
                        {Array.from({ length: 10 }, (_, i) => (
                          <span key={i} className="h-full flex-1 rounded-[2px]" style={{ background: i < s.score ? SERIES[0] : "#dfe4dc" }} />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-canopy/10 bg-mist px-5 py-4 sm:px-6">
            <p className="font-display-normal font-semibold">
              Overall rating {pivot.overallStated !== null ? `${pivot.overallStated}/10` : "not stated"}
            </p>
            {avg !== null && pivot.overallStated !== null && Math.abs(avg - pivot.overallStated) > 0.05 && (
              <p className="text-sm text-[#8a5a14]">
                The five scores average {avg.toFixed(1)}. {pivot.overallMethod ?? "How the overall is worked out is still to be confirmed."}
              </p>
            )}
          </div>
          {pivot.provenance && <p className="border-t border-canopy/10 px-5 py-3 text-xs text-stone sm:px-6">Source: {pivot.provenance.source}.</p>}
        </div>
      )}

      {exit && x && (
        <section className={`${card} p-5 sm:p-6`} aria-labelledby="pivot-exit">
          <h3 id="pivot-exit" className="font-display text-lg font-extrabold">Timing of exit: a benchmark from {exit.comparable}</h3>
          <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
            An older nearby project&apos;s average price, grown by a yearly amount to {projectName}&apos;s completion, then adjusted because older projects
            counted more space (such as air-con ledges) before area harmonisation on 1 June 2023.
          </p>
          <div className="mt-4 flex flex-wrap gap-5">
            <NumberField id="pv-cpsf" label={`${exit.comparable} average`} value={exit.comparablePsf} onChange={(n) => setExit({ ...exit, comparablePsf: n })} suffix="$ psf" />
            <NumberField id="pv-cy" label={`${exit.comparable} completed`} value={exit.comparableCompletionYear} onChange={(n) => setExit({ ...exit, comparableCompletionYear: n })} />
            <NumberField id="pv-sy" label={`${projectName} completes`} value={exit.subjectCompletionYear} onChange={(n) => setExit({ ...exit, subjectCompletionYear: n })} />
            <NumberField id="pv-g" label="Growth a year" value={exit.growthPsfPerYear} onChange={(n) => setExit({ ...exit, growthPsfPerYear: n })} suffix="$ psf" />
            <NumberField id="pv-h" label="Harmonisation adjustment" value={Math.round(exit.harmonisationUplift * 1000) / 10} step={0.5} onChange={(n) => setExit({ ...exit, harmonisationUplift: n / 100 })} suffix="%" />
          </div>
          <div className="mt-4">
            <Waterfall
              ariaLabel="How the exit benchmark price per square foot builds up"
              height={230}
              format={(n) => `$${Math.round(n).toLocaleString("en-SG")}`}
              steps={[
                { label: `${exit.comparable} average`, value: exit.comparablePsf, kind: "total" },
                { label: `${x.years} years of growth`, value: x.growth, kind: "change" },
                { label: "Harmonisation", value: x.estimate - x.beforeUplift, kind: "change" },
                { label: "Exit benchmark", value: x.estimate, kind: "total" },
              ]}
            />
          </div>
          <ol className="mt-4 grid gap-1 font-display-normal text-[0.9375rem] tabular-nums">
            <li>{x.years} years × {exact(exit.growthPsfPerYear)} = {exact(x.growth)}</li>
            <li>{exact(exit.comparablePsf)} + {exact(x.growth)} = <strong>{exact(x.beforeUplift)}</strong></li>
            <li>× {(1 + exit.harmonisationUplift).toFixed(3).replace(/0+$/, "")} = <strong className="text-lg">{psf(x.estimate)}</strong> benchmark at completion</li>
          </ol>
          <p className="mt-2 text-sm text-stone">The e-book&apos;s figure: {psf(exit.statedPsf)}. A benchmark under these assumptions, not a forecast.</p>
        </section>
      )}

      <NotSupplied
        title="Break-even price, holding periods and selling scenarios aren't available yet."
        needed={[
          ...(pivot.overallMethod === null && pivot.overallStated !== null
            ? [`How the overall rating is worked out (stated ${pivot.overallStated}/10${avg !== null ? `; the five scores average ${avg.toFixed(1)}` : ""}).`]
            : []),
          "The purchase costs to include (buyer's stamp duty, legal fees) and financing assumptions, confirmed against current official rules.",
          "The holding periods and the downside, middle and upside selling prices you want to show.",
          "One worked example of how you assess a specific unit, to check the tool reproduces it.",
        ]}
      >
        Profit, outstanding loan, CPF refund and cash received on sale will be shown separately once these are confirmed.
      </NotSupplied>
    </div>
  );
}

/** The selected unit against the entry estimate and the exit benchmark. Conditional, gross figures only. */
function UnitAssessment({ unit, entry, exit, onChooseUnit }: { unit: PivotUnit | null; entry: number | null; exit: number | null; onChooseUnit: () => void }) {
  if (!unit || unit.price === null || unit.areaSqft === null) {
    return (
      <div className={`${card} p-5`}>
        <p className="font-display-normal font-semibold">Choose a unit to assess its entry price.</p>
        <button type="button" onClick={onChooseUnit} className="mt-2 font-display-normal text-sm font-semibold text-reservoir underline underline-offset-4">
          Choose a unit
        </button>
      </div>
    );
  }
  const unitPsf = unit.price / unit.areaSqft;
  const vsEntry = entry !== null ? unitPsf - entry : null;
  const atExit = exit !== null ? exit * unit.areaSqft : null;
  const gain = atExit !== null ? atExit - unit.price : null;
  return (
    <section aria-labelledby="pivot-unit" className="rounded-2xl bg-canopy p-5 text-mist sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="pivot-unit" className="font-display text-xl font-extrabold text-white">Assess this unit: {unit.name}</h3>
        {unit.isEstimate && <EstimateTag />}
      </div>
      <dl className="mt-4 grid gap-3 font-display-normal sm:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-4">
          <dt className="text-sm text-mist/75">Its price per sq ft</dt>
          <dd className="text-2xl font-extrabold tabular-nums text-white">{psf(unitPsf)}</dd>
          <dd className="text-xs text-mist/70">${unit.price.toLocaleString("en-SG")} ÷ {unit.areaSqft.toLocaleString("en-SG")} sq ft</dd>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <dt className="text-sm text-mist/75">Against the entry estimate</dt>
          <dd className="text-2xl font-extrabold tabular-nums text-white">{vsEntry !== null ? `${vsEntry >= 0 ? "+" : "−"}${psf(Math.abs(vsEntry))}` : "—"}</dd>
          <dd className="text-xs text-mist/70">{entry !== null ? `TRM's fair-entry estimate from the land bid: ${psf(entry)}.` : "No entry estimate."}</dd>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <dt className="text-sm text-mist/75">If sold at the exit benchmark</dt>
          <dd className="text-2xl font-extrabold tabular-nums text-white">{gain !== null ? `${gain >= 0 ? "+" : "−"}$${Math.round(Math.abs(gain)).toLocaleString("en-SG")}` : "—"}</dd>
          <dd className="text-xs text-mist/70">{exit !== null ? `At ${psf(exit)} on completion. Gross: before stamp duty, fees, loan repayment and CPF refund.` : "No exit benchmark."}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-mist/70">A scenario under the assumptions below, not a forecast or a guaranteed return.</p>
    </section>
  );
}

const pctText = (r: number) => `${(r * 100).toFixed(2)}%`;
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;

/** The unit's price grown at the comparison project's yearly returns, by year of sale. */
function ExitOutcomes({
  models,
  start,
  evidence,
  completionDate,
}: {
  models: UnitModel[];
  start: { key: string; level: number } | null;
  evidence: ExitEvidence;
  completionDate: string | null;
}) {
  const fallback = models.find((m) => m.bedrooms === 3) ?? models[0];
  const startModel = (start && models.find((m) => m.key === start.key)) || fallback;
  const [key, setKey] = useState(startModel?.key ?? "");
  const [level, setLevel] = useState(start && startModel?.key === start.key ? start.level : (startModel?.levels[0]?.level ?? 0));
  const [priceInput, setPriceInput] = useState<number | null>(null);
  const [rateInput, setRateInput] = useState<number | null>(null);
  const [basis, setBasis] = useState<"all" | "band">("all");
  // Read the clock once, so the year around completion stays stable between renders.
  const [now] = useState(() => Date.now());
  const model = models.find((m) => m.key === key) ?? fallback;
  if (!model) return null;
  const floor = model.levels.find((l) => l.level === level) ?? model.levels[0];
  const band = floorBand(floor.level);
  const bandInfo = FLOOR_BANDS.find((b) => b.id === band)!;
  const pool = basis === "all" ? evidence.resales : evidence.resales.filter((r) => floorBand(r.floor) === band);
  const spread = annualisedSpread(pool.map((r) => r.annualised));
  if (!spread) return null;
  const price = priceInput ?? floor.price;
  const rate = rateInput !== null ? rateInput / 100 : spread.median;
  // The lower and higher case keep the spread of past results around the chosen rate.
  const lowRate = rate - (spread.median - spread.q1);
  const highRate = rate + (spread.q3 - spread.median);
  const yearsToCompletion = completionDate ? (new Date(`${completionDate}T00:00:00Z`).getTime() - now) / (365.25 * 24 * 3600 * 1000) : null;
  const completionYear = yearsToCompletion !== null ? Math.max(1, Math.round(yearsToCompletion)) : null;
  const mid = exitProjection(price, rate);
  const low = exitProjection(price, lowRate);
  const high = exitProjection(price, highRate);
  const label = (y: number) => `+${y} years${completionYear === y ? " (around completion)" : ""}`;
  const bedrooms = [...new Set(models.map((m) => m.bedrooms))];
  const pick = (m: UnitModel, lv: number) => {
    setKey(m.key);
    setLevel(m.levels.some((l) => l.level === lv) ? lv : m.levels[0].level);
    setPriceInput(null);
  };
  const input = "w-full min-w-0 rounded-lg border border-canopy/25 bg-paper px-3 py-2 font-display-normal tabular-nums";

  return (
    <section aria-labelledby="exit-outcomes" className={`${card} p-5 sm:p-6`}>
      <h3 id="exit-outcomes" className="font-display text-lg font-extrabold">Exit outcomes by year of sale</h3>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        Choose a unit type and price, and a yearly growth rate. The default rate is the median yearly return owners made when they resold at {evidence.project}.
      </p>

      <div className="mt-4 grid gap-4 rounded-xl bg-mist p-4">
        <div role="group" aria-label="Bedroom type" className="flex flex-wrap gap-2">
          {bedrooms.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={model.bedrooms === b}
              onClick={() => pick(models.find((m) => m.bedrooms === b)!, floor.level)}
              className={`rounded-full px-4 py-1.5 font-display-normal text-sm font-semibold ${model.bedrooms === b ? "bg-canopy text-mist" : "border border-canopy/20 bg-paper text-canopy/80"}`}
            >
              {b} bedrooms
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <label className="grid gap-1 font-display-normal text-sm">
            <span className="text-canopy/70">Model</span>
            <select value={model.key} onChange={(e) => pick(models.find((m) => m.key === e.target.value)!, floor.level)} className={input}>
              {models
                .filter((m) => m.bedrooms === model.bedrooms)
                .map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.type} · {m.sizeSqft.toLocaleString("en-SG")} sq ft
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 font-display-normal text-sm">
            <span className="text-canopy/70">Floor level</span>
            <select
              value={floor.level}
              onChange={(e) => {
                setLevel(Number(e.target.value));
                setPriceInput(null);
              }}
              className={input}
            >
              {model.levels.map((l) => (
                <option key={l.level} value={l.level}>
                  Level {l.level}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 font-display-normal text-sm">
            <span className="text-canopy/70">Purchase price (S$)</span>
            <input type="number" inputMode="decimal" min={0} step={10000} value={Math.round(price)} onChange={(e) => setPriceInput(e.target.value === "" ? null : Number(e.target.value))} className={input} />
            <span className="text-xs text-canopy/60">{priceInput === null ? (floor.isEstimate ? "Estimated price; type your own to change it" : "Price list") : "Your price"}</span>
          </label>
          <label className="grid gap-1 font-display-normal text-sm">
            <span className="text-canopy/70">Yearly growth (%)</span>
            <input type="number" inputMode="decimal" step={0.1} value={Math.round(rate * 10000) / 100} onChange={(e) => setRateInput(e.target.value === "" ? null : Number(e.target.value))} className={input} />
            <span className="text-xs text-canopy/60">
              {rateInput === null ? `${evidence.project} median, ${spread.n} resales` : "Your rate"}
              {rateInput !== null && (
                <>
                  {" · "}
                  <button type="button" onClick={() => setRateInput(null)} className="font-semibold text-reservoir underline">
                    use median ({pctText(spread.median)})
                  </button>
                </>
              )}
            </span>
          </label>
        </div>
        <div role="group" aria-label="Which resales the default rate uses" className="inline-flex w-fit flex-wrap rounded-full border border-canopy/15 bg-paper p-1">
          {([
            ["all", `All ${evidence.project} resales`],
            ["band", `${bandInfo.label} floors only, like level ${floor.level}`],
          ] as const).map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={basis === id}
              onClick={() => setBasis(id)}
              className={`rounded-full px-4 py-1.5 font-display-normal text-sm font-semibold ${basis === id ? "bg-canopy text-mist" : "text-canopy/75"}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        {model.type}, level {floor.level}: {dollars(price)}
        {priceInput === null && floor.isEstimate ? " (an estimate)" : ""}, grown at <strong>{pctText(rate)} a year</strong>.
      </p>

      <div className="mt-4">
        <ChartCard
          title="Projected selling price by year of sale"
          legend={[
            { label: `Middle (${pctText(rate)} a year)`, color: SERIES[0] },
            { label: `Lower to higher case (${pctText(lowRate)}–${pctText(highRate)})`, color: SERIES[0], shape: "band" },
            { label: "Purchase price", color: "#6f7a71", shape: "dashed" },
          ]}
        >
          <LineChart
            ariaLabel="Projected selling price by year of sale, with a lower and higher case"
            height={240}
            xFormat={(y) => `+${y} yrs`}
            yFormat={(n) => `$${(n / 1_000_000).toFixed(2)}M`}
            band={{ lower: low.map((r) => ({ x: r.years, y: r.value })), upper: high.map((r) => ({ x: r.years, y: r.value })), color: SERIES[0], label: "lower to higher case" }}
            highlightX={completionYear ?? undefined}
            series={[
              { id: "mid", label: "middle case", color: SERIES[0], endLabel: true, points: mid.map((r) => ({ x: r.years, y: r.value })) },
              { id: "buy", label: "purchase price", color: "#6f7a71", dashed: true, points: mid.map((r) => ({ x: r.years, y: price })) },
            ]}
          />
        </ChartCard>
      </div>

      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
          <caption className="sr-only">Projected selling price and gross gain by year of sale</caption>
          <thead>
            <tr className="bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
              <th scope="col" className="px-3 py-2.5 font-semibold">Sell after</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Projected price</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Gain before costs</th>
            </tr>
          </thead>
          <tbody>
            {mid.map((r) => (
              <tr key={r.years} className="border-t border-canopy/10">
                <th scope="row" className="px-3 py-2.5 text-left font-semibold">{label(r.years)}</th>
                <td className="px-3 py-2.5 text-right">{dollars(r.value)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">+{dollars(r.gain)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Disclosure title="Show a lower and a higher case" hint={`${pctText(lowRate)} to ${pctText(highRate)} a year, the spread of ${evidence.project}'s middle half of resales`}>
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
              <caption className="sr-only">Lower, middle and higher case projected selling prices</caption>
              <thead>
                <tr className="text-left text-xs text-canopy/65">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Sell after</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Lower ({pctText(lowRate)})</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Middle ({pctText(rate)})</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Higher ({pctText(highRate)})</th>
                </tr>
              </thead>
              <tbody>
                {mid.map((r, i) => (
                  <tr key={r.years} className="border-t border-canopy/10">
                    <th scope="row" className="py-1.5 pr-3 text-left font-semibold">+{r.years} years</th>
                    <td className="py-1.5 pr-3 text-right">{dollars(low[i].value)}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{dollars(r.value)}</td>
                    <td className="py-1.5 text-right">{dollars(high[i].value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone">At the median rate, a quarter of {evidence.project}&apos;s resales did worse than the lower case, and a quarter did better than the higher case.</p>
        </Disclosure>
      </div>

      <p className="mt-3 text-xs text-stone">
        Gain before costs: projected price minus the purchase price, before stamp duty, legal fees, interest, loan repayment and CPF refund. Past returns at{" "}
        {evidence.project} (as at {evidence.asAt}) are a guide for a similar project, not a forecast for this unit.
        {completionYear !== null ? ` Years count from buying now; completion is expected in about ${completionYear} years.` : " Years count from buying now."}
      </p>
    </section>
  );
}

