"use client";

import { useRef } from "react";
import { card } from "./ui";

// Places named on the developer's location map. Distances are left out
// unless measured: only the MRT linkway length comes from the architect.
const NEARBY: { title: string; items: string[] }[] = [
  {
    title: "Getting around",
    items: [
      "Upper Thomson MRT (Thomson–East Coast Line) beside the site: a 65 m covered linkway from Side Gate 1",
      "Bright Hill, one stop north: a future interchange",
      "North–South Corridor (under construction), Central and Pan-Island Expressways",
    ],
  },
  {
    title: "Nature on the doorstep",
    items: [
      "Central Catchment Nature Reserve and MacRitchie Reservoir",
      "Windsor Nature Park and the MacRitchie Nature Trail",
      "Lower and Upper Peirce Reservoirs, the TreeTop Walk",
      "Singapore Island Country Club",
    ],
  },
  {
    title: "Schools on the map",
    items: [
      "Ai Tong School, CHIJ St. Nicholas Girls' School",
      "Catholic High School, Peirce Secondary, Mayflower Secondary, Whitley Secondary",
      "Raffles Institution, Raffles Girls' School (Secondary), Eunoia Junior College",
    ],
  },
  {
    title: "Food and shopping",
    items: [
      "Thomson Plaza and Midview City",
      "Junction 8, AMK Hub and Jubilee Square",
      "Shunfu, Mayflower, Kebun Baru and Sembawang Hills food centres",
    ],
  },
];

export function LocationSection({ map }: { map: { src: string; srcSet: string; alt: string } }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <figure className={`${card} overflow-hidden p-0`}>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-label="Location map. Open larger"
          className="block w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- plain img so the standalone build can load it */}
          <img src={map.src} srcSet={map.srcSet} sizes="(min-width: 1024px) 860px, 100vw" alt={map.alt} loading="lazy" className="block h-auto w-full" />
        </button>
        <figcaption className="px-4 py-2.5 font-display-normal text-xs text-stone">
          Location map from the developer&apos;s marketing material. Not to scale. Tap to enlarge.
        </figcaption>
      </figure>

      <div className={`${card} p-5 sm:p-6`}>
        {NEARBY.map((g) => (
          <section key={g.title} className="border-t border-canopy/10 pt-4 first:border-t-0 first:pt-0 [&+section]:mt-4">
            <h3 className="font-display-normal text-base font-semibold">{g.title}</h3>
            <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-[0.9375rem] leading-snug text-canopy/85">
              {g.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-label="Location map"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(1400px,96vw)] overflow-auto rounded-xl bg-paper p-0 backdrop:bg-canopy/70"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-canopy/10 bg-paper px-4 py-2.5">
          <p className="font-display-normal text-sm font-semibold">Thomson Reserve location</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm"
          >
            Close
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src={map.src} alt={map.alt} className="block h-auto w-full min-w-[900px]" />
      </dialog>
    </div>
  );
}
