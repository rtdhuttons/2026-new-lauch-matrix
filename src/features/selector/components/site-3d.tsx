"use client";

// 3D massing view of the site. Loaded only in the browser (see site-view.tsx).

import { Edges, Html, OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Dataset, Point, Unit } from "../model/types";
import type { Box, Extrusion, SceneData, Tree, UnitBox } from "../lib/scene";
import { buildScene, sunVector } from "../lib/scene";

export interface Site3DProps {
  ds: Dataset;
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
}

const tmp = new THREE.Object3D();
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

function Trees({ trees }: { trees: Tree[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    trees.forEach((t, i) => {
      const r = Math.max(2.5, t.height * 0.28);
      tmp.position.set(t.x, t.baseY + t.height - r, t.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(r, r * 1.1, r);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#7fa36b" roughness={1} flatShading />
    </instancedMesh>
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

  const initialCamera = useMemo(
    () => new THREE.Vector3(scene.centre.x + 50, 360, scene.centre.z + 270),
    [scene.centre.x, scene.centre.z],
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
  const lightDir = showSun && sunUp ? sunVector(sun.azimuthDeg, sun.altitudeDeg) : sunVector(150, 55);
  const lightPos: [number, number, number] = [
    centre.x + lightDir.x * 600,
    lightDir.y * 600,
    centre.z + lightDir.z * 600,
  ];
  const sunMarker = sunVector(sun.azimuthDeg, Math.max(sun.altitudeDeg, 2));

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
        shadow-camera-left={-380}
        shadow-camera-right={380}
        shadow-camera-top={380}
        shadow-camera-bottom={-380}
        shadow-camera-near={10}
        shadow-camera-far={1600}
        shadow-bias={-0.0004}
      >
        <object3D attach="target" position={[centre.x, 0, centre.z]} />
      </directionalLight>

      {/* Ground, water and roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centre.x, 0, centre.z]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color="#e6e9e3" roughness={1} />
      </mesh>
      {showSurroundings && (
        <>
          {targets.map((t) => (
            <FlatShape key={t.id} points={t.footprint} y={0.03} colour={t.id === "reservoir" ? "#a9cfdb" : "#cfdcc4"} />
          ))}
          {ds.exposureSources
            .filter((s) => s.kind === "expressway" || s.kind === "main-road")
            .map((s) => (
              <Road key={s.id} path={s.geometry} width={s.kind === "expressway" ? 26 : 14} />
            ))}
          {scene.buildings.map((b) => (
            <Building key={b.id} b={b} />
          ))}
          <PlainBoxes boxes={scene.houses} colour="#e0e3dd" />
        </>
      )}
      <Trees trees={showSurroundings ? scene.trees : scene.trees.filter((t) => t.baseY > 3)} />

      {/* The site */}
      <mesh position={[centre.x, 2, centre.z]} receiveShadow>
        <boxGeometry args={[ds.project.siteBounds.width, 4, ds.project.siteBounds.height]} />
        <meshStandardMaterial color="#d6e3cf" roughness={1} />
      </mesh>
      <mesh position={[112, 4.15, 93]} rotation={[0, -Math.atan2(10, 40), 0]} receiveShadow>
        <boxGeometry args={[44, 0.3, 9]} />
        <meshStandardMaterial color="#6fb0c8" roughness={0.3} />
      </mesh>
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

      {/* Labels */}
      {scene.stackLabels.map((l) => (
        <Html key={l.stackId} position={[l.x, l.y, l.z]} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={() => props.onPickStack(l.stackId)}
            className={`rounded px-1 font-display-normal text-[11px] font-bold leading-4 ${
              l.stackId === props.selectedStackId ? "bg-canopy text-mist" : "bg-paper/85 text-canopy"
            }`}
            aria-label={`Select stack ${l.stackId}`}
          >
            {l.text}
          </button>
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

      {/* Sun glow */}
      {showSun && sunUp && (
        <mesh position={[centre.x + sunMarker.x * 520, sunMarker.y * 520, centre.z + sunMarker.z * 520]} raycast={() => null}>
          <sphereGeometry args={[14, 24, 24]} />
          <meshBasicMaterial color="#ffc94d" />
        </mesh>
      )}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={120}
        maxDistance={1100}
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
      dpr={[1, 2]}
      camera={{ position: [scene.centre.x + 50, 360, scene.centre.z + 270], fov: 38, near: 5, far: 5000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Scene {...props} scene={scene} />
    </Canvas>
  );
}
