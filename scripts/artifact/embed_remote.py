"""Download the web images an automatically built project's page uses and add
them, compressed, to its embedded assets as {image address: data URI}.

Usage: python3 scripts/artifact/embed_remote.py URLS_JSON ASSETS_JSON   (needs Pillow)
The images come from Huttons' image server (the developers' marketing
material, as the API serves it). A failed download is skipped; the page then
shows that image's alt text.
"""

import base64
import io
import json
import sys
import time
import urllib.request

from PIL import Image

MAX_W, QUALITY = 1600, 68


def fetch(url):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (TRM single-page build)"})
            return urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    print(f"  skipped {url[:90]}: {last}")
    return None


def encode(data):
    im = Image.open(io.BytesIO(data))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.getchannel("A"))
        im = bg
    im = im.convert("RGB")
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main(urls_path, assets_path):
    urls = json.load(open(urls_path))
    assets = json.load(open(assets_path))
    done = 0
    for url in urls:
        data = fetch(url)
        if data:
            assets[url] = encode(data)
            done += 1
    json.dump(assets, open(assets_path, "w"))
    total = sum(len(v) for v in assets.values())
    print(f"embedded {done} of {len(urls)} web images; {total / 1024 / 1024:.2f} MB of data URIs in all")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
