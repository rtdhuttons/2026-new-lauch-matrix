// ILLUSTRATIVE DEMO DATA — a fictional price list and availability for
// Wrenfield Residences. Generated once from simple rules with a fixed seed
// so the demo is stable. A real price list replaces this module entirely;
// nothing else in the app depends on how these prices were produced.

import type { Unit, UnitStatus } from "../../model/types";
import { blocks, demo, layouts, stacks } from "./project";

// Deterministic pseudo-random numbers (mulberry32) so figures never change
// between page loads.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const basePsf: Record<string, number> = {
  "2A": 2380,
  "2S": 2330,
  "3A": 2260,
  "3P": 2290,
  "4P": 2240,
};

// The developer's own judgement of each stack, and where it starts charging
// a view premium. These deliberately do not always match the estimated
// clearance floors, which is what makes value comparisons interesting.
const stackPricing: Record<string, { factor: number; viewStepFrom?: number; viewStepPsf?: number }> = {
  "01": { factor: 1.03, viewStepFrom: 16, viewStepPsf: 45 },
  "02": { factor: 1.05, viewStepFrom: 14, viewStepPsf: 40 },
  "03": { factor: 0.99 },
  "04": { factor: 0.97, viewStepFrom: 20, viewStepPsf: 40 },
  "05": { factor: 1.02, viewStepFrom: 10, viewStepPsf: 30 },
  "06": { factor: 1.02, viewStepFrom: 16, viewStepPsf: 40 },
  "07": { factor: 0.96 },
  "08": { factor: 1.0, viewStepFrom: 8, viewStepPsf: 25 },
  "09": { factor: 0.98 },
  "10": { factor: 0.97 },
  "11": { factor: 0.99, viewStepFrom: 15, viewStepPsf: 35 },
  "12": { factor: 0.99, viewStepFrom: 15, viewStepPsf: 35 },
  "13": { factor: 1.05, viewStepFrom: 18, viewStepPsf: 50 },
  "14": { factor: 1.04, viewStepFrom: 18, viewStepPsf: 50 },
  "15": { factor: 1.0 },
  "16": { factor: 0.99 },
};

const PSF_PER_LEVEL = 9;

// A few units are pinned so the worked example in the explainer always has
// available units to compare.
const pinnedAvailable = new Set(["01-09", "01-13", "01-14", "01-20", "05-12", "05-23", "13-17", "13-20"]);

const next = rng(20260930);

export const units: Unit[] = stacks.flatMap((stack) => {
  const block = blocks.find((b) => b.id === stack.blockId)!;
  const layout = layouts.find((l) => l.id === stack.layoutId)!;
  const pricing = stackPricing[stack.id];
  const result: Unit[] = [];

  for (let level = block.firstResidentialLevel; level <= block.storeys; level++) {
    if (block.noUnitLevels.includes(level)) continue;
    const id = `${stack.id}-${String(level).padStart(2, "0")}`;

    let psf = basePsf[layout.id] * pricing.factor + PSF_PER_LEVEL * (level - 2);
    if (pricing.viewStepFrom && level >= pricing.viewStepFrom) {
      psf += pricing.viewStepPsf ?? 0;
    }
    const jitter = Math.round((next() - 0.5) * 12) * 1000;
    const price = Math.round((layout.areaSqft * psf) / 1000) * 1000 + jitter;

    const roll = next();
    const topReserved = level > block.storeys - 2;
    let status: UnitStatus;
    if (pinnedAvailable.has(id)) status = "available";
    else if (topReserved) status = roll < 0.5 ? "not-released" : "sold";
    else if (roll < 0.27) status = "sold";
    else if (roll < 0.35) status = "reserved";
    else if (roll < 0.4) status = "not-released";
    else status = "available";

    result.push({
      id,
      stackId: stack.id,
      level,
      status,
      price: status === "available" ? price : null,
      priceProvenance: demo(
        status === "available"
          ? "Illustrative list price"
          : "Price not shown for units that are not on sale",
      ),
    });
  }
  return result;
});
