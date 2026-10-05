"""Every project in the Huttons New Launch API, for the projects map.

Usage:
  python3 scripts/huttons/sync-catalogue.py
  python3 scripts/huttons/sync-catalogue.py --limit 5     # a quick trial

For each project: name, district, market segment, address, map position,
tenure, developer, launch and completion dates, total units, and its unit
types with sizes, units left and the lowest price still available (from the
live unit list). Writes src/features/catalogue/data/huttons-catalogue.ts.

Also saves a small copy of each listed project's main image to
public/catalogue/<id>.jpg (projects still selling or upcoming; existing
copies are kept) and lists them in src/features/catalogue/data/catalogue-images.ts,
so the single-page map can embed them.

Credentials come from HUTTONS_API_KEY and HUTTONS_API_SECRET. No agent
contacts and no internal media are fetched. Projects without a map position
are placed at their street address with OneMap's public search when
www.onemap.gov.sg is reachable, otherwise listed without a position.
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import client  # noqa: E402

# TRM_ROOT redirects the output, for trying the script without touching the repo.
ROOT = Path(os.environ.get("TRM_ROOT") or Path(__file__).resolve().parents[2])
OUT = ROOT / "src/features/catalogue/data/huttons-catalogue.ts"
THUMBS = ROOT / "public/catalogue"
THUMB_LIST = ROOT / "src/features/catalogue/data/catalogue-images.ts"


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def onemap(address):
    q = urllib.parse.urlencode({"searchVal": address, "returnGeom": "Y", "getAddrDetails": "N", "pageNum": 1})
    try:
        r = json.load(urllib.request.urlopen(f"https://www.onemap.gov.sg/api/common/elastic/search?{q}", timeout=20))
        hit = (r.get("results") or [None])[0]
        return (float(hit["LATITUDE"]), float(hit["LONGITUDE"])) if hit else None
    except Exception:
        return None


def district(location):
    m = re.match(r"\s*(D\d{2})\s*-?\s*(.*)", location or "")
    return (m.group(1), m.group(2).strip() or None) if m else (None, location or None)


def project_row(p):
    pid = p["projectId"]
    try:
        detail = client.get("project/queryProjectDetail", projectId=pid) or {}
    except client.ApiError:
        detail = {}
    try:
        units = client.pages("unit/queryUnitsByPage", projectId=pid, orderType="stack")
    except client.ApiError as e:
        print("  units failed:", p.get("projectName"), e)
        units = []
    lat, lon = num(p.get("latitude") or detail.get("latitude")), num(p.get("longitude") or detail.get("longitude"))
    placed = "huttons"
    if not (lat and lon) and p.get("streetAddress"):
        found = onemap(p["streetAddress"])
        lat, lon, placed = (*found, "onemap") if found else (None, None, None)
    code, area = district(p.get("location") or detail.get("location"))
    types = client.summarise_units(units)
    segment = (detail.get("projectArea") or p.get("projectArea") or "").upper() or None
    return {
        "id": pid,
        "name": (p.get("projectName") or "").strip(),
        "district": code,
        "area": area,
        "segment": segment if segment in ("CCR", "RCR", "OCR") else None,
        "address": p.get("streetAddress") or None,
        "lat": round(lat, 6) if lat else None,
        "lon": round(lon, 6) if lon else None,
        "placedBy": placed,
        "tenure": p.get("tenure") or None,
        "developer": p.get("developer") or None,
        "launchDate": client.day(p.get("launchDate")),
        "launchNote": p.get("launchDateAltText") or None,
        "completionDate": client.day(p.get("completionDate")),
        "totalUnits": int(num(p.get("unitsNum")) or 0) or (len(units) or None),
        "unitsLeft": sum(1 for u in units if (u.get("purchaseStatus") or "").upper() == "AVAILABLE") if units else None,
        "unitTypes": types,
        "image": p.get("mainImage") or detail.get("mainImage") or None,
    }


def thumbnails(rows, today):
    """Small JPEG copies of the main images of projects shown on the map."""
    try:
        from PIL import Image
    except ImportError:
        print("Pillow not installed; map thumbnails skipped")
        return
    import io
    THUMBS.mkdir(parents=True, exist_ok=True)
    shown = [r for r in rows if r["image"] and ((r["launchDate"] or "") > today or r["unitsLeft"] is None or r["unitsLeft"] > 0)]
    saved = 0
    for r in shown:
        f = THUMBS / f"{r['id']}.jpg"
        if f.exists():
            continue
        try:
            data = urllib.request.urlopen(r["image"], timeout=30).read()
            im = Image.open(io.BytesIO(data)).convert("RGB")
            im.thumbnail((480, 480))
            im.save(f, "JPEG", quality=62, optimize=True)
            saved += 1
        except Exception as e:  # a missing image is not worth failing the sync for
            print("  image failed:", r["name"], e)
    ids = sorted(p.stem for p in THUMBS.glob("*.jpg") if p.stem in {r["id"] for r in shown})
    THUMB_LIST.write_text(
        "// Generated by scripts/huttons/sync-catalogue.py: projects with a saved\n"
        "// copy of their main image in public/catalogue/. Don't edit by hand.\n\n"
        f"export const catalogueImages = new Set<string>({json.dumps(ids)});\n"
    )
    print(f"{saved} new map thumbnails; {len(ids)} listed")


def main(limit=None):
    listed = client.pages("project/queryProjectByPage")
    listed = [p for p in listed if (p.get("country") or "Singapore") == "Singapore"]
    if limit:
        listed = listed[:limit]
    rows = []
    for i, p in enumerate(listed, 1):
        print(f"[{i}/{len(listed)}] {p.get('projectName')}")
        rows.append(project_row(p))
    rows.sort(key=lambda r: r["name"].lower())
    fetched = client.today()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = "".join("    " + json.dumps(r, ensure_ascii=False) + ",\n" for r in rows).rstrip("\n")
    OUT.write_text(f"""// Generated by scripts/huttons/sync-catalogue.py from the Huttons New Launch API
// on {fetched}. Don't edit by hand; run the script again to refresh.

import type {{ Catalogue }} from "../model";

export const huttonsCatalogue: Catalogue = {{
  source: "Huttons New Launch API",
  fetched: "{fetched}",
  seed: false,
  projects: [
{body}
  ],
}};
""")
    thumbnails(rows, fetched)
    located = sum(1 for r in rows if r["lat"])
    print(f"{len(rows)} projects ({located} on the map) written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(int(args[args.index("--limit") + 1]) if "--limit" in args else None)
