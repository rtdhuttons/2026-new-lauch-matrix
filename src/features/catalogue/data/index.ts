// The projects map's data: the Huttons catalogue, and the developments
// around it with sales and rents (URA, plus reports already in the repo).

import type { MarketData, MarketProject } from "../model";
import { reportEvidence } from "./evidence";
import { huttonsCatalogue } from "./huttons-catalogue";
import { uraMarket } from "./ura-market";

export const catalogue = huttonsCatalogue;

const key = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "");
const SMALL = new Set(["at", "of", "the", "by", "on", "and"]);
/** URA's "THOMSON VIEW CONDOMINIUM" -> "Thomson View Condominium" for display. */
const title = (name: string) =>
  name === name.toUpperCase()
    ? name
        .toLowerCase()
        .split(" ")
        .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ")
    : name;

/** URA's developments, with any report's matched-resale CAGR attached; report-only developments added. */
function mergeMarket(ura: MarketData, reports: MarketProject[]): MarketProject[] {
  const byName = new Map(ura.projects.map((p) => [key(p.name), p]));
  const out = ura.projects.map((p) => {
    const r = reports.find((x) => key(x.name) === key(p.name));
    return { ...p, name: r ? r.name : title(p.name), ...(r?.matchedCagr ? { matchedCagr: r.matchedCagr } : {}) };
  });
  for (const r of reports) if (!byName.has(key(r.name))) out.push(r);
  return out;
}

export const market = { ...uraMarket, projects: mergeMarket(uraMarket, reportEvidence) };
export const uraLoaded = uraMarket.projects.length > 0;
