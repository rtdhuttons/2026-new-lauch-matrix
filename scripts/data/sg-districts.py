"""Singapore's 28 postal districts (D01–D28) as outlines for the projects map.

Usage: python3 scripts/data/sg-districts.py [subzones.geojson]

There is no official map of postal districts, so they are built from
official pieces: URA's Master Plan 2019 subzones (data.gov.sg) are each
assigned to the postal district of the addresses inside them (OneMap's
public search, by the first two digits of each postcode, using URA's
postal district list), then merged. A subzone without addresses takes the
district its neighbours share most border with. The result is approximate
at the edges. Writes src/features/catalogue/data/sg-districts.ts.
Needs Shapely (pip install shapely) and www.onemap.gov.sg.
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

basemap = import_module("sg-basemap")  # project(), download(), simplify settings

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/features/catalogue/data/sg-districts.ts"
SUBZONES = "d_8594ae9ff96d0c708bc2af633048edfb"  # Master Plan 2019 Subzone Boundary (No Sea)

# URA's list of postal districts: first two digits of the postcode -> district.
SECTORS = {
    "D01": "01 02 03 04 05 06", "D02": "07 08", "D03": "14 15 16", "D04": "09 10", "D05": "11 12 13",
    "D06": "17", "D07": "18 19", "D08": "20 21", "D09": "22 23", "D10": "24 25 26 27", "D11": "28 29 30",
    "D12": "31 32 33", "D13": "34 35 36 37", "D14": "38 39 40 41", "D15": "42 43 44 45", "D16": "46 47 48",
    "D17": "49 50 81", "D18": "51 52", "D19": "53 54 55 82", "D20": "56 57", "D21": "58 59",
    "D22": "60 61 62 63 64", "D23": "65 66 67 68", "D24": "69 70 71", "D25": "72 73", "D26": "77 78",
    "D27": "75 76", "D28": "79 80",
}
DISTRICT_OF = {s: d for d, ss in SECTORS.items() for s in ss.split()}
NAMES = {
    "D01": "Raffles Place, Marina", "D02": "Tanjong Pagar, Chinatown", "D03": "Queenstown, Tiong Bahru", "D04": "Harbourfront, Telok Blangah",
    "D05": "Buona Vista, West Coast, Clementi", "D06": "City Hall, Clarke Quay", "D07": "Beach Road, Bugis", "D08": "Farrer Park, Serangoon Road",
    "D09": "Orchard, River Valley", "D10": "Holland, Bukit Timah, Tanglin", "D11": "Newton, Novena", "D12": "Balestier, Toa Payoh",
    "D13": "Macpherson, Potong Pasir", "D14": "Eunos, Geylang, Paya Lebar", "D15": "East Coast, Marine Parade", "D16": "Bedok, Upper East Coast",
    "D17": "Changi, Loyang", "D18": "Pasir Ris, Tampines", "D19": "Hougang, Punggol, Sengkang", "D20": "Ang Mo Kio, Bishan, Thomson",
    "D21": "Clementi Park, Upper Bukit Timah", "D22": "Boon Lay, Jurong, Tuas", "D23": "Bukit Batok, Bukit Panjang, Choa Chu Kang",
    "D24": "Lim Chu Kang, Tengah", "D25": "Admiralty, Woodlands", "D26": "Mandai, Upper Thomson", "D27": "Sembawang, Yishun",
    "D28": "Seletar, Yio Chu Kang",
}


def onemap(q):
    params = urllib.parse.urlencode({"searchVal": q, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": 1})
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(f"https://www.onemap.gov.sg/api/common/elastic/search?{params}", timeout=20)).get("results", [])
        except Exception:
            time.sleep(1 + i)
    return []


def main(src=None):
    data = json.loads(Path(src).read_text()) if src else basemap.download(SUBZONES)
    zones = []
    for f in data["features"]:
        p = f["properties"]
        zones.append({"name": p["SUBZONE_N"], "area": p["PLN_AREA_N"], "geom": shape(f["geometry"]).buffer(0)})
    # Postcodes found inside each subzone, from searches by the subzone's and its planning area's names.
    for i, z in enumerate(zones):
        votes = Counter()
        for q in (z["name"], f"{z['name']} {z['area']}"):
            for h in onemap(q):
                post = h.get("POSTAL", "")
                if len(post) == 6 and post.isdigit() and z["geom"].contains(Point(float(h["LONGITUDE"]), float(h["LATITUDE"]))):
                    d = DISTRICT_OF.get(post[:2])
                    if d:
                        votes[d] += 1
            if votes:
                break
            time.sleep(0.1)
        z["district"] = votes.most_common(1)[0][0] if votes else None
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(zones)} subzones")
    # Subzones with no addresses: the district they share the most border with.
    for _ in range(6):
        changed = False
        for z in zones:
            if z["district"]:
                continue
            border = Counter()
            for o in zones:
                if o["district"] and o is not z and z["geom"].touches(o["geom"]) or (o["district"] and o is not z and z["geom"].intersects(o["geom"])):
                    border[o["district"]] += z["geom"].boundary.intersection(o["geom"].boundary).length
            if border:
                z["district"] = border.most_common(1)[0][0]
                changed = True
        if not changed:
            break
    districts = []
    for d in sorted(SECTORS):
        parts = [z["geom"] for z in zones if z["district"] == d]
        if not parts:
            print("no subzones for", d)
            continue
        merged = unary_union(parts).buffer(0.00005).buffer(-0.00005)
        polys = list(merged.geoms) if merged.geom_type == "MultiPolygon" else [merged]
        path = "".join(basemap.ring_path([(x, y) for x, y in poly.exterior.coords]) for poly in polys if poly.area > 1e-7)
        rp = merged.representative_point()
        lx, ly = basemap.project(rp.x, rp.y)
        districts.append({"id": d, "name": NAMES[d], "d": path, "label": [round(lx), round(ly)], "subzones": sum(1 for z in zones if z["district"] == d)})
    unassigned = [z["name"] for z in zones if not z["district"]]
    OUT.write_text(f"""// Generated by scripts/data/sg-districts.py. Don't edit by hand.
// Postal districts approximated from URA's Master Plan 2019 subzones (data.gov.sg),
// each assigned to the postal district of the OneMap addresses inside it, then merged.

export const DISTRICTS_NOTE = "District outlines are approximate: URA subzones grouped by the postal district of the addresses inside them.";

export const sgDistricts: {{ id: string; name: string; d: string; label: [number, number]; subzones: number }}[] = {json.dumps(districts, ensure_ascii=False)};
""")
    print(f"{len(districts)} districts from {len(zones)} subzones ({len(unassigned)} unassigned), {OUT.stat().st_size / 1024:.0f} KB -> {OUT.relative_to(ROOT)}")
    if unassigned:
        print("unassigned:", ", ".join(unassigned[:20]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
