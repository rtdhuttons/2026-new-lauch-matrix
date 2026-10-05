// A project bundle: everything the shared website needs to know about one
// development. The website, the 3D model and every calculator read only
// from a bundle, so another development is added by writing its bundle
// (see docs/adding-a-project.md and docs/project-intake-checklist.md),
// not by changing the shared code.
//
// Rules for bundle authors:
// - Never invent a figure. Leave a value null or an array empty and the
//   website shows a clear "not supplied yet" message instead.
// - Every important fact carries a source, a kind (below) and the date it
//   was last checked.
// - Project-specific rules (starting floors, view-clearance assessments,
//   illustrative pricing assumptions) live in the bundle, never in the
//   shared calculators.

import type { PriceEstimate } from "../lib/estimate";
import type { ComparableProject, Dataset, Point, Provenance } from "./types";

/**
 * Where a piece of information comes from. Shown to buyers so they can tell
 * a developer's figure from TRM's own assessment or an illustration.
 */
export type SourceKind =
  /** Developer's factsheet, brochure, plans, price list or renders. */
  | "developer"
  /** Government records: URA, LTA, MOE, SLA, IRAS, HDB. */
  | "official"
  /** Research reports, map data and portals (Huttons research, OpenStreetMap). */
  | "third-party"
  /** TRM's own on-site observations and professional judgement. */
  | "agent"
  /** Worked out by the website from the data above (traced positions, sun, heights). */
  | "calculated"
  /** Placeholder assumptions for illustration only (estimated prices). */
  | "illustrative";

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  developer: "Developer information",
  official: "Official record",
  "third-party": "Research or map data",
  agent: "TRM assessment",
  calculated: "Calculated estimate",
  illustrative: "Illustrative assumption",
};

/** One line in the project's source register. */
export interface SourceRecord {
  item: string;
  kind: SourceKind;
  source: string;
  /** ISO date the information was last checked. */
  checked: string;
  status: Provenance["status"];
  note?: string;
}

export interface HeroImage {
  src: string;
  srcSet: string;
  alt: string;
  /** Caption in the corner; "Artist's impression" unless the image may not be a render. */
  credit?: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  title: string;
  caption: string;
}

export interface ProjectProfile {
  name: string;
  /** Street address used for school distances and maps. */
  address: string | null;
  developer: string | null;
  tenure: string | null;
  district: string | null;
  /** e.g. "6 towers of 21 and 30 storeys". */
  towersSummary: string | null;
  /** Nearest MRT station as buyers know it, e.g. "Upper Thomson MRT". */
  nearestMrt: string | null;
  /** Expected completion (TOP); null until the developer confirms it. */
  expectedCompletion: { date: string; provenance: Provenance } | null;
  /** Sales launch date, when known. */
  launchDate?: { date: string; provenance: Provenance } | null;
  provenance: Provenance;
}

/** Words on the page that belong to this project. */
export interface ProjectCopy {
  /** Small line above the project name in the opening image. */
  eyebrow: string;
  /** One or two sentences under the name. */
  tagline: string;
  /** Up to four facts under the opening image. */
  heroFacts: { label: string; value: string }[];
  /** Home page card. */
  cardSummary: string;
  galleryTitle: string;
  galleryLede: string;
  locationTitle: string;
  locationLede: string;
  /** Footer disclaimer for this project's pages. */
  disclaimer: string;
}

export interface LocationInfo {
  map: HeroImage | null;
  /** Caption under the map, e.g. "Location map from the developer's marketing material. Not to scale." */
  mapCaption: string;
  groups: { title: string; items: string[] }[];
  provenance: Provenance;
}

export interface School {
  name: string;
  levels: ("primary" | "secondary" | "junior-college")[];
  /**
   * Distance from the project, only when measured. A project with several
   * addresses (blocks) has one distance per address.
   */
  distance: {
    byAddress: { address: string; metres: number }[];
    method: string;
    provenance: Provenance;
  } | null;
  /**
   * Distance category. "official" only from the official home-school
   * distance check (SLA OneMap); "indicative" when worked out from map data,
   * which may differ near 1 km or 2 km.
   */
  distanceCategory: { value: "within-1km" | "1-2km" | "outside-2km"; basis: "official" | "onemap" | "indicative" } | null;
  /** Past Primary 1 registration results, as published. */
  p1History: { year: number; phase: string; applicants: number | null; vacancies: number | null; balloted: boolean | null; provenance: Provenance }[];
  provenance: Provenance;
  /** True when TRM wants this school highlighted. */
  highlighted?: boolean;
  /** Short remark with its source, e.g. a TRM claim still to be checked officially. */
  note?: string;
}

export interface SchoolsInfo {
  /** Address the distances are measured from. */
  measuredFrom: string | null;
  /** P1 registration year the guidance applies to; null until checked. */
  registrationYear: number | null;
  schools: School[];
  provenance: Provenance;
}

/** Why a comparison project is a fair guide, trait by trait. */
export interface ComparableRelevance {
  trait: string;
  comparable: string;
  subject: string;
}

export interface ComparableEvidence {
  project: ComparableProject;
  relevance: ComparableRelevance[];
  /** Image shown beside the relevance table. */
  image: { src: string; alt: string; caption: string } | null;
}

export interface RentalRecord {
  /** First day of the lease month, ISO date. */
  month: string;
  areaSqft: { min: number; max: number };
  monthlyRent: number;
  /** Null when the record doesn't say. */
  bedrooms: number | null;
}

export interface RentalEvidence {
  project: string;
  records: RentalRecord[];
  provenance: Provenance;
  kind: SourceKind;
}

export interface AlternativeUnitType {
  bedrooms: number;
  /** As the project names it, e.g. "3BR Premium + Study". */
  type: string;
  sizeSqft: { min: number; max: number } | null;
  /** Lowest price among the remaining units of this type. */
  fromPrice: number | null;
  /** Units of this type still available; null if not stated. */
  unitsLeft: number | null;
}

export interface AlternativeProject {
  name: string;
  /** The role it plays in the comparison, e.g. "The space alternative". */
  tag: string;
  why: string;
  bestFor: string | null;
  developer: string | null;
  nearestMrt: string | null;
  totalUnits: number | null;
  tenure: string | null;
  /** Expected completion; where sources differ, the range is given. */
  completion: string | null;
  image: { src: string; alt: string } | null;
  unitTypes: AlternativeUnitType[];
  /** Where the project facts (developer, units, tenure, completion) come from. */
  factsSource: { source: string; checked: string; note?: string } | null;
  /** What the prices are, e.g. "Lowest price among remaining units". */
  priceBasis: string;
  provenance: Provenance;
  kind: SourceKind;
}

export interface PaymentScheduleStage {
  stage: string;
  percent: number;
  /** Estimated date, labelled as such until confirmed. */
  expected: string | null;
  estimatedDate: boolean;
}

export interface PaymentsInfo {
  /** Developer's payment schedule; null until supplied. */
  schedule: PaymentScheduleStage[] | null;
  scheduleProvenance: Provenance | null;
  /** Monthly maintenance estimates by unit type or size, when supplied. */
  maintenance: { label: string; monthly: number }[] | null;
}

export interface PricingInfo {
  /**
   * Illustrative pricing used until the developer's price list arrives.
   * Null means "no illustrative prices for this project".
   */
  estimate: PriceEstimate | null;
  estimateProvenance: Provenance | null;
  /** The developer's dated price list, once loaded into the units. */
  priceList: { date: string; provenance: Provenance } | null;
}

/** TRM's PIVOT categories: Product mix, Investment entry, Value-add, Opportunity zone, Timing of exit. */
export type PivotCategory = "product-mix" | "investment-entry" | "value-add" | "opportunity-zone" | "timing-of-exit";

/** Entry-price estimate from the land bid, as TRM's e-book works it out. */
export interface PivotEntryEstimate {
  landPrice: number;
  /** Land price per sq ft of permissible gross floor area ("psf ppr"). */
  landPsfPpr: number;
  constructionPsf: number;
  /** e.g. 0.15 for a 15% developer margin. */
  profitMargin: number;
  /** e.g. 0.15 for the e-book's further 15% "breakeven cost" step. */
  breakevenUplift: number;
  /** The e-book's stated result, kept to check the calculation reproduces it. */
  statedPsf: number;
  provenance: Provenance;
}

export interface PivotInfo {
  /** TRM's scores out of 10, with the reason given for each. */
  scores: { category: PivotCategory; score: number; reason: string }[] | null;
  /** Overall rating as stated in the assessment; the method behind it is recorded separately. */
  overallStated: number | null;
  /** How the overall is worked out, once TRM confirms it. */
  overallMethod: string | null;
  entry: PivotEntryEstimate | null;
  provenance: Provenance | null;
}

export interface ProjectBundle {
  /** URL slug, e.g. "thomson-reserve". */
  id: string;
  /** "live" can be published; "sample" is fictional and must never be. */
  status: "live" | "sample";
  profile: ProjectProfile;
  copy: ProjectCopy;
  /** Site plan, blocks, stacks, floors, units, layouts, surroundings, routes, noise. */
  dataset: Dataset;
  /** MRT entrance on the plan, for walking times. */
  mrtEntrance: Point | null;
  media: {
    hero: HeroImage | null;
    gallery: GalleryImage[];
    /** A photo for the numbers-heavy tabs, to break up the figures. */
    tabPhotos?: Partial<Record<"units" | "schools" | "investor" | "alternatives" | "pivot" | "upgrading", GalleryImage>>;
    /** The website's page showing the towers in Google's 3D city, if any (not in the single-page build). */
    city3d?: string;
  };
  location: LocationInfo | null;
  pricing: PricingInfo;
  payments: PaymentsInfo;
  schools: SchoolsInfo | null;
  /** Comparison projects with resale records (historical profitability). */
  comparables: ComparableEvidence[];
  rentals: RentalEvidence[];
  alternatives: AlternativeProject[];
  pivot: PivotInfo;
  /** Important facts with their kind, source and checked date. */
  sources: SourceRecord[];
  /** Information still missing, in plain words. */
  gaps: string[];
}
