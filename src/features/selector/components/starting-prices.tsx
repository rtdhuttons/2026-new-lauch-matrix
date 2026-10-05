"use client";

import type { PricingInfo } from "../model/project";

const mil = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const size = (s: { min: number; max: number }) =>
  s.min === s.max ? `${s.min.toLocaleString("en-SG")} sq ft` : `${s.min.toLocaleString("en-SG")}–${s.max.toLocaleString("en-SG")} sq ft`;

/** Indicative starting prices by unit type, exactly as published (e.g. a launch flyer). */
export function StartingPrices({ prices }: { prices: NonNullable<PricingInfo["startingPrices"]> }) {
  const all = prices.groups.flatMap((g) => g.rows.map((r) => r.from).filter((v): v is number => v !== null));
  const top = Math.max(...all, 1);
  return (
    <div>
      {prices.headline && <p className="font-display-normal text-lg font-semibold">{prices.headline}</p>}
      {prices.groups.map((g) => (
        <div key={g.name} className="mt-4">
          <h4 className="font-display-normal text-sm font-semibold uppercase tracking-[0.12em] text-[#8a5a14]">{g.name}</h4>
          <table className="mt-2 w-full table-fixed font-display-normal text-[15px]">
            <caption className="sr-only">Indicative starting prices, {g.name}</caption>
            <thead>
              <tr className="text-left text-sm text-canopy/65">
                <th scope="col" className="w-[48%] py-1.5 pr-3 font-medium">Unit type</th>
                <th scope="col" className="w-[24%] py-1.5 pr-3 font-medium">Size</th>
                <th scope="col" className="py-1.5 text-right font-medium">Starting price</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.type} className="border-t border-canopy/10 align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">{r.type}</th>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{size(r.sizeSqft)}</td>
                  <td className="py-2 text-right">
                    {r.from !== null ? (
                      <>
                        <span className="font-semibold tabular-nums">{mil(r.from)}</span>
                        <span aria-hidden="true" className="mt-1 ml-auto block h-1.5 rounded-full bg-[#c88a12]/70" style={{ width: `${Math.round((r.from / top) * 100)}%` }} />
                      </>
                    ) : (
                      <span className="text-canopy/75">{r.note ?? "Not published"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="mt-3 text-sm text-stone">
        {prices.provenance.source}, as at {prices.provenance.updated}.{prices.provenance.note ? ` ${prices.provenance.note}` : ""}
      </p>
    </div>
  );
}
