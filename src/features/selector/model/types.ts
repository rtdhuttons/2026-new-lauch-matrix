// Data model for the Stack & Unit Selector.
//
// Everything a buyer sees is derived from a `Dataset`. Each kind of data
// (project, stacks, units, obstructions, exposure sources, routes,
// transactions) lives in its own collection so a real project's data can
// replace the illustrative demo one collection at a time.

export type DataStatus = "verified" | "estimated" | "assumed" | "unknown";

export interface Provenance {
  source: string;
  /** ISO date the record was last checked or updated. */
  updated: string;
  status: DataStatus;
  note?: string;
}

/** A numeric value whose true figure may sit anywhere in [min, max]. */
export interface Range {
  min: number;
  max: number;
}

/** Plan coordinates in metres. x grows east, y grows south (SVG convention). */
export interface Point {
  x: number;
  y: number;
}

export interface Project {
  name: string;
  isDemo: boolean;
  demoNotice: string;
  tenure: string;
  totalUnits: number;
  siteBounds: { width: number; height: number };
  /** Bearing of plan "up" relative to true north. 0 means north is up. */
  planNorthDeg: number;
  latitudeDeg: number;
  longitudeDeg: number;
  /** UTC offset of local clock time, in hours. */
  utcOffsetHours: number;
  provenance: Provenance;
}

export interface Block {
  id: string;
  name: string;
  centre: Point;
  /** Footprint width along the local x axis and depth along local y, metres. */
  size: { w: number; h: number };
  /** Clockwise rotation of the footprint on plan, degrees. */
  rotationDeg: number;
  storeys: number;
  /** Finished ground level at the block, metres above Singapore Height Datum. */
  groundRL: number;
  level1HeightM: number;
  typicalFloorHeightM: number;
  roofAllowanceM: number;
  /** Levels without homes (sky terraces, M&E floors). */
  noUnitLevels: number[];
  firstResidentialLevel: number;
  provenance: Provenance;
}

export type LayoutFeature =
  | "corner"
  | "private lift lobby"
  | "enclosed kitchen"
  | "study"
  | "dual-aspect living"
  | "bedroom next to common corridor";

export interface Layout {
  id: string;
  name: string;
  bedrooms: number;
  areaSqft: number;
  features: LayoutFeature[];
  /** Depth of the balcony that overhangs the living room glass, metres. */
  livingOverhangM: number;
  /** Depth of ledge or fin over the master bedroom window, metres. */
  masterOverhangM: number;
  windowHeightM: number;
  provenance: Provenance;
}

export interface ViewSpec {
  label: string;
  bearingDeg: number;
  /** Half-width of the view cone tested with rays, degrees. */
  coneHalfWidthDeg: number;
  targetId: string;
  provenance: Provenance;
}

export interface Stack {
  id: string;
  blockId: string;
  layoutId: string;
  /** Where the stack sits on plan, used for rays and distances. */
  position: Point;
  livingBearingDeg: number;
  masterBearingDeg: number;
  mainView: ViewSpec;
  provenance: Provenance;
}

export type UnitStatus = "available" | "reserved" | "sold" | "not-released";

export interface Unit {
  id: string;
  stackId: string;
  level: number;
  status: UnitStatus;
  /** Only published for available units. Never interpolated. */
  price: number | null;
  priceProvenance: Provenance;
}

export type ObstructionKind =
  | "own-block"
  | "existing-building"
  | "tree-belt"
  | "landed-housing";

export interface Obstruction {
  id: string;
  name: string;
  kind: ObstructionKind;
  footprint: Point[];
  baseRL: number;
  /** Top of the obstruction, metres SHD. A range when height is uncertain. */
  topRL: Range;
  heightProvenance: Provenance;
  /** Own blocks are linked so a stack never obstructs itself. */
  blockId?: string;
}

export interface ViewTarget {
  id: string;
  name: string;
  footprint: Point[];
  /** Level of the visible surface (water, canopy, ridge), metres SHD. */
  surfaceRL: number;
  provenance: Provenance;
}

export type FutureRiskLevel = "low" | "moderate" | "high" | "unknown";

export interface FutureSite {
  id: string;
  name: string;
  footprint: Point[];
  planningNote: string;
  risk: FutureRiskLevel;
  provenance: Provenance;
}

export type ExposureKind =
  | "expressway"
  | "main-road"
  | "pool"
  | "playground"
  | "tennis"
  | "arrival-court"
  | "vehicle-ramp"
  | "walkway";

export interface ExposureSource {
  id: string;
  kind: ExposureKind;
  name: string;
  /** A point or a polyline; distance is measured to the nearest segment. */
  geometry: Point[];
  activity: string;
  provenance: Provenance;
}

export interface Gate {
  id: string;
  name: string;
  position: Point;
  opening: string;
}

export interface InternalRoute {
  blockId: string;
  gateId: string;
  path: Point[];
  distanceM: number;
  coveredM: number | null;
  provenance: Provenance;
}

export interface ExternalRoute {
  gateId: string;
  destination: string;
  /** Plan path to the edge of the plan; the rest is off-plan. */
  path: Point[];
  distanceM: number;
  coveredM: number | null;
  crossings: string;
  provenance: Provenance;
}

export interface Transaction {
  unitId: string;
  date: string;
  price: number;
  kind: "new-sale" | "resale" | "sub-sale";
  provenance: Provenance;
}

export interface NearbyProject {
  id: string;
  name: string;
  completion: string;
  distanceKm: number;
  comparable: { bedrooms: number; sizeSqft: Range; units: number }[];
  provenance: Provenance;
}

export interface Dataset {
  project: Project;
  blocks: Block[];
  layouts: Layout[];
  stacks: Stack[];
  units: Unit[];
  obstructions: Obstruction[];
  viewTargets: ViewTarget[];
  futureSites: FutureSite[];
  exposureSources: ExposureSource[];
  gates: Gate[];
  internalRoutes: InternalRoute[];
  externalRoutes: ExternalRoute[];
  transactions: Transaction[];
  nearbyProjects: NearbyProject[];
}
