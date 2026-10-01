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
  shape: "round" | "cone";
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
  /** One name tag per block, floating above its roof. */
  blockLabels: (Label & { blockId: string })[];
  lawns: Box[];
  centre: { x: number; z: number };
  radius: number;
}

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
  const blockLabels: SceneData["blockLabels"] = [];
  const groundY = 0;
  // The lowest block sits on the ground plane, so a site measured from a
  // road datum (or on high ground) still starts at the origin.
  const baseRL = Math.min(BASE_RL, ...ds.blocks.map((b) => b.groundRL));
  const y = (rl: number) => rl - baseRL;

  for (const block of ds.blocks) {
    const blockStacks = ds.stacks.filter((s) => s.blockId === block.id);
    const top = floorRL(block, block.storeys) + block.typicalFloorHeightM;
    const podiumTop = floorRL(block, block.firstResidentialLevel);
    blockLabels.push({ blockId: block.id, text: block.name.replace(/^Block /, "BLK "), x: block.centre.x, y: y(top) + 14, z: block.centre.y });

    if (blockStacks.some((s) => s.footprint)) {
      // Traced layout: each stack is its own column of homes.
      for (const stack of blockStacks) {
        const fp = stack.footprint ?? { w: 9, d: 9, rotationDeg: 0 };
        const rotY = planRotationToY(fp.rotationDeg);
        const base = { x: stack.position.x, z: stack.position.y, w: fp.w, d: fp.d, rotY };
        // Podium from the ground plane up to the first homes (car park decks, raised platforms).
        if (y(podiumTop) > 0.2) podiums.push({ ...base, y: y(podiumTop) / 2, h: y(podiumTop) });
        roofs.push({ ...base, w: fp.w * 0.9, d: fp.d * 0.9, y: y(top) + 0.4, h: 0.8 });
        for (const unit of ds.units.filter((u) => u.stackId === stack.id)) {
          units.push({
            unit,
            ...base,
            w: fp.w - GAP,
            d: fp.d - GAP,
            y: y(floorRL(block, unit.level)) + block.typicalFloorHeightM / 2,
            h: block.typicalFloorHeightM - 0.35,
          });
        }
        stackLabels.push({ stackId: stack.id, text: stack.id, x: stack.position.x, y: y(top) + 3, z: stack.position.y });
      }
      continue;
    }

    const rotY = planRotationToY(block.rotationDeg);
    const { w, h } = block.size;

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

    for (const stack of blockStacks) {
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
  // A real site plan image already shows the landscape, so only the
  // illustrative demo gets generated planting, houses and trees.
  const decorate = !ds.project.display?.planImage;

  for (const o of ds.obstructions) {
    if (o.kind === "own-block" || o.fromMap) continue;
    if (!decorate && o.kind !== "existing-building") continue;
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
            shape: rand() < 0.3 ? "cone" : "round",
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

  const { width, height } = ds.project.siteBounds;
  const SITE_Y = 4;

  // Planting along the site boundary, leaving gaps at the gates.
  const nearGate = (px: number, pz: number) =>
    ds.gates.some((g) => Math.hypot(g.position.x - px, g.position.y - pz) < 14);
  const edge: Point[] = [];
  for (let px = 6; px <= width - 6; px += 9) edge.push({ x: px, y: 5 }, { x: px, y: height - 5 });
  for (let pz = 14; pz <= height - 14; pz += 9) edge.push({ x: 5, y: pz }, { x: width - 5, y: pz });
  for (const p of edge) {
    if (!decorate) break;
    if (nearGate(p.x, p.y)) continue;
    trees.push({
      x: p.x + (rand() - 0.5) * 3,
      z: p.y + (rand() - 0.5) * 3,
      baseY: SITE_Y,
      height: 8 + rand() * 6,
      shape: rand() < 0.45 ? "cone" : "round",
    });
  }

  // Garden clusters between the blocks, kept clear of block footprints.
  const clusters: [number, number][] = [
    [104, 124], [128, 152], [86, 168], [206, 150], [212, 18], [26, 86], [150, 96], [196, 176], [112, 60], [140, 22],
  ];
  for (const [cx, cz] of clusters) {
    if (!decorate) break;
    for (let i = 0; i < 4; i++) {
      trees.push({
        x: cx + (rand() - 0.5) * 16,
        z: cz + (rand() - 0.5) * 16,
        baseY: SITE_Y,
        height: 7 + rand() * 6,
        shape: rand() < 0.5 ? "cone" : "round",
      });
    }
  }

  // Scattered trees in the open ground around the site.
  for (let i = 0; i < 70; i++) {
    if (!decorate) break;
    const px = -120 + rand() * 540;
    const pz = -20 + rand() * 280;
    const insideSite = px > -6 && px < width + 6 && pz > -6 && pz < height + 6;
    const onBuilding = ds.obstructions.some((o) => {
      const b = bounds(o.footprint);
      return px > b.x1 - 6 && px < b.x2 + 6 && pz > b.y1 - 6 && pz < b.y2 + 6;
    });
    const onRoad = Math.abs(px - 252) < 12 || Math.abs(pz + 12) < 10 || Math.abs(px - 350) < 22;
    if (insideSite || onBuilding || onRoad) continue;
    trees.push({ x: px, z: pz, baseY: 0, height: 7 + rand() * 7, shape: rand() < 0.6 ? "cone" : "round" });
  }

  const lawns: Box[] = !decorate ? [] : [
    { x: 104, y: SITE_Y + 0.08, z: 128, w: 46, h: 0.15, d: 30, rotY: 0 },
    { x: 196, y: SITE_Y + 0.08, z: 172, w: 60, h: 0.15, d: 22, rotY: 0 },
    { x: 26, y: SITE_Y + 0.08, z: 72, w: 26, h: 0.15, d: 40, rotY: 0 },
  ];
  return {
    units,
    podiums,
    roofs,
    plinths,
    buildings,
    houses,
    trees,
    stackLabels,
    blockLabels,
    lawns,
    centre: { x: width / 2, z: height / 2 },
    radius: Math.hypot(width, height) / 2,
  };
}

/**
 * Unit vector pointing towards the sun in world space. `planNorthDeg` is the
 * true bearing of plan "up", so a rotated site plan still gets the real sun.
 */
export function sunVector(
  azimuthDeg: number,
  altitudeDeg: number,
  planNorthDeg = 0,
): { x: number; y: number; z: number } {
  const az = ((azimuthDeg - planNorthDeg) * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  return {
    x: Math.sin(az) * Math.cos(alt),
    y: Math.sin(alt),
    z: -Math.cos(az) * Math.cos(alt),
  };
}

