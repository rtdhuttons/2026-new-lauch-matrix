"use client";

// A project's towers placed in Google's Photorealistic 3D Tiles (the 3D city
// in Google Earth), in CesiumJS, with the sun and shadows for any date and
// time, a camera fly-in, and tapping a stack to open it in the selector.
//
// CesiumJS loads from jsDelivr when the page opens, so it isn't bundled.
// Google's tiles need NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (Map Tiles API, billing
// on, key limited to the website's address). Without a key the towers show on
// OpenStreetMap's flat map instead. The model and its placement come from
// scripts/3d/export-glb.mts.

import { useEffect, useRef, useState } from "react";

const CESIUM_VERSION = "1.146.0";
// NEXT_PUBLIC_CESIUM_BASE can point at a self-hosted copy of Build/Cesium/ instead of jsDelivr.
const CESIUM_BASE = process.env.NEXT_PUBLIC_CESIUM_BASE || `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;

export interface Placement {
  project: string;
  model: string;
  origin: { lat: number; lon: number };
  roadSample: { lat: number; lon: number; note: string };
  siteOutline: { lat: number; lon: number }[];
  stacks: { id: string; block: string; lat: number; lon: number }[];
  blocks: { id: string; name: string; storeys: number; lat: number; lon: number }[];
  centre: { lat: number; lon: number };
  credit: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- CesiumJS is loaded at runtime without its type package */
declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

function loadCesium(): Promise<any> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  window.CESIUM_BASE_URL = CESIUM_BASE;
  return new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${CESIUM_BASE}Widgets/widgets.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${CESIUM_BASE}Cesium.js`;
    s.async = true;
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("CesiumJS did not load")));
    s.onerror = () => reject(new Error("CesiumJS could not be downloaded"));
    document.head.appendChild(s);
  });
}

const metresBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 110574, (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180));

export function City3D({ placementUrl, modelBase, selectorHref, googleKey }: { placementUrl: string; modelBase: string; selectorHref: string; googleKey: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const model = useRef<any>(null);
  const base = useRef<{ lat: number; lon: number; h: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [heightNote, setHeightNote] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [picked, setPicked] = useState<Placement["stacks"][number] | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState(16 * 60);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [C, p] = await Promise.all([loadCesium(), fetch(placementUrl).then((r) => r.json() as Promise<Placement>)]);
        if (cancelled || !box.current) return;
        setPlacement(p);
        const v = new C.Viewer(box.current, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: true,
          ...(googleKey ? { globe: false, baseLayer: false } : { baseLayer: new C.ImageryLayer(new C.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })) }),
        });
        viewer.current = v;
        v.scene.renderError.addEventListener((_s: unknown, e: any) => console.error("render error:", e?.message ?? e, String(e?.stack ?? "").slice(0, 600)));
        v.scene.shadowMap.softShadows = true;
        v.scene.shadowMap.size = 4096;
        v.scene.light = new C.SunLight();
        if (v.scene.skyAtmosphere) v.scene.skyAtmosphere.show = true;

        let groundH = 0;
        if (googleKey) {
          C.GoogleMaps.defaultApiKey = googleKey;
          const tiles = await C.createGooglePhotorealistic3DTileset({ key: googleKey, onlyUsingWithGoogleGeocoder: true });
          tiles.shadows = C.ShadowMode.RECEIVE_ONLY;
          v.scene.primitives.add(tiles);
          // The model's base: the 3D city's height at Upper Thomson Road beside the site.
          try {
            const [c] = await v.scene.sampleHeightMostDetailed([C.Cartographic.fromDegrees(p.roadSample.lon, p.roadSample.lat)]);
            if (c && Number.isFinite(c.height)) {
              groundH = c.height;
              setHeightNote(`Base set at Upper Thomson Road beside the site, ${c.height.toFixed(1)} m above the WGS84 ellipsoid in Google's 3D city.`);
            }
          } catch {
            setHeightNote("Couldn't read the road height from the 3D city; use the height control to line the towers up with the ground.");
          }
          // Cut Google's existing scan of the plot out, so old buildings don't poke through.
          tiles.clippingPolygons = new C.ClippingPolygonCollection({
            polygons: [new C.ClippingPolygon({ positions: C.Cartesian3.fromDegreesArray(p.siteOutline.flatMap((q) => [q.lon, q.lat])) })],
          });
        } else {
          setHeightNote("Without Google's 3D city, the towers stand on a flat map at road level.");
        }

        base.current = { ...p.origin, h: groundH };
        const m = await C.Model.fromGltfAsync({
          url: `${modelBase}${p.model}`,
          modelMatrix: C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(p.origin.lon, p.origin.lat, groundH)),
          shadows: C.ShadowMode.ENABLED,
          // The model is already east-north-up (glTF +X east, -Z north): skip Cesium's turn that faces glTF's +Z east.
          forwardAxis: C.Axis.X,
        });
        if (cancelled) return;
        v.scene.primitives.add(m);
        model.current = m;
        if (process.env.NODE_ENV !== "production") (window as any).__city3d = { viewer: v, model: m, placement: p };

        // Tap a tower: each stack is its own mesh, named "stack:<id>"; otherwise the nearest stack to the point tapped.
        const handler = new C.ScreenSpaceEventHandler(v.scene.canvas);
        handler.setInputAction((e: any) => {
          const hit = v.scene.pick(e.position);
          if (!hit || hit.primitive !== m) return setPicked(null);
          const named = /^stack:(.+)$/.exec(hit.detail?.node?.name ?? "")?.[1];
          const stack = named ? p.stacks.find((s) => s.id === named) : undefined;
          if (stack) return setPicked(stack);
          const pos = v.scene.pickPosition(e.position);
          if (!pos) return;
          const c = C.Cartographic.fromCartesian(pos);
          const at = { lat: C.Math.toDegrees(c.latitude), lon: C.Math.toDegrees(c.longitude) };
          const nearest = p.stacks.map((s) => ({ s, d: metresBetween(at, s) })).sort((a, b) => a.d - b.d)[0];
          setPicked(nearest && nearest.d < 30 ? nearest.s : null);
        }, C.ScreenSpaceEventType.LEFT_CLICK);

        // Fly in from the south-west, looking across the towers.
        const centre = C.Cartesian3.fromDegrees(p.centre.lon, p.centre.lat, groundH + 40);
        v.camera.flyToBoundingSphere(new C.BoundingSphere(centre, 260), {
          offset: new C.HeadingPitchRange(C.Math.toRadians(35), C.Math.toRadians(-28), 720),
          duration: 4,
        });
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "The 3D view couldn't start.");
        }
      }
    })();
    return () => {
      cancelled = true;
      viewer.current?.destroy?.();
      viewer.current = null;
    };
  }, [placementUrl, modelBase, googleKey]);

  // Sun position for the chosen date and time (Singapore time).
  useEffect(() => {
    const C = window.Cesium;
    const v = viewer.current;
    if (!C || !v) return;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    v.clock.currentTime = C.JulianDate.fromDate(new Date(`${date}T${hh}:${mm}:00+08:00`));
    v.clock.shouldAnimate = false;
  }, [date, minutes, status]);

  // Fine-tune the towers' height against the 3D city's ground.
  useEffect(() => {
    const C = window.Cesium;
    if (!C || !model.current || !base.current) return;
    const b = base.current;
    model.current.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(b.lon, b.lat, b.h + lift));
  }, [lift, status]);

  const clock = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <div className="grid gap-4">
      {!googleKey && (
        <p className="rounded-xl border border-[#e2cf9f] bg-[#fbf5e6] px-4 py-3 font-display-normal text-sm text-[#5c3f0b]">
          Google&apos;s 3D city isn&apos;t switched on yet: add a Google Maps Platform key (Map Tiles API) as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Until then the
          towers stand on a flat OpenStreetMap map.
        </p>
      )}
      <div className="relative overflow-hidden rounded-xl border border-canopy/10 bg-[#dfe7ea]">
        <div ref={box} className="h-[520px] w-full sm:h-[640px]" role="region" aria-label={`${placement?.project ?? "Project"} in 3D. Drag to look around, scroll or pinch to zoom, tap a tower to choose its stack.`} />
        {status === "loading" && <p className="absolute inset-0 grid place-items-center font-display-normal text-sm text-canopy/75">Loading the 3D city…</p>}
        {status === "error" && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center font-display-normal text-sm text-[#9b2f28]">
            {message?.replace(/\.?$/, ".")} Check your connection, then reload the page.
          </p>
        )}
        {picked && (
          <div className="absolute left-3 top-3 rounded-xl bg-paper/95 p-4 font-display-normal shadow-md">
            <p className="text-sm text-canopy/70">{picked.block}</p>
            <p className="text-lg font-semibold">Stack {picked.id}</p>
            <a href={`${selectorHref}?stack=${encodeURIComponent(picked.id)}#project`} className="mt-2 inline-block rounded-full bg-canopy px-4 py-2 text-sm font-semibold text-mist">
              Open stack {picked.id} in the selector
            </a>
          </div>
        )}
      </div>
      <div className="grid gap-3 rounded-xl bg-mist p-4 font-display-normal text-sm sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="text-canopy/70">Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-canopy/25 bg-paper px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-canopy/70">
            Time of day: <strong className="text-canopy">{clock}</strong>
          </span>
          <input type="range" min={7 * 60} max={19 * 60} step={10} value={minutes} aria-valuetext={clock} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full accent-reservoir" />
        </label>
        <label className="grid gap-1">
          <span className="text-canopy/70">Tower height adjustment</span>
          <span className="flex items-center gap-2">
            <input type="number" step={0.5} value={lift} onChange={(e) => setLift(Number(e.target.value) || 0)} className="w-24 rounded-lg border border-canopy/25 bg-paper px-3 py-2 tabular-nums" />
            <span className="text-canopy/70">m</span>
          </span>
        </label>
      </div>
      <p className="font-display-normal text-xs text-stone">
        {heightNote ? `${heightNote} ` : ""}
        {placement?.credit} Shadows are indicative. Placed using the site plan&apos;s scale bar and north point; Upper Thomson MRT Exit 2 lands within about a metre
        of the plan&apos;s marker.
      </p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
