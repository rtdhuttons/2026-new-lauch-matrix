"""Map layers for the projects map: URA's market regions (CCR, RCR, OCR),
parks, reservoirs and rivers, major roads and neighbourhood names.

Usage: python3 scripts/data/sg-map-layers.py [subzones.geojson] [landuse.geojson]

Regions follow URA's definitions at subzone level, from the Master Plan 2019
subzones (data.gov.sg):
  CCR  Core Central Region: postal districts 9, 10 and 11, the Downtown Core
       planning area and Sentosa
  RCR  Rest of Central Region: the rest of URA's Central Region
  OCR  Outside Central Region: everything else
A subzone's postal district comes from scripts/data/subzone-districts.json
(made by scripts/data/sg-districts.py), so a district that straddles a
region boundary is split at the subzone line rather than given to one region.

Parks and nature areas (PARK, OPEN SPACE), water (WATERBODY) and major roads
(ROAD reserves wider than about 28 m: expressways and arterials) come from the Master Plan 2019 Land Use
layer (data.gov.sg). Writes src/features/catalogue/data/sg-layers.ts.
Needs Shapely.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

basemap = import_module("sg-basemap")

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/features/catalogue/data/sg-layers.ts"
CACHE = ROOT / "scripts/data/subzone-districts.json"
SUBZONES = "d_8594ae9ff96d0c708bc2af633048edfb"  # Master Plan 2019 Subzone Boundary (No Sea)
LANDUSE = "d_90d86daa5bfaa371668b84fa5f01424f"  # Master Plan 2019 Land Use layer
REGIONS = {
    "CCR": "Core Central Region",
    "RCR": "Rest of Central Region",
    "OCR": "Outside Central Region",
}


def to_m(geom):
    return transform(lambda x, y, z=None: basemap.project(x, y), geom)


def path_of(geom, tol, min_area=0.0):
    """Polygon(s) in metres -> SVG path, simplified, dropping tiny parts."""
    geom = geom.simplify(tol, preserve_topology=True)
    polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom] if geom.geom_type == "Polygon" else []
    out = []
    for p in polys:
        if p.area < min_area:
            continue
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            if len(pts) >= 4:
                out.append("M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in pts[:-1]) + "Z")
    return "".join(out)


def region_of(z, district):
    if z["region"] != "CENTRAL REGION":
        return "OCR"
    if district in ("D09", "D10", "D11") or z["area"] == "DOWNTOWN CORE" or z["name"] == "SENTOSA":
        return "CCR"
    return "RCR"


def main(sub_src=None, lu_src=None):
    subzones = json.loads(Path(sub_src).read_text()) if sub_src else basemap.download(SUBZONES)
    districts = json.loads(CACHE.read_text())
    zones = []
    for f in subzones["features"]:
        p = f["properties"]
        z = {"code": p["SUBZONE_C"], "name": p["SUBZONE_N"], "area": p["PLN_AREA_N"], "region": p["REGION_N"], "geom": to_m(shape(f["geometry"]).buffer(0))}
        z["district"] = districts.get(z["code"])
        z["market"] = region_of(z, z["district"])
        zones.append(z)

    regions = []
    for rid, name in REGIONS.items():
        merged = unary_union([z["geom"] for z in zones if z["market"] == rid]).buffer(2).buffer(-2)
        minx, miny, maxx, maxy = merged.bounds
        big = max(merged.geoms, key=lambda g: g.area) if merged.geom_type == "MultiPolygon" else merged
        pt = big.representative_point()
        regions.append({"id": rid, "name": name, "d": path_of(merged, 20, 20000), "bbox": [round(minx), round(miny), round(maxx - minx), round(maxy - miny)], "label": [round(pt.x), round(pt.y)]})

    # How much of each postal district lies in each region, by area.
    shares = defaultdict(lambda: defaultdict(float))
    for z in zones:
        if z["district"]:
            shares[z["district"]][z["market"]] += z["geom"].area
    district_regions = {d: {r: round(a / sum(v.values()), 3) for r, a in sorted(v.items(), key=lambda kv: -kv[1])} for d, v in sorted(shares.items())}

    # Neighbourhood names: planning areas, with their size for label priority.
    by_area = defaultdict(list)
    for z in zones:
        by_area[z["area"]].append(z["geom"])
    area_labels = []
    for name, parts in by_area.items():
        g = unary_union(parts)
        pt = g.representative_point()
        area_labels.append([name.title(), round(pt.x), round(pt.y), round(g.area / 1e6, 2)])
    area_labels.sort(key=lambda a: -a[3])

    land = json.loads(Path(lu_src).read_text()) if lu_src else basemap.download(LANDUSE)
    parks, water, roads = [], [], []
    for f in land["features"]:
        kind = f["properties"].get("LU_DESC")
        if kind not in ("PARK", "OPEN SPACE", "WATERBODY", "ROAD"):
            continue
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        (parks if kind in ("PARK", "OPEN SPACE") else water if kind == "WATERBODY" else roads).append(to_m(g))
    park = unary_union(parks)
    lake = unary_union(water)
    # Major roads: keep road reserves wider than about 28 m (an "opening" of 14 m).
    road = unary_union(roads).buffer(-14).buffer(16)
    OUT.write_text(f"""// Generated by scripts/data/sg-map-layers.py from URA's Master Plan 2019 subzones
// and land use layer (data.gov.sg, Singapore Open Data Licence). Don't edit by hand.

/** URA's market regions, at subzone level: CCR = postal districts 9-11, Downtown Core and Sentosa; RCR = rest of the Central Region; OCR = the rest. */
export const sgRegions: {{ id: "CCR" | "RCR" | "OCR"; name: string; d: string; bbox: [number, number, number, number]; label: [number, number] }}[] = {json.dumps(regions)};

/** Share of each postal district's area in each region. */
export const districtRegions: Record<string, Partial<Record<"CCR" | "RCR" | "OCR", number>>> = {json.dumps(district_regions)};

/** Planning areas as neighbourhood names: [name, x, y, area km²], largest first. */
export const areaLabels: [string, number, number, number][] = {json.dumps(area_labels)};

export const sgParks = {json.dumps(path_of(park, 25, 60000))};
export const sgWater = {json.dumps(path_of(lake, 15, 15000))};
export const sgMajorRoads = {json.dumps(path_of(road, 12, 30000))};
""")
    print(f"regions {[r['id'] for r in regions]}, {len(area_labels)} areas; {OUT.stat().st_size / 1024:.0f} KB -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0] if a else None, a[1] if len(a) > 1 else None)
