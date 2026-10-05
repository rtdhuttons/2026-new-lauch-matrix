"use client";

// Step 1 of choosing a unit: bedroom type and an optional budget, with the
// rest under "More filters".

import type { Criterion } from "../lib/engine";
import { compactMoney } from "../lib/format";
import type { Preferences } from "../lib/recommend";
import { PURPOSE_WEIGHTS } from "../lib/recommend";
import { btnText, Disclosure } from "./ui";

const PRIORITIES: { id: Criterion; label: string }[] = [
  { id: "view", label: "Views" },
  { id: "quiet", label: "Quiet" },
  { id: "sun", label: "Less afternoon sun" },
  { id: "mrt", label: "Near the MRT" },
  { id: "resale", label: "Resale appeal" },
];

const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-display-normal text-sm font-semibold transition-colors ${
    active ? "border-canopy bg-canopy text-mist" : "border-canopy/20 bg-paper text-canopy hover:border-canopy/50"
  }`;

export interface UnitFilterState {
  floorBand: string;
  blockId: string;
}

export function UnitFilters({
  prefs,
  onPrefs,
  filters,
  onFilters,
  bedroomOptions,
  budgetMax,
  floorBands,
  blocks,
  matches,
  unitSearch,
  onClear,
}: {
  prefs: Preferences;
  onPrefs: (p: Preferences) => void;
  filters: UnitFilterState;
  onFilters: (f: UnitFilterState) => void;
  bedroomOptions: number[];
  /** The dearest priced unit, used for "Any budget". */
  budgetMax: number;
  floorBands: { id: string; label: string }[];
  blocks: { id: string; name: string }[];
  matches: number;
  unitSearch: React.ReactNode;
  onClear: () => void;
}) {
  // $1.5M to $6M in half-million steps.
  const budgets = Array.from({ length: 10 }, (_, i) => 1_500_000 + i * 500_000);
  const anyBudget = prefs.budget >= budgetMax;
  const base = PURPOSE_WEIGHTS[prefs.purpose];
  const extra = (filters.floorBand !== "any" ? 1 : 0) + (filters.blockId !== "any" ? 1 : 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-2xl bg-mist-deep/60 p-4 sm:p-5">
        <div>
          <p className="mb-2 font-display-normal text-sm font-semibold">Bedroom type</p>
          <div role="group" aria-label="Bedroom type" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={prefs.bedrooms === "any"} onClick={() => onPrefs({ ...prefs, bedrooms: "any" })} className={chip(prefs.bedrooms === "any")}>
              {prefs.bedrooms === "any" && <span aria-hidden="true">✓</span>}All
            </button>
            {bedroomOptions.map((b) => (
              <button key={b} type="button" aria-pressed={prefs.bedrooms === b} onClick={() => onPrefs({ ...prefs, bedrooms: b })} className={chip(prefs.bedrooms === b)}>
                {prefs.bedrooms === b && <span aria-hidden="true">✓</span>}
                {b} bedrooms
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          {budgetMax > 0 && (
            <label className="grid gap-1 font-display-normal text-sm">
              <span className="font-semibold">Budget (optional)</span>
              <select
                value={budgets.includes(prefs.budget) && !(anyBudget && prefs.budget === budgetMax) ? String(prefs.budget) : "any"}
                onChange={(e) => onPrefs({ ...prefs, budget: e.target.value === "any" ? budgetMax : Number(e.target.value) })}
                className="rounded-lg border border-canopy/25 bg-paper px-3 py-2"
              >
                <option value="any">Any budget</option>
                {budgets.map((b) => (
                  <option key={b} value={b}>
                    Up to {compactMoney(b)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="font-display-normal text-sm" aria-live="polite">
            <strong>{matches.toLocaleString("en-SG")}</strong> {matches === 1 ? "unit matches" : "units match"}
          </p>
        </div>
        {matches === 0 && (
          <p role="status" className="rounded-lg bg-[#fbe9e6] px-4 py-2.5 font-display-normal text-sm text-[#7a231b]">
            No units match these filters. Increase your budget or clear a filter.{" "}
            <button type="button" onClick={onClear} className="font-semibold underline underline-offset-4">Clear filters</button>
          </p>
        )}
      </div>

      <Disclosure title={`More filters${extra ? ` (${extra} on)` : ""}`} hint="Floor, block, unit number and what matters most">
        <div className="grid gap-5">
          <div role="group" aria-label="Floors">
            <p className="mb-2 font-display-normal text-sm font-semibold">Floors</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: "any", label: "Any floor" }, ...floorBands].map((b) => (
                <button key={b.id} type="button" aria-pressed={filters.floorBand === b.id} onClick={() => onFilters({ ...filters, floorBand: b.id })} className={chip(filters.floorBand === b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          {blocks.length > 1 && (
            <label className="grid max-w-xs gap-1 font-display-normal text-sm">
              <span className="font-semibold">Block</span>
              <select value={filters.blockId} onChange={(e) => onFilters({ ...filters, blockId: e.target.value })} className="rounded-lg border border-canopy/25 bg-paper px-3 py-2">
                <option value="any">All blocks</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <p className="mb-2 font-display-normal text-sm font-semibold">Find a unit number</p>
            {unitSearch}
          </div>
          <div role="group" aria-label="What matters most">
            <p className="mb-1 font-display-normal text-sm font-semibold">What matters most to you?</p>
            <p className="mb-2 text-xs text-canopy/65">Used for the suggested units below; doesn&apos;t hide any units.</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const on = prefs.weights[p.id] === 5;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPrefs({ ...prefs, weights: { ...prefs.weights, [p.id]: on ? base[p.id] : 5 } })}
                    className={chip(on)}
                  >
                    {on && <span aria-hidden="true">✓</span>}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={onClear} className={`${btnText} justify-self-start`}>Clear all filters</button>
        </div>
      </Disclosure>
    </div>
  );
}
