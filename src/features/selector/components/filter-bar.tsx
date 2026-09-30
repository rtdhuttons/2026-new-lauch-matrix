"use client";

import { useState } from "react";
import type { Criterion } from "../lib/engine";
import { compactMoney } from "../lib/format";
import type { Preferences } from "../lib/recommend";
import { PURPOSE_WEIGHTS } from "../lib/recommend";

const PRIORITIES: { id: Criterion; label: string }[] = [
  { id: "view", label: "Views" },
  { id: "quiet", label: "Quiet" },
  { id: "sun", label: "Less afternoon sun" },
  { id: "mrt", label: "Near the MRT" },
  { id: "resale", label: "Resale appeal" },
];

const chip = (active: boolean) =>
  `rounded-full border px-4 py-2 font-display-normal text-sm font-medium transition-colors ${
    active ? "border-canopy bg-canopy text-mist" : "border-canopy/15 bg-paper text-canopy hover:border-canopy/40"
  }`;

/** The few choices most buyers start with: bedrooms or budget, and what matters most. */
export function FilterBar({
  prefs,
  onChange,
  bedroomOptions,
  budgetMax,
  matches,
  unitSearch,
}: {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
  bedroomOptions: number[];
  /** The dearest priced home, used for "Any budget". */
  budgetMax: number;
  matches: number;
  unitSearch: React.ReactNode;
}) {
  const [by, setBy] = useState<"bedroom" | "budget">("bedroom");
  const budgets = [2_000_000, 2_500_000, 3_000_000, 4_000_000].filter((b) => b < budgetMax);
  const anyBudget = prefs.budget >= budgetMax;
  const base = PURPOSE_WEIGHTS[prefs.purpose];

  return (
    <div className="grid gap-4 rounded-2xl bg-mist-deep/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Find homes by" className="flex rounded-full border border-canopy/10 bg-paper p-1">
          {(["bedroom", "budget"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={by === b}
              onClick={() => setBy(b)}
              className={`rounded-full px-4 py-1.5 font-display-normal text-sm font-semibold ${by === b ? "bg-canopy text-mist" : "text-canopy/75"}`}
            >
              By {b}
            </button>
          ))}
        </div>

        {by === "bedroom" ? (
          <div role="group" aria-label="Bedrooms" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={prefs.bedrooms === "any"} onClick={() => onChange({ ...prefs, bedrooms: "any" })} className={chip(prefs.bedrooms === "any")}>
              All
            </button>
            {bedroomOptions.map((b) => (
              <button key={b} type="button" aria-pressed={prefs.bedrooms === b} onClick={() => onChange({ ...prefs, bedrooms: b })} className={chip(prefs.bedrooms === b)}>
                {b} bedroom
              </button>
            ))}
          </div>
        ) : (
          <div role="group" aria-label="Budget" className="flex flex-wrap gap-2">
            {budgets.map((b) => (
              <button key={b} type="button" aria-pressed={!anyBudget && prefs.budget === b} onClick={() => onChange({ ...prefs, budget: b })} className={chip(!anyBudget && prefs.budget === b)}>
                Up to {compactMoney(b)}
              </button>
            ))}
            <button type="button" aria-pressed={anyBudget} onClick={() => onChange({ ...prefs, budget: budgetMax })} className={chip(anyBudget)}>
              Any budget
            </button>
          </div>
        )}

        <div className="ml-auto">{unitSearch}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-display-normal text-sm font-medium text-canopy/80">What matters most to you?</span>
        {PRIORITIES.map((p) => {
          const on = prefs.weights[p.id] === 5;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...prefs, weights: { ...prefs.weights, [p.id]: on ? base[p.id] : 5 } })}
              className={chip(on)}
            >
              {p.label}
            </button>
          );
        })}
        <span className="ml-auto font-display-normal text-sm text-canopy/75" aria-live="polite">
          {matches.toLocaleString("en-SG")} homes match
        </span>
      </div>
    </div>
  );
}
