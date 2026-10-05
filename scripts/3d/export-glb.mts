// Exports Thomson Reserve's towers from the selector's own 3D massing
// (lib/scene.ts) to a GLB model for placing in a 3D city map (CesiumJS with
// Google's Photorealistic 3D Tiles), plus a JSON file saying where it goes.
//
//   npx tsx scripts/3d/export-glb.mts
//
// The model is in a local east-north-up frame (glTF: +X east, +Y up,
// -Z north) with its origin at plan point (0, 0) and height 0 at Upper
// Thomson Road, so it needs no rotation when placed. Plan to latitude and
// longitude uses the same fit as the OpenStreetMap layer
// (scripts/osm/build-context.py), which puts MRT Exit 2 within about a metre
// of the developer's marker. Each stack is one mesh named "stack:<id>", so
// tapping it can open that stack in the selector; podiums and roofs are
// "block:<id>".
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { thomsonReserveDataset as ds } from "../../src/features/selector/data/thomson-reserve/index";
import { osmRoadLabels } from "../../src/features/selector/data/thomson-reserve/osm-context";
import { buildScene, BASE_RL } from "../../src/features/selector/lib/scene";
import { indexDataset } from "../../src/features/selector/lib/dataset-index";

const OUT_DIR = "public/thomson-reserve/3d";
const OUTLINE = JSON.parse(readFileSync("scripts/3d/thomson-reserve-outline.json", "utf8")) as { outline: [number, number][] };

// Plan metres -> latitude and longitude: the inverse of build-context.py's to_plan().
const FIT = { lat0: 1.3566, lon0: 103.83, rotDeg: 40, pxPerM: 2.66, tx: 787.5, ty: 570.0 };
function planToLatLon(px: number, py: number) {
  const x = px - FIT.tx / FIT.pxPerM;
  const y = py - FIT.ty / FIT.pxPerM;
  const p = (FIT.rotDeg * Math.PI) / 180;
  const e = x * Math.cos(p) + -y * Math.sin(p);
  const n = -x * Math.sin(p) + -y * Math.cos(p);
  return { lat: +(FIT.lat0 + n / 110574).toFixed(7), lon: +(FIT.lon0 + e / (111320 * Math.cos((FIT.lat0 * Math.PI) / 180))).toFixed(7) };
}

// Node has Blob but not FileReader, which the binary exporter uses.
(globalThis as unknown as { FileReader: unknown }).FileReader = class {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) {
    b.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(b: Blob) {
    b.arrayBuffer().then((r) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(r).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const scene = buildScene(ds);
const ix = indexDataset(ds);
// The scene's heights start at the lowest block; put Upper Thomson Road (RL 0) at height 0.
const baseRL = Math.min(BASE_RL, ...ds.blocks.map((b) => b.groundRL));
const typeColour = new Map((ds.project.display?.unitTypeColours ?? []).map((t) => [t.category, t.colour]));

function boxGeometry(b: { x: number; y: number; z: number; w: number; h: number; d: number; rotY: number }, colour: string) {
  const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.rotY, 0)), new THREE.Vector3(1, 1, 1)));
  const c = new THREE.Color(colour);
  const colours = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colours.length; i += 3) colours.set([c.r, c.g, c.b], i);
  g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  g.deleteAttribute("uv");
  return g;
}

const root = new THREE.Group();
root.name = "Thomson Reserve";
// Plan axes (x right, z down the plan) to east-north-up: rotate by the plan's north point.
root.rotation.y = (-(ds.project.planNorthDeg) * Math.PI) / 180;
root.position.y = baseRL;
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });

const byStack = new Map<string, THREE.BufferGeometry[]>();
for (const u of scene.units) {
  const layout = ix.stackLayout(u.unit.stackId);
  const colour = typeColour.get(layout.category ?? "") ?? "#dfe3dc";
  // A small gap between floors reads as storeys from a distance.
  byStack.set(u.unit.stackId, [...(byStack.get(u.unit.stackId) ?? []), boxGeometry({ ...u, h: u.h * 0.92 }, colour)]);
}
for (const [id, geoms] of byStack) {
  const mesh = new THREE.Mesh(mergeGeometries(geoms), material);
  mesh.name = `stack:${id}`;
  root.add(mesh);
}
const blockParts = [
  ...scene.podiums.map((b) => ({ b, colour: "#c9cfc6" })),
  ...scene.plinths.map((b) => ({ b, colour: "#d5ddd0" })),
  ...scene.roofs.map((b) => ({ b, colour: "#b3bbb0" })),
];
const blockGeoms: THREE.BufferGeometry[] = blockParts.map(({ b, colour }) => boxGeometry(b, colour));
const structure = new THREE.Mesh(mergeGeometries(blockGeoms), material);
structure.name = "structure";
root.add(structure);

const exporter = new GLTFExporter();
const glb = (await exporter.parseAsync(root, { binary: true })) as ArrayBuffer;
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/towers.glb`, Buffer.from(glb));

const road = osmRoadLabels.find((r) => /upper thomson/i.test(r.text)) ?? osmRoadLabels[0];
const placement = {
  project: ds.project.name,
  generated: new Date().toISOString().slice(0, 10),
  model: "towers.glb",
  origin: planToLatLon(0, 0),
  frame: "east-north-up; glTF +X east, +Y up, -Z north; height 0 = Upper Thomson Road beside the site",
  roadSample: { ...planToLatLon(road.at.x, road.at.y), note: `${road.text}: sample the 3D city's height here for the model's base` },
  siteOutline: OUTLINE.outline.map(([x, y]) => planToLatLon(x, y)),
  stacks: ds.stacks.map((s) => ({ id: s.id, block: ix.stackBlock(s.id).name, ...planToLatLon(s.position.x, s.position.y) })),
  blocks: ds.blocks.map((b) => ({ id: b.id, name: b.name, storeys: b.storeys, ...planToLatLon(b.centre.x, b.centre.y) })),
  centre: planToLatLon(ds.project.siteBounds.width / 2, ds.project.siteBounds.height / 2),
  credit: "Massing from TRM's selector, traced from the developer's site plan; not the developer's model.",
};
writeFileSync(`${OUT_DIR}/placement.json`, JSON.stringify(placement, null, 1));
console.log(`${OUT_DIR}/towers.glb ${(glb.byteLength / 1024).toFixed(0)} KB, ${byStack.size} stacks; origin ${placement.origin.lat}, ${placement.origin.lon}`);
