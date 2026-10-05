"use client";

// 3D massing view of the site. Loaded only in the browser (see site-view.tsx).

import { Edges, Html, Line, OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Dataset, Point, SiteDistance, Unit } from "../model/types";
import type { Box, Extrusion, SceneData, Tree, UnitBox } from "../lib/scene";
import { buildScene, sunVector } from "../lib/scene";
import { MapLayer } from "./map-layer";

export interface Facility {
  number: number;
  name: string;
  position: Point;
}

export interface Site3DProps {
  ds: Dataset;
  facilities: Facility[] | null;
  colours: Map<string, string>;
  selectedStackId: string;
  selectedUnit: Unit | null;
  tooltip: { title: string; detail: string } | null;
  onPickUnit: (u: Unit) => void;
  onPickStack: (stackId: string) => void;
  showSurroundings: boolean;
  showSun: boolean;
  sun: { azimuthDeg: number; altitudeDeg: number };
  resetSignal: number;
  onAzimuth: (deg: number) => void;
  gates: { name: string; position: Point }[];
  mrt: { name: string; position: Point } | null;
  /** Measured lines from the developer's plans, or null to hide them. */
  distances: SiteDistance[] | null;
}

const tmp = new THREE.Object3D();

/** Default camera: closer for a large real site plan, higher for the compact demo. */
function cameraStart(scene: SceneData, hasPlanImage: boolean): THREE.Vector3 {
  const [side, up, back] = hasPlanImage ? [0.12, 1.25, 0.95] : [0.33, 2.35, 1.76];
  return new THREE.Vector3(
    scene.centre.x + scene.radius * side,
    scene.radius * up,
    scene.centre.z + scene.radius * back,
  );
}
const tmpColour = new THREE.Color();

function useInstanced(ref: React.RefObject<THREE.InstancedMesh | null>, boxes: Box[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      tmp.position.set(b.x, b.y, b.z);
      tmp.rotation.set(0, b.rotY, 0);
      tmp.scale.set(b.w, b.h, b.d);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, boxes]);
}

function Units({
  boxes,
  colours,
  onPick,
}: {
  boxes: UnitBox[];
  colours: Map<string, string>;
  onPick: (u: Unit) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstanced(ref, boxes);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => mesh.setColorAt(i, tmpColour.set(colours.get(b.unit.id) ?? "#dddddd")));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [boxes, colours]);

  const pick = (e: ThreeEvent<MouseEvent>) => {
    // Ignore clicks that end a drag-to-spin.
    if (e.delta > 6 || e.instanceId === undefined) return;
    e.stopPropagation();
    onPick(boxes[e.instanceId].unit);
  };

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, boxes.length]}
      castShadow
      receiveShadow
      onClick={pick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.85} metalness={0} />
    </instancedMesh>
  );
}

function PlainBoxes({ boxes, colour, cast = true }: { boxes: Box[]; colour: string; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstanced(ref, boxes);
  if (boxes.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} castShadow={cast} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={colour} roughness={0.95} />
    </instancedMesh>
  );
}

function TreeSet({ trees, shape }: { trees: Tree[]; shape: Tree["shape"] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    trees.forEach((t, i) => {
      const r = Math.max(2.2, t.height * (shape === "cone" ? 0.22 : 0.28));
      if (shape === "cone") {
        tmp.position.set(t.x, t.baseY + t.height / 2, t.z);
        tmp.scale.set(r, t.height, r);
      } else {
        tmp.position.set(t.x, t.baseY + t.height - r, t.z);
        tmp.scale.set(r, r * 1.1, r);
      }
      tmp.rotation.set(0, (i * 1.7) % Math.PI, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees, shape]);
  if (trees.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
      {shape === "cone" ? <coneGeometry args={[1, 1, 7]} /> : <icosahedronGeometry args={[1, 1]} />}
      <meshStandardMaterial color={shape === "cone" ? "#6f9a63" : "#86a973"} roughness={1} flatShading />
    </instancedMesh>
  );
}

function Trees({ trees }: { trees: Tree[] }) {
  const round = useMemo(() => trees.filter((t) => t.shape === "round"), [trees]);
  const cones = useMemo(() => trees.filter((t) => t.shape === "cone"), [trees]);
  return (
    <>
      <TreeSet trees={round} shape="round" />
      <TreeSet trees={cones} shape="cone" />
    </>
  );
}

/** The developer's site plan laid flat on the ground at its true scale. */
function PlanImage({ src, maskSrc, widthM, heightM }: { src: string; maskSrc?: string; widthM: number; heightM: number }) {
  const loaded = useLoader(THREE.TextureLoader, maskSrc ? [src, maskSrc] : [src]);
  const [texture, mask] = useMemo(() => {
    const t = loaded[0].clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return [t, loaded[1] ?? null];
  }, [loaded]);
  // With a mask, only the site itself is drawn and the map shows around it.
  return (
    <mesh position={[widthM / 2, 0.1, heightM / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null} renderOrder={4}>
      <planeGeometry args={[widthM, heightM]} />
      <meshStandardMaterial
        map={texture}
        alphaMap={mask}
        alphaTest={mask ? 0.5 : 0}
        roughness={1}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-16}
      />
    </mesh>
  );
}

/** Letter-spaced capitals painted flat on the ground, like a map label. */
function GroundLabel({ text, x, z, angle, width, colour = "#6f7a71" }: { text: string; x: number; z: number; angle: number; width: number; colour?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "sans-serif";
    ctx.fillStyle = colour;
    ctx.textBaseline = "middle";
    const chars = [...text.toUpperCase()];
    // Shrink long names so they fit the label instead of being cut off.
    let size = 64;
    let spacing = 14;
    const measure = () => {
      ctx.font = `600 ${size}px ${family}`;
      return chars.reduce((a, c) => a + ctx.measureText(c).width + spacing, -spacing);
    };
    let total = measure();
    if (total > canvas.width - 32) {
      const k = (canvas.width - 32) / total;
      size = Math.floor(size * k);
      spacing = spacing * k;
      total = measure();
    }
    let cx = (canvas.width - total) / 2;
    for (const c of chars) {
      ctx.fillText(c, cx, canvas.height / 2);
      cx += ctx.measureText(c).width + spacing;
    }
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 4;
    return t;
  }, [text, colour]);
  return (
    <mesh position={[x, 0.3, z]} rotation={[-Math.PI / 2, 0, angle]} raycast={() => null} renderOrder={5}>
      <planeGeometry args={[width, (width * 96) / 1024]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-8} polygonOffsetUnits={-32} />
    </mesh>
  );
}

function Building({ b }: { b: Extrusion }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(b.footprint.map((p) => new THREE.Vector2(p.x, -p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [b]);
  return (
    <mesh geometry={geometry} position={[0, b.baseY, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#cfd4cd" roughness={0.95} />
    </mesh>
  );
}

function FlatShape({ points, y, colour }: { points: Point[]; y: number; colour: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y))));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [points]);
  return (
    <mesh geometry={geometry} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial color={colour} roughness={1} />
    </mesh>
  );
}

function Road({ path, width }: { path: Point[]; width: number }) {
  return (
    <>
      {path.slice(0, -1).map((a, i) => {
        const b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        return (
          <mesh key={i} position={[(a.x + b.x) / 2, 0.06, (a.y + b.y) / 2]} rotation={[-Math.PI / 2, 0, -angle]} receiveShadow>
            <planeGeometry args={[len, width]} />
            <meshStandardMaterial color="#d7dad4" roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}

function Pill({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" | "accent" }) {
  const styles =
    tone === "dark"
      ? "bg-canopy text-mist"
      : tone === "accent"
        ? "bg-reservoir text-paper"
        : "bg-paper/90 text-canopy";
  return (
    <span className={`pointer-events-none whitespace-nowrap rounded-full px-2 py-0.5 font-display-normal text-[11px] font-semibold shadow-sm ${styles}`}>
      {children}
    </span>
  );
}

function Scene(props: Site3DProps & { scene: SceneData }) {
  const { scene, ds, showSurroundings, showSun, sun } = props;
  const controls = useRef<OrbitControlsImpl>(null);
  const centre = new THREE.Vector3(scene.centre.x, 20, scene.centre.z);

  const hasPlanImage = !!ds.project.display?.planImage;
  const initialCamera = useMemo(
    () => cameraStart(scene, hasPlanImage),
    [scene, hasPlanImage],
  );

  useLayoutEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.object.position.copy(initialCamera);
    c.target.set(scene.centre.x, 20, scene.centre.z);
    c.update();
    props.onAzimuth((c.getAzimuthalAngle() * 180) / Math.PI);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resetSignal]);

  const sunUp = sun.altitudeDeg > 0;
  const north = ds.project.planNorthDeg;
  const reach = Math.max(600, scene.radius * 4);
  const lightDir = showSun && sunUp ? sunVector(sun.azimuthDeg, sun.altitudeDeg, north) : sunVector(150, 55, north);
  const lightPos: [number, number, number] = [
    centre.x + lightDir.x * reach,
    lightDir.y * reach,
    centre.z + lightDir.z * reach,
  ];
  const sunMarker = sunVector(sun.azimuthDeg, Math.max(sun.altitudeDeg, 2), north);
  const shadowExtent = Math.max(380, scene.radius * 1.3);
  const planImage = ds.project.display?.planImage;

  const selectedBox = props.selectedUnit
    ? scene.units.find((b) => b.unit.id === props.selectedUnit!.id)
    : null;
  const stackBoxes = scene.units.filter((b) => b.unit.stackId === props.selectedStackId);
  const stackColumn = stackBoxes.length
    ? (() => {
        const lo = stackBoxes[0];
        const hi = stackBoxes[stackBoxes.length - 1];
        const bottom = lo.y - lo.h / 2;
        const top = hi.y + hi.h / 2;
        return { ...lo, y: (bottom + top) / 2, h: top - bottom + 0.6, w: lo.w + 0.8, d: lo.d + 0.8 };
      })()
    : null;

  const targets = ds.viewTargets.filter((t) => t.id === "reservoir" || t.id === "woodland");

  return (
    <>
      <color attach="background" args={["#eef1ec"]} />
      <hemisphereLight args={["#ffffff", "#c9d2c4", showSun && !sunUp ? 0.5 : 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={lightPos}
        intensity={showSun ? (sunUp ? 1.1 + Math.min(1, sun.altitudeDeg / 45) * 0.9 : 0.15) : 1.2}
        color={showSun && sunUp && sun.altitudeDeg < 20 ? "#ffd9a0" : "#ffffff"}
        castShadow={showSun && sunUp}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={10}
        shadow-camera-far={reach * 2.5}
        shadow-bias={-0.0004}
      >
        <object3D attach="target" position={[centre.x, 0, centre.z]} />
      </directionalLight>

      {/* Ground, water and roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centre.x, 0, centre.z]} receiveShadow>
        <planeGeometry args={[Math.max(2400, scene.radius * 8), Math.max(2400, scene.radius * 8)]} />
        <meshStandardMaterial color="#e6e9e3" roughness={1} />
      </mesh>
      {showSurroundings && (
        <>
          {targets.map((t) => (
            <FlatShape key={t.id} points={t.footprint} y={0.03} colour={t.id === "reservoir" ? "#a9cfdb" : "#cfdcc4"} />
          ))}
          {/* A map already draws the real roads. */}
          {!ds.project.display?.mapContext && ds.exposureSources
            .filter((s) => s.kind === "expressway" || s.kind === "main-road")
            .map((s) => (
              <Road key={s.id} path={s.geometry} width={s.kind === "expressway" ? 26 : 14} />
            ))}
          {ds.project.display?.mapContext && <MapLayer map={ds.project.display.mapContext} />}
          {scene.buildings.map((b) => (
            <Building key={b.id} b={b} />
          ))}
          <PlainBoxes boxes={scene.houses} colour="#e0e3dd" />
        </>
      )}
      <Trees trees={showSurroundings ? scene.trees : scene.trees.filter((t) => t.baseY > 3)} />

      {/* The site */}
      {planImage ? (
        <Suspense fallback={null}>
          <PlanImage src={planImage.src} maskSrc={showSurroundings ? planImage.maskSrc : undefined} widthM={planImage.widthM} heightM={planImage.heightM} />
        </Suspense>
      ) : (
        <>
          <mesh position={[centre.x, 2, centre.z]} receiveShadow>
            <boxGeometry args={[ds.project.siteBounds.width, 4, ds.project.siteBounds.height]} />
            <meshStandardMaterial color="#d6e3cf" roughness={1} />
          </mesh>
          <mesh position={[112, 4.15, 93]} rotation={[0, -Math.atan2(10, 40), 0]} receiveShadow>
            <boxGeometry args={[44, 0.3, 9]} />
            <meshStandardMaterial color="#6fb0c8" roughness={0.3} />
          </mesh>
        </>
      )}
      {scene.lawns.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} receiveShadow>
          <boxGeometry args={[l.w, l.h, l.d]} />
          <meshStandardMaterial color="#c3d9b4" roughness={1} />
        </mesh>
      ))}
      <PlainBoxes boxes={scene.plinths} colour="#c9d4c2" cast={false} />
      <PlainBoxes boxes={scene.podiums} colour="#bfc7bc" />
      <PlainBoxes boxes={scene.roofs} colour="#b3bbb0" />
      <Units boxes={scene.units} colours={props.colours} onPick={props.onPickUnit} />

      {stackColumn && (
        <mesh position={[stackColumn.x, stackColumn.y, stackColumn.z]} rotation={[0, stackColumn.rotY, 0]} raycast={() => null}>
          <boxGeometry args={[stackColumn.w, stackColumn.h, stackColumn.d]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#2e6a78" lineWidth={1.5} />
        </mesh>
      )}
      {selectedBox && (
        <mesh position={[selectedBox.x, selectedBox.y, selectedBox.z]} rotation={[0, selectedBox.rotY, 0]} raycast={() => null}>
          <boxGeometry args={[selectedBox.w + 1.2, selectedBox.h + 0.8, selectedBox.d + 1.2]} />
          <meshBasicMaterial color="#10291c" transparent opacity={0.15} depthWrite={false} />
          <Edges color="#10291c" lineWidth={2.5} />
          {props.tooltip && (
            <Html position={[0, selectedBox.h, 0]} center zIndexRange={[20, 0]} style={{ transform: "translateY(-28px)" }}>
              <div className="pointer-events-none min-w-[150px] rounded-lg bg-paper px-3 py-2 text-left shadow-md">
                <p className="whitespace-nowrap font-display-normal text-[12px] font-bold text-canopy">{props.tooltip.title}</p>
                <p className="whitespace-nowrap font-display-normal text-[11px] text-canopy/75">{props.tooltip.detail}</p>
              </div>
            </Html>
          )}
        </mesh>
      )}

      {/* Road names */}
      {showSurroundings && (
        <>
          {ds.project.display?.roadLabels?.map((r) => (
            <GroundLabel key={r.text} text={r.text} x={r.at.x} z={r.at.y} angle={(r.angleDeg * Math.PI) / 180} width={r.lengthM} />
          ))}
        </>
      )}

      {/* Facilities key pins */}
      {props.facilities?.map((f) => (
        <Html key={`f-${f.number}`} position={[f.position.x, 7, f.position.y]} center zIndexRange={[12, 0]}>
          <span className="pointer-events-none grid size-5 place-items-center rounded-full bg-reservoir font-display-normal text-[10px] font-bold text-paper shadow">
            {f.number}
          </span>
        </Html>
      ))}

      {/* Labels */}
      {scene.stackLabels.map((l) => (
        <Html key={l.stackId} position={[l.x, l.y, l.z]} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={() => props.onPickStack(l.stackId)}
            className={`rounded px-1 font-display-normal font-bold leading-4 ${
              l.stackId === props.selectedStackId
                ? "bg-canopy text-[12px] text-mist"
                : scene.stackLabels.length > 30
                  ? "text-[10px] text-canopy [text-shadow:0_0_2px_#fff,0_0_2px_#fff,0_0_3px_#fff]"
                  : "bg-paper/85 text-[11px] text-canopy"
            }`}
            aria-label={`Select stack ${l.stackId}`}
          >
            {l.text}
          </button>
        </Html>
      ))}
      {scene.blockLabels.map((l) => (
        <Html key={`b-${l.blockId}`} position={[l.x, l.y, l.z]} center zIndexRange={[11, 0]}>
          <span className="pointer-events-none whitespace-nowrap rounded bg-[#8a5a14] px-1.5 py-0.5 font-display-normal text-[11px] font-bold tracking-wide text-white shadow-sm">
            {l.text}
          </span>
        </Html>
      ))}
      {props.gates.map((g) => (
        <Html key={g.name} position={[g.position.x, 8, g.position.y]} center zIndexRange={[10, 0]}>
          <Pill tone="accent">{g.name}</Pill>
        </Html>
      ))}
      {props.mrt && showSurroundings && (
        <Html position={[props.mrt.position.x, 6, props.mrt.position.y]} center zIndexRange={[10, 0]}>
          <Pill tone="dark">{props.mrt.name}</Pill>
        </Html>
      )}
      {showSurroundings &&
        scene.buildings.map((b) => (
          <Html
            key={`l-${b.id}`}
            position={[
              b.footprint.reduce((a, p) => a + p.x, 0) / b.footprint.length,
              b.baseY + b.height + 4,
              b.footprint.reduce((a, p) => a + p.y, 0) / b.footprint.length,
            ]}
            center
            zIndexRange={[10, 0]}
          >
            <Pill>{b.name.replace(/ \(.*\)$/, "")}</Pill>
          </Html>
        ))}

      {/* Distances from the developer's plans */}
      {props.distances?.map((d, i) => {
        const y = 7;
        const mid: [number, number, number] = [(d.from.x + d.to.x) / 2, y, (d.from.y + d.to.y) / 2];
        return (
          <group key={`d-${i}`}>
            <Line
              points={[[d.from.x, y, d.from.y], [d.to.x, y, d.to.y]]}
              color={d.kind === "blocks" ? "#c62f2f" : "#c9693b"}
              lineWidth={d.kind === "blocks" ? 2.5 : 1.75}
              dashed={d.kind === "edge"}
              dashSize={3}
              gapSize={2}
              depthTest={false}
              renderOrder={20}
            />
            {[d.from, d.to].map((p, j) => (
              <mesh key={j} position={[p.x, y, p.y]} renderOrder={20} raycast={() => null}>
                <sphereGeometry args={[1.4, 10, 8]} />
                <meshBasicMaterial color={d.kind === "blocks" ? "#c62f2f" : "#c9693b"} depthTest={false} />
              </mesh>
            ))}
            <Html position={mid} center zIndexRange={[13, 0]}>
              <span
                className={`pointer-events-none whitespace-nowrap rounded-full px-1.5 py-px font-display-normal text-[11px] font-bold shadow-sm ${
                  d.kind === "blocks" ? "bg-[#c62f2f] text-white" : "bg-paper/95 text-[#9a4a22] ring-1 ring-[#c9693b]"
                }`}
                title={d.between}
              >
                {d.metres} m
              </span>
            </Html>
          </group>
        );
      })}

      {/* Sun glow */}
      {showSun && sunUp && (
        <mesh position={[centre.x + sunMarker.x * reach * 0.85, sunMarker.y * reach * 0.85, centre.z + sunMarker.z * reach * 0.85]} raycast={() => null}>
          <sphereGeometry args={[14 * (reach / 600), 24, 24]} />
          <meshBasicMaterial color="#ffc94d" />
        </mesh>
      )}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={80}
        maxDistance={Math.max(1100, scene.radius * 5)}
        maxPolarAngle={1.32}
        target={[scene.centre.x, 20, scene.centre.z]}
        onChange={() => {
          const c = controls.current;
          if (c) props.onAzimuth((c.getAzimuthalAngle() * 180) / Math.PI);
        }}
      />
    </>
  );
}

export default function Site3D(props: Site3DProps) {
  const scene = useMemo(() => buildScene(props.ds), [props.ds]);
  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{
        position: cameraStart(scene, !!props.ds.project.display?.planImage).toArray(),
        fov: 38,
        near: 5,
        far: Math.max(5000, scene.radius * 20),
      }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Scene {...props} scene={scene} />
    </Canvas>
  );
}
