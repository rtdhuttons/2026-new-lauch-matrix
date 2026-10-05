"""The site's outline from the site plan mask, for cutting the existing 3D
city out of the plot.

Usage: python3 scripts/3d/site-outline.py [mask.png] [px_per_m] [plan_width_px] [out.json]
Defaults to Thomson Reserve: public/thomson-reserve/site-plan-mask.png
(white where the plan shows the site), drawn on a 1,520 px wide site plan at
2.66 px a metre; a smaller mask is scaled to the plan.

Writes the largest white shape's outline, simplified to about 1 m, in plan
metres. Needs Pillow, NumPy and OpenCV (pip install opencv-python-headless).
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
mask_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public/thomson-reserve/site-plan-mask.png"
px_per_m = float(sys.argv[2]) if len(sys.argv) > 2 else 2.66
plan_width = float(sys.argv[3]) if len(sys.argv) > 3 else 1520
out = Path(sys.argv[4]) if len(sys.argv) > 4 else ROOT / "scripts/3d/thomson-reserve-outline.json"

mask = Image.open(mask_path).convert("L")
px_per_m *= mask.width / plan_width  # the mask may be smaller than the plan
img = np.array(mask)
_, bw = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(contours, key=cv2.contourArea)
approx = cv2.approxPolyDP(c, 2.5, True)[:, 0, :]
pts = [[round(float(x) / px_per_m, 2), round(float(y) / px_per_m, 2)] for x, y in approx]
area = cv2.contourArea(c) / px_per_m**2
out.write_text(json.dumps({"source": str(mask_path.relative_to(ROOT)), "pxPerM": px_per_m, "areaSqm": round(area), "outline": pts}))
print(f"{len(pts)} points, {area:,.0f} m² site, written to {out.relative_to(ROOT)}")
