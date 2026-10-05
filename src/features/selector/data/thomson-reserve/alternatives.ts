// Alternative projects for Thomson Reserve buyers. The projects, their roles
// and descriptions come from TRM's "What can your budget buy?" comparison
// page; unit types still on sale, the lowest price of each and units left
// come from the Huttons New Launch API (scripts/huttons/sync-alternatives.py).

import type { AlternativeProject } from "../../model/project";
import { alternativesSync } from "./alternatives-huttons";

const base = process.env.NEXT_PUBLIC_TR_IMAGE_BASE ?? "/thomson-reserve/images";

const provenance = {
  source: alternativesSync.source,
  updated: alternativesSync.fetched,
  status: "verified" as const,
  note: "Lowest price among the units still available, and units left, from the developers' sales listings. Availability changes daily.",
};
const priceBasis = "Lowest price among the units still available";
const web = (note?: string) => ({
  source: "Public listings and property news (EdgeProp, PropertyGuru and project review sites)",
  checked: "2026-10-03",
  note: note ?? "Not checked against the developer's documents.",
});

const listed: AlternativeProject[] = [
  {
    name: "Lentor Gardens Residences",
    tag: "More choices across 2 to 4 bedrooms",
    why: "The broadest selection in this comparison: 2-bedroom through 4-bedroom units, together with strata terrace units. Useful for comparing similar-sized units at a different entry price.",
    bestFor: "2-bedroom + study, 3-bedroom family units and 4-bedroom value comparisons.",
    developer: "Kingsford Group",
    nearestMrt: "Lentor MRT",
    totalUnits: 499,
    tenure: "99-year leasehold",
    completion: "2029–2030 (sources differ)",
    image: { src: `${base}/alt-lentor-gardens.jpg`, alt: "Lentor Gardens Residences. Artist's impression." },
    factsSource: web("499 units including 3 strata terrace houses, in three 16-storey blocks and one 8-storey block. Sources give expected completion from Q1 2029 to the legal completion date of 31 Dec 2030. Tenure confirmed by TRM."),
    unitTypes: [
      { bedrooms: 2, type: "2BR Premium", sizeSqft: { min: 646, max: 678 }, fromPrice: 1_571_300, unitsLeft: 34 },
      { bedrooms: 2, type: "2BR Premium HS", sizeSqft: { min: 689, max: 689 }, fromPrice: 1_705_500, unitsLeft: 1 },
      { bedrooms: 2, type: "2BR + Study", sizeSqft: { min: 732, max: 732 }, fromPrice: 1_715_000, unitsLeft: 103 },
      { bedrooms: 3, type: "3BR Premium + Study", sizeSqft: { min: 969, max: 969 }, fromPrice: 2_221_400, unitsLeft: 8 },
      { bedrooms: 3, type: "3BR Premium", sizeSqft: { min: 1001, max: 1012 }, fromPrice: 2_297_500, unitsLeft: 10 },
      { bedrooms: 4, type: "4BR Compact", sizeSqft: { min: 1184, max: 1184 }, fromPrice: 2_738_000, unitsLeft: 9 },
      { bedrooms: 4, type: "4BR Premium", sizeSqft: { min: 1346, max: 1356 }, fromPrice: 3_129_200, unitsLeft: 34 },
    ],
    priceBasis,
    provenance,
    kind: "agent",
  },
  {
    name: "Lentoria",
    tag: "Lower price, limited choices",
    why: "A 267-unit development along Lentor Hills Road, about a five-minute walk from Lentor MRT and the nearby mall.",
    bestFor: "Buyers who put a lower entry price first in the Lentor and Upper Thomson area.",
    developer: "Hong Leong Group and Mitsui Fudosan",
    nearestMrt: "Lentor MRT (about a five-minute walk)",
    totalUnits: 267,
    tenure: "99-year leasehold",
    completion: "2027 (expected)",
    image: { src: `${base}/alt-lentoria.jpg`, alt: "Lentoria. Artist's impression." },
    factsSource: web("Three blocks of 8 to 17 storeys."),
    unitTypes: [
      { bedrooms: 1, type: "1BR", sizeSqft: null, fromPrice: 1_288_000, unitsLeft: null },
      { bedrooms: 2, type: "2BR", sizeSqft: { min: 700, max: 732 }, fromPrice: 1_800_000, unitsLeft: 5 },
      { bedrooms: 3, type: "3BR", sizeSqft: { min: 936, max: 936 }, fromPrice: 2_279_000, unitsLeft: 3 },
    ],
    priceBasis,
    provenance,
    kind: "agent",
  },
  {
    name: "Springleaf Residence",
    tag: "The space alternative",
    why: "941 units beside the Springleaf green enclave, close to Springleaf MRT and the surrounding forest. The units left are mostly larger ones.",
    bestFor: "Buyers who need more space without pushing the price too high.",
    developer: "GuocoLand and Hong Leong Holdings",
    nearestMrt: "Springleaf MRT",
    totalUnits: 941,
    tenure: "99-year leasehold",
    completion: "2nd half of 2029 (expected)",
    image: { src: `${base}/alt-springleaf-residence.jpg`, alt: "Springleaf Residence. Artist's impression." },
    factsSource: web("Six blocks of 4 to 25 storeys; lease from July 2024. Tenure confirmed by TRM."),
    unitTypes: [
      { bedrooms: 3, type: "3BR + Study + Utility", sizeSqft: { min: 1259, max: 1259 }, fromPrice: 2_732_000, unitsLeft: 6 },
      { bedrooms: 5, type: "5BR", sizeSqft: { min: 1453, max: 1475 }, fromPrice: 3_224_000, unitsLeft: 10 },
    ],
    priceBasis,
    provenance,
    kind: "agent",
  },
  {
    name: "Chuan Park",
    tag: "Very few units left",
    why: "A 916-unit project beside Lorong Chuan MRT, with three 22-storey and two 19-storey blocks. The 4-bedroom and 5-bedroom types are sold out.",
    bestFor: "Not necessarily the lowest price, but very limited remaining supply.",
    developer: "Kingsford Group and MCC Land",
    nearestMrt: "Lorong Chuan MRT",
    totalUnits: 916,
    tenure: "99-year leasehold",
    completion: "2028–2029 (sources differ)",
    image: { src: `${base}/alt-chuan-park.jpg`, alt: "Chuan Park. Artist's impression." },
    factsSource: web("Sources give vacant possession from September 2028 and TOP in September 2029."),
    unitTypes: [
      { bedrooms: 2, type: "2BR + Study", sizeSqft: { min: 743, max: 743 }, fromPrice: 2_021_600, unitsLeft: 3 },
      { bedrooms: 3, type: "3BR", sizeSqft: { min: 1206, max: 1227 }, fromPrice: 3_234_900, unitsLeft: 10 },
    ],
    priceBasis,
    provenance,
    kind: "agent",
  },
];

/** Unit types, prices, units left and total units replaced by the latest Huttons listing where available. */
export const alternatives: AlternativeProject[] = listed.map((a) => {
  const live = alternativesSync.projects[a.name];
  return live ? { ...a, totalUnits: live.totalUnits ?? a.totalUnits, unitTypes: live.unitTypes } : a;
});
