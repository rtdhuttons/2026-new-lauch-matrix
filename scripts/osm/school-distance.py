"""Indicative distance from each block to a school's boundary, from the OSM export.

Usage: python3 scripts/osm/school-distance.py map.osm WAY_ID BLOCKS_JSON

BLOCKS_JSON is a list like [{"id": "1", "address": "1 Bright Hill Drive",
"x": 468.0, "y": 146.6}] in plan metres (block centres from the project's
index.ts). Uses the same OSM-to-plan fit as build-context.py. Prints the
straight-line distance from each block centre to the nearest point on the
school's boundary. The official home-school distance comes from SLA OneMap
and can differ; treat these as indicative.
"""

import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
exec(open(Path(__file__).parent / "build-context.py").read().split("def main")[0])  # to_plan()


def seg(p, a, b):
    (ax, ay), (bx, by), (px, py) = a, b, p
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def main(osm, way_id, blocks_json):
    root = ET.parse(osm).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    way = next(w for w in root.iter("way") if w.get("id") == way_id)
    poly = [to_plan(*nodes[nd.get("ref")]) for nd in way.findall("nd")]  # noqa: F821
    for b in json.loads(Path(blocks_json).read_text()):
        d = min(seg((b["x"], b["y"]), poly[i], poly[i + 1]) for i in range(len(poly) - 1))
        print(f'{b["address"]}: {round(d / 10) * 10} m')


if __name__ == "__main__":
    main(*sys.argv[1:4])
