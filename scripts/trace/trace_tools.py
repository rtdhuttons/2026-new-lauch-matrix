"""Helpers for tracing a project's site plan into
src/features/selector/data/auto/traces/<slug>.json (see docs/tracing-site-plans.md).

  python3 scripts/trace/trace_tools.py prep <slug>
      Downloads the project's site plans and elevation chart into
      .trace/<slug>/, draws a labelled pixel grid over each (grid-*.jpg), and
      prints the blocks and stacks from the unit list.
  python3 scripts/trace/trace_tools.py zoom <slug> <image-index> x0 y0 x1 y1
      A gridded close-up of one area of a site plan (in original pixels).
  python3 scripts/trace/trace_tools.py scale <slug> x1,y1 x2,y2 x3,y3 ...
      Plan scale (px per metre) from the site boundary traced as a polygon
      (original pixels) and the site area the developer publishes.
  python3 scripts/trace/trace_tools.py check <slug>
      Validates the trace file against the unit list and draws it over the
      plan (.trace/<slug>/check.jpg) to compare by eye.
"""

import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
AUTO = ROOT / "src/features/selector/data/auto"
WORK = ROOT / ".trace"


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def spec(slug):
    return json.loads((AUTO / "specs" / f"{slug}.json").read_text())


def fetch(url, dest):
    if not dest.exists():
        u = urllib.parse.quote(urllib.parse.unquote(url), safe=":/?=&%")
        dest.write_bytes(urllib.request.urlopen(u, timeout=60).read())
    return Image.open(dest).convert("RGB")


def grid(im, step, scale=1.0, origin=(0, 0)):
    """Image with grid lines every `step` original pixels, labelled in original pixels."""
    w, h = im.size
    out = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS) if scale != 1 else im.copy()
    d = ImageDraw.Draw(out, "RGBA")
    f = font(max(11, round(13 * min(1.6, max(0.8, scale)))))
    ox, oy = origin
    x = (ox // step + 1) * step
    while x < ox + w:
        X = (x - ox) * scale
        d.line([(X, 0), (X, out.height)], fill=(255, 0, 120, 110), width=1)
        d.text((X + 2, 2), str(x), fill=(200, 0, 90, 255), font=f)
        x += step
    y = (oy // step + 1) * step
    while y < oy + h:
        Y = (y - oy) * scale
        d.line([(0, Y), (out.width, Y)], fill=(0, 90, 255, 110), width=1)
        d.text((2, Y + 2), str(y), fill=(0, 60, 200, 255), font=f)
        y += step
    return out


def prep(slug):
    s = spec(slug)
    work = WORK / slug
    work.mkdir(parents=True, exist_ok=True)
    print(f"{s['name']} ({slug})")
    for i, sp in enumerate(s["sitePlans"]):
        ext = ".png" if sp["img"].lower().endswith(".png") else ".jpg"
        im = fetch(sp["img"], work / f"site-{i}{ext}")
        w, h = im.size
        scale = min(1.0, 1600 / max(w, h))
        step = 100 if max(w, h) <= 2500 else 200
        grid(im, step, scale).save(work / f"grid-{i}.jpg", quality=85)
        print(f"  [{i}] {sp['name']}: {w} x {h} px -> .trace/{slug}/grid-{i}.jpg (grid every {step} px)")
        print(f"      image url: {sp['img']}")
    blocks = {}
    for u in s["units"]:
        b = blocks.setdefault(u[0], {})
        b.setdefault(u[1], set()).add(u[2])
    print("  blocks and stacks in the unit list:")
    for b, st in sorted(blocks.items()):
        floors = sorted({f for v in st.values() for f in v})
        print(f"    {b!r}: stacks {', '.join(sorted(st, key=lambda x: (len(x), x)))}; floors {floors[0]}-{floors[-1]}")
    plans = {p["name"]: p["type"] for p in s["floorPlans"]}
    print(f"  {len(plans)} floor plans; {len(s['units'])} units")


def zoom(slug, idx, x0, y0, x1, y1):
    work = WORK / slug
    src = next(work.glob(f"site-{idx}.*"))
    im = Image.open(src).convert("RGB").crop((x0, y0, x1, y1))
    scale = min(4.0, 1400 / max(im.size))
    step = 10 if (x1 - x0) <= 300 else 25 if (x1 - x0) <= 800 else 50
    out = grid(im, step, scale, (x0, y0))
    path = work / f"zoom-{idx}-{x0}-{y0}-{x1}-{y1}.jpg"
    out.save(path, quality=88)
    print(path.relative_to(ROOT))


def site_area_m2(s):
    a = s["facts"].get("siteArea") or ""
    # Thousands may be written "197,151", "197, 151" or "197 151".
    m = re.search(r"(\d{1,3}(?:[,\s]\s*\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(sq\s*ft|sqft|sf|square\s*f(?:ee|oo)t|sq\s*m|sqm|m2|m²|square\s*met(?:re|er)s?)", a, re.I)
    if not m:
        return None
    v = float(re.sub(r"[,\s]", "", m.group(1)))
    unit = m.group(2).lower()
    return v / 10.7639 if ("ft" in unit or "sf" in unit or "feet" in unit or "foot" in unit) else v


def polygon_area(pts):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


def scale(slug, pts):
    s = spec(slug)
    area = site_area_m2(s)
    if not area:
        print(f"No usable site area for this project (API gives {s['facts'].get('siteArea')!r})")
        return
    px = polygon_area(pts)
    print(f"site area {area:,.0f} m² (API: {s['facts']['siteArea']}); boundary {px:,.0f} px² -> pxPerM {math.sqrt(px / area):.3f}")


def check(slug):
    s = spec(slug)
    t = json.loads((AUTO / "traces" / f"{slug}.json").read_text())
    errors = []
    names = {u[0] for u in s["units"]}
    stacks = {}
    for u in s["units"]:
        stacks.setdefault(u[0], set()).add(u[1])
    traced = {b["block"] for b in t["blocks"]}
    for n in names - traced:
        errors.append(f"block {n!r} in the unit list is not traced")
    for n in traced - names:
        errors.append(f"traced block {n!r} is not in the unit list")
    for b in t["blocks"]:
        for st in (b.get("stacks") or {}):
            if st not in stacks.get(b["block"], set()):
                errors.append(f"stack {st} traced on {b['block']!r} has no units")
    if not (1 <= t["pxPerM"] <= 40):
        errors.append(f"pxPerM {t['pxPerM']} looks wrong")
    if t["stackPositions"] not in ("labelled", "arranged"):
        errors.append("stackPositions must be 'labelled' or 'arranged'")
    if not any(sp["img"] == t["image"] for sp in s["sitePlans"]):
        errors.append("image is not one of the project's site plans")
    work = WORK / slug
    idx = next(i for i, sp in enumerate(s["sitePlans"]) if sp["img"] == t["image"]) if not errors or any(sp["img"] == t["image"] for sp in s["sitePlans"]) else 0
    src = next(work.glob(f"site-{idx}.*"), None)
    if src:
        im = Image.open(src).convert("RGB")
        if im.size != (t["widthPx"], t["heightPx"]):
            errors.append(f"widthPx/heightPx {t['widthPx']}x{t['heightPx']} differ from the image {im.size[0]}x{im.size[1]}")
        d = ImageDraw.Draw(im, "RGBA")
        f = font(max(12, im.width // 90))
        if t.get("crop"):
            x0c, y0c, x1c, y1c = t["crop"]
            d.rectangle([x0c, y0c, x1c, y1c], outline=(255, 0, 255, 255), width=4)
            for b in t["blocks"]:
                cx, cy = b["core"]
                if not (x0c <= cx <= x1c and y0c <= cy <= y1c):
                    errors.append(f"block {b['block']!r} lies outside the crop")
        for b in t["blocks"]:
            cx, cy = b["core"]
            r = max(6, im.width // 160)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 0, 0, 200))
            d.text((cx + r, cy - r), b["block"], fill=(255, 0, 0, 255), font=f)
            for st, (x, y) in (b.get("stacks") or {}).items():
                d.line([(cx, cy), (x, y)], fill=(255, 140, 0, 200), width=2)
                d.ellipse([x - r / 2, y - r / 2, x + r / 2, y + r / 2], fill=(0, 120, 255, 220))
                d.text((x + 3, y + 3), st, fill=(0, 70, 200, 255), font=f)
        # scale bar check: 50 m drawn at the trace's scale
        L = t["pxPerM"] * 50
        d.line([(20, im.height - 30), (20 + L, im.height - 30)], fill=(255, 0, 0, 255), width=5)
        d.text((24, im.height - 60), "50 m at traced scale", fill=(255, 0, 0, 255), font=f)
        if t.get("siteBoundary"):
            d.line([tuple(p) for p in t["siteBoundary"] + t["siteBoundary"][:1]], fill=(0, 200, 120, 255), width=4)
            area = site_area_m2(s)
            if area:
                implied = math.sqrt(polygon_area(t["siteBoundary"]) / area)
                if abs(implied - t["pxPerM"]) / implied > 0.03:
                    errors.append(f"pxPerM {t['pxPerM']} differs from the site-area scale {implied:.3f}")
        if t.get("northDeg") is None:
            d.text((im.width - 260, 40), "no north point", fill=(255, 0, 0, 255), font=f)
            scale_w = min(1.0, 1600 / max(im.size))
            im.resize((round(im.width * scale_w), round(im.height * scale_w))).save(work / "check.jpg", quality=85)
            print(f".trace/{slug}/check.jpg")
            print("OK" if not errors else "\n".join(errors))
            return
        # north arrow from the trace
        a = math.radians(-t["northDeg"])
        x0, y0 = im.width - 60, 80
        d.line([(x0, y0), (x0 + 45 * math.sin(a), y0 - 45 * math.cos(a))], fill=(255, 0, 0, 255), width=5)
        d.text((x0 + 50 * math.sin(a) - 5, y0 - 50 * math.cos(a) - 18), "N", fill=(255, 0, 0, 255), font=f)
        scale = min(1.0, 1600 / max(im.size))
        im.resize((round(im.width * scale), round(im.height * scale))).save(work / "check.jpg", quality=85)
        print(f".trace/{slug}/check.jpg")
    print("OK" if not errors else "\n".join(errors))


if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    if cmd == "prep":
        prep(a[0])
    elif cmd == "zoom":
        zoom(a[0], int(a[1]), *map(int, a[2:6]))
    elif cmd == "scale":
        scale(a[0], [tuple(map(float, p.split(","))) for p in a[1:]])
    elif cmd == "check":
        check(a[0])
