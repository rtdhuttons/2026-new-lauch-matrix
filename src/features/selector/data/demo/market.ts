// ILLUSTRATIVE DEMO DATA — nearby projects are fictional. There are no
// transactions: resale evidence is deliberately empty so the app shows
// "insufficient evidence" instead of inventing returns or demand.

import type { NearbyProject, Transaction } from "../../model/types";
import { demo } from "./project";

export const transactions: Transaction[] = [];

export const nearbyProjects: NearbyProject[] = [
  {
    id: "parkline",
    name: "Parkline Court (fictional)",
    completion: "Completed 1998",
    distanceKm: 0.3,
    comparable: [
      { bedrooms: 2, sizeSqft: { min: 850, max: 900 }, units: 60 },
      { bedrooms: 3, sizeSqft: { min: 1100, max: 1250 }, units: 96 },
      { bedrooms: 4, sizeSqft: { min: 1500, max: 1600 }, units: 24 },
    ],
    provenance: demo("Fictional neighbouring condo"),
  },
  {
    id: "orchid-crest",
    name: "Orchid Crest (fictional new launch)",
    completion: "Expected 2030",
    distanceKm: 0.9,
    comparable: [
      { bedrooms: 2, sizeSqft: { min: 620, max: 740 }, units: 240 },
      { bedrooms: 3, sizeSqft: { min: 900, max: 1080 }, units: 180 },
      { bedrooms: 4, sizeSqft: { min: 1300, max: 1420 }, units: 40 },
    ],
    provenance: demo("Fictional competing launch"),
  },
];
