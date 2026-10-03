"use client";

// Unit list: units that match the filters, cheapest first, a page at a time.
// Cards on phones, a table on wider screens; the selected unit is marked
// in words as well as colour.

import { useState } from "react";
import type { Unit } from "../model/types";
import { levelView, VIEW_CATEGORY_LABEL } from "../lib/clearance";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import { unitNumber } from "./unit-summary";
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
        <p className="font-display-normal font-semibold">No units match these filters. Increase your budget or clear a filter.</p>
      </div>
    );
  }

  const info = (u: Unit) => {
    const layout = ix.stackLayout(u.stackId);
    const view = levelView(engine.view(u.stackId), u.level);
    return {
      layout,
      bedrooms: layout.category ?? (layout.bedrooms ? `${layout.bedrooms}-bedroom` : layout.name),
      size: layout.areaSqft ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "Size not known",
      price: u.price !== null ? money(u.price) : "Not published",
      view: view && view.category !== "unknown" ? VIEW_CATEGORY_LABEL[view.category] : "Not assessed",
    };
  };
  const addButton = (u: Unit) => {
    const listed = shortlist.includes(u.id);
    return (
      <button
        type="button"
        onClick={() => onToggleShortlist(u)}
        disabled={!listed && shortlistFull}
        aria-pressed={listed}
        className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-display-normal text-xs font-semibold disabled:opacity-40 ${listed ? "border-canopy bg-canopy text-mist" : "border-canopy/25"}`}
      >
        {listed ? "✓ In comparison" : "Add to comparison"}
      </button>
    );
  };
  const anyEstimate = rows.some((u) => u.priceIsEstimate);

  return (
    <div className={`${card} overflow-hidden p-0`}>
      {/* Phones: cards */}
      <ul className="divide-y divide-canopy/10 sm:hidden">
        {rows.map((u) => {
          const x = info(u);
          const on = u.id === selectedId;
          return (
            <li key={u.id} className={`p-4 ${on ? "bg-mist" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onSelect(u)} className="text-left" aria-current={on ? "true" : undefined}>
                  <span className="block font-display-normal font-semibold underline-offset-4 hover:underline">
                    Unit {unitNumber(u)} {on && <span className="text-xs font-normal text-canopy/70">(selected)</span>}
                  </span>
                  <span className="block text-sm text-canopy/75">{x.bedrooms} · {x.size} · floor {u.level}</span>
                </button>
                <span className="text-right font-display-normal font-semibold tabular-nums">
                  {x.price}
                  {u.priceIsEstimate && <span className="block text-xs font-normal text-stone">estimate</span>}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-canopy/70">View: {x.view}</span>
                {addButton(u)}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Wider screens: table */}
      <div className="relative hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse font-display-normal text-sm tabular-nums">
          <caption className="sr-only">Units matching your filters, cheapest first</caption>
          <thead>
            <tr className="bg-mist text-left text-xs uppercase tracking-[0.06em] text-canopy/70">
              <th scope="col" className="px-4 py-3 font-semibold">Unit</th>
              <th scope="col" className="px-3 py-3 font-semibold">Bedrooms</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Size</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Price</th>
              <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">View at this floor</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Comparison</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const x = info(u);
              const on = u.id === selectedId;
              return (
                <tr key={u.id} className={`border-t border-canopy/10 ${on ? "bg-mist" : ""}`}>
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                    <button type="button" onClick={() => onSelect(u)} className="text-left underline-offset-4 hover:underline" aria-current={on ? "true" : undefined}>
                      Unit {unitNumber(u)}
                    </button>
                    {on && <span className="ml-1.5 text-xs font-normal text-canopy/70">(selected)</span>}
                    <span className="block text-xs font-normal text-canopy/60">{ix.stackBlock(u.stackId).name}, floor {u.level}</span>
                  </th>
                  <td className="px-3 py-2.5">{x.bedrooms}</td>
                  <td className="px-3 py-2.5 text-right">{x.size}</td>
                  <td className="px-3 py-2.5 text-right">
                    {x.price}
                    {u.priceIsEstimate && <span className="ml-1 text-xs text-stone">est.</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">{x.view}</td>
                  <td className="px-4 py-2.5 text-right">{addButton(u)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-canopy/10 px-4 py-3 font-display-normal text-sm">
        <span className="text-canopy/70">
          Showing {rows.length.toLocaleString("en-SG")} of {units.length.toLocaleString("en-SG")}, cheapest first.{anyEstimate ? " Prices are estimates." : ""}
        </span>
        {shown < units.length && (
          <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="rounded-full border border-canopy/25 px-4 py-1.5 font-semibold">
            Show {Math.min(PAGE * 2, units.length - shown)} more units
          </button>
        )}
      </div>
    </div>
  );
}
