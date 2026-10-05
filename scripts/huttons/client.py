"""Shared client for the Huttons New Launch API (api.singmap.com).

Reads HUTTONS_API_KEY and HUTTONS_API_SECRET from the environment and never
writes them out. Tokens last five minutes, so one is reused for four.
Calls that come back with the API's occasional "Network error" (-99) are
retried. Set HUTTONS_FIXTURES=path/to/dir to answer calls from saved JSON
files instead (used to test the scripts without network or credentials).
"""

import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOST = "https://api.singmap.com/cgi-api"
SGT = timezone(timedelta(hours=8))
_token = {"value": None, "at": 0.0}


class ApiError(Exception):
    pass


def _fixture(path, params):
    folder = Path(os.environ["HUTTONS_FIXTURES"])
    keyed = folder / f"{path.replace('/', '_')}__{params.get('projectId', '')}.json"
    plain = folder / f"{path.replace('/', '_')}.json"
    f = keyed if keyed.exists() else plain
    if not f.exists():
        raise ApiError(f"no fixture for {path} {params.get('projectId', '')}")
    return json.loads(f.read_text())


def token():
    if _token["value"] and time.time() - _token["at"] < 240:
        return _token["value"]
    key, secret = os.environ.get("HUTTONS_API_KEY"), os.environ.get("HUTTONS_API_SECRET")
    if not key or not secret:
        raise SystemExit("Set HUTTONS_API_KEY and HUTTONS_API_SECRET in the environment.")
    q = urllib.parse.urlencode({"key": key, "secret": secret})
    r = json.load(urllib.request.urlopen(urllib.request.Request(f"{HOST}/token?{q}", data=b"", method="POST"), timeout=30))
    if str(r.get("code")) != "0":
        raise SystemExit(f"Token refused: {r.get('msg')}")
    _token.update(value=r["datas"]["access_token"], at=time.time())
    return _token["value"]


def get(path, tries=4, **params):
    """One API call; returns its "datas"."""
    if os.environ.get("HUTTONS_FIXTURES"):
        return _fixture(path, params)
    last = None
    for i in range(tries):
        try:
            t = token()
            rt = datetime.now(SGT).strftime("%Y%m%d%H%M%S")
            q = {"token": t, "request_time": rt, "sign": hashlib.md5((t + rt).encode()).hexdigest(), **params}
            r = json.load(urllib.request.urlopen(f"{HOST}/{path}?" + urllib.parse.urlencode(q), timeout=60))
            if str(r.get("code")) == "0":
                return r.get("datas")
            last = r.get("msg")
            if "token" in str(last).lower():
                _token["value"] = None
        except (OSError, ValueError) as e:  # network trouble or a broken reply
            last = str(e)
        time.sleep(2 ** i)
    raise ApiError(f"{path}: {last}")


def pages(path, **params):
    """Every row of a paged list (up to 200 a page)."""
    rows, page = [], 1
    while True:
        d = get(path, pageNo=page, pageSize=200, **params)
        rows += d.get("lists") or []
        if len(rows) >= int(d.get("count") or 0) or not d.get("lists"):
            return rows
        page += 1


def day(ms):
    """API timestamps (milliseconds) as ISO dates in Singapore time."""
    try:
        return datetime.fromtimestamp(int(ms) / 1000, SGT).strftime("%Y-%m-%d") if ms else None
    except (TypeError, ValueError):
        return None


def today():
    return datetime.now(SGT).strftime("%Y-%m-%d")


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def bedroom_label(t):
    """'3 BEDROOM PREMIUM + STUDY' -> '3BR Premium + Study'."""
    t = re.sub(r"\s+", " ", (t or "").strip())
    t = re.sub(r"(?i)\b(\d) bedroom\b", r"\1BR", t)
    words = [w if w.isupper() and len(w) <= 3 or re.match(r"^\d", w) else w.capitalize() for w in re.split(r"(\s+|\+|\(|\))", t.lower())]
    out = "".join(words).replace("br", "BR").replace("Hs", "HS")
    return re.sub(r"\s*\+\s*", " + ", out).replace("( ", "(").replace(" )", ")")


def unit_price(u):
    """Nett price if given, else list price; None until prices are released."""
    for k in ("price2", "price1"):
        try:
            v = float(u.get(k) or 0)
        except (TypeError, ValueError):
            v = 0
        if v > 0:
            return int(v)
    return None


def summarise_units(units):
    """Unit types with sizes, totals, units left and the lowest price still available."""
    by_type = {}
    for u in units:
        if (u.get("type") or "").lower() == "shop" or not u.get("bedrooms"):
            continue
        by_type.setdefault(u.get("type") or "Unknown", []).append(u)
    types = []
    for t, us in by_type.items():
        av = [u for u in us if (u.get("purchaseStatus") or "").upper() == "AVAILABLE"]
        areas = [round(float(u["area"])) for u in us if u.get("area")]
        av_prices = [(unit_price(u), float(u.get("area") or 0)) for u in av]
        av_prices = [(p, a) for p, a in av_prices if p]
        cheapest = min(av_prices, default=None)
        try:
            bedrooms = int(float(us[0]["bedrooms"]))
        except (TypeError, ValueError):
            continue
        types.append({
            "bedrooms": bedrooms,
            "type": bedroom_label(t),
            "sizeSqft": {"min": min(areas), "max": max(areas)} if areas else None,
            "total": len(us),
            "unitsLeft": len(av),
            "fromPrice": cheapest[0] if cheapest else None,
            "fromPsf": round(cheapest[0] / cheapest[1]) if cheapest and cheapest[1] else None,
        })
    types.sort(key=lambda r: (r["bedrooms"], r["fromPrice"] or 9e12, r["type"]))
    return types
