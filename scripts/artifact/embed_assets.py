"""Compress the selector's images into data URIs for the standalone page.

The Artifact viewer only displays images embedded in the page itself, so
every photo, floor plan and the location map is re-encoded smaller and
written to dist-artifact/embedded-assets.json as {published path: data URI}.
The Next.js site keeps serving the full-size files from public/.

Usage: python3 scripts/artifact/embed_assets.py GROUPS_JSON OUT_JSON   (needs Pillow)
GROUPS_JSON is a list of [folder, published prefix, max width, JPEG quality,
filter], filter being "all" or "skip-small-variants" (drops the -960/-1200
copies and hero images the page doesn't use). Groups come from
scripts/artifact/projects.mjs.
"""

import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

FILTERS = {
    "all": lambda n: True,
    "skip-small-variants": lambda n: not n.endswith("-960.jpg") and not n.endswith("-1200.jpg") and not n.startswith("hero-"),
}


# Full-width hero images, embedded at full resolution.
HERO_FILES = {"sunset-1920.jpg"}


def encode(path: Path, max_w: int, quality: int) -> str:
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    groups = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
    out = ROOT / (sys.argv[2] if len(sys.argv) > 2 else "dist-artifact/embedded-assets.json")
    assets: dict[str, str] = {}
    for folder, prefix, max_w, quality, keep in groups:
        for f in sorted((ROOT / folder).glob("*.jpg")):
            if FILTERS[keep](f.name):
                # The location map carries small text, so it keeps more width;
                # the hero fills the screen, so it keeps its full size and detail.
                w, q = max_w, quality
                if f.name.startswith("location-map"):
                    w = 1800
                elif f.name in HERO_FILES:
                    w, q = 1920, 85
                assets[f"{prefix}/{f.name}"] = encode(f, w, q)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(assets))
    total = sum(len(v) for v in assets.values())
    print(f"embedded {len(assets)} images, {total / 1024 / 1024:.2f} MB as data URIs")


if __name__ == "__main__":
    main()
