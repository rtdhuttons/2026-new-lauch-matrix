// MRT access — prefers recorded walking routes over straight-line distance.
// Walking time uses 80 m per minute (about 4.8 km/h) and excludes lift
// waiting time.

import type { DataStatus, ExternalRoute, Gate, InternalRoute, Point } from "../model/types";
import type { DatasetIndex } from "./dataset-index";
import { weakestStatus } from "./dataset-index";
import { distance } from "./geometry";

export const WALK_M_PER_MIN = 80;

export interface MrtOption {
  gate: Gate;
  internal: InternalRoute;
  external: ExternalRoute;
  totalM: number;
  minutes: number;
  /** Null when any part of the route has unknown shelter. */
  coveredM: number | null;
  status: DataStatus;
}

export interface MrtAccess {
  best: MrtOption | null;
  options: MrtOption[];
  straightLineM: number | null;
  destination: string | null;
  /** 0–100 where 5 minutes or less scores 100 and 15 minutes or more scores 0. */
  score: number | null;
  status: DataStatus;
}

export function mrtAccess(ix: DatasetIndex, stackId: string, mrtEntrance: Point | null): MrtAccess {
  const stack = ix.stack(stackId);
  const options: MrtOption[] = [];
  for (const internal of ix.ds.internalRoutes.filter((r) => r.blockId === stack.blockId)) {
    const external = ix.ds.externalRoutes.find((r) => r.gateId === internal.gateId);
    const gate = ix.ds.gates.find((g) => g.id === internal.gateId);
    if (!external || !gate) continue;
    const totalM = internal.distanceM + external.distanceM;
    options.push({
      gate,
      internal,
      external,
      totalM,
      minutes: Math.ceil(totalM / WALK_M_PER_MIN),
      coveredM:
        internal.coveredM === null || external.coveredM === null
          ? null
          : internal.coveredM + external.coveredM,
      status: weakestStatus([internal.provenance.status, external.provenance.status]),
    });
  }
  options.sort((a, b) => a.totalM - b.totalM);
  const best = options[0] ?? null;
  const score = best ? Math.max(0, Math.min(100, ((15 - best.minutes) / 10) * 100)) : null;
  return {
    best,
    options,
    straightLineM: mrtEntrance ? Math.round(distance(stack.position, mrtEntrance)) : null,
    destination: best?.external.destination ?? null,
    score,
    status: best?.status ?? "unknown",
  };
}
