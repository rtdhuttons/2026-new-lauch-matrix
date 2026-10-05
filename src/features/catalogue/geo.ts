// The projects map's flat projection, and which postal district a point is in.

import { PROJECTION } from "./data/sg-basemap";
import { sgDistricts } from "./data/sg-districts";
import { insideRings, pathRings } from "./lib";
import type { CatalogueProject } from "./model";

/** Latitude and longitude to the map's metres east and south of its centre. */
export function toXY(lat: number, lon: number) {
  return {
    x: (lon - PROJECTION.lon0) * PROJECTION.metresPerDegree * Math.cos((PROJECTION.lat0 * Math.PI) / 180),
    y: (PROJECTION.lat0 - lat) * PROJECTION.metresPerDegree,
  };
}

const districtRings = sgDistricts.map((d) => ({ id: d.id, rings: pathRings(d.d) }));

/** The postal district outline a point falls in (approximate at the edges). */
export function districtAt(lat: number, lon: number): string | null {
  const { x, y } = toXY(lat, lon);
  return districtRings.find((d) => insideRings(x, y, d.rings))?.id ?? null;
}

/** The project's district from the API, else from its position on the map. */
export function projectDistrict(p: CatalogueProject): string | null {
  if (p.district) return p.district;
  return p.lat !== null && p.lon !== null ? districtAt(p.lat, p.lon) : null;
}
