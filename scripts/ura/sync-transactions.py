"""Sales and rental transactions of private homes near every project on the
map, from URA's Data Service (eservice.ura.gov.sg).

Usage:
  python3 scripts/ura/sync-transactions.py              # within 1.5 km (the map's radius)
  python3 scripts/ura/sync-transactions.py --radius 2

Needs URA_ACCESS_KEY in the environment (free; register at
https://eservice.ura.gov.sg/maps/api/reg.html). Reads the project positions
from src/features/catalogue/data/huttons-catalogue.ts, keeps the
condominiums, apartments and executive condominiums within the radius of any
of the projects on the map, and writes src/features/catalogue/data/ura-market.ts with, for each
development:
  - sales by year: number, median price per sq ft, new sales, sub-sales and
    resales (URA's last five years of caveats)
  - the most recent sales (up to 15 in the last two years; the map shows 15)
  - rents over the last four quarters by number of bedrooms: number, median
    monthly rent and median rent per sq ft (from the middle of URA's area band)
Set URA_FIXTURES=dir to answer calls from saved JSON instead of the network.
"""

import json
import math
import os
import re
import statistics
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from svy21 import to_latlon  # noqa: E402

ROOT = Path(os.environ.get("TRM_ROOT") or Path(__file__).resolve().parents[2])
CATALOGUE = ROOT / "src/features/catalogue/data/huttons-catalogue.ts"
OUT = ROOT / "src/features/catalogue/data/ura-market.ts"
BASE = "https://eservice.ura.gov.sg/uraDataService"
HOMES = {"Apartment", "Condominium", "Executive Condominium"}
SALE_TYPE = {"1": "new", "2": "sub", "3": "resale"}
SQFT_PER_SQM = 10.7639


def call(path, **params):
    if os.environ.get("URA_FIXTURES"):
        key = params.get("batch") or params.get("refPeriod") or "token"
        f = Path(os.environ["URA_FIXTURES"]) / f"{params.get('service', 'token')}_{key}.json"
        return json.loads(f.read_text()) if f.exists() else {"Status": "Success", "Result": []}
    access = os.environ.get("URA_ACCESS_KEY")
    if not access:
        raise SystemExit("Set URA_ACCESS_KEY in the environment (register at https://eservice.ura.gov.sg/maps/api/reg.html).")
    headers = {"AccessKey": access, "User-Agent": "Mozilla/5.0 (TRM data sync)"}
    if path != "insertNewToken/v1":
        headers["Token"] = call.token
    url = f"{BASE}/{path}" + ("?" + urllib.parse.urlencode(params) if params else "")
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as r:
                raw = r.read()
            try:
                d = json.loads(raw.decode("utf-8"))
            except UnicodeDecodeError:  # a few project names are sent in Windows-1252
                d = json.loads(raw.decode("cp1252", errors="replace"))
            if d.get("Status") == "Success":
                return d
            last = d.get("Message")
        except (OSError, ValueError) as e:
            last = str(e)
        time.sleep(10 * (i + 1))  # URA answers 403 when called too quickly
    raise SystemExit(f"URA {params.get('service', path)}: {last}")


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def catalogue_points():
    """Map positions of the projects on the new launches map (client.on_map)."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "huttons"))
    import client
    fetched = re.search(r'fetched: "(\d{4}-\d{2}-\d{2})"', CATALOGUE.read_text()).group(1)
    pts = []
    for line in CATALOGUE.read_text().splitlines():
        line = line.strip().rstrip(",")
        if line.startswith('{"id"'):
            p = json.loads(line)
            if p.get("lat") and p.get("lon") and client.on_map(p, fetched):
                pts.append((p["lat"], p["lon"]))
    if not pts:
        raise SystemExit(f"No projects with a map position in {CATALOGUE}; run sync-catalogue.py first.")
    return pts


def month(mmyy):
    """URA dates are MMYY."""
    return f"20{mmyy[2:]}-{mmyy[:2]}"


def quarters(n):
    today = date.today()
    y, q = today.year, (today.month - 1) // 3  # the quarter before this one
    if q == 0:
        y, q = y - 1, 4
    out = []
    for _ in range(n):
        out.append(f"{str(y)[2:]}q{q}")
        y, q = (y - 1, 4) if q == 1 else (y, q - 1)
    return out


def label(ref):
    """'26q2' -> '2026 Q2'."""
    return f"20{ref[:2]} Q{ref[3]}"


def band_mid(band):
    m = re.match(r"(\d+)\s*-\s*(\d+)", band or "")
    return (int(m.group(1)) + int(m.group(2))) / 2 if m else None


def main(radius):
    points = catalogue_points()
    if not os.environ.get("URA_FIXTURES"):
        call.token = call("insertNewToken/v1")["Result"]
    near = {}
    year_ago = f"{date.today().year - 1}-{date.today().month:02d}"
    by_district = {}

    def place(p):
        try:
            lat, lon = to_latlon(float(p["y"]), float(p["x"]))
        except (KeyError, TypeError, ValueError):
            return None
        d = min(km((lat, lon), q) for q in points)
        if d > radius:
            return None
        key = (p["project"].strip().upper(), p.get("street", "").strip().upper())
        return near.setdefault(key, {"name": p["project"].strip(), "street": p.get("street", "").strip(), "lat": round(lat, 6), "lon": round(lon, 6),
                                     "segment": p.get("marketSegment") or None, "district": None, "tenure": None, "propertyType": None,
                                     "_sales": [], "_rents": []})

    for batch in (1, 2, 3, 4):
        for p in call("invokeUraDS/v1", service="PMI_Resi_Transaction", batch=batch).get("Result") or []:
            tx = [t for t in p.get("transaction") or [] if t.get("propertyType") in HOMES]
            # Island-wide district averages over the last 12 months, for the map's shading.
            for t in tx:
                if month(t["contractDate"]) > year_ago and str(t.get("district") or "").isdigit():
                    by_district.setdefault(f"D{int(t['district']):02d}", []).append(float(t["price"]) / (float(t["area"]) * SQFT_PER_SQM))
            if not tx or not (row := place(p)):
                continue
            for t in tx:
                area = float(t["area"]) * SQFT_PER_SQM
                units = max(1, int(t.get("noOfUnits") or 1))
                price = float(t["price"])
                row["_sales"].append({"month": month(t["contractDate"]), "type": SALE_TYPE.get(str(t.get("typeOfSale")), "other"),
                                      "floor": t.get("floorRange") or None, "areaSqft": round(area / units), "price": round(price / units),
                                      "psf": round(price / area)})
                row["district"] = row["district"] or t.get("district")
                row["tenure"] = row["tenure"] or t.get("tenure")
                row["propertyType"] = row["propertyType"] or t.get("propertyType")
    periods = quarters(4)
    for ref in periods:
        for p in call("invokeUraDS/v1", service="PMI_Resi_Rental", refPeriod=ref).get("Result") or []:
            rents = [r for r in p.get("rental") or [] if r.get("propertyType") in ("Non-landed Properties", "Executive Condominium") or r.get("propertyType") in HOMES]
            if not rents or not (row := place(p)):
                continue
            for r in rents:
                beds = r.get("noOfBedRoom")
                row["_rents"].append({"bedrooms": int(beds) if str(beds).isdigit() else None, "rent": float(r["rent"]), "sqft": band_mid(r.get("areaSqft"))})

    projects = []
    cutoff = f"{date.today().year - 2}-{date.today().month:02d}"
    for row in near.values():
        sales, rents = row.pop("_sales"), row.pop("_rents")
        if not sales and not rents:
            continue
        years = {}
        for s in sales:
            years.setdefault(int(s["month"][:4]), []).append(s)
        row["sales"] = [{"year": y, "count": len(v), "medianPsf": round(statistics.median(s["psf"] for s in v)),
                         "newSale": sum(s["type"] == "new" for s in v), "subSale": sum(s["type"] == "sub" for s in v),
                         "resale": sum(s["type"] == "resale" for s in v)} for y, v in sorted(years.items())]
        recent = sorted((s for s in sales if s["month"] >= cutoff), key=lambda s: s["month"], reverse=True)[:15]
        row["recentSales"] = [[s["month"], s["type"], s["floor"], s["areaSqft"], s["price"], s["psf"]] for s in recent]
        by_beds = {}
        for r in rents:
            by_beds.setdefault(r["bedrooms"], []).append(r)
        row["rentals"] = [{"bedrooms": b, "count": len(v), "medianRent": round(statistics.median(r["rent"] for r in v)),
                           "medianPsf": round(statistics.median(r["rent"] / r["sqft"] for r in v if r["sqft"]), 2) if any(r["sqft"] for r in v) else None}
                          for b, v in sorted(by_beds.items(), key=lambda kv: (kv[0] is None, kv[0] or 0))]
        projects.append(row)
    projects.sort(key=lambda r: r["name"])
    districts = [{"district": d, "sales": len(v), "avgPsf": round(sum(v) / len(v)), "medianPsf": round(statistics.median(v))}
                 for d, v in sorted(by_district.items())]
    today = date.today().isoformat()
    body = "".join("    " + json.dumps(r, ensure_ascii=False) + ",\n" for r in projects).rstrip("\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(f"""// Generated by scripts/ura/sync-transactions.py from URA's Data Service on
// {today}. Don't edit by hand; run the script again to refresh.
// recentSales rows: [month, sale type, floor range, area sq ft, price, price psf]

import type {{ MarketData }} from "../model";

export const uraMarket: MarketData = {{
  source: "URA Data Service (private residential transactions and rental contracts)",
  fetched: "{today}",
  radiusKm: {radius},
  rentalPeriod: "{label(periods[-1])} to {label(periods[0])}",
  projects: [
{body}
  ],
  districtPeriod: "12 months to {today}",
  districts: {json.dumps(districts)},
}};
""")
    print(f"{len(projects)} developments within {radius} km of {len(points)} projects written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(float(a[a.index("--radius") + 1]) if "--radius" in a else 1.5)  # the map shows 1.5 km
