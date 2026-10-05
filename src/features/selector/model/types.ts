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
  /**
   * What RL values are measured from when it is not Singapore Height Datum,
   * e.g. "Upper Thomson Road" when only heights above the road are known.
   */
  heightDatum?: string;
  provenance: Provenance;
  /** Optional map furniture for drawing the site. */
  display?: ProjectDisplay;
}

export interface ProjectDisplay {
  /** Site plan image laid under the plan, covering (0,0)–(widthM,heightM). */
  planImage?: {
    src: string;
    widthM: number;
    heightM: number;
    credit: string;
    /** Greyscale mask: white where the plan shows the site, black where the map beneath should show through. */
    maskSrc?: string;
  };
  /** Surrounding buildings, roads, parks and water from a map, in plan metres. */
  mapContext?: MapContext;
  roadLabels?: { text: string; at: Point; angleDeg: number; lengthM: number }[];
  mrtLabel?: { text: string; at: Point };
  /** Short banner shown above the selector. */
  notice: string;
  /** What the prices and unit types currently are, in plain words. */
  pricingNote: string;
  /** Colours for each unit type, matching the developer's elevation charts. */
  unitTypeColours?: { category: string; colour: string }[];
  unitTypeColoursCredit?: string;
  /** Distances marked on the developer's plans, drawn as lines in the 3D view. */
  distances?: SiteDistance[];
  distancesCredit?: string;
}

export interface SiteDistance {
  from: Point;
  to: Point;
  /** The figure printed on the developer's plan. */
  metres: number;
  /** What the line measures, e.g. "Block 11 to Block 1". */
  between: string;
  /** "blocks": between two towers; "edge": from a tower to the site boundary or a facility. */
  kind: "blocks" | "edge";
  note?: string;
}

export interface MapBuilding {
  footprint: Point[];
  /** Drawn height above the road, metres. */
  heightM: number;
  /** "levels": from the storeys the map records; "assumed": a house drawn at 2 storeys; "unknown": footprint only. */
  height: "levels" | "assumed" | "unknown";
  levels: number | null;
  label: string | null;
  /** Where the storey count comes from when it isn't OpenStreetMap, e.g. HDB's records. */
  levelsSource?: string;
}

export interface MapContext {
  buildings: MapBuilding[];
  roads: { path: Point[]; widthM: number }[];
  green: Point[][];
  water: Point[][];
  credit: string;
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
  /** Finished ground level at the block, metres above SHD (or `Project.heightDatum`). */
  groundRL: number;
  level1HeightM: number;
  typicalFloorHeightM: number;
  roofAllowanceM: number;
  /** Levels without homes (sky terraces, M&E floors). */
  noUnitLevels: number[];
  firstResidentialLevel: number;
  /** e.g. "Classic" or "Luxury" collection. */
  collection?: string;
  /** Traced outline when the block is not a simple rectangle. */
  footprint?: Point[];
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
  /** Developer's category, e.g. "3-Bedroom Premium". */
  category?: string;
  /** Null until the developer's unit schedule is known. */
  bedrooms: number | null;
  areaSqft: number | null;
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
  /** Plan footprint of one home on this stack, centred on `position`. */
  footprint?: { w: number; d: number; rotationDeg: number };
  /** Facts about this stack worth showing buyers, with their source. */
  notes?: string[];
  /**
   * First level whose main view clears the surroundings, from an on-site
   * assessment. When present it sets the View Clearance Floor Marker in
   * place of the geometric estimate.
   */
  observedClearance?: { fromLevel: number; over: string; provenance: Provenance };
  provenance: Provenance;
}

export type UnitStatus = "available" | "reserved" | "sold" | "not-released" | "pending";

export interface Unit {
  id: string;
  stackId: string;
  level: number;
  status: UnitStatus;
  /**
   * Published price for available units. Never interpolated from other
   * floors; an illustrative estimate is flagged with `priceIsEstimate`.
   */
  price: number | null;
  /** True when `price` is a TRM illustration from the user's PSF assumptions. */
  priceIsEstimate?: boolean;
  /** Developer's unit type code, e.g. "CP2p", when it differs by level. */
  typeCode?: string;
  /** The developer's floor plan for this unit's type, when published. */
  floorPlan?: { src: string; mirrored: boolean; credit: string };
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
  /** Already drawn by the map layer, so the 3D model doesn't add it again. */
  fromMap?: boolean;
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
  | "service-road"
  | "walkway";

export interface ExposureSource {
  id: string;
  kind: ExposureKind;
  name: string;
  /** A point or a polyline; distance is measured to the nearest segment. */
  geometry: Point[];
  /** Level the source sits at, metres; when unknown, sound paths use the obstruction's base. */
  levelRL?: number;
  activity: string;
  /** Buffers, planting or design measures between the source and the homes. */
  context?: string;
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

export interface ComparableTransaction {
  floor: number;
  areaSqft: number;
  bedrooms: number;
  purchaseDate: string | null;
  purchasePrice: number | null;
  saleDate: string;
  salePrice: number;
  /** Gross profit: sale price minus purchase price, before duties and fees. */
  profit: number;
  profitPsf: number | null;
  holdingYears: number;
  /** Annualised return, e.g. 0.0533 for 5.33% a year. */
  annualised: number;
}

/** Resale record of a similar, completed development, used as evidence. */
export interface ComparableProject {
  name: string;
  /** Where it is, in a few words, e.g. "Shunfu Road, District 20". */
  location?: string;
  transactions: ComparableTransaction[];
  excludedNote: string;
  /** True when bedroom counts were inferred (e.g. from size) rather than recorded. */
  bedroomsInferred: boolean;
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
  /** A completed development whose resales show how floor height paid off. */
  comparable?: ComparableProject;
}
