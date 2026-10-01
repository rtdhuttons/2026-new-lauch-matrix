"use client";

// The neighbourhood from the map, drawn as a few merged meshes so a
// thousand buildings and hundreds of roads stay cheap to render.

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapContext, Point } from "../model/types";

const toShape = (pts: Point[]) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  for (const p of parts) p.dispose();
  return g;
}

function extrusions(footprints: { footprint: Point[]; heightM: number }[]) {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of footprints) {
    if (b.footprint.length < 3) continue;
    const g = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: b.heightM, bevelEnabled: false });
    g.deleteAttribute("uv");
    g.clearGroups();
    g.rotateX(-Math.PI / 2);
    parts.push(g);
  }
  return merged(parts);
}

function flats(rings: Point[][]) {
  const parts: THREE.BufferGeometry[] = [];
  for (const r of rings) {
    if (r.length < 3) continue;
    const g = new THREE.ShapeGeometry(toShape(r));
    g.deleteAttribute("uv");
    g.rotateX(-Math.PI / 2);
    parts.push(g);
  }
  return merged(parts);
}

/** Road ribbons: a quad per segment and a disc at each bend so corners join cleanly. */
function ribbons(roads: MapContext["roads"]) {
  const pos: number[] = [];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) =>
    pos.push(a[0], 0, a[1], b[0], 0, b[1], c[0], 0, c[1]);
  for (const { path, widthM } of roads) {
    const h = widthM / 2;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) continue;
      const nx = (-(b.y - a.y) / len) * h;
      const ny = ((b.x - a.x) / len) * h;
      const p1: [number, number] = [a.x + nx, a.y + ny];
      const p2: [number, number] = [b.x + nx, b.y + ny];
      const p3: [number, number] = [b.x - nx, b.y - ny];
      const p4: [number, number] = [a.x - nx, a.y - ny];
      tri(p1, p3, p2);
      tri(p1, p4, p3);
    }
    for (const p of path.slice(1, -1)) {
      const n = 8;
      for (let k = 0; k < n; k++) {
        const t1 = (k / n) * Math.PI * 2;
        const t2 = ((k + 1) / n) * Math.PI * 2;
        tri([p.x, p.y], [p.x + Math.cos(t2) * h, p.y + Math.sin(t2) * h], [p.x + Math.cos(t1) * h, p.y + Math.sin(t1) * h]);
      }
    }
  }
  if (pos.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A flat layer drawn just above the ground; `layer` lifts it over the ones below without z-fighting. */
function FlatLayer({ geometry, colour, layer }: { geometry: THREE.BufferGeometry | null; colour: string; layer: number }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position={[0, 0.02 * layer, 0]} receiveShadow raycast={() => null} renderOrder={layer}>
      <meshStandardMaterial
        color={colour}
        roughness={1}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-layer}
        polygonOffsetUnits={-4 * layer}
      />
    </mesh>
  );
}

function Massing({ geometry, colour, shadows = true }: { geometry: THREE.BufferGeometry | null; colour: string; shadows?: boolean }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={shadows} receiveShadow raycast={() => null}>
      <meshStandardMaterial color={colour} roughness={0.95} />
    </mesh>
  );
}

export function MapLayer({ map }: { map: MapContext }) {
  const geo = useMemo(
    () => ({
      green: flats(map.green),
      water: flats(map.water),
      roads: ribbons(map.roads),
      known: extrusions(map.buildings.filter((b) => b.height === "levels")),
      houses: extrusions(map.buildings.filter((b) => b.height === "assumed")),
      outlines: extrusions(map.buildings.filter((b) => b.height === "unknown")),
    }),
    [map],
  );
  return (
    <>
      <FlatLayer geometry={geo.green} colour="#d3e0c8" layer={1} />
      <FlatLayer geometry={geo.water} colour="#a9cfdb" layer={2} />
      <FlatLayer geometry={geo.roads} colour="#fbfbf8" layer={3} />
      <Massing geometry={geo.known} colour="#c9cfc7" />
      <Massing geometry={geo.houses} colour="#dfe3dc" />
      <Massing geometry={geo.outlines} colour="#e3e6e0" shadows={false} />
    </>
  );
}
