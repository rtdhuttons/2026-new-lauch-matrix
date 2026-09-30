"use client";

import { useRef } from "react";
import type { Unit } from "../model/types";

/** Floor plan thumbnail that opens the full page in a dialog. */
export function FloorPlan({ unit }: { unit: Unit }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const plan = unit.floorPlan;
  if (!plan) return null;
  const title = `Floor plan, Type ${unit.typeCode ?? ""}`.trim();

  return (
    <figure className="mt-4">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="block w-full overflow-hidden rounded-lg border border-canopy/15 bg-white hover:border-canopy/40"
        aria-label={`${title}. Open larger`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img so the standalone build can load it */}
        <img src={plan.src} alt="" loading="lazy" className="block h-auto w-full" />
      </button>
      <figcaption className="mt-1.5 text-sm text-canopy/75">
        {title}. Tap to enlarge.{plan.mirrored ? " This stack is a mirror image of the plan shown." : ""} {plan.credit}
      </figcaption>
      <dialog
        ref={dialog}
        aria-label={title}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[92vh] w-[min(1100px,94vw)] rounded-xl bg-paper p-0 backdrop:bg-canopy/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-canopy/10 px-4 py-2.5">
          <p className="font-display-normal text-sm font-semibold">
            {title}
            {plan.mirrored ? " (this stack is mirrored)" : ""}
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm"
          >
            Close
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src={plan.src} alt={`${title}, from the developer's unit plans`} className="block h-auto w-full" />
      </dialog>
    </figure>
  );
}
