"use client";

import { useRef } from "react";
import { card } from "./ui";
import type { LocationInfo } from "../model/project";
import { AssetImg } from "./asset-image";

export function LocationSection({ location, projectName }: { location: LocationInfo; projectName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const map = location.map;
  return (
    <div className={`grid grid-cols-1 items-start gap-6 ${map ? "lg:grid-cols-[1fr_340px]" : ""} [&>*]:min-w-0`}>
      {map && (
      <figure className={`${card} overflow-hidden p-0`}>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-label="Location map. Open larger"
          className="block w-full"
        >
          <AssetImg src={map.src} srcSet={map.srcSet} sizes="(min-width: 1024px) 860px, 100vw" alt={map.alt} loading="lazy" className="block h-auto w-full" />
        </button>
        <figcaption className="px-4 py-2.5 font-display-normal text-xs text-stone">
          {location.mapCaption}
        </figcaption>
      </figure>
      )}

      <div className={`${card} p-5 sm:p-6`}>
        {location.groups.map((g) => (
          <section key={g.title} className="border-t border-canopy/10 pt-4 first:border-t-0 first:pt-0 [&+section]:mt-4">
            <h3 className="font-display-normal text-base font-semibold">{g.title}</h3>
            <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-[0.9375rem] leading-snug text-canopy/85">
              {g.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-4 border-t border-canopy/10 pt-3 text-xs text-stone">Source: {location.provenance.source}. {location.provenance.note}</p>
      </div>

      {map && (
      <dialog
        ref={dialog}
        aria-label="Location map"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(1400px,96vw)] overflow-auto rounded-xl bg-paper p-0 backdrop:bg-canopy/70"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-canopy/10 bg-paper px-4 py-2.5">
          <p className="font-display-normal text-sm font-semibold">{projectName} location</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm"
          >
            Close
          </button>
        </div>
        <AssetImg src={map.src} alt={map.alt} className="block h-auto w-full min-w-[900px]" />
      </dialog>
      )}
    </div>
  );
}
