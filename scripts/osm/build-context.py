"""Turn an OpenStreetMap export around Thomson Reserve into plan data.

Usage: python3 scripts/osm/build-context.py path/to/map.osm

Writes src/features/selector/data/thomson-reserve/osm-context.ts with the
buildings, roads, green spaces and water around the site, in the same plan
metres as the rest of the dataset (x east-ish, y south-ish on the rotated
site plan).

The OSM data is placed on the developer's site plan with a similarity
transform: rotation 40 degrees (the plan's north point), the plan's scale
bar (2.66 px per metre) and a shift that puts the OSM site boundary inside
the plan's landscaped area and Upper Thomson MRT Exit 2 within about a
metre of the plan's marker. Data (c) OpenStreetMap contributors, ODbL.
"""

import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/features/selector/data/thomson-reserve/osm-context.ts"

LAT0, LON0 = 1.3566, 103.8300
ROT_DEG, PX_PER_M, TX, TY = 40.0, 2.66, 787.5, 570.0
SITE_CENTRE = (285.0, 131.0)
RADIUS_M = 650.0

HOUSE_TYPES = {"house", "terrace", "semidetached_house", "detached", "bungalow"}
ROAD_WIDTH = {
    "primary": 16, "primary_link": 7, "secondary": 11, "secondary_link": 7,
    "tertiary": 9, "tertiary_link": 6, "unclassified": 7, "residential": 6.5, "service": 4,
}
LABEL_CLASSES = {"primary", "secondary", "tertiary", "residential"}
GREEN = {("landuse", "grass"), ("landuse", "forest"), ("landuse", "recreation_ground"),
         ("leisure", "park"), ("leisure", "garden"), ("leisure", "pitch"),
         ("natural", "wood"), ("natural", "scrub")}


def to_plan(lat, lon):
    e = (lon - LON0) * 111320 * math.cos(math.radians(LAT0))
    n = (lat - LAT0) * 110574
    p = math.radians(ROT_DEG)
    x = e * math.cos(p) - n * math.sin(p)
    y = -(n * math.cos(p) + e * math.sin(p))
    return ((PX_PER_M * x + TX) / PX_PER_M, (PX_PER_M * y + TY) / PX_PER_M)


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    L = math.hypot(bx - ax, by - ay) or 1e-9
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def flat(pts):
    return "[" + ",".join(f"{round(x, 1):g},{round(y, 1):g}" for x, y in pts) + "]"


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def near(pt):
    return math.hypot(pt[0] - SITE_CENTRE[0], pt[1] - SITE_CENTRE[1]) <= RADIUS_M


def chain(lines):
    """Join polylines that share end points into longer ones."""
    key = lambda p: (round(p[0], 1), round(p[1], 1))
    lines = [list(l) for l in lines]
    joined = True
    while joined:
        joined = False
        for i in range(len(lines)):
            for j in range(len(lines)):
                if i == j:
                    continue
                a, b = lines[i], lines[j]
                if key(a[-1]) == key(b[0]):
                    lines[i] = a + b[1:]
                elif key(a[-1]) == key(b[-1]):
                    lines[i] = a + b[::-1][1:]
                else:
                    continue
                del lines[j]
                joined = True
                break
            if joined:
                break
    return lines


def js(s):
    return "null" if s is None else '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main(path):
    root = ET.parse(path).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    ways = []
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        pts = [to_plan(*nodes[nd.get("ref")]) for nd in w.findall("nd") if nd.get("ref") in nodes]
        ways.append((tags, pts))

    site = next(p for t, p in ways if t.get("name") == "Thomson Reserve" and t.get("landuse") == "construction")

    buildings, roads, green, water = [], [], [], []
    pieces = {}
    for tags, pts in ways:
        if len(pts) < 2:
            continue
        closed = len(pts) > 3 and pts[0] == pts[-1]
        ring = pts[:-1] if closed else pts
        if "building" in tags and closed:
            c = centroid(ring)
            if not near(c) or inside(c, site):
                continue
            lv = tags.get("building:levels")
            try:
                levels = float(lv) if lv else None
            except ValueError:
                levels = None
            kind = "house" if tags["building"] in HOUSE_TYPES else "other"
            addr = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x) or None
            buildings.append(f"[{'null' if levels is None else f'{levels:g}'},\"{kind}\",{js(tags.get('name') or addr)},{flat(ring)}]")
        elif tags.get("highway") in ROAD_WIDTH:
            if not any(near(p) for p in pts) or inside(pts[len(pts) // 2], site):
                continue
            hw = tags["highway"]
            line = simplify(pts, 0.4)
            roads.append(f"[{ROAD_WIDTH[hw]},{js(tags.get('name'))},{flat(line)}]")
            if tags.get("name") and hw in LABEL_CLASSES:
                pieces.setdefault(tags["name"], []).append(pts)
        elif closed and (any((k, tags.get(k)) in GREEN for k in ("landuse", "leisure", "natural"))):
            if near(centroid(ring)) and not inside(centroid(ring), site):
                green.append(flat(simplify(ring, 0.4)))
        elif closed and (tags.get("natural") == "water" or tags.get("leisure") == "swimming_pool"):
            if near(centroid(ring)) and not inside(centroid(ring), site):
                water.append(flat(ring))

    # OSM splits a road into many short ways: join them end to end, then label
    # each road once, on its longest stretch nearest the site.
    labels = {}
    for name, ps in pieces.items():
        for pts in chain(ps):
            length = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
            mid = pts[len(pts) // 2]
            score = math.hypot(mid[0] - SITE_CENTRE[0], mid[1] - SITE_CENTRE[1]) - 0.5 * length
            if length >= 60 and score < labels.get(name, (0, None, math.inf))[2]:
                labels[name] = (length, pts, score)

    road_labels = []
    for name, (length, pts, _) in sorted(labels.items()):
        # Label the middle of the way, along its local direction.
        half, run = length / 2, 0.0
        for a, b in zip(pts, pts[1:]):
            seg = math.dist(a, b)
            if run + seg >= half:
                t = (half - run) / seg if seg else 0
                at = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                dx, dy = b[0] - a[0], b[1] - a[1]
                break
            run += seg
        if math.hypot(at[0] - SITE_CENTRE[0], at[1] - SITE_CENTRE[1]) > 450:
            continue
        if dx < 0:
            dx, dy = -dx, -dy
        angle = math.degrees(math.atan2(-dy, dx))
        road_labels.append(
            f'{{ text: {js(name)}, at: {{ x: {at[0]:.1f}, y: {at[1]:.1f} }}, angleDeg: {angle:.1f}, lengthM: {min(140, max(60, len(name) * 6)):g} }}'
        )

    OUT.write_text(
        "// Generated by scripts/osm/build-context.py from an OpenStreetMap export.\n"
        "// Do not edit by hand. Map data (c) OpenStreetMap contributors, ODbL.\n"
        "//\n"
        "// Buildings: [levels or null, \"house\" | \"other\", name or address, flat ring x,y,...]\n"
        "// Roads: [width m, name, flat line]. Green and water: flat rings.\n\n"
        "export const OSM_EXTRACT_DATE = \"2026-10-01\";\n\n"
        "export const osmBuildings: [number | null, \"house\" | \"other\", string | null, number[]][] = [\n  "
        + ",\n  ".join(buildings) + ",\n];\n\n"
        "export const osmRoads: [number, string | null, number[]][] = [\n  " + ",\n  ".join(roads) + ",\n];\n\n"
        "export const osmGreen: number[][] = [\n  " + ",\n  ".join(green) + ",\n];\n\n"
        "export const osmWater: number[][] = [\n  " + ",\n  ".join(water) + ",\n];\n\n"
        "export const osmRoadLabels = [\n  " + ",\n  ".join(road_labels) + ",\n];\n"
    )
    print(f"{len(buildings)} buildings, {len(roads)} roads, {len(green)} green, {len(water)} water, {len(road_labels)} labels -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
