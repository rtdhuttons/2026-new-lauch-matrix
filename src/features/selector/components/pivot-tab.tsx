"use client";

// PIVOT: TRM's five-segment assessment. Scores and reasons come from the
// project's own assessment; the entry-price and exit-benchmark workings
// reproduce TRM's e-book and every input can be changed. These are
// conditional estimates, never promised returns.

import { useState } from "react";
import type { PivotInfo } from "../model/project";
import { averageScore, entryPsfSteps, exitPsfSteps, PIVOT_CATEGORIES } from "../lib/pivot";
import { NotSupplied } from "./tabs";
import { card, SectionHeading } from "./ui";

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

export function PivotTab({ pivot, projectName, illustrativeAveragePsf }: { pivot: PivotInfo; projectName: string; illustrativeAveragePsf: number | null }) {
  const [entry, setEntry] = useState(pivot.entry);
  const [exit, setExit] = useState(pivot.exit);
  const avg = averageScore(pivot);

  if (!pivot.scores && !pivot.entry && !pivot.exit) {
    return (
      <div className="grid gap-6">
        <SectionHeading title="PIVOT" lede="TRM's five-segment assessment: Product mix, Investment entry, Value-add, Opportunity zone and Timing of exit." />
        <NotSupplied
          title={`PIVOT assessment for ${projectName}`}
          needed={["TRM's scores and reasons for the five segments.", "Land bid evidence for the entry-price working.", "An older nearby project's prices for the exit benchmark."]}
        />
      </div>
    );
  }

  const e = entry ? entryPsfSteps(entry) : null;
  const x = exit ? exitPsfSteps(exit) : null;

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      <SectionHeading
        title="PIVOT"
        lede={`TRM's five-segment way to judge whether ${projectName} is worth buying. Scores and workings are from TRM's PIVOT e-book; change any input to test it.`}
      />

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
                  <p className="font-display text-xl font-extrabold tabular-nums">{s ? `${s.score}/10` : "—"}</p>
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

      {entry && e && (
        <section className={`${card} p-5 sm:p-6`} aria-labelledby="pivot-entry">
          <h3 id="pivot-entry" className="font-display text-lg font-extrabold">Investment entry: a fair price from the land bid</h3>
          <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
            The land price is quoted per sq ft of the floor area the site may build (&quot;psf ppr&quot;). It is a cost to the developer, not a selling price. Adding
            construction, the developer&apos;s margin and a breakeven allowance gives an estimated selling price per sq ft.
          </p>
          <p className="mt-2 text-sm text-canopy/70">Land bid: ${entry.landPrice.toLocaleString("en-SG")}</p>
          <div className="mt-4 flex flex-wrap gap-5">
            <NumberField id="pv-land" label="Land, psf ppr" value={entry.landPsfPpr} onChange={(n) => setEntry({ ...entry, landPsfPpr: n })} suffix="$" />
            <NumberField id="pv-build" label="Construction and materials" value={entry.constructionPsf} onChange={(n) => setEntry({ ...entry, constructionPsf: n })} suffix="$ psf" />
            <NumberField id="pv-margin" label="Developer margin" value={Math.round(entry.profitMargin * 1000) / 10} step={0.5} onChange={(n) => setEntry({ ...entry, profitMargin: n / 100 })} suffix="%" />
            <NumberField id="pv-be" label="Breakeven allowance" value={Math.round(entry.breakevenUplift * 1000) / 10} step={0.5} onChange={(n) => setEntry({ ...entry, breakevenUplift: n / 100 })} suffix="%" />
          </div>
          <ol className="mt-4 grid gap-1 font-display-normal text-[0.9375rem] tabular-nums">
            <li>{exact(entry.landPsfPpr)} + {exact(entry.constructionPsf)} = <strong>{exact(e.cost)}</strong></li>
            <li>× {(1 + entry.profitMargin).toFixed(3).replace(/0+$/, "")} margin = <strong>{exact(Math.round(e.withMargin * 10) / 10)}</strong></li>
            <li>× {(1 + entry.breakevenUplift).toFixed(3).replace(/0+$/, "")} breakeven = <strong className="text-lg">{psf(e.estimate)}</strong> estimated selling price</li>
          </ol>
          <p className="mt-2 text-sm text-stone">
            The e-book&apos;s figure: {psf(entry.statedPsf)}.
            {illustrativeAveragePsf !== null && ` The illustrative prices on this site currently average ${psf(illustrativeAveragePsf)}; both are estimates, not the developer's price.`}
          </p>
        </section>
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
          <ol className="mt-4 grid gap-1 font-display-normal text-[0.9375rem] tabular-nums">
            <li>{x.years} years × {exact(exit.growthPsfPerYear)} = {exact(x.growth)}</li>
            <li>{exact(exit.comparablePsf)} + {exact(x.growth)} = <strong>{exact(x.beforeUplift)}</strong></li>
            <li>× {(1 + exit.harmonisationUplift).toFixed(3).replace(/0+$/, "")} = <strong className="text-lg">{psf(x.estimate)}</strong> benchmark at completion</li>
          </ol>
          <p className="mt-2 text-sm text-stone">The e-book&apos;s figure: {psf(exit.statedPsf)}. A benchmark under these assumptions, not a forecast.</p>
        </section>
      )}

      <NotSupplied
        title="Break-even price, holding periods and selling scenarios"
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
