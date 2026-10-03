"use client";

// My Shortlist: a utility that stays with the buyer on every tab. It shows
// the selected home and up to three shortlisted homes, and opens them in
// Units & Payments for comparison.

import { useRef } from "react";
import type { Unit } from "../model/types";
import { unitLabel } from "../lib/dataset-index";
import type { Engine } from "../lib/engine";
import { compactMoney, money } from "../lib/format";

export const MAX_SHORTLIST = 3;

export function ShortlistBar({
  engine,
  selected,
  shortlist,
  onOpen,
  onRemove,
  onCompare,
}: {
  engine: Engine;
  selected: Unit | null;
  shortlist: Unit[];
  onOpen: (u: Unit) => void;
  onRemove: (u: Unit) => void;
  onCompare: () => void;
}) {
  const ix = engine.ix;
  const dialog = useRef<HTMLDialogElement>(null);
  const priceText = (u: Unit) => (u.price !== null ? `${compactMoney(u.price)}${u.priceIsEstimate ? " est." : ""}` : "price not published");

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-canopy/10 bg-paper/95 backdrop-blur lg:inset-x-auto lg:bottom-5 lg:right-5 lg:rounded-full lg:border lg:shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 lg:gap-4 lg:py-2 lg:pl-5 lg:pr-2">
          <p className="min-w-0 truncate font-display-normal text-sm">
            {selected ? (
              <>
                <span className="text-canopy/65">Selected: </span>
                <span className="font-semibold">{unitLabel(ix, selected)}</span> {priceText(selected)}
              </>
            ) : (
              <span className="text-canopy/65">No home selected</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="shrink-0 rounded-full bg-canopy px-4 py-2 font-display-normal text-sm font-semibold text-mist"
            aria-haspopup="dialog"
          >
            My Shortlist ({shortlist.length})
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="shortlist-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(560px,94vw)] rounded-2xl bg-paper p-0 text-canopy backdrop:bg-canopy/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-canopy/10 px-5 py-4">
          <h2 id="shortlist-title" className="font-display text-lg font-extrabold">
            My Shortlist <span className="font-display-normal text-sm font-normal text-canopy/70">({shortlist.length} of {MAX_SHORTLIST})</span>
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm">
            Close
          </button>
        </div>
        {shortlist.length === 0 ? (
          <p className="px-5 py-6 text-canopy/80">
            Nothing shortlisted yet. Tap a home on the 3D model or in the list of matching homes, then choose <strong>Add to shortlist</strong>.
          </p>
        ) : (
          <ul className="divide-y divide-canopy/10">
            {shortlist.map((u) => {
              const layout = ix.stackLayout(u.stackId);
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-display-normal font-semibold">{unitLabel(ix, u)}</p>
                    <p className="text-sm text-canopy/75">
                      {layout.category ?? layout.name} · {layout.areaSqft ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "size unknown"} ·{" "}
                      {u.price !== null ? `${money(u.price)}${u.priceIsEstimate ? " (estimate)" : ""}` : "price not published"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        dialog.current?.close();
                        onOpen(u);
                      }}
                      className="rounded-full border border-canopy/20 px-3 py-1.5 font-display-normal text-sm font-semibold"
                    >
                      Open
                    </button>
                    <button type="button" onClick={() => onRemove(u)} className="rounded-full px-3 py-1.5 font-display-normal text-sm text-[#9b2f28]">
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-canopy/10 px-5 py-4">
          <button
            type="button"
            disabled={shortlist.length === 0}
            onClick={() => {
              dialog.current?.close();
              onCompare();
            }}
            className="w-full rounded-full bg-canopy px-4 py-2.5 font-display-normal text-sm font-semibold text-mist disabled:opacity-40"
          >
            Compare in Units &amp; Payments
          </button>
        </div>
      </dialog>
    </>
  );
}
