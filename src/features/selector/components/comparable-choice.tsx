"use client";

// The comparable project(s) TRM chose for a project's resale and rental
// records: why, a side-by-side of the facts, and whether the records are in yet.

import { useState } from "react";
import type { ComparableChoice as Choice } from "../model/project";
import { stillBuilding } from "../data/comparables/choice";
import { ComparableRecords } from "./comparable-records";
import { card } from "./ui";

const distance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const possessive = (s: string) => (s.endsWith("s") ? `${s}’` : `${s}’s`);
const year = (d: string | null) => (d ? d.slice(0, 4) : null);
const district = (d: string | null) => (d ? `District ${Number(d.replace(/\D/g, ""))}` : null);

export function ComparableChoice({ choice, projectName }: { choice: Choice; projectName: string }) {
  const names = choice.comparables.map((c) => c.name);
  const building = choice.comparables.filter((c) => stillBuilding(c, choice.asAt));
  const records = choice.records ?? [];
  const withRecords = choice.comparables.map((c, i) => ({ c, r: records[i] ?? null })).filter((x) => x.r);
  const [shown, setShown] = useState(0);
  const current = withRecords[Math.min(shown, withRecords.length - 1)];
  const rows: { trait: string; values: (string | null)[]; subject: string | null }[] = [
    { trait: "Distance from " + projectName, values: choice.comparables.map((c) => (c.km !== null ? distance(c.km) : null)), subject: "—" },
    { trait: "Address", values: choice.comparables.map((c) => c.address), subject: null },
    { trait: "District", values: choice.comparables.map((c) => district(c.district)), subject: district(choice.subject.district) },
    { trait: "Tenure", values: choice.comparables.map((c, i) => c.huttons?.tenure ?? records[i]?.tenure ?? null), subject: choice.subject.tenure },
    { trait: "Units", values: choice.comparables.map((c) => c.huttons?.totalUnits?.toLocaleString("en-SG") ?? null), subject: choice.subject.totalUnits?.toLocaleString("en-SG") ?? null },
    {
      trait: "Completion",
      values: choice.comparables.map((c) => (stillBuilding(c, choice.asAt) ? `Under construction${c.huttons?.completion ? ` (expected ${year(c.huttons.completion)})` : ""}` : year(c.huttons?.completion ?? null))),
      subject: choice.subject.completion ? `Expected ${year(choice.subject.completion)}` : null,
    },
  ];
  return (
    <section aria-labelledby="comparable-choice" className={`${card} p-5 sm:p-6`}>
      <p className="font-display-normal text-xs font-semibold uppercase tracking-[0.1em] text-[#9b3b1c]">
        {names.length > 1 ? "Comparable projects" : "Comparable project"} for resale and rental records
      </p>
      <h4 id="comparable-choice" className="mt-1 font-display text-xl font-extrabold">
        {names.join(" and ")}
      </h4>
      <h5 className="mt-3 font-display-normal font-semibold">Why it&apos;s comparable</h5>
      <p className="mt-1 max-w-[72ch] text-[0.9375rem] text-canopy/85">{choice.why}</p>

      {building.length > 0 && (
        <p className="mt-3 rounded-lg border-l-4 border-[#c88a12] bg-[#fbf5e8] px-3 py-2 text-sm">
          {building.map((c) => c.name).join(" and ")} {building.length > 1 ? "are" : "is"} still being built, so there are no completed resales yet: only
          sub-sales, where buyers resell before completion. A completed project nearby would add a longer record.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse font-display-normal text-sm">
          <caption className="sr-only">
            {names.join(" and ")} compared with {projectName}
          </caption>
          <thead>
            <tr className="border-b border-canopy/15 text-left text-xs uppercase tracking-[0.06em] text-canopy/65">
              <th scope="col" className="py-2 pr-3 font-semibold" />
              {names.map((n) => (
                <th key={n} scope="col" className="py-2 pr-3 font-semibold">
                  {n}
                </th>
              ))}
              <th scope="col" className="py-2 font-semibold">
                {projectName}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.trait} className="border-b border-canopy/10 align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-canopy/65">
                  {r.trait}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="py-2 pr-3">
                    {v ?? <span className="text-canopy/50">Not known yet</span>}
                  </td>
                ))}
                <td className="py-2">{r.subject ?? <span className="text-canopy/50">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && choice.recordsSource && (
        <div className="mt-6 border-t border-canopy/10 pt-5">
          <h5 className="font-display text-lg font-extrabold">What homes at {withRecords.length > 1 ? "these projects" : current.c.name} sell and rent for</h5>
          {withRecords.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Comparable project">
              {withRecords.map((x, i) => (
                <button
                  key={x.c.name}
                  type="button"
                  aria-pressed={current === x}
                  onClick={() => setShown(i)}
                  className={`rounded-full px-4 py-2 font-display-normal text-sm font-semibold ${current === x ? "bg-canopy text-mist" : "border border-canopy/20 bg-paper text-canopy/80"}`}
                >
                  {x.c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <ComparableRecords record={current.r!} fetched={choice.recordsSource.fetched} salesWindow={choice.recordsSource.salesWindow} />
          </div>
        </div>
      )}

      {!choice.recordsLoaded && (
        <p className="mt-4 text-sm text-canopy/80">
          <span className="font-semibold">Resale and rental records:</span> not loaded yet. {possessive(names.join(" and "))} past resales (with profit by floor) and
          rents will appear here once they are pulled from URA&apos;s Data Service.
        </p>
      )}
      <p className="mt-3 text-xs text-stone">
        Chosen by TRM{choice.trmNote ? ` (“${choice.trmNote.trim()}”)` : ""}. Profit counts and years built are TRM&apos;s own review of matched purchase and
        sale records. Distances are straight lines on OneMap to the comparable&apos;s nearest address point. Units and completion from the Huttons New Launch API
        where the project is listed there; tenure from Huttons or URA; checked {choice.asAt}.
      </p>
    </section>
  );
}
