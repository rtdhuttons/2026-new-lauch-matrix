// The nearest projects on the new launches map, as a project's alternatives.
// The list comes from scripts/huttons/nearby-projects.py (the map's Huttons
// catalogue); this only words it for the Alternative Projects tab.

import type { AlternativeProject, AlternativeUnitType } from "../model/project";

export interface NearbyProject {
  /** The map's project id and the project's own mini site address. */
  id?: string;
  slug?: string;
  name: string;
  /** Straight line between the two projects' map positions. */
  km: number;
  district?: string | null;
  address?: string | null;
  segment: string | null;
  developer: string | null;
  tenure: string | null;
  totalUnits: number | null;
  completion: string | null;
  launchDate: string | null;
  mrt?: { name: string; metres: number; minutes: number | null } | null;
  /** A photo: a file name in the project's own images folder, or a web address. */
  image?: string | null;
  unitTypes: AlternativeUnitType[];
}

export interface NearbySync {
  source: string;
  fetched: string;
  /** How the projects were chosen, in plain words. */
  rule: string;
  projects: NearbyProject[];
}

const distance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const ORDINAL = ["The nearest", "Second nearest", "Third nearest", "Fourth nearest"];

/** The nearby projects as alternatives, nearest first. */
export function nearbyAlternatives(
  near: NearbyProject[],
  opts: { fetched: string; source?: string; imageSrc?: (n: NearbyProject) => string | null },
): AlternativeProject[] {
  const source = opts.source ?? "Huttons New Launch API";
  return near.map((n, i) => {
    const beds = [...new Set(n.unitTypes.filter((t) => t.unitsLeft !== 0).map((t) => t.bedrooms))].sort((a, b) => a - b);
    const upcoming = !!n.launchDate && n.launchDate > opts.fetched;
    const completed = !!n.completion && n.completion < opts.fetched;
    const bedText = beds.length > 1 ? `${beds.slice(0, -1).join(", ")} and ${beds[beds.length - 1]}-bedroom` : `${beds[0]}-bedroom`;
    const status = upcoming
      ? ` Launching ${n.launchDate}; prices not released yet.`
      : completed
        ? ` Completed in ${n.completion!.slice(0, 4)}; these are the developer's remaining units.`
        : "";
    const src = opts.imageSrc?.(n) ?? null;
    return {
      name: n.name,
      tag: `${distance(n.km)} away`,
      why: `${ORDINAL[i] ?? "Nearby"} project on the map still selling ${bedText} units.${status}`,
      bestFor: null,
      developer: n.developer,
      nearestMrt: n.mrt ? `${n.mrt.name} (${distance(n.mrt.metres / 1000)}${n.mrt.minutes ? `, about ${n.mrt.minutes} min walk` : ""})` : null,
      totalUnits: n.totalUnits,
      tenure: n.tenure,
      completion: n.completion ? n.completion.slice(0, 4) : null,
      image: src ? { src, alt: `${n.name}. Artist's impression.` } : null,
      unitTypes: n.unitTypes,
      distanceKm: n.km,
      factsSource: { source, checked: opts.fetched },
      priceBasis: "Lowest price among the units still available",
      provenance: { source, updated: opts.fetched, status: "verified", note: "Lowest price, price per sq ft and units left from the developers' sales listings. Availability changes daily." },
      kind: "third-party",
    };
  });
}
