"""Resale and rental records of TRM's chosen comparable projects, from URA's
Data Service, for each project's Investor tab.

Usage:
  python3 scripts/ura/sync-comparables.py

Needs URA_ACCESS_KEY (or URA_FIXTURES=dir of saved responses, named as in
sync-transactions.py, with URA_FETCHED=YYYY-MM-DD for the date they were saved). With HUTTONS_API_KEY and HUTTONS_API_SECRET set, also
reads what first buyers paid the developer for comparables that are Huttons
projects; without them, keeps the figures already in the output file.

The comparables are the ones in src/features/selector/data/comparables/chosen.ts
(from TRM's project sheet). Each is matched to URA's project of the same name
nearest its OneMap position. For each it writes, to ura-comparables.ts:
  - sales by year (URA's last five years of caveats): new sales, sub-sales and
    resales, and median price per sq ft of each
  - resales by floor range: number and median price per sq ft
  - the latest 20 sales
  - rents over the last 12 quarters: by bedrooms for the latest four quarters
    (number, median rent, median rent per sq ft from the middle of URA's size
    band) and the median rent per sq ft each quarter
  - first sales from the developer (Huttons): number, dates and median price
    per sq ft
URA does not link a resale to the unit's earlier purchase, so no profit per
unit is worked out here.
"""

import importlib.util
import json
import math
import os
import re
import statistics
import sys
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
CHOSEN = ROOT / "src/features/selector/data/comparables/chosen.ts"
CATALOGUE = ROOT / "src/features/catalogue/data/huttons-catalogue.ts"
OUT = ROOT / "src/features/selector/data/comparables/ura-comparables.ts"
RENTS = ROOT / "src/features/selector/data/comparables/rents"
SQFT_PER_SQM = 10.7639
SALE_TYPE = {"1": "new", "2": "sub", "3": "resale"}
HOMES = {"Apartment", "Condominium", "Executive Condominium"}

sys.path.insert(0, str(HERE))
from svy21 import to_latlon  # noqa: E402

_spec = importlib.util.spec_from_file_location("sync_transactions", HERE / "sync-transactions.py")
ura = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ura)


def squash(s):
    s = re.sub(r"\s*\(U/C\)", "", (s or "").lower()).replace("@", " at ")
    return re.sub(r"[^a-z0-9]", "", re.sub(r"^\s*the\s+", "", s))


def km(a, b):
    p = math.pi / 180
    h = math.sin((b[0] - a[0]) * p / 2) ** 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * math.sin((b[1] - a[1]) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def ts_json(path):
    s = path.read_text()
    return json.loads(s[s.index("= {") + 2: s.rstrip().rstrip(";").rindex("}") + 1])


def quarters(n):
    today = date.today()
    y, q = today.year, (today.month - 1) // 3
    if q == 0:
        y, q = y - 1, 4
    out = []
    for _ in range(n):
        out.append(f"{str(y)[2:]}q{q}")
        y, q = (y - 1, 4) if q == 1 else (y, q - 1)
    return out


def tenure_text(t):
    """URA's "99 yrs lease commencing from 2014" -> "99 years from 2014"."""
    m = re.match(r"(\d+)\s*yrs?\s*lease\s*commencing\s*from\s*(\d{4})", t or "", re.I)
    return f"{m.group(1)} years from {m.group(2)}" if m else (t.strip().capitalize() if t else None)


def first_sales(names):
    """What first buyers paid the developer, from the Huttons New Launch API, for comparables that are Huttons projects."""
    if not (os.environ.get("HUTTONS_API_KEY") and os.environ.get("HUTTONS_API_SECRET")):
        return None
    sys.path.insert(0, str(ROOT / "scripts/huttons"))
    import client
    rows = [json.loads(line.strip().rstrip(",")) for line in CATALOGUE.read_text().splitlines() if line.strip().startswith('{"id"')]
    by = {squash(re.sub(r"[⺀-鿿豈-﫿＀-￯]+", "", r["name"])): r for r in rows}
    out = {}
    for name in names:
        r = by.get(squash(name))
        if not r:
            continue
        units = client.pages("unit/queryUnitsByPage", projectId=r["id"])
        sold = [u for u in units if u.get("transactionPrice") and u.get("transactionDate") and u.get("area")]
        if not sold:
            continue
        days = sorted(datetime.fromtimestamp(u["transactionDate"] / 1000).date().isoformat() for u in sold)
        out[squash(name)] = {
            "count": len(sold),
            "ofUnits": len(units),
            "from": days[0][:7],
            "to": days[-1][:7],
            "medianPsf": round(statistics.median(u["transactionPrice"] / u["area"] for u in sold)),
            "source": f"Huttons New Launch API, {client.today()}",
        }
        print(f"  first sales: {name}: {len(sold)} of {len(units)} units")
    return out


def main():
    chosen = ts_json(CHOSEN)
    wanted = {}
    for p in chosen["projects"]:
        for c in p["comparables"]:
            wanted.setdefault(squash(c["sheetName"]), {"name": c["name"], "sheetName": c["sheetName"], "at": (c["lat"], c["lon"]) if c["lat"] else None})

    if not os.environ.get("URA_FIXTURES"):
        ura.call.token = ura.call("insertNewToken/v1")["Result"]

    # URA projects with a wanted name; where a name repeats, keep the one nearest the comparable's OneMap point.
    found = {}

    def take(p, kind):
        k = squash(p["project"])
        if k not in wanted:
            return None
        try:
            here = to_latlon(float(p["y"]), float(p["x"]))
        except (KeyError, TypeError, ValueError):
            here = None
        w = wanted[k]
        d = km(w["at"], here) if (w["at"] and here) else 0
        if d > 1.5:
            return None
        key = (k, p.get("street", "").strip().upper())
        row = found.setdefault(key, {"ura": p["project"].strip(), "street": p.get("street", "").strip(), "km": d, "sales": [], "rents": [], "tenure": []})
        return row

    for batch in (1, 2, 3, 4):
        for p in ura.call("invokeUraDS/v1", service="PMI_Resi_Transaction", batch=batch).get("Result") or []:
            if not (row := take(p, "sales")):
                continue
            for t in p.get("transaction") or []:
                if t.get("propertyType") not in HOMES:
                    continue
                units = max(1, int(t.get("noOfUnits") or 1))
                area = float(t["area"]) * SQFT_PER_SQM / units
                price = float(t["price"]) / units
                row["tenure"].append(t.get("tenure") or "")
                row["sales"].append((ura.month(t["contractDate"]), SALE_TYPE.get(str(t.get("typeOfSale")), "other"), t.get("floorRange") or None, round(area), round(price)))
    periods = quarters(12)
    for ref in periods:
        for p in ura.call("invokeUraDS/v1", service="PMI_Resi_Rental", refPeriod=ref).get("Result") or []:
            if not (row := take(p, "rents")):
                continue
            for r in p.get("rental") or []:
                beds = r.get("noOfBedRoom")
                row["rents"].append((ref, int(beds) if str(beds).isdigit() else None, ura.band_mid(r.get("areaSqft")), float(r["rent"])))
                band = re.match(r"(\d+)\s*-\s*(\d+)", r.get("areaSqft") or "")
                lease = str(r.get("leaseDate") or "")
                if band and len(lease) == 4:
                    row.setdefault("leases", []).append([f"20{lease[2:]}-{lease[:2]}-01", int(band.group(1)), int(band.group(2)), round(float(r["rent"])), int(beds) if str(beds).isdigit() else None])

    # One URA project per comparable: the nearest, with the most records on a tie.
    best = {}
    for (k, _), row in found.items():
        if k not in best or (row["km"], -len(row["sales"])) < (best[k]["km"], -len(best[k]["sales"])):
            best[k] = row

    previous = {c["key"]: c for c in ts_json(OUT)["comparables"]} if OUT.exists() else {}
    huttons = first_sales([w["name"] for w in wanted.values()])

    out = []
    latest4 = set(periods[:4])
    for k, w in sorted(wanted.items(), key=lambda kv: kv[1]["name"]):
        row = best.get(k)
        if not row:
            print(f"{w['name']}: not found in URA's records")
            continue
        sales = sorted(row["sales"], key=lambda s: s[0])
        years = {}
        for s in sales:
            years.setdefault(int(s[0][:4]), []).append(s)
        by_year = []
        for y, v in sorted(years.items()):
            def med(kind):
                xs = [s[4] / s[3] for s in v if s[1] == kind and s[3]]
                return round(statistics.median(xs)) if xs else None
            by_year.append({"year": y, "new": sum(s[1] == "new" for s in v), "sub": sum(s[1] == "sub" for s in v), "resale": sum(s[1] == "resale" for s in v),
                            "newPsf": med("new"), "subPsf": med("sub"), "resalePsf": med("resale")})
        floors = {}
        for s in sales:
            if s[1] == "resale" and s[2] and s[2] != "-":
                floors.setdefault(s[2], []).append(s[4] / s[3])
        by_floor = [{"floors": f, "count": len(v), "medianPsf": round(statistics.median(v))} for f, v in sorted(floors.items())]
        recent = [[s[0], s[1], s[2], s[3], s[4]] for s in sales[::-1][:20]]
        rents = row["rents"]
        by_beds = {}
        for r in rents:
            if r[0] in latest4:
                by_beds.setdefault(r[1], []).append(r)
        rent_beds = [{"bedrooms": b, "count": len(v), "medianRent": round(statistics.median(r[3] for r in v)),
                      "medianPsf": round(statistics.median(r[3] / r[2] for r in v if r[2]), 2) if any(r[2] for r in v) else None}
                     for b, v in sorted(by_beds.items(), key=lambda kv: (kv[0] is None, kv[0] or 0))]
        by_q = {}
        for r in rents:
            if r[2]:
                by_q.setdefault(r[0], []).append(r[3] / r[2])
        rent_trend = [{"quarter": f"20{q[:2]} Q{q[3]}", "count": len(by_q[q]), "medianPsf": round(statistics.median(by_q[q]), 2)} for q in sorted(by_q)]
        last12 = [s for s in sales if s[1] == "resale" and s[0] >= f"{date.today().year - 1}-{date.today().month:02d}"]
        first = (huttons or {}).get(k) if huttons is not None else previous.get(k, {}).get("firstSale")
        out.append({
            "key": k,
            "name": w["name"],
            "ura": {"project": row["ura"], "street": row["street"]},
            "tenure": tenure_text(max(set(row["tenure"]), key=row["tenure"].count)) if row["tenure"] else None,
            "salesByYear": by_year,
            "resaleByFloor": by_floor,
            "recentSales": recent,
            "resaleLast12": {"count": len(last12), "medianPsf": round(statistics.median(s[4] / s[3] for s in last12)) if last12 else None},
            "rentsByBedroom": rent_beds,
            "rentTrend": rent_trend,
            "rentPeriod": f"20{periods[3][:2]} Q{periods[3][3]} to 20{periods[0][:2]} Q{periods[0][3]}",
            "firstSale": first,
        })
        print(f"{w['name']}: {len(sales)} sales, {len(rents)} rental contracts" + (f", first sales {first['count']}" if first else ""))

    # Each comparable's individual rental contracts, loaded only by the projects that use it.
    today = os.environ.get("URA_FETCHED") or date.today().isoformat()  # URA_FETCHED: the saved data's date, with URA_FIXTURES
    RENTS.mkdir(parents=True, exist_ok=True)
    loaders = []
    for k, w in sorted(wanted.items()):
        row = best.get(k)
        leases = sorted((row or {}).get("leases") or [], key=lambda x: x[0])
        if not leases:
            continue
        (RENTS / f"{k}.json").write_text(json.dumps({
            "project": w["name"],
            "source": "URA Data Service: private residential rental contracts",
            "fetched": today,
            "note": "Size is URA's band; bedrooms where URA records them.",
            "leases": leases,
        }, ensure_ascii=False, separators=(",", ":")))
        loaders.append(f'  {json.dumps(k)}: () => import("./{k}.json"),')
    have = {line.split('"')[1] for line in loaders}
    # Each chosen project's comparable with rental contracts (the first, where TRM chose two).
    by_project = {}
    for p in chosen["projects"]:
        keys = [squash(c["sheetName"]) for c in p["comparables"]]
        k = next((k for k in keys if k in have), None)
        if k:
            by_project[p["slug"]] = k
    (RENTS / "index.ts").write_text(
        "// Generated by scripts/ura/sync-comparables.py: each comparable's URA rental\n"
        "// contracts ([lease month, smallest sq ft, largest sq ft, monthly rent,\n"
        "// bedrooms or null]), loaded on demand. Don't edit by hand.\n\n"
        "export interface ComparableLeases {\n  project: string;\n  source: string;\n  fetched: string;\n  note: string;\n  leases: [string, number, number, number, number | null][];\n}\n\n"
        "export const comparableRentLoaders: Record<string, () => Promise<{ default: unknown }>> = {\n"
        + "\n".join(loaders)
        + "\n};\n\n"
        "/** Each project's comparable (TRM's choice) whose rental contracts it uses. */\n"
        f"export const comparableRentsFor: Record<string, string> = {json.dumps(by_project, indent=2)};\n"
    )

    body = json.dumps({
        "source": "URA Data Service: private residential transactions (caveats lodged, last five years) and rental contracts (last 12 quarters)",
        "fetched": today,
        "salesWindow": f"{min((s['salesByYear'][0]['year'] for s in out if s['salesByYear']), default='')} to {date.today().year}",
        "comparables": out,
    }, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// Generated by scripts/ura/sync-comparables.py from URA's Data Service (and the\n"
        f"// Huttons New Launch API for first sales) on {today}. Don't edit by hand.\n"
        "// recentSales rows: [month, sale type, floor range, area sq ft, price]\n\n"
        'import type { UraComparables } from "../../model/project";\n\n'
        f"export const uraComparables: UraComparables = {body};\n"
    )
    print(f"{len(out)} comparables written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
