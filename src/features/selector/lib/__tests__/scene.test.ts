import { describe, expect, it } from "vitest";
import { demoDataset as dataset } from "../../data/demo";
import { floorRL } from "../geometry";
import { BASE_RL, buildScene, planRotationToY, sunVector } from "../scene";

describe("3D scene", () => {
  const scene = buildScene(dataset);

  it("has one box per unit, sitting on that unit's floor level", () => {
    expect(scene.units).toHaveLength(dataset.units.length);
    for (const b of scene.units.slice(0, 40)) {
      const stack = dataset.stacks.find((s) => s.id === b.unit.stackId)!;
      const block = dataset.blocks.find((x) => x.id === stack.blockId)!;
      expect(b.y - b.h / 2).toBeCloseTo(floorRL(block, b.unit.level) - BASE_RL + 0.175, 3);
    }
  });

  it("puts each stack's units in the block quadrant nearest the stack", () => {
    for (const s of dataset.stacks) {
      const box = scene.units.find((b) => b.unit.stackId === s.id)!;
      const d = Math.hypot(box.x - s.position.x, box.z - s.position.y);
      expect(d).toBeLessThan(12);
    }
  });

  it("labels every stack", () => {
    expect(scene.stackLabels.map((l) => l.stackId).sort()).toEqual(dataset.stacks.map((s) => s.id).sort());
  });

  it("matches plan rotation to the vertical-axis rotation", () => {
    expect(planRotationToY(90)).toBeCloseTo(-Math.PI / 2);
  });

  it("points the sun vector the right way", () => {
    const west = sunVector(270, 0);
    expect(west.x).toBeCloseTo(-1);
    const north = sunVector(0, 0);
    expect(north.z).toBeCloseTo(-1);
    expect(sunVector(0, 90).y).toBeCloseTo(1);
  });
});
