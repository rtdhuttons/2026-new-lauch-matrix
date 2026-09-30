"""Compress the selector's images into data URIs for the standalone page.

The Artifact viewer only displays images embedded in the page itself, so
every photo, floor plan and the location map is re-encoded smaller and
written to dist-artifact/embedded-assets.json as {published path: data URI}.
The Next.js site keeps serving the full-size files from public/.

Usage: python3 scripts/artifact/embed_assets.py   (needs Pillow)
"""

import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist-artifact" / "embedded-assets.json"

# (source folder, published prefix, max width, JPEG quality, file filter)
GROUPS = [
    ("public/thomson-reserve/images", "images", 1200, 70, lambda n: not n.endswith("-960.jpg") and not n.endswith("-1200.jpg") and not n.startswith("hero-")),
    ("public/thomson-reserve/plans", "plans", 1100, 62, lambda n: True),
]


def encode(path: Path, max_w: int, quality: int) -> str:
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    assets: dict[str, str] = {}
    for folder, prefix, max_w, quality, keep in GROUPS:
        for f in sorted((ROOT / folder).glob("*.jpg")):
            if keep(f.name):
                # The location map carries small text, so it keeps more width.
                w = 1800 if f.name.startswith("location-map") else max_w
                assets[f"{prefix}/{f.name}"] = encode(f, w, quality)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(assets))
    total = sum(len(v) for v in assets.values())
    print(f"embedded {len(assets)} images, {total / 1024 / 1024:.2f} MB as data URIs")


if __name__ == "__main__":
    main()
