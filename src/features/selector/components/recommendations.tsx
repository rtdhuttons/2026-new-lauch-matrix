"use client";

import type { Unit } from "../model/types";
import { VIEW_CATEGORY_LABEL } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import type { Recommendation } from "../lib/recommend";
import { APPRECIATION_NOTE } from "../lib/recommend";
import { card } from "./ui";

export function Recommendations({
  engine,
  recs,
  shortlist,
  onOpen,
  onToggleShortlist,
}: {
  engine: Engine;
  recs: Recommendation[];
  shortlist: string[];
  onOpen: (u: Unit) => void;
  onToggleShortlist: (u: Unit) => void;
}) {
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3">
        {recs.map((r) => {
          const u = r.unit;
          const layout = u ? engine.ix.stackLayout(u.stackId) : null;
          const onList = u ? shortlist.includes(u.id) : false;
          return (
            <article key={r.kind} className={`${card} flex flex-col p-5`}>
              <h3 className="font-display-normal text-sm font-semibold text-reservoir">{r.title}</h3>
              {u && layout ? (
                <>
                  <p className="mt-1 font-display text-xl font-extrabold">{unitLabel(engine.ix, u)}</p>
                  <p className="font-display-normal text-sm text-canopy/80">
                    {layout.name}, {layout.bedrooms} bedrooms, {money(u.price!)}{u.priceIsEstimate ? " (estimate)" : ""}
                    {r.ranked?.fit.score != null && `, fit ${Math.round(r.ranked.fit.score)}/100`}
                    {r.ranked && r.ranked.fit.coverage < 1 && ` (${Math.round(r.ranked.fit.coverage * 100)}% of weights had data)`}
                  </p>
                  {r.ranked?.assessment.level && (
                    <p className="font-display-normal text-sm text-canopy/80">
                      {VIEW_CATEGORY_LABEL[r.ranked.assessment.level.category]}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 font-display text-lg font-bold">No unit</p>
              )}
              <ul className="mt-3 grid gap-1.5 text-[1rem]">
                {r.reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {r.tradeOffs.length > 0 && (
                <div className="mt-3">
                  <p className="font-display-normal text-sm font-semibold">Trade-offs</p>
                  <ul className="mt-1 grid gap-1 text-[1rem] text-canopy/80">
                    {r.tradeOffs.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {u && (
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => onOpen(u)}
                    className="rounded-full bg-canopy px-4 py-2 font-display-normal text-sm font-semibold text-mist hover:bg-canopy-soft"
                  >
                    Show on floor slider
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleShortlist(u)}
                    disabled={!onList && shortlist.length >= 3}
                    className="rounded-full border border-canopy/25 px-4 py-2 font-display-normal text-sm font-semibold disabled:opacity-50"
                  >
                    {onList ? "Remove from shortlist" : "Add to shortlist"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-canopy/75">{APPRECIATION_NOTE}</p>
    </div>
  );
}
