"use client";

// Homes that match the buyer's filters, cheapest first, a page at a time.

import { useState } from "react";
import type { Unit } from "../model/types";
import { levelView, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import { card } from "./ui";

const PAGE = 12;

export function MatchingHomes({
  engine,
  units,
  selectedId,
  shortlist,
  onSelect,
  onToggleShortlist,
  shortlistFull,
}: {
  engine: Engine;
  units: Unit[];
  selectedId: string | null;
  shortlist: string[];
  onSelect: (u: Unit) => void;
  onToggleShortlist: (u: Unit) => void;
  shortlistFull: boolean;
}) {
  const ix = engine.ix;
  const [shown, setShown] = useState(PAGE);
  const sorted = [...units].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.level - b.level || a.stackId.localeCompare(b.stackId));
  const rows = sorted.slice(0, shown);

  if (units.length === 0) {
    return (
      <div className={`${card} p-5`}>
        <p className="font-display-normal font-semibold">No homes match these filters.</p>
        <p className="mt-1 text-canopy/75">Try another bedroom count, a higher budget or a wider floor range.</p>
      </div>
    );
  }

  return (
    <div className={`${card} overflow-hidden p-0`}>
      {/* relative: keeps the screen-reader caption inside the scroll box on phones */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse font-display-normal text-sm tabular-nums">
          <caption className="sr-only">Homes matching your filters, cheapest first</caption>
          <thead>
            <tr className="bg-canopy text-left text-xs uppercase tracking-[0.08em] text-mist">
              <th scope="col" className="px-4 py-3 font-semibold">Home</th>
              <th scope="col" className="px-3 py-3 font-semibold">Type</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Size</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Price</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">PSF</th>
              <th scope="col" className="px-3 py-3 font-semibold">View at this floor</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const layout = ix.stackLayout(u.stackId);
              const view = levelView(engine.view(u.stackId), u.level);
              const on = u.id === selectedId;
              const listed = shortlist.includes(u.id);
              return (
                <tr key={u.id} className={`border-t border-canopy/10 ${on ? "bg-mist" : ""}`}>
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                    <button type="button" onClick={() => onSelect(u)} className="text-left underline-offset-4 hover:underline" aria-current={on ? "true" : undefined}>
                      {unitLabel(ix, u)}
                    </button>
                  </th>
                  <td className="px-3 py-2.5">{u.typeCode ?? layout.name.replace(/^Type /, "")} · {layout.category ?? (layout.bedrooms ? `${layout.bedrooms}-bedroom` : "")}</td>
                  <td className="px-3 py-2.5 text-right">{layout.areaSqft ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    {u.price !== null ? money(u.price) : "—"}
                    {u.price !== null && u.priceIsEstimate && <span className="ml-1 text-xs text-stone">est.</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{u.price !== null && layout.areaSqft ? `$${Math.round(u.price / layout.areaSqft).toLocaleString("en-SG")}` : "—"}</td>
                  <td className="px-3 py-2.5">{view && view.category !== "unknown" ? VIEW_CATEGORY_LABEL[view.category] : "Not assessed"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleShortlist(u)}
                      disabled={!listed && shortlistFull}
                      className="whitespace-nowrap rounded-full border border-canopy/20 px-3 py-1 text-xs font-semibold disabled:opacity-40"
                    >
                      {listed ? "Remove" : "Shortlist"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-canopy/10 px-4 py-3 font-display-normal text-sm">
        <span className="text-canopy/70">
          Showing {rows.length.toLocaleString("en-SG")} of {units.length.toLocaleString("en-SG")}, cheapest first.
        </span>
        {shown < units.length && (
          <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="rounded-full border border-canopy/20 px-4 py-1.5 font-semibold">
            Show more
          </button>
        )}
      </div>
    </div>
  );
}
