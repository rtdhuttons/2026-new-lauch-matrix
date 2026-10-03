// SAMPLE PROJECT — fictional, never to be published. It proves the website
// runs on any project bundle: it shares no names, units, schools, prices or
// view rules with Thomson Reserve, and most optional sections are left
// empty on purpose so the "not supplied yet" messages can be checked.

import type { ProjectBundle } from "../../model/project";
import { mrtEntrance } from "./access";
import { demo } from "./project";
import { demoDataset } from "./index";

export const sampleProject: ProjectBundle = {
  id: "sample-wrenfield",
  status: "sample",
  profile: {
    name: "Wrenfield Residences",
    address: null,
    developer: null,
    tenure: "99-year leasehold (illustrative)",
    district: null,
    towersSummary: "4 fictional blocks",
    nearestMrt: "MRT Exit B (fictional)",
    expectedCompletion: null,
    provenance: demo("Fictional sample project for testing the template"),
  },
  copy: {
    eyebrow: "Sample project · Fictional data · Not for publication",
    tagline: "A made-up development used to test the TRM website template. Nothing on this page describes a real property.",
    heroFacts: [
      { label: "Units", value: String(demoDataset.units.length) },
      { label: "Blocks", value: "4 (fictional)" },
      { label: "Status", value: "Sample only" },
    ],
    cardSummary: "Fictional sample project for testing the template.",
    galleryTitle: "Gallery",
    galleryLede: "No images supplied for this sample project.",
    locationTitle: "Location",
    locationLede: "No location information supplied for this sample project.",
    disclaimer:
      "Sample project with fictional data, for testing the TRM website template only. Not a real development and not for publication.",
  },
  dataset: demoDataset,
  mrtEntrance,
  media: { hero: null, gallery: [] },
  location: null,
  pricing: { estimate: null, estimateProvenance: null, priceList: null },
  payments: { schedule: null, scheduleProvenance: null, maintenance: null },
  schools: null,
  comparables: [],
  rentals: [],
  alternatives: [],
  pivot: { scores: null, overallStated: null, overallMethod: null, entry: null, exit: null, provenance: null },
  sources: [
    { item: "Everything on this page", kind: "illustrative", source: "TRM fictional sample data", checked: "2026-10-03", status: "assumed" },
  ],
  gaps: ["This is a fictional sample project. Replace it with a real project's bundle before any use."],
};
