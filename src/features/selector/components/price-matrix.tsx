"use client";

import { useMemo } from "react";
import type { Dataset } from "../model/types";
import type { PriceEstimate } from "../lib/estimate";
import { averagePsf, estimatedPsf, lowestHomeLevel } from "../lib/estimate";
import { layoutLookup } from "../lib/dataset-index";
import { BEDROOM_COLOURS } from "./ui";

interface Column {
  key: string;
  name: string;
  bedrooms: number | null;
  areaSqft: number;
}

interface Cell {
  homes: number;
  pes: boolean;
}

/** Corner triangle marking cells that include homes with a private enclosed space. */
const PES_MARK = { borderTop: "8px solid #10291c", borderRight: "8px solid transparent" } as const;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;
/** A bedroom colour as a light cell tint (hex with alpha). */
const tint = (bedrooms: number | null, alpha: string) => (bedrooms ? `${BEDROOM_COLOURS[bedrooms]}${alpha}` : "transparent");

function build(ds: Dataset) {
  const layoutOf = layoutLookup(ds);
  const columns = new Map<string, Column>();
  const cells = new Map<string, Cell>(); // `${level}|${column}`
  for (const u of ds.units) {
    const l = layoutOf(u);
    if (!l || l.areaSqft === null) continue;
    const key = `${l.category ?? l.name}|${l.areaSqft}`;
    if (!columns.has(key)) columns.set(key, { key, name: l.category ?? l.name, bedrooms: l.bedrooms, areaSqft: l.areaSqft });
    const ck = `${u.level}|${key}`;
    const c = cells.get(ck) ?? { homes: 0, pes: false };
    c.homes += 1;
    if (u.typeCode && /p( |$|\()/.test(u.typeCode)) c.pes = true;
    cells.set(ck, c);
  }
  const lowest = lowestHomeLevel(ds);
  const top = Math.max(...ds.blocks.map((b) => b.storeys));
  const levels: number[] = [];
  for (let l = top; l >= lowest; l--) levels.push(l);
  return { columns: [...columns.values()].sort((a, b) => a.areaSqft - b.areaSqft), cells, levels, lowest };
}

/** Every level with its PSF and the price of each unit type found on it. */
export function PriceMatrix({
  base,
  estimate,
  bedrooms = "any",
}: {
  base: Dataset;
  estimate: PriceEstimate;
  /** Show only unit types with this many bedrooms. */
  bedrooms?: number | "any";
}) {
  const built = useMemo(() => build(base), [base]);
  const { cells, lowest } = built;
  const columns = built.columns.filter((c) => bedrooms === "any" || c.bedrooms === bedrooms);
  // Keep only levels where a shown type has homes.
  const levels = built.levels.filter((l) => columns.some((c) => cells.has(`${l}|${c.key}`)));
  const avg = averagePsf(base, estimate);
  const avgLevel = levels.reduce((best, l) =>
    Math.abs(estimatedPsf(l, estimate, lowest) - avg) < Math.abs(estimatedPsf(best, estimate, lowest) - avg) ? l : best,
  );

  return (
    <div>
      <div className="relative max-h-[70vh] overflow-auto rounded-lg border border-canopy/10" tabIndex={0} aria-label="Price by level and unit type, scrollable">
        <table className="w-max min-w-full border-separate border-spacing-0 font-display-normal text-sm tabular-nums">
          <caption className="sr-only">
            Illustrative price of each unit type at every level. Blank cells: that type has no units on that floor.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-30 border-b border-canopy/15 bg-paper px-3 py-2 text-left align-bottom font-semibold">
                Level
              </th>
              <th scope="col" className="sticky left-[3.5rem] top-0 z-30 border-b border-r border-canopy/15 bg-paper px-3 py-2 text-right align-bottom font-semibold">
                PSF
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="sticky top-0 z-20 min-w-[8.5rem] border-b border-canopy/15 bg-paper px-3 pb-2 pt-0 text-right align-bottom font-semibold"
                >
                  <span aria-hidden="true" className="mb-2 block h-1 rounded-b" style={{ background: tint(c.bedrooms, "") }} />
                  <span className="block leading-tight">{c.name}</span>
                  <span className="block text-[0.75rem] font-normal text-stone">{c.areaSqft.toLocaleString("en-SG")} sq ft</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => {
              const psf = estimatedPsf(level, estimate, lowest);
              const isAvg = level === avgLevel;
              return (
                <tr key={level}>
                  <th scope="row" className="sticky left-0 z-10 w-14 border-b border-canopy/10 bg-paper px-3 py-2 text-left font-semibold">
                    {level}
                  </th>
                  <td className="sticky left-[3.5rem] z-10 border-b border-r border-canopy/10 bg-paper px-3 py-2 text-right text-canopy/85">
                    <span className="inline-flex items-center gap-1.5">
                      {isAvg && (
                        <span className="rounded bg-canopy px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-mist" title="Closest level to the average PSF">
                          Avg
                        </span>
                      )}
                      {money(psf)}
                    </span>
                  </td>
                  {columns.map((c) => {
                    const cell = cells.get(`${level}|${c.key}`);
                    if (!cell) return <td key={c.key} className="border-b border-canopy/[0.06]" />;
                    return (
                      <td
                        key={c.key}
                        className="relative border-b border-white/70 px-3 py-2 text-right font-semibold text-canopy"
                        style={{ background: tint(c.bedrooms, "24") }}
                        title={`${cell.homes} ${cell.homes === 1 ? "unit" : "units"}${cell.pes ? ", including units with a private enclosed space" : ""}`}
                      >
                        {cell.pes && (
                          <span aria-hidden="true" className="absolute left-0 top-0 size-0" style={PES_MARK} />
                        )}
                        {money(Math.round((psf * c.areaSqft) / 1000) * 1000)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-display-normal text-[0.8125rem] text-canopy/80">
        <li className="flex items-center gap-1.5">
          <span className="rounded bg-canopy px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-mist">Avg</span>
          Level closest to the average of {money(avg)} psf across all {base.units.length.toLocaleString("en-SG")} units
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-0" style={PES_MARK} />
          Includes units with a private enclosed space (PES)
        </li>
        <li>Blank: no units of that type on that floor. Hover a price to see how many units it covers.</li>
      </ul>
    </div>
  );
}
