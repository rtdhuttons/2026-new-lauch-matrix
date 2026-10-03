"use client";

// Explains the exit appeal score for the selected home: its three parts,
// what each means and what it can't tell you. It is a guide to how easy a
// home may be to resell against similar homes, not a profit forecast.

import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { card } from "./ui";

export function ExitAppeal({ engine, unit }: { engine: Engine; unit: Unit | null }) {
  const ix = engine.ix;
  const r = unit ? engine.assess(unit).resale : null;
  const total = ix.ds.units.length;
  const competition = r?.known ? 50 * (1 - r.similarCount / Math.max(1, total - 1)) : null;
  const traits = r?.known ? Math.min(20, r.distinctive.length * 10) : null;

  return (
    <div className={`${card} p-5 sm:p-6`}>
      <h3 className="font-display text-lg font-extrabold">Exit appeal score</h3>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/80">
        A score out of 100 for how a unit may stand out when you sell, against the similar units a buyer could choose instead. It is not a forecast of
        profit or price.
      </p>

      {unit && r ? (
        <div className="mt-4">
          <p className="font-display-normal text-sm text-canopy/70">{unitLabel(ix, unit)}</p>
          {r.known && r.score !== null ? (
            <>
              <p className="font-display text-3xl font-extrabold tabular-nums">{r.score}<span className="text-lg text-canopy/60">/100</span></p>
              <dl className="mt-3 grid gap-2 font-display-normal text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-mist p-3">
                  <dt className="text-canopy/70">Less competition (up to 50)</dt>
                  <dd className="text-lg font-semibold tabular-nums">{competition!.toFixed(0)}</dd>
                  <dd className="text-xs text-stone">{r.similarCount.toLocaleString("en-SG")} similar units in the project</dd>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <dt className="text-canopy/70">Floor band record (up to 30)</dt>
                  <dd className="text-lg font-semibold tabular-nums">{r.floorEvidence ? r.floorEvidence.points : "—"}</dd>
                  <dd className="text-xs text-stone">
                    {r.floorEvidence ? `${r.floorEvidence.band.label} floors at ${r.floorEvidence.project}: ${(r.floorEvidence.band.annualised * 100).toFixed(2)}% a year` : "No comparison project"}
                  </dd>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <dt className="text-canopy/70">Distinctive features (up to 20)</dt>
                  <dd className="text-lg font-semibold tabular-nums">{traits}</dd>
                  <dd className="text-xs text-stone">{r.distinctive.length > 0 ? r.distinctive.join("; ") : "None found"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-2 text-canopy/80">Not scored: this unit&apos;s type or size isn&apos;t known yet.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-canopy/80">Choose a unit to see its score.</p>
      )}

      <h4 className="mt-5 font-display-normal text-base font-semibold">Limitations</h4>
      <ul className="mt-1 grid list-disc gap-1 pl-5 text-[0.9375rem] text-canopy/80">
        <li>Similar units are potential competition; it doesn&apos;t mean their owners will sell at the same time as you.</li>
        <li>The floor band points come from another development&apos;s past resales, which may not repeat here.</li>
        <li>Demand, interest rates, future supply and the unit&apos;s condition are not in the score.</li>
      </ul>
    </div>
  );
}
