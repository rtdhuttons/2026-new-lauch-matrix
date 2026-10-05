// Builds a starter projects-map catalogue from data already in the repo
// (Thomson Reserve's unit list and its alternatives, both from the Huttons
// New Launch API on the dates shown), placed with OneMap. Used until the
// first run of scripts/huttons/sync-catalogue.py replaces it.
//
//   npx tsx scripts/huttons/seed-catalogue.mts
import { writeFileSync } from "node:fs";
import { thomsonReserve } from "../../src/features/selector/data/thomson-reserve/bundle";
import { huttonsSync } from "../../src/features/selector/data/thomson-reserve/huttons-units";
import { alternatives } from "../../src/features/selector/data/thomson-reserve/alternatives";
import { alternativesSync } from "../../src/features/selector/data/thomson-reserve/alternatives-huttons";
import { indexDataset } from "../../src/features/selector/lib/dataset-index";
import type { CatalogueProject, CatalogueUnitType } from "../../src/features/catalogue/model";

const OUT = "src/features/catalogue/data/huttons-catalogue.ts";

async function onemap(q: string) {
  const u = `https://www.onemap.gov.sg/api/common/elastic/search?${new URLSearchParams({ searchVal: q, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" })}`;
  const r = (await (await fetch(u)).json()) as { results: { SEARCHVAL: string; ADDRESS: string; LATITUDE: string; LONGITUDE: string }[] };
  const hit = r.results.find((h) => h.SEARCHVAL.toUpperCase().startsWith(q.toUpperCase())) ?? null;
  if (!hit) throw new Error(`OneMap has no match for ${q}`);
  const address = hit.ADDRESS.replace(/\s+SINGAPORE\s+\d{6}$/, "").replace(hit.SEARCHVAL, "").replace(/\s+/g, " ").trim();
  return { lat: +Number(hit.LATITUDE).toFixed(6), lon: +Number(hit.LONGITUDE).toFixed(6), address: titleCase(address) };
}
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const ds = thomsonReserve.dataset;
const ix = indexDataset(ds);
const byCategory = new Map<string, typeof ds.units>();
for (const u of ds.units) {
  const c = ix.stackLayout(u.stackId).category ?? "Other";
  byCategory.set(c, [...(byCategory.get(c) ?? []), u]);
}
const trTypes: CatalogueUnitType[] = [...byCategory.entries()].map(([type, units]) => {
  const sizes = units.map((u) => ix.stackLayout(u.stackId).areaSqft!).filter(Boolean);
  const left = units.filter((u) => u.status === "available");
  const priced = left.filter((u) => u.price !== null && !u.priceIsEstimate).sort((a, b) => a.price! - b.price!);
  return {
    bedrooms: ix.stackLayout(units[0].stackId).bedrooms!,
    type: type.replace(/(\d)-Bedroom/, "$1BR"),
    sizeSqft: { min: Math.min(...sizes), max: Math.max(...sizes) },
    total: units.length,
    unitsLeft: left.length,
    fromPrice: priced[0]?.price ?? null,
    fromPsf: priced[0] ? Math.round(priced[0].price! / ix.stackLayout(priced[0].stackId).areaSqft!) : null,
  };
}).sort((a, b) => a.bedrooms - b.bedrooms || (a.sizeSqft!.min - b.sizeSqft!.min));

const projects: CatalogueProject[] = [];
const tr = await onemap("Thomson Reserve");
projects.push({
  id: "50ba3d549264456cbe67a97565d66d79", name: "Thomson Reserve", district: null, area: null, segment: null,
  address: tr.address, lat: tr.lat, lon: tr.lon, placedBy: "onemap", tenure: ds.project.tenure, developer: null,
  launchDate: huttonsSync.launchDate, launchNote: null, completionDate: huttonsSync.completionDate,
  totalUnits: ds.units.length, unitsLeft: ds.units.filter((u) => u.status === "available").length, unitTypes: trTypes,
});
const ids: Record<string, string> = {
  "Lentor Gardens Residences": "02a030d8f3ca4ed1b2093e94e3b31115", Lentoria: "e0d7efea415743a79d08cda8de572c09",
  "Springleaf Residence": "997843e71ffa45d08e3f20e2a0fd96ed", "Chuan Park": "eccc7150c2254954a2371b9655eb459c",
};
for (const a of alternatives) {
  const live = alternativesSync.projects[a.name];
  if (!live) continue;
  const at = await onemap(a.name);
  projects.push({
    id: ids[a.name] ?? a.name, name: a.name, district: null, area: null, segment: null, address: at.address, lat: at.lat, lon: at.lon,
    placedBy: "onemap", tenure: a.tenure, developer: a.developer, launchDate: null, launchNote: null, completionDate: null,
    totalUnits: live.totalUnits, unitsLeft: live.unitTypes.reduce((s, t) => s + (t.unitsLeft ?? 0), 0),
    unitTypes: live.unitTypes.map((t) => ({ ...t, total: null, fromPsf: null })),
  });
}
projects.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, `// Starter catalogue from scripts/huttons/seed-catalogue.mts: Thomson Reserve
// (Huttons unit list, ${huttonsSync.fetched}) and its alternatives (Huttons, ${alternativesSync.fetched}),
// placed with OneMap. Replaced by the first run of scripts/huttons/sync-catalogue.py.

import type { Catalogue } from "../model";

export const huttonsCatalogue: Catalogue = {
  source: "Huttons New Launch API",
  fetched: "${alternativesSync.fetched}",
  seed: true,
  projects: [
${projects.map((p) => "    " + JSON.stringify(p) + ",").join("\n")}
  ],
};
`);
console.log(`${projects.length} projects written to ${OUT}`);
