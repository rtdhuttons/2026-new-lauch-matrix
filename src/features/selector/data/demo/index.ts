import type { Dataset } from "../../model/types";
import { exposureSources, externalRoutes, gates, internalRoutes } from "./access";
import { nearbyProjects, transactions } from "./market";
import { blocks, layouts, project, stacks } from "./project";
import { futureSites, obstructions, viewTargets } from "./surroundings";
import { units } from "./units";

export const demoDataset: Dataset = {
  project: { ...project, totalUnits: units.length },
  blocks,
  layouts,
  stacks,
  units,
  obstructions,
  viewTargets,
  futureSites,
  exposureSources,
  gates,
  internalRoutes,
  externalRoutes,
  transactions,
  nearbyProjects,
};
