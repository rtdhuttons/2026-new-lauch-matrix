// Turns a Dataset into simple 3D massing for the site view.
//
// World axes: x = east, y = up, z = south (plan y). Heights are metres above
// BASE_RL so the scene sits near the origin. Everything here is plain data,
// so the geometry can be tested without a browser.

import type { Block, Dataset, Obstruction, Point, Unit } from "../model/types";
import { floorRL, rotate } from "./geometry";

export const BASE_RL = 22;

export interface Box {
  /** Centre of the box in world coordinates. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Rotation about the vertical axis, radians. */
  rotY: number;
}

export interface UnitBox extends Box {
  unit: Unit;
}

export interface Extrusion {
  id: string;
  name: string;
  kind: Obstruction["kind"];
  footprint: Point[];
  baseY: number;
  height: number;
}

export interface Tree {
  x: number;
  z: number;
  baseY: number;
  height: number;
}

export interface Label {
  text: string;
  x: number;
  y: number;
  z: number;
}

export interface SceneData {
  units: UnitBox[];
  podiums: Box[];
  roofs: Box[];
  plinths: Box[];
  buildings: Extrusion[];
  houses: Box[];
  trees: Tree[];
  stackLabels: (Label & { stackId: string })[];
  centre: { x: number; z: number };
  radius: number;
}

const y = (rl: number) => rl - BASE_RL;

/** Rotation about the vertical axis that matches a clockwise plan rotation. */
export const planRotationToY = (deg: number) => (-deg * Math.PI) / 180;

function localOf(block: Block, p: Point): Point {
  return rotate({ x: p.x - block.centre.x, y: p.y - block.centre.y }, -block.rotationDeg);
}

function worldOf(block: Block, local: Point): Point {
  const r = rotate(local, block.rotationDeg);
  return { x: block.centre.x + r.x, y: block.centre.y + r.y };
}

// Deterministic scatter so trees and houses never move between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function bounds(poly: Point[]) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

const GAP = 0.5;

export function buildScene(ds: Dataset): SceneData {
  const units: UnitBox[] = [];
  const podiums: Box[] = [];
  const roofs: Box[] = [];
  const plinths: Box[] = [];
  const stackLabels: SceneData["stackLabels"] = [];
  const groundY = 0;

  for (const block of ds.blocks) {
    const rotY = planRotationToY(block.rotationDeg);
    const { w, h } = block.size;
    const top = floorRL(block, block.storeys) + block.typicalFloorHeightM;

    // Platform the block stands on, from the base ground up to its own level.
    if (y(block.groundRL) > groundY + 0.2) {
      plinths.push({
        x: block.centre.x,
        z: block.centre.y,
        y: y(block.groundRL) / 2,
        w: w + 8,
        d: h + 8,
        h: y(block.groundRL),
        rotY,
      });
    }
    const podiumTop = floorRL(block, block.firstResidentialLevel);
    podiums.push({
      x: block.centre.x,
      z: block.centre.y,
      y: (y(block.groundRL) + y(podiumTop)) / 2,
      w,
      d: h,
      h: podiumTop - block.groundRL,
      rotY,
    });
    roofs.push({
      x: block.centre.x,
      z: block.centre.y,
      y: y(top) + block.roofAllowanceM / 4,
      w: w * 0.55,
      d: h * 0.5,
      h: block.roofAllowanceM / 2,
      rotY,
    });

    for (const stack of ds.stacks.filter((s) => s.blockId === block.id)) {
      const local = localOf(block, stack.position);
      const qx = Math.sign(local.x) * (w / 4);
      const qy = Math.sign(local.y) * (h / 4);
      const centre = worldOf(block, { x: qx, y: qy });
      for (const unit of ds.units.filter((u) => u.stackId === stack.id)) {
        const bottom = floorRL(block, unit.level);
        units.push({
          unit,
          x: centre.x,
          z: centre.y,
          y: y(bottom) + block.typicalFloorHeightM / 2,
          w: w / 2 - GAP,
          d: h / 2 - GAP,
          h: block.typicalFloorHeightM - 0.35,
          rotY,
        });
      }
      const labelPoint = worldOf(block, { x: Math.sign(local.x) * (w / 2 - 3), y: Math.sign(local.y) * (h / 2) });
      stackLabels.push({ stackId: stack.id, text: stack.id, x: labelPoint.x, y: y(top) + 3, z: labelPoint.y });
    }
  }

  const buildings: Extrusion[] = [];
  const houses: Box[] = [];
  const trees: Tree[] = [];
  const rand = seeded(20260930);

  for (const o of ds.obstructions) {
    if (o.kind === "own-block") continue;
    const midTop = (o.topRL.min + o.topRL.max) / 2;
    if (o.kind === "existing-building") {
      buildings.push({
        id: o.id,
        name: o.name,
        kind: o.kind,
        footprint: o.footprint,
        baseY: y(o.baseRL),
        height: midTop - o.baseRL,
      });
    } else if (o.kind === "tree-belt") {
      const b = bounds(o.footprint);
      for (let px = b.x1 + 6; px < b.x2; px += 13) {
        for (let py = b.y1 + 6; py < b.y2; py += 13) {
          trees.push({
            x: px + (rand() - 0.5) * 8,
            z: py + (rand() - 0.5) * 8,
            baseY: y(o.baseRL),
            height: (midTop - o.baseRL) * (0.8 + rand() * 0.25),
          });
        }
      }
    } else if (o.kind === "landed-housing") {
      const b = bounds(o.footprint);
      // Only the rows nearest the site; the rest of the estate is flat ground.
      for (let py = b.y1 + 10; py < Math.min(b.y2, b.y1 + 60); py += 24) {
        for (let px = b.x1 + 8; px < b.x2; px += 16) {
          const hh = (midTop - o.baseRL) * (0.75 + rand() * 0.25);
          houses.push({ x: px, z: py, y: y(o.baseRL) + hh / 2, w: 11, d: 14, h: hh, rotY: 0 });
        }
      }
    }
  }

  // A few trees inside the grounds for scale.
  for (const [tx, tz] of [
    [100, 130], [120, 150], [80, 170], [200, 140], [210, 20], [30, 90], [150, 90], [190, 175],
  ]) {
    trees.push({ x: tx, z: tz, baseY: 4, height: 10 + rand() * 4 });
  }

  const { width, height } = ds.project.siteBounds;
  return {
    units,
    podiums,
    roofs,
    plinths,
    buildings,
    houses,
    trees,
    stackLabels,
    centre: { x: width / 2, z: height / 2 },
    radius: Math.hypot(width, height) / 2,
  };
}

/** Unit vector pointing towards the sun, for a light or shadow direction. */
export function sunVector(azimuthDeg: number, altitudeDeg: number): { x: number; y: number; z: number } {
  const az = (azimuthDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  return {
    x: Math.sin(az) * Math.cos(alt),
    y: Math.sin(alt),
    z: -Math.cos(az) * Math.cos(alt),
  };
}

