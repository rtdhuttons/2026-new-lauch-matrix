"use client";

// My Shortlist (the units being compared) as a utility on every tab: a button
// in the tab bar that opens the list, and a compact comparison bar once at
// least one unit has been added.

import { useRef } from "react";
import type { Unit } from "../model/types";
import type { Engine } from "../lib/engine";
import { money } from "../lib/format";
import { unitNumber } from "./unit-summary";
import { btnPrimary, btnSecondary } from "./ui";

export const MAX_SHORTLIST = 3;

/** Message after adding or trying to add a unit. */
export function comparisonFeedback(u: Unit, count: number, added: boolean): string {
  if (!added) return "You're comparing 3 units. Remove one to add another.";
  const left = MAX_SHORTLIST - count;
  return left > 0
    ? `Unit ${unitNumber(u)} added. You can compare ${left} more unit${left === 1 ? "" : "s"}.`
    : `Unit ${unitNumber(u)} added. You're comparing 3 units.`;
}

export function useShortlistDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return { ref, open: () => ref.current?.showModal(), close: () => ref.current?.close() };
}

export function ShortlistButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="shrink-0 rounded-full border border-canopy/25 bg-paper px-3.5 py-2 font-display-normal text-sm font-semibold hover:bg-mist-deep"
    >
      <span className="hidden sm:inline">My </span>Shortlist <span className="tabular-nums">({count})</span>
    </button>
  );
}

export function ShortlistDialog({
  dialogRef,
  engine,
  shortlist,
  onOpen,
  onRemove,
  onCompare,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  engine: Engine;
  shortlist: Unit[];
  onOpen: (u: Unit) => void;
  onRemove: (u: Unit) => void;
  onCompare: () => void;
}) {
  const ix = engine.ix;
  const close = () => dialogRef.current?.close();
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shortlist-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[min(560px,94vw)] rounded-2xl bg-paper p-0 text-canopy backdrop:bg-canopy/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-canopy/10 px-5 py-4">
        <h2 id="shortlist-title" className="font-display text-lg font-extrabold">
          My Shortlist <span className="font-display-normal text-sm font-normal text-canopy/70">({shortlist.length} of {MAX_SHORTLIST} units)</span>
        </h2>
        <button type="button" onClick={close} className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm">
          Close
        </button>
      </div>
      {shortlist.length === 0 ? (
        <p className="px-5 py-6 text-canopy/80">
          No units added yet. Select a unit on the site view or in the unit list, then choose <strong>Add to comparison</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-canopy/10">
          {shortlist.map((u) => {
            const layout = ix.unitLayout(u);
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-display-normal font-semibold">Unit {unitNumber(u)} <span className="font-normal text-canopy/70">· {ix.stackBlock(u.stackId).name}</span></p>
                  <p className="text-sm text-canopy/75">
                    {layout.category ?? layout.name} · {layout.areaSqft ? `${layout.areaSqft.toLocaleString("en-SG")} sq ft` : "size not known"} ·{" "}
                    {u.price !== null ? `${money(u.price)}${u.priceIsEstimate ? " (estimate)" : ""}` : "price not published"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onOpen(u);
                    }}
                    className="rounded-full border border-canopy/25 px-3 py-1.5 font-display-normal text-sm font-semibold"
                  >
                    View details
                  </button>
                  <button type="button" onClick={() => onRemove(u)} className="rounded-full px-3 py-1.5 font-display-normal text-sm font-semibold text-[#9b2f28]">
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
          disabled={shortlist.length < 2}
          onClick={() => {
            close();
            onCompare();
          }}
          className={`${btnPrimary} w-full`}
        >
          {shortlist.length < 2 ? "Select at least 2 units to compare" : `Compare ${shortlist.length} units`}
        </button>
      </div>
    </dialog>
  );
}

/** Bottom bar once units are added: who's in the comparison and one clear action. */
export function ComparisonBar({
  shortlist,
  feedback,
  onCompare,
  onOpenList,
}: {
  shortlist: Unit[];
  feedback: string | null;
  onCompare: () => void;
  onOpenList: () => void;
}) {
  if (shortlist.length === 0 && !feedback) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-canopy/15 bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(16_41_28/0.5)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
        <div className="min-w-0 font-display-normal text-sm" aria-live="polite">
          {feedback ? (
            <p className="font-semibold">{feedback}</p>
          ) : (
            <p>
              <span className="font-semibold">{shortlist.length} unit{shortlist.length === 1 ? "" : "s"}<span className="hidden sm:inline"> in comparison</span>:</span>{" "}
              <span className="text-canopy/75">{shortlist.map(unitNumber).join(", ")}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="hidden sm:block">
            <button type="button" onClick={onOpenList} className={`${btnSecondary} px-4 py-2`}>
              My Shortlist
            </button>
          </span>
          <button type="button" onClick={onCompare} disabled={shortlist.length < 2} className={`${btnPrimary} px-4 py-2`}>
            {shortlist.length < 2 ? (
              <>
                <span className="sm:hidden">Add 1 more to compare</span>
                <span className="hidden sm:inline">Select at least 2 units to compare</span>
              </>
            ) : (
              `Compare ${shortlist.length} units`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
