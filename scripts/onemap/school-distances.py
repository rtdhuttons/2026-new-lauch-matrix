"""Straight-line distances from a project's block addresses to nearby primary
schools, using SLA OneMap address points.

Usage: python3 scripts/onemap/school-distances.py "1 BRIGHT HILL DRIVE" "3 BRIGHT HILL DRIVE" ...

Uses OneMap's public address search (no token needed). Finds every result for
"PRIMARY SCHOOL" plus schools whose names don't say "Primary" (listed below),
and prints those within 2.6 km of any block, with the distance from each block
in metres (rounded to 10 m). MOE's official home-school distance is measured
to the school boundary, so it can be a little shorter than these figures.
Needs network access to www.onemap.gov.sg.
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request

SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search?"
# Primary schools whose names don't contain "Primary".
EXTRA = [
    "AI TONG SCHOOL", "CATHOLIC HIGH SCHOOL", "CHIJ ST. NICHOLAS GIRLS' SCHOOL", "MARYMOUNT CONVENT SCHOOL",
    "KHENG CHENG SCHOOL", "PEI CHUN PUBLIC SCHOOL", "CHIJ PRIMARY (TOA PAYOH)", "MARIS STELLA HIGH SCHOOL",
    "HONG WEN SCHOOL", "ST. JOSEPH'S INSTITUTION JUNIOR", "ANGLO-CHINESE SCHOOL (JUNIOR)", "ANGLO-CHINESE SCHOOL (PRIMARY)",
    "SINGAPORE CHINESE GIRLS' SCHOOL", "ST. ANDREW'S JUNIOR SCHOOL", "CHIJ (KELLOCK)",
]


def search(q, page=1):
    url = SEARCH + urllib.parse.urlencode({"searchVal": q, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": page})
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(url, timeout=30))
        except Exception:
            time.sleep(1)
    return {"results": [], "totalNumPages": 0}


def metres(a, b):
    r = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main(addresses):
    blocks = {}
    for addr in addresses:
        hit = next(x for x in search(addr)["results"] if addr.upper() in x["ADDRESS"])
        blocks[addr] = (float(hit["LATITUDE"]), float(hit["LONGITUDE"]), hit["POSTAL"])
    first = search("PRIMARY SCHOOL")
    results = list(first["results"])
    for p in range(2, first["totalNumPages"] + 1):
        results += search("PRIMARY SCHOOL", p)["results"]
    for q in EXTRA:
        results += search(q)["results"]
    schools = {}
    for r in results:
        name = r["BUILDING"]
        if not name or name == "NIL" or "STUDENT CARE" in name or "@" in name:
            continue
        pt = (float(r["LATITUDE"]), float(r["LONGITUDE"]))
        by = {a: round(metres(b[:2], pt) / 10) * 10 for a, b in blocks.items()}
        if min(by.values()) < 2600:
            schools[name] = (r["POSTAL"], by)
    for name, (postal, by) in sorted(schools.items(), key=lambda kv: min(kv[1][1].values())):
        print(f"{name} ({postal})")
        for a, m in by.items():
            print(f"  {a} ({blocks[a][2]}): {m} m")


if __name__ == "__main__":
    main(sys.argv[1:])
