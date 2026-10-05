// Applies a developer listing (units, availability and prices pulled from a
// sales system such as the Huttons New Launch API) to a project's dataset.
// Each unit is matched by block, stack and floor. A published price replaces
// any estimate; units without one keep "price not published" so the
// illustrative estimate can still stand in until the price list is out.

import type { Dataset, Unit, UnitStatus } from "../model/types";

/** [block, stack, floor, floor plan, area sq ft, availability, list price, nett price] */
export type ListingUnit = [string, string, number, string, number, UnitStatus, number | null, number | null];

export interface Listing {
  source: string;
  fetched: string;
  units: ListingUnit[];
}

export interface ListingResult {
  dataset: Dataset;
  matched: number;
  priced: number;
  /** Units in the listing that aren't in the dataset, as "block-stack-floor". */
  unmatched: string[];
}

export function applyListing(ds: Dataset, listing: Listing): ListingResult {
  const blockOf = new Map(ds.stacks.map((s) => [s.id, s.blockId]));
  const byKey = new Map(listing.units.map((u) => [`${u[0]}|${u[1]}|${u[2]}`, u]));
  const used = new Set<string>();
  let priced = 0;
  const units: Unit[] = ds.units.map((u) => {
    const key = `${blockOf.get(u.stackId)}|${u.stackId}|${u.level}`;
    const l = byKey.get(key);
    if (!l) return u;
    used.add(key);
    const [, , , , , status, list, nett] = l;
    const price = nett ?? list;
    if (price !== null) priced++;
    return {
      ...u,
      status,
      price,
      priceIsEstimate: false,
      priceProvenance:
        price !== null
          ? {
              source: `${listing.source}: developer's price list`,
              updated: listing.fetched,
              status: "verified",
              note: nett !== null && list !== null && nett !== list ? `List price $${list.toLocaleString("en-SG")}; nett price shown.` : undefined,
            }
          : { ...u.priceProvenance, note: `Released for sale (${listing.source}, ${listing.fetched}); price not published yet.` },
    };
  });
  return {
    dataset: { ...ds, units },
    matched: used.size,
    priced,
    unmatched: [...byKey.keys()].filter((k) => !used.has(k)).map((k) => k.replaceAll("|", "-")),
  };
}
