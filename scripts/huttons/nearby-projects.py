"""The four nearest projects on the new launches map, for a project's
Alternative Projects tab.

Usage:
  python3 scripts/huttons/nearby-projects.py the-serra-residences   # one or more project slugs
  python3 scripts/huttons/nearby-projects.py --all                  # every project on the map

Reads the map's catalogue (src/features/catalogue/data/huttons-catalogue.ts,
from sync-catalogue.py), so it needs no API keys and makes no requests; run
sync-catalogue.py first to refresh prices and units left.

The rule: projects on the map (still selling, or not launched yet), nearest
first by straight-line distance between the map positions, that sell a
bedroom type this project also has, with units of that type still available
(or the project not launched yet). Four are kept. Only the shared bedroom
types are listed, each with its lowest price, the price per sq ft of that
unit, the range of price per sq ft across the available units, and units left.

Writes, for a project with its own folder (src/features/selector/data/<slug>/),
<slug>/nearby-projects.ts, and copies each nearby project's saved photo
(public/catalogue/<id>.jpg) to public/<slug>/images/nearby-<their slug>.jpg so
the single-page build can embed it. For an automatically built project, it
rewrites `nearby` in src/features/selector/data/auto/specs/<slug>.json.
"""

import json
import math
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOGUE = ROOT / "src/features/catalogue/data/huttons-catalogue.ts"
DATA = ROOT / "src/features/selector/data"
SPECS = DATA / "auto/specs"
HAND_BUILT = {"thomson-reserve", "the-serra-residences"}
COUNT = 4
RULE = (
    "The four nearest projects on the new launches map, by straight-line distance between map positions, "
    "that still have units for sale (or have not launched yet) in a bedroom type this project also offers."
)

CJK = re.compile(r"[⺀-鿿豈-﫿＀-￯]+")


def clean_name(name):
    return re.sub(r"\s+", " ", CJK.sub("", name or "")).strip()


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def metres(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def load():
    t = CATALOGUE.read_text()
    fetched = re.search(r'fetched: "(\d{4}-\d{2}-\d{2})"', t).group(1)
    rows = [json.loads(line.strip().rstrip(",")) for line in t.splitlines() if line.strip().startswith('{"id"')]
    on_map = [r for r in rows if (r["launchDate"] or "") > fetched or r["unitsLeft"] is None or r["unitsLeft"] > 0]
    return fetched, on_map


def nearest(me, on_map, fetched):
    mine = {t["bedrooms"] for t in me["unitTypes"]}
    out = []
    for o in on_map:
        if o["id"] == me["id"] or o["lat"] is None or me["lat"] is None:
            continue
        upcoming = (o["launchDate"] or "") > fetched
        shared = [t for t in o["unitTypes"] if t["bedrooms"] in mine and (upcoming or (t["unitsLeft"] or 0) > 0)]
        if shared:
            out.append((metres((me["lat"], me["lon"]), (o["lat"], o["lon"])) / 1000, o, shared))
    out.sort(key=lambda x: x[0])
    near = []
    for km, o, shared in out[:COUNT]:
        slug = slugify(clean_name(o["name"]))
        spec = SPECS / f"{slug}.json"
        mrt = json.loads(spec.read_text())["mrt"][:1] if spec.exists() else []
        near.append({
            "id": o["id"],
            "slug": slug,
            "name": clean_name(o["name"]),
            "km": round(km, 2),
            "district": o["district"],
            "address": o["address"],
            "segment": o["segment"],
            "developer": o["developer"],
            "tenure": o["tenure"],
            "totalUnits": o["totalUnits"],
            "completion": o["completionDate"],
            "launchDate": o["launchDate"],
            "mrt": mrt[0] if mrt else None,
            "image": None,
            "unitTypes": [
                {
                    "bedrooms": t["bedrooms"],
                    "type": t["type"],
                    "sizeSqft": t["sizeSqft"],
                    "fromPrice": t["fromPrice"],
                    "fromPsf": t["fromPsf"],
                    "psfRange": t.get("psfRange"),
                    "unitsLeft": t["unitsLeft"],
                }
                for t in shared
            ],
        })
    return near


def write_hand_built(slug, near, fetched):
    images = ROOT / "public" / slug / "images"
    for n in near:
        photo = ROOT / "public/catalogue" / f"{n['id']}.jpg"
        if photo.exists():
            name = f"nearby-{n['slug']}.jpg"
            shutil.copyfile(photo, images / name)
            n["image"] = name
    body = json.dumps({"source": "Huttons New Launch API", "fetched": fetched, "rule": RULE, "projects": near}, indent=2, ensure_ascii=False)
    (DATA / slug / "nearby-projects.ts").write_text(
        "// Generated by scripts/huttons/nearby-projects.py from the new launches map's\n"
        f"// catalogue (Huttons New Launch API, {fetched}). Don't edit by hand; run the\n"
        "// script again after sync-catalogue.py to refresh.\n\n"
        'import type { NearbySync } from "../nearby";\n\n'
        f"export const nearbySync: NearbySync = {body};\n"
    )


def write_auto(slug, near):
    path = SPECS / f"{slug}.json"
    spec = json.loads(path.read_text())
    for n in near:
        other = SPECS / f"{n['slug']}.json"
        n["image"] = json.loads(other.read_text())["mainImage"] if other.exists() else None
    spec["nearby"] = near
    path.write_text(json.dumps(spec, ensure_ascii=False, separators=(",", ":")))


def main(args):
    fetched, on_map = load()
    by_slug = {slugify(clean_name(r["name"])): r for r in on_map}
    slugs = sorted(by_slug) if args == ["--all"] else args
    for slug in slugs:
        me = by_slug.get(slug)
        if not me:
            print(f"{slug}: not on the map; skipped")
            continue
        if slug in HAND_BUILT and not (DATA / slug).is_dir():
            continue
        if slug == "thomson-reserve":
            # Thomson Reserve keeps TRM's own comparison (alternatives.ts).
            continue
        near = nearest(me, on_map, fetched)
        if slug in HAND_BUILT:
            write_hand_built(slug, near, fetched)
        elif (SPECS / f"{slug}.json").exists():
            write_auto(slug, near)
        else:
            print(f"{slug}: no mini site data file; skipped")
            continue
        print(f"{clean_name(me['name'])}: " + "; ".join(f"{n['name']} {n['km']} km" for n in near))


if __name__ == "__main__":
    if not sys.argv[1:]:
        sys.exit(__doc__)
    main(sys.argv[1:])
