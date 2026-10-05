"use client";

// PIVOT: TRM's five-segment assessment. Scores and reasons come from the
// project's own assessment; the entry-price working reproduces TRM's e-book.
// The exit strategy grows the purchase price at a yearly rate (CAGR), by
// default the average at the comparison project. Every input can be
// changed. These are conditional estimates, never promised returns.

import { useState } from "react";
import type { PivotInfo } from "../model/project";
import { floorBand, FLOOR_BANDS } from "../lib/comparable";
import type { UnitModel } from "../lib/alternatives";
import { annualisedSpread, averageScore, entryPsfSteps, exitProjection, PIVOT_CATEGORIES } from "../lib/pivot";
import { BarChart, ChartCard, LineChart, SERIES } from "./charts";
import { NotSupplied } from "./tabs";
import { EstimateTag } from "./unit-summary";
import { card, Disclosure } from "./ui";
import { AmountInput } from "./amount-input";

const psf = (n: number) => `$${Math.round(n).toLocaleString("en-SG")} psf`;
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
  const avg = averageScore(pivot);
  // Exit strategy: the yearly growth rate (CAGR). Default: the comparison project's average.
  const spread = evidence ? annualisedSpread(evidence.resales.map((r) => r.annualised)) : null;
  const [cagrInput, setCagrInput] = useState<number | null>(null);
  const cagr = cagrInput !== null ? cagrInput / 100 : (spread?.mean ?? null);

  if (!pivot.scores && !pivot.entry && !evidence) {
    return (
      <div className="grid gap-6">
        <NotSupplied
          title={`A PIVOT assessment has not been added for ${projectName}.`}
          needed={["TRM's scores and reasons for the five segments.", "Land bid evidence for the entry-price working.", "Resale records from a comparable project, for the exit projection."]}
        />
      </div>
    );
  }

  const e = entry ? entryPsfSteps(entry) : null;

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      <UnitAssessment
        unit={unit}
        entry={e?.estimate ?? null}
        cagr={cagr}
        cagrNote={cagrInput === null && evidence && spread ? `${evidence.project} average` : "your rate"}
        onChooseUnit={onChooseUnit}
      />

      {unit && unit.price !== null && unit.areaSqft && e && (
        <ChartCard
          title="Price per sq ft: fair entry and this unit"
          subtitle={`${unit.name} against TRM's fair-entry estimate from the land bid`}
          note={unit.isEstimate ? "This unit's price is an estimate, not the developer's price." : undefined}
        >
          <BarChart
            ariaLabel="Price per square foot: fair entry estimate and this unit"
            format={(n) => `$${Math.round(n).toLocaleString("en-SG")}`}
            bars={[
              ...(e ? [{ id: "entry", label: "Fair entry (land bid)", sub: "TRM estimate", value: e.estimate, color: SERIES[1] }] : []),
              { id: "unit", label: unit.name, sub: unit.isEstimate ? "estimated price" : "price", value: unit.price / unit.areaSqft, color: SERIES[0], emphasis: true },
            ]}
          />
        </ChartCard>
      )}

      {evidence && spread && cagr !== null && models.length > 0 && (
        <ExitOutcomes
          models={models}
          start={start}
          evidence={evidence}
          spread={spread}
          rate={cagr}
          isDefault={cagrInput === null}
          onRate={setCagrInput}
          completionDate={completionDate}
        />
      )}

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

      <NotSupplied
        title="Break-even price and net selling scenarios aren't available yet."
        needed={[
          ...(pivot.overallMethod === null && pivot.overallStated !== null
            ? [`How the overall rating is worked out (stated ${pivot.overallStated}/10${avg !== null ? `; the five scores average ${avg.toFixed(1)}` : ""}).`]
            : []),
          "The purchase costs to include (buyer's stamp duty, legal fees) and financing assumptions, confirmed against current official rules.",
          "One worked example of how you assess a specific unit, to check the tool reproduces it.",
        ]}
      >
        Profit, outstanding loan, CPF refund and cash received on sale will be shown separately once these are confirmed.
      </NotSupplied>
    </div>
  );
}

/** The selected unit against the entry estimate, and sold after a few years at the chosen CAGR. Conditional, gross figures only. */
function UnitAssessment({
  unit,
  entry,
  cagr,
  cagrNote,
  onChooseUnit,
}: {
  unit: PivotUnit | null;
  entry: number | null;
  cagr: number | null;
  cagrNote: string;
  onChooseUnit: () => void;
}) {
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
  const atExit = cagr !== null ? exitProjection(unit.price, cagr, [SAMPLE_YEARS])[0] : null;
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
          <dt className="text-sm text-mist/75">If sold after {SAMPLE_YEARS} years</dt>
          <dd className="text-2xl font-extrabold tabular-nums text-white">{atExit ? dollars(atExit.value) : "—"}</dd>
          <dd className="text-xs text-mist/70">
            {atExit && cagr !== null
              ? `+${dollars(atExit.gain)} at ${pctText(cagr)} a year (${cagrNote}). Before stamp duty, fees, loan repayment and CPF refund.`
              : "No growth rate."}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-mist/70">A scenario under the assumptions below, not a forecast or a guaranteed return. Change the yearly growth rate under Exit strategy.</p>
    </section>
  );
}

const pctText = (r: number) => `${(r * 100).toFixed(2)}%`;
/** The holding period used for the one-line example at the top. */
const SAMPLE_YEARS = 5;
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;

/** Exit strategy: the unit's price grown at a yearly rate (CAGR), by year of sale. */
function ExitOutcomes({
  models,
  start,
  evidence,
  spread,
  rate,
  isDefault,
  onRate,
  completionDate,
}: {
  models: UnitModel[];
  start: { key: string; level: number } | null;
  evidence: ExitEvidence;
  /** Spread of the comparison project's yearly returns (all resales). */
  spread: { q1: number; median: number; q3: number; mean: number; n: number };
  /** Yearly growth rate (CAGR) in use, e.g. 0.054. */
  rate: number;
  isDefault: boolean;
  onRate: (percent: number | null) => void;
  completionDate: string | null;
}) {
  const fallback = models.find((m) => m.bedrooms === 3) ?? models[0];
  const startModel = (start && models.find((m) => m.key === start.key)) || fallback;
  const [key, setKey] = useState(startModel?.key ?? "");
  const [level, setLevel] = useState(start && startModel?.key === start.key ? start.level : (startModel?.levels[0]?.level ?? 0));
  const [priceInput, setPriceInput] = useState<number | null>(null);
  // Read the clock once, so the year around completion stays stable between renders.
  const [now] = useState(() => Date.now());
  const model = models.find((m) => m.key === key) ?? fallback;
  if (!model) return null;
  const floor = model.levels.find((l) => l.level === level) ?? model.levels[0];
  const band = floorBand(floor.level);
  // The comparison project's average by floor band, as reference rates.
  const bands = FLOOR_BANDS.map((b) => {
    const s = annualisedSpread(evidence.resales.filter((r) => floorBand(r.floor) === b.id).map((r) => r.annualised));
    return s ? { ...b, mean: s.mean, n: s.n } : null;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
  const price = priceInput ?? floor.price;
  // The lower and higher case keep the spread of past results around the chosen rate.
  const lowRate = rate - (spread.median - spread.q1);
  const highRate = rate + (spread.q3 - spread.median);
  const yearsToCompletion = completionDate ? (new Date(`${completionDate}T00:00:00Z`).getTime() - now) / (365.25 * 24 * 3600 * 1000) : null;
  const completionYear = yearsToCompletion !== null ? Math.max(1, Math.round(yearsToCompletion)) : null;
  const mid = exitProjection(price, rate);
  const sample = exitProjection(price, rate, [SAMPLE_YEARS])[0];
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
      <h3 id="exit-outcomes" className="font-display text-lg font-extrabold">Exit strategy: selling price by year of sale</h3>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        Your purchase price grown each year at a compound annual growth rate (CAGR). The starting rate is the average CAGR owners made when they resold at{" "}
        {evidence.project}: <strong>{pctText(spread.mean)} a year</strong> across {spread.n} resales. Change the price or the rate to test your own.
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
            <AmountInput value={price} onChange={setPriceInput} className={input} />
            <span className="text-xs text-canopy/60">{priceInput === null ? (floor.isEstimate ? "Estimated price; type your own to change it" : "Price list") : "Your price"}</span>
          </label>
          <label className="grid gap-1 font-display-normal text-sm">
            <span className="text-canopy/70">CAGR (% a year)</span>
            <input type="number" inputMode="decimal" step={0.1} value={Math.round(rate * 10000) / 100} onChange={(e) => onRate(e.target.value === "" ? null : Number(e.target.value))} className={input} />
            <span className="text-xs text-canopy/60">
              {isDefault ? `${evidence.project} average, ${spread.n} resales` : "Your rate"}
              {!isDefault && (
                <>
                  {" · "}
                  <button type="button" onClick={() => onRate(null)} className="font-semibold text-reservoir underline">
                    use average ({pctText(spread.mean)})
                  </button>
                </>
              )}
            </span>
          </label>
        </div>
        {bands.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 font-display-normal text-sm">
            <span className="text-canopy/70">{evidence.project} average by floor:</span>
            {bands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onRate(Math.round(b.mean * 10000) / 100)}
                aria-label={`Use ${b.label.toLowerCase()} floors' average, ${pctText(b.mean)} a year`}
                className={`rounded-full border px-3 py-1 tabular-nums ${b.id === band ? "border-canopy/40 bg-paper font-semibold" : "border-canopy/15 bg-paper/60 text-canopy/80"}`}
              >
                {b.label} {pctText(b.mean)}
              </button>
            ))}
            <span className="text-xs text-canopy/60">Tap one to use it. Level {floor.level} is {FLOOR_BANDS.find((b) => b.id === band)!.label.toLowerCase()}.</span>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-canopy/10 p-4 font-display-normal">
        <p className="text-sm text-canopy/70">
          {model.type}, level {floor.level}
          {priceInput === null && floor.isEstimate ? " (estimated price)" : ""}, sold after {SAMPLE_YEARS} years
        </p>
        <p className="mt-1 text-[0.9375rem] tabular-nums">
          {dollars(price)} × (1 + {pctText(rate)})<sup>{SAMPLE_YEARS}</sup> = <strong className="text-xl">{dollars(sample.value)}</strong>
        </p>
        <p className="text-[0.9375rem] tabular-nums">
          Gain before costs: <strong>+{dollars(sample.gain)}</strong>
        </p>
        <p className="mt-2 text-xs text-stone">For example, $2,000,000 at 5% a year: $2,000,000 × 1.05<sup>5</sup> = $2,552,563 after 5 years, a gain of $552,563.</p>
      </div>

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
        <Disclosure title="Show a lower and a higher case" hint={`${pctText(lowRate)} to ${pctText(highRate)} a year, from the spread of ${evidence.project}'s middle half of resales`}>
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
          <p className="mt-2 text-xs text-stone">
            The lower and higher case sit as far from your rate as a quarter of {evidence.project}&apos;s resales sat below and above its median ({pctText(spread.q1)} and{" "}
            {pctText(spread.q3)} a year).
          </p>
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

