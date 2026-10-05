"""One data file per project for its mini site, from the Huttons New Launch API.

Usage:
  python3 scripts/huttons/build-sites.py                 # every project on the map
  python3 scripts/huttons/build-sites.py "Lentoria" ...  # just these

For each project still selling or upcoming (the ones on the new launches map,
from src/features/catalogue/data/huttons-catalogue.ts), writes
src/features/selector/data/auto/specs/<slug>.json with:
  facts      address, district, segment, map position, tenure, developer,
             units, launch and completion, site area, and the developer's
             description, facilities and nearby amenities
  units      every unit: block, stack, floor, floor plan, area, bedrooms,
             bathrooms, availability, list and nett price
  plans      floor plans and site plans (the API's image addresses; the
             website loads them from Huttons' image server)
  images     the main image and project images marked open to the public
             (sensitive = 1); internal-only media is never used
  mrt        stations nearby with walking distance and time (the API's
             nearby facilities)
  schools    primary schools within 2.5 km, straight line from the project's
             map position on OneMap address points (needs www.onemap.gov.sg)
  nearby     the nearest other projects on the map with a bedroom type in
             common, units left and their lowest prices
Then regenerates src/features/selector/data/auto/registry.ts.

Projects with their own hand-built folder (Thomson Reserve, The Serra
Residences) are skipped. Credentials come from HUTTONS_API_KEY and
HUTTONS_API_SECRET. Agent contacts and commission details are never fetched.
"""

import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import client  # noqa: E402

ROOT = Path(os.environ.get("TRM_ROOT") or Path(__file__).resolve().parents[2])
CATALOGUE = ROOT / "src/features/catalogue/data/huttons-catalogue.ts"
AUTO = ROOT / "src/features/selector/data/auto"
SPECS = AUTO / "specs"
HAND_BUILT = {"thomson-reserve", "the-serra-residences"}
STATUS = {"AVAILABLE": "available", "SOLD": "sold", "RESERVED": "reserved", "BOOKED": "reserved"}
ONEMAP = "https://www.onemap.gov.sg/api/common/elastic/search?"
EXTRA_SCHOOLS = [
    "AI TONG SCHOOL", "CATHOLIC HIGH SCHOOL", "CHIJ ST. NICHOLAS GIRLS' SCHOOL", "MARYMOUNT CONVENT SCHOOL",
    "KHENG CHENG SCHOOL", "PEI CHUN PUBLIC SCHOOL", "CHIJ PRIMARY (TOA PAYOH)", "MARIS STELLA HIGH SCHOOL",
    "HONG WEN SCHOOL", "ST. JOSEPH'S INSTITUTION JUNIOR", "ANGLO-CHINESE SCHOOL (JUNIOR)", "ANGLO-CHINESE SCHOOL (PRIMARY)",
    "SINGAPORE CHINESE GIRLS' SCHOOL", "ST. ANDREW'S JUNIOR SCHOOL", "CHIJ (KELLOCK)", "NAN HUA PRIMARY SCHOOL",
    "NANYANG PRIMARY SCHOOL", "RAFFLES GIRLS' PRIMARY SCHOOL", "TAO NAN SCHOOL", "ROSYTH SCHOOL", "HOLY INNOCENTS' PRIMARY SCHOOL",
    "ST. HILDA'S PRIMARY SCHOOL", "METHODIST GIRLS' SCHOOL (PRIMARY)", "PAYA LEBAR METHODIST GIRLS' SCHOOL (PRIMARY)",
    "ST. STEPHEN'S SCHOOL", "ST. GABRIEL'S PRIMARY SCHOOL", "ST. ANTHONY'S PRIMARY SCHOOL", "ST. MARGARET'S SCHOOL (PRIMARY)",
    "CHIJ OUR LADY OF GOOD COUNSEL", "CHIJ OUR LADY OF THE NATIVITY", "CHIJ OUR LADY QUEEN OF PEACE", "CHIJ KATONG CONVENT",
    "CANOSSA CATHOLIC PRIMARY SCHOOL", "MAHA BODHI SCHOOL", "MAHA BODHI SCHOOL", "MANJUSRI SECONDARY SCHOOL", "KONG HWA SCHOOL",
    "HAIG GIRLS' SCHOOL", "TAO NAN SCHOOL", "CHONGFU SCHOOL", "XISHAN PRIMARY SCHOOL", "FAIRFIELD METHODIST SCHOOL (PRIMARY)",
    "GONGSHANG PRIMARY SCHOOL", "NGEE ANN PRIMARY SCHOOL", "RED SWASTIKA SCHOOL", "PEI HWA PRESBYTERIAN PRIMARY SCHOOL",
    "PEI TONG PRIMARY SCHOOL", "MONTFORT JUNIOR SCHOOL", "DE LA SALLE SCHOOL", "ST. JOSEPH'S INSTITUTION JUNIOR",
]

CJK = re.compile(r"[⺀-鿿豈-﫿＀-￯]+")


def clean_name(name):
    return re.sub(r"\s+", " ", CJK.sub("", name or "")).strip()


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def metres(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def onemap(q, page=1):
    url = ONEMAP + urllib.parse.urlencode({"searchVal": q, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": page})
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(url, timeout=30))
        except Exception:
            time.sleep(1)
    return {"results": [], "totalNumPages": 0}


def primary_schools():
    """Every primary school's OneMap address point: {name: (lat, lon)}."""
    first = onemap("PRIMARY SCHOOL")
    results = list(first["results"])
    for p in range(2, int(first.get("totalNumPages") or 0) + 1):
        results += onemap("PRIMARY SCHOOL", p)["results"]
    for q in dict.fromkeys(EXTRA_SCHOOLS):
        results += onemap(q)["results"][:3]
    schools = {}
    for r in results:
        name = (r.get("BUILDING") or "").strip()
        if not name or name == "NIL" or "STUDENT CARE" in name or "@" in name or "KINDERGARTEN" in name or "HISTORIC" in name:
            continue
        if not re.search(r"SCHOOL|INSTITUTION", name):
            continue
        name = re.sub(r"^SAINT ", "ST. ", name)
        schools.setdefault(name, (float(r["LATITUDE"]), float(r["LONGITUDE"])))
    print(f"{len(schools)} schools from OneMap")
    return schools


def title_case(name):
    small = {"of", "the", "and"}
    words = name.lower().split()
    out = []
    for i, w in enumerate(words):
        if w.startswith("(") and len(w) > 1:
            out.append("(" + w[1:].capitalize())
        elif w in {"chij", "acs", "sji", "mgs"}:
            out.append(w.upper())
        elif i and w in small:
            out.append(w)
        else:
            out.append(w[0].upper() + w[1:] if w else w)
    return " ".join(out).replace("St. ", "St. ").replace("'S", "'s")


def mrt_list(listing):
    """Stations from the API's nearby facilities: name, metres, minutes walk."""
    stations = {}
    for key in ("facilitiesMap", "facilitiesMap1", "facilitiesMap05"):
        try:
            groups = json.loads(listing.get(key) or "[]")
        except ValueError:
            continue
        for g in groups:
            if g.get("type") != "subway_station":
                continue
            for s in g.get("value") or []:
                d, t = num(s.get("distance")), num(s.get("duration"))
                if d is None or not s.get("name"):
                    continue
                name = s["name"].strip()
                if name not in stations or d < stations[name]["metres"]:
                    stations[name] = {"name": name, "metres": int(d), "minutes": math.ceil(t / 60) if t else None}
    return sorted(stations.values(), key=lambda s: s["metres"])[:4]


def nearby(row, rows, today):
    """The nearest other projects on the map with a bedroom type in common and units left."""
    mine = {t["bedrooms"] for t in row["unitTypes"]}
    out = []
    for o in rows:
        if o["id"] == row["id"] or not (o["lat"] and row["lat"]):
            continue
        upcoming = (o["launchDate"] or "") > today
        if not upcoming and not (o["unitsLeft"] or 0) > 0:
            continue
        shared = [t for t in o["unitTypes"] if t["bedrooms"] in mine]
        if not shared:
            continue
        km = metres((row["lat"], row["lon"]), (o["lat"], o["lon"])) / 1000
        out.append((km, o, shared))
    out.sort(key=lambda x: x[0])
    return [
        {
            "name": clean_name(o["name"]),
            "km": round(km, 2),
            "developer": o["developer"],
            "tenure": o["tenure"],
            "totalUnits": o["totalUnits"],
            "completion": o["completionDate"],
            "launchDate": o["launchDate"],
            "segment": o["segment"],
            "unitTypes": [
                {"bedrooms": t["bedrooms"], "type": t["type"], "sizeSqft": t["sizeSqft"], "fromPrice": t["fromPrice"], "unitsLeft": t["unitsLeft"]}
                for t in shared
            ],
        }
        for km, o, shared in out[:4]
    ]


def text(v):
    import base64
    import html
    if not v:
        return None
    s = v
    try:
        decoded = base64.b64decode(v, validate=True).decode("utf-8")
        if decoded.strip():
            s = decoded
    except Exception:
        pass
    s = re.sub(r"<br\s*/?>|</p>|</li>", "\n", s, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\n\s*\n+", "\n", s).strip() or None


def spec_for(row, listing, schools, rows, fetched):
    pid = row["id"]
    detail = client.get("project/queryProjectDetail", projectId=pid) or {}
    units = client.pages("unit/queryUnitsByPage", projectId=pid, orderType="stack")
    unit_rows = []
    for u in units:
        if (u.get("type") or "").lower() == "shop":
            continue
        price = lambda k: int(float(u[k])) if num(u.get(k)) and float(u[k]) > 0 else None  # noqa: E731
        unit_rows.append([
            (u.get("buildName") or "").strip(),
            (u.get("stack") or "").strip(),
            int(num(u.get("floor")) or 0),
            (u.get("floorPlanName") or "").strip(),
            round(num(u.get("area")) or 0),
            int(num(u.get("bedrooms")) or 0) or None,
            int(num(u.get("bathrooms")) or 0) or None,
            (u.get("type") or "").strip() or None,
            STATUS.get((u.get("purchaseStatus") or "").upper(), "pending"),
            price("price1"),
            price("price2"),
        ])
    unit_rows.sort(key=lambda r: (r[0], r[1], r[2]))
    plans = [
        {"name": (fp.get("floorPlanName") or "").strip(), "type": fp.get("floorPlanType"), "img": fp.get("img")}
        for fp in client.get("project/queryFloorPlan", projectId=pid) or []
        if fp.get("img")
    ]
    site = [{"name": sp.get("sitePlanName"), "img": sp.get("img")} for sp in client.get("project/querySitePlans", projectId=pid) or [] if sp.get("img")]
    images = []
    for m in client.get("project/queryProjectMedia", projectId=pid, type="Image") or []:
        if str(m.get("sensitive")) == "1" and m.get("url"):  # 0 = internal only, never used
            images.append({"title": m.get("title") or None, "img": m["url"]})
    lat, lon = row["lat"], row["lon"]
    near_schools = sorted(
        ({"name": title_case(n), "metres": round(metres((lat, lon), p) / 10) * 10} for n, p in schools.items()),
        key=lambda s: s["metres"],
    )
    seen, school_rows = set(), []
    for s in near_schools:
        key = re.sub(r"[^a-z]", "", s["name"].lower().replace("primary", ""))
        if s["metres"] > 2500 or key in seen:
            continue
        seen.add(key)
        school_rows.append(s)
    return {
        "id": client.slugify(clean_name(row["name"])),
        "projectId": pid,
        "name": clean_name(row["name"]),
        "fetched": fetched,
        "facts": {
            "address": row["address"],
            "postalCode": detail.get("postalCode") or None,
            "district": row["district"],
            "area": row["area"],
            "segment": row["segment"],
            "lat": lat,
            "lon": lon,
            "tenure": row["tenure"],
            "developer": row["developer"],
            "totalUnits": row["totalUnits"],
            "launchDate": row["launchDate"],
            "launchNote": row["launchNote"],
            "completionDate": row["completionDate"],
            "completionNote": listing.get("completionDateAltText") or None,
            "siteArea": listing.get("siteArea") or None,
            "description": text(detail.get("description")),
            "keyPoints": text(detail.get("keyPoints")),
            "facilities": text(detail.get("facilities")),
            "nearbyAmenities": text(detail.get("nearbyAmenities")),
        },
        "units": unit_rows,
        "floorPlans": plans,
        "sitePlans": site,
        "mainImage": row.get("image"),
        "images": images,
        "mrt": mrt_list(listing),
        "schools": school_rows[:14],
        "nearby": nearby(row, rows, fetched),
    }


def write_registry():
    """src/features/selector/data/auto/registry.ts: every project's listing and loaders."""
    specs = sorted(SPECS.glob("*.json"))
    traces = {f.stem for f in (AUTO / "traces").glob("*.json")}
    entries, loaders, trace_loaders = [], [], []
    for f in specs:
        s = json.loads(f.read_text())
        f_ = s["facts"]
        bits = [f"{len(s['units']):,} units" if s["units"] else None, f_["tenure"], f_["district"]]
        entries.append({
            "id": s["id"],
            "name": s["name"],
            "district": f_["district"],
            "area": f_["area"],
            "summary": " · ".join(b for b in bits if b),
            "image": s["mainImage"],
            "traced": s["id"] in traces,
        })
        loaders.append(f'  {json.dumps(s["id"])}: () => import("./specs/{f.name}"),')
        if s["id"] in traces:
            trace_loaders.append(f'  {json.dumps(s["id"])}: () => import("./traces/{s["id"]}.json"),')
    (AUTO / "registry.ts").write_text(
        "// Generated by scripts/huttons/build-sites.py: every project with an\n"
        "// automatically built mini site. Don't edit by hand; run\n"
        "// `python3 scripts/huttons/build-sites.py --registry` after adding a trace.\n\n"
        "export interface AutoListing {\n  id: string;\n  name: string;\n  district: string | null;\n  area: string | null;\n  summary: string;\n  image: string | null;\n  traced: boolean;\n}\n\n"
        f"export const autoListings: AutoListing[] = {json.dumps(entries, indent=2, ensure_ascii=False)};\n\n"
        "/** Loads one project's data file on demand. */\n"
        "export const autoSpecLoaders: Record<string, () => Promise<{ default: unknown }>> = {\n"
        + "\n".join(loaders)
        + "\n};\n\n/** Loads TRM's tracing of the project's site plan, where there is one. */\n"
        "export const autoTraceLoaders: Record<string, () => Promise<{ default: unknown }>> = {\n"
        + "\n".join(trace_loaders)
        + "\n};\n"
    )
    print(f"registry: {len(entries)} projects, {len(trace_loaders)} traced")


def main(names):
    t = CATALOGUE.read_text()
    rows = [json.loads(line.strip().rstrip(",")) for line in t.splitlines() if line.strip().startswith('{"id"')]
    fetched = client.today()
    on_map = [r for r in rows if (r["launchDate"] or "") > fetched or r["unitsLeft"] is None or r["unitsLeft"] > 0]
    todo = [r for r in on_map if client.slugify(clean_name(r["name"])) not in HAND_BUILT]
    if names:
        want = {client.slugify(clean_name(n)) for n in names}
        todo = [r for r in todo if client.slugify(clean_name(r["name"])) in want]
    listings = {p["projectId"]: p for p in client.pages("project/queryProjectByPage")}
    schools = primary_schools()
    SPECS.mkdir(parents=True, exist_ok=True)
    for i, row in enumerate(todo, 1):
        try:
            spec = spec_for(row, listings.get(row["id"], {}), schools, on_map, fetched)
        except client.ApiError as e:
            print(f"[{i}/{len(todo)}] {row['name']}: failed ({e}); keeping the previous file")
            continue
        (SPECS / f"{spec['id']}.json").write_text(json.dumps(spec, ensure_ascii=False, separators=(",", ":")))
        print(f"[{i}/{len(todo)}] {spec['name']}: {len(spec['units'])} units, {len(spec['floorPlans'])} plans, {len(spec['sitePlans'])} site plans")
    write_registry()


if __name__ == "__main__":
    if sys.argv[1:] == ["--registry"]:
        write_registry()
    else:
        main(sys.argv[1:])
