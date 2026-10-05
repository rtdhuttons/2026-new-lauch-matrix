// The projects map's data: the Huttons catalogue, and the developments
// around it with sales and rents (URA, plus reports already in the repo).

import type { MarketData, MarketProject } from "../model";
import { reportEvidence } from "./evidence";
import { huttonsCatalogue } from "./huttons-catalogue";
import { uraMarket } from "./ura-market";

export const catalogue = huttonsCatalogue;

const key = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** URA's developments, with any report's matched-resale CAGR attached; report-only developments added. */
function mergeMarket(ura: MarketData, reports: MarketProject[]): MarketProject[] {
  const byName = new Map(ura.projects.map((p) => [key(p.name), p]));
  const out = ura.projects.map((p) => {
    const r = reports.find((x) => key(x.name) === key(p.name));
    return r?.matchedCagr ? { ...p, matchedCagr: r.matchedCagr } : p;
  });
  for (const r of reports) if (!byName.has(key(r.name))) out.push(r);
  return out;
}

export const market = { ...uraMarket, projects: mergeMarket(uraMarket, reportEvidence) };
export const uraLoaded = uraMarket.projects.length > 0;
