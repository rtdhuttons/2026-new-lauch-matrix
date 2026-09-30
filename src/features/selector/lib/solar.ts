// Sun exposure — ILLUSTRATIVE GEOMETRIC ESTIMATE
//
// Sun positions use the standard NOAA approximation, which is accurate to
// well under a degree. Everything else is simplified: buildings are prisms
// from the plan, balconies are a single overhang depth, and a facade counts
// as sunlit when direct sun reaches most of the window. This is not a
// verified solar simulation. Any provider that returns the same
// `ExposureEstimate` shape (for example a proper daylight model) can
// replace `geometricSunProvider` without touching the UI.

import type { DataStatus, Unit } from "../model/types";
import type { DatasetIndex } from "./dataset-index";
import { angleDiff, bearingVector, floorRL, rayPolygonSpan } from "./geometry";

const DEG = Math.PI / 180;

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Afternoon window used for "direct afternoon sun", local clock time. */
export const AFTERNOON = { startMin: 12 * 60, endMin: 19 * 60 + 30 };
const STEP_MIN = 10;

export interface SunPosition {
  altitudeDeg: number;
  azimuthDeg: number;
}

/** Sun position for a local clock time on the 21st of a month. */
export function sunPosition(
  month: number,
  minutes: number,
  latDeg: number,
  lonDeg: number,
  utcOffsetHours: number,
): SunPosition {
  const dayOfYear = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355][month];
  const hour = minutes / 60;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - utcOffsetHours - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const trueSolarMin = minutes + eqTime + 4 * lonDeg - 60 * utcOffsetHours;
  const ha = (trueSolarMin / 4 - 180) * DEG;
  const lat = latDeg * DEG;
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const altitude = 90 - Math.acos(Math.max(-1, Math.min(1, cosZen))) / DEG;
  const az =
    Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / DEG +
    180;
  return { altitudeDeg: altitude, azimuthDeg: ((az % 360) + 360) % 360 };
}

export type Facade = "living" | "master";

export type SunState =
  | { kind: "sunlit" }
  | { kind: "night" }
  | { kind: "facing-away" }
  | { kind: "overhang" }
  | { kind: "building"; name: string };

export interface ShadingSummary {
  /** Minutes per year the sun faces this window but something shades it. */
  byOverhangMin: number;
  byBuildings: { name: string; minutes: number; months: string[] }[];
}

export interface FacadeExposure {
  facade: Facade;
  bearingDeg: number;
  /** Direct afternoon sun, minutes, for each month (21st of the month). */
  monthlyAfternoonMin: number[];
  annualAverageMin: number;
  peakMonths: string[];
  shading: ShadingSummary;
}

export interface ExposureEstimate {
  unitId: string;
  living: FacadeExposure;
  master: FacadeExposure;
  status: DataStatus;
  method: string;
}

export interface SunProvider {
  estimate(unit: Unit): ExposureEstimate;
  stateAt(unit: Unit, facade: Facade, month: number, minutes: number): SunState;
}

const WINDOW_MID_M = 1.3;
/** Share of window height that must be in shadow to count as shaded. */
const OVERHANG_SHADE_SHARE = 0.6;

export function geometricSunProvider(ix: DatasetIndex): SunProvider {
  const { project } = ix.ds;
  const cache = new Map<string, ExposureEstimate>();

  function stateAt(unit: Unit, facade: Facade, month: number, minutes: number): SunState {
    const stack = ix.stack(unit.stackId);
    const block = ix.stackBlock(unit.stackId);
    const layout = ix.stackLayout(unit.stackId);
    const sun = sunPosition(
      month,
      minutes,
      project.latitudeDeg,
      project.longitudeDeg,
      project.utcOffsetHours,
    );
    if (sun.altitudeDeg <= 2) return { kind: "night" };
    const bearing = facade === "living" ? stack.livingBearingDeg : stack.masterBearingDeg;
    const incidence = angleDiff(sun.azimuthDeg, bearing);
    if (Math.abs(incidence) >= 85) return { kind: "facing-away" };

    // Balcony or ledge overhang: vertical shadow (profile) angle.
    const overhang = facade === "living" ? layout.livingOverhangM : layout.masterOverhangM;
    const tanProfile = Math.tan(sun.altitudeDeg * DEG) / Math.cos(incidence * DEG);
    if (overhang * tanProfile >= OVERHANG_SHADE_SHARE * layout.windowHeightM) {
      return { kind: "overhang" };
    }

    // Buildings between the window and the sun.
    const windowRL = floorRL(block, unit.level) + WINDOW_MID_M;
    const dir = bearingVector(sun.azimuthDeg, project.planNorthDeg);
    const tanAlt = Math.tan(sun.altitudeDeg * DEG);
    for (const o of ix.ds.obstructions) {
      if (o.blockId === stack.blockId) continue;
      if (o.kind === "landed-housing") continue;
      const span = rayPolygonSpan(stack.position, dir, o.footprint);
      if (!span) continue;
      const topMid = (o.topRL.min + o.topRL.max) / 2;
      if (windowRL + Math.max(span.near, 1) * tanAlt < topMid) {
        return { kind: "building", name: o.name };
      }
    }
    return { kind: "sunlit" };
  }

  function facadeExposure(unit: Unit, facade: Facade): FacadeExposure {
    const stack = ix.stack(unit.stackId);
    const monthly: number[] = [];
    let byOverhang = 0;
    const byBuilding = new Map<string, { minutes: number; months: Set<string> }>();

    for (let m = 0; m < 12; m++) {
      let lit = 0;
      for (let t = AFTERNOON.startMin; t < AFTERNOON.endMin; t += STEP_MIN) {
        const s = stateAt(unit, facade, m, t);
        if (s.kind === "sunlit") lit += STEP_MIN;
        else if (s.kind === "overhang") byOverhang += STEP_MIN * 30.4;
        else if (s.kind === "building") {
          const e = byBuilding.get(s.name) ?? { minutes: 0, months: new Set<string>() };
          e.minutes += STEP_MIN * 30.4;
          e.months.add(MONTHS[m]);
          byBuilding.set(s.name, e);
        }
      }
      monthly.push(lit);
    }

    const annualAverage = monthly.reduce((a, b) => a + b, 0) / 12;
    const max = Math.max(...monthly);
    const peakMonths =
      max === 0
        ? []
        : MONTHS.filter((_, i) => monthly[i] >= Math.max(30, max * 0.8));

    return {
      facade,
      bearingDeg: facade === "living" ? stack.livingBearingDeg : stack.masterBearingDeg,
      monthlyAfternoonMin: monthly,
      annualAverageMin: annualAverage,
      peakMonths,
      shading: {
        byOverhangMin: Math.round(byOverhang),
        byBuildings: [...byBuilding.entries()]
          .map(([name, e]) => ({ name, minutes: Math.round(e.minutes), months: [...e.months] }))
          .sort((a, b) => b.minutes - a.minutes),
      },
    };
  }

  return {
    stateAt,
    estimate(unit) {
      const hit = cache.get(unit.id);
      if (hit) return hit;
      const result: ExposureEstimate = {
        unitId: unit.id,
        living: facadeExposure(unit, "living"),
        master: facadeExposure(unit, "master"),
        status: "estimated",
        method:
          "Illustrative geometric estimate: real sun positions, simplified building shapes and balcony depths. Not a verified solar simulation.",
      };
      cache.set(unit.id, result);
      return result;
    },
  };
}

export function formatMinutes(min: number): string {
  if (min < 5) return "None";
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `.${String(m).padStart(2, "0")}` : ""}${suffix}`;
}
