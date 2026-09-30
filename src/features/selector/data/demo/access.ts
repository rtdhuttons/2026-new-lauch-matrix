// ILLUSTRATIVE DEMO DATA — exposure sources, gates and walking routes for
// the fictional Wrenfield Residences. Routes are drawn on the illustrative
// plan; none were walked or measured.

import type {
  ExposureSource,
  ExternalRoute,
  Gate,
  InternalRoute,
  Point,
} from "../../model/types";
import { polylineLength } from "../../lib/geometry";
import { demo, estimatedDemo } from "./project";

export const exposureSources: ExposureSource[] = [
  {
    id: "expressway",
    kind: "expressway",
    name: "Kestrel Expressway",
    geometry: [
      { x: 365, y: -260 },
      { x: 335, y: 420 },
    ],
    activity: "All day and night; heavy vehicles more noticeable late at night",
    provenance: demo(),
  },
  {
    id: "wrenfield-ave",
    kind: "main-road",
    name: "Wrenfield Avenue",
    geometry: [
      { x: 252, y: -200 },
      { x: 252, y: 380 },
    ],
    activity: "Peak-hour traffic and buses, about 6.30–9.30am and 5–8pm",
    provenance: demo(),
  },
  {
    id: "reservoir-rd",
    kind: "main-road",
    name: "Reservoir Road",
    geometry: [
      { x: -200, y: -12 },
      { x: 420, y: -12 },
    ],
    activity: "Moderate traffic; park visitors' cars at weekends",
    provenance: demo(),
  },
  {
    id: "lap-pool",
    kind: "pool",
    name: "50 m lap pool and pool deck",
    geometry: [
      { x: 92, y: 88 },
      { x: 132, y: 98 },
    ],
    activity: "7am–10pm; busier at weekends and in school holidays",
    provenance: demo(),
  },
  {
    id: "playground",
    kind: "playground",
    name: "Children's playground",
    geometry: [{ x: 100, y: 168 }],
    activity: "After school and weekends, roughly 4–8pm",
    provenance: demo(),
  },
  {
    id: "tennis",
    kind: "tennis",
    name: "Tennis court (floodlit)",
    geometry: [{ x: 218, y: 105 }],
    activity: "Evenings and weekends; floodlit until 10pm",
    provenance: demo(),
  },
  {
    id: "arrival",
    kind: "arrival-court",
    name: "Arrival court and drop-off",
    geometry: [{ x: 222, y: 38 }],
    activity: "School drop-offs 6.45–8am, deliveries through the day, taxis at night",
    provenance: demo(),
  },
  {
    id: "ramp",
    kind: "vehicle-ramp",
    name: "Basement car park ramp",
    geometry: [{ x: 228, y: 72 }],
    activity: "Vehicle movement at morning and evening peaks",
    provenance: demo(),
  },
];

export const gates: Gate[] = [
  {
    id: "main",
    name: "Main gate, Wrenfield Avenue",
    position: { x: 240, y: 40 },
    opening: "24 hours",
  },
  {
    id: "south",
    name: "South pedestrian gate",
    position: { x: 118, y: 190 },
    opening: "6am to midnight, card access",
  },
];

function internal(
  blockId: string,
  gateId: string,
  path: Point[],
  coveredM: number | null,
): InternalRoute {
  return {
    blockId,
    gateId,
    path,
    distanceM: Math.round(polylineLength(path)),
    coveredM,
    provenance: estimatedDemo("Measured along paths drawn on the illustrative plan"),
  };
}

export const internalRoutes: InternalRoute[] = [
  internal("B1", "main", [{ x: 86, y: 44 }, { x: 130, y: 22 }, { x: 240, y: 40 }], 140),
  internal("B1", "south", [{ x: 70, y: 58 }, { x: 88, y: 110 }, { x: 110, y: 176 }, { x: 118, y: 190 }], 60),
  internal("B2", "main", [{ x: 190, y: 50 }, { x: 240, y: 40 }], 51),
  internal("B2", "south", [{ x: 150, y: 64 }, { x: 118, y: 120 }, { x: 118, y: 190 }], 40),
  internal("B3", "main", [{ x: 62, y: 110 }, { x: 110, y: 80 }, { x: 130, y: 22 }, { x: 240, y: 40 }], 120),
  internal("B3", "south", [{ x: 62, y: 150 }, { x: 100, y: 178 }, { x: 118, y: 190 }], 67),
  internal("B4", "main", [{ x: 180, y: 118 }, { x: 236, y: 80 }, { x: 240, y: 40 }], null),
  internal("B4", "south", [{ x: 140, y: 150 }, { x: 118, y: 190 }], 46),
];

export const externalRoutes: ExternalRoute[] = [
  {
    gateId: "south",
    destination: "Wrenfield MRT, Exit B",
    path: [{ x: 118, y: 190 }, { x: 118, y: 212 }, { x: 330, y: 212 }],
    distanceM: 420,
    coveredM: 150,
    crossings: "One signalised crossing at Kestrel Road",
    provenance: estimatedDemo("Illustrative route; not walked or timed"),
  },
  {
    gateId: "main",
    destination: "Wrenfield MRT, Exit B",
    path: [{ x: 240, y: 40 }, { x: 258, y: 40 }, { x: 258, y: 212 }, { x: 330, y: 212 }],
    distanceM: 560,
    coveredM: 0,
    crossings: "Crosses the car park ramp entrance and one signalised junction",
    provenance: estimatedDemo("Illustrative route; not walked or timed"),
  },
];

/** Where the MRT entrance sits off-plan, for the straight-line comparison. */
export const mrtEntrance: Point = { x: 420, y: 250 };
