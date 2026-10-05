// Data for the Huttons projects map: every project from the Huttons New
// Launch API (scripts/huttons/sync-catalogue.py) and the private home sales
// and rents around them from URA (scripts/ura/sync-transactions.py).

export interface CatalogueUnitType {
  bedrooms: number;
  type: string;
  sizeSqft: { min: number; max: number } | null;
  /** All units of this type, sold or not; null when not known. */
  total: number | null;
  unitsLeft: number | null;
  /** Lowest price among the units still available; null until released. */
  fromPrice: number | null;
  /** Price per sq ft of that lowest-priced unit. */
  fromPsf: number | null;
  /** Highest price among the units still available. */
  toPrice?: number | null;
  /** Price per sq ft across the available, priced units of this type. */
  psfRange?: { min: number; max: number; avg: number; units: number } | null;
}

export interface CatalogueProject {
  id: string;
  name: string;
  /** Postal district, e.g. "D20". */
  district: string | null;
  /** The district's areas, e.g. "Ang Mo Kio / Bishan / Thomson". */
  area: string | null;
  segment: "CCR" | "RCR" | "OCR" | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  /** Where the position came from: the API, or OneMap from the address. */
  placedBy: "huttons" | "onemap" | null;
  tenure: string | null;
  developer: string | null;
  launchDate: string | null;
  launchNote: string | null;
  completionDate: string | null;
  totalUnits: number | null;
  unitsLeft: number | null;
  unitTypes: CatalogueUnitType[];
  /** The project's main image from the API, where given (a web address). */
  image?: string | null;
}

export interface Catalogue {
  source: string;
  fetched: string;
  /** True until the first full sync: a few projects already in the repo. */
  seed: boolean;
  projects: CatalogueProject[];
}

export interface MarketYear {
  year: number;
  count: number;
  medianPsf: number;
  newSale: number;
  subSale: number;
  resale: number;
}

export interface MarketRent {
  bedrooms: number | null;
  count: number;
  medianRent: number;
  /** Monthly rent per sq ft, from the middle of URA's area band. */
  medianPsf: number | null;
}

/** [month "YYYY-MM", sale type, floor range, area sq ft, price, price psf] */
export type MarketSale = [string, "new" | "sub" | "resale" | "other", string | null, number, number, number];

export interface MarketProject {
  name: string;
  street: string;
  lat: number;
  lon: number;
  segment: string | null;
  district: string | null;
  tenure: string | null;
  propertyType: string | null;
  sales: MarketYear[];
  recentSales: MarketSale[];
  rentals: MarketRent[];
  /** A CAGR worked out from matched purchase and resale records, where a report gives them. */
  matchedCagr?: { rate: number; resales: number; source: string };
  /** Where this project's figures come from, when not the file's source. */
  source?: string;
}

/** Average price per sq ft of private home sales in a postal district over the last 12 months. */
export interface DistrictPsf {
  /** "D20". */
  district: string;
  sales: number;
  avgPsf: number;
  medianPsf: number;
}

export interface MarketData {
  source: string;
  fetched: string;
  radiusKm: number;
  rentalPeriod: string;
  projects: MarketProject[];
  /** Island-wide, by postal district, over the 12 months to `districtPeriod`. */
  districts?: DistrictPsf[];
  districtPeriod?: string;
}
