// A project's chosen comparable(s) for its Investor tab: TRM's pick from the
// project sheet (chosen.ts) with the website's explanation (chosen-notes.ts).

import type { ComparableChoice } from "../../model/project";
import { chosenComparables } from "./chosen";
import { chosenNotes } from "./chosen-notes";

export function comparableChoiceFor(
  slug: string,
  subject: ComparableChoice["subject"],
  opts: { recordsLoaded?: boolean } = {},
): ComparableChoice | null {
  const entry = chosenComparables.projects.find((p) => p.slug === slug);
  if (!entry || entry.comparables.length === 0) return null;
  const names = entry.comparables.map((c) => c.name).join(" and ");
  return {
    comparables: entry.comparables,
    why: chosenNotes[slug] ?? entry.trmNote ?? `TRM chose ${names} as the comparable for resale and rental records.`,
    trmNote: entry.trmNote,
    subject,
    recordsLoaded: opts.recordsLoaded ?? false,
    asAt: chosenComparables.checked,
    provenance: {
      source: "TRM's choice of comparable (project sheet); distances and addresses from SLA OneMap; facts from the Huttons New Launch API where listed",
      updated: chosenComparables.checked,
      status: "verified",
      note: "Profit counts and years built are TRM's own review figures, not yet checked against URA's records.",
    },
  };
}

/** Still being built: OneMap marks it under construction, or its listed completion is after the date. */
export const stillBuilding = (c: ComparableChoice["comparables"][number], asAt: string) =>
  !!c.underConstruction || (!!c.huttons?.completion && c.huttons.completion > asAt);
