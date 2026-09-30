"use client";

import type { ImgHTMLAttributes } from "react";
import { useEffect, useState } from "react";

// The standalone Artifact build runs under a content security policy that
// refuses <img> URLs pointing at its own files but allows fetch() of them
// and images from blob: URLs. There, images are fetched once and shown
// from an object URL. In the Next.js app they load directly.
const FETCH_ASSETS = process.env.NEXT_PUBLIC_ASSET_FETCH === "1";

const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function loadAsset(src: string): Promise<string> {
  let p = pending.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} loading ${src}`);
        return r.blob();
      })
      .then((b) => {
        const url = URL.createObjectURL(b);
        resolved.set(src, url);
        return url;
      });
    pending.set(src, p);
  }
  return p;
}

/** A displayable URL for one of the page's own image files. */
export function useAssetSrc(src: string): string | undefined {
  const [url, setUrl] = useState<{ for: string; url: string } | null>(null);
  useEffect(() => {
    if (!FETCH_ASSETS) return;
    let live = true;
    loadAsset(src)
      .then((u) => {
        if (live) setUrl({ for: src, url: u });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [src]);
  if (!FETCH_ASSETS) return src;
  return resolved.get(src) ?? (url?.for === src ? url.url : undefined);
}

/** `<img>` for the page's own files; works in the Next.js app and the standalone build. */
export function AssetImg({ src, srcSet, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const url = useAssetSrc(src);
  if (!url) return <span role="img" aria-label={alt} className={`block min-h-24 bg-mist-deep ${rest.className ?? ""}`} />;
  // eslint-disable-next-line @next/next/no-img-element -- plain img so the standalone build can load it
  return <img {...rest} alt={alt} src={url} srcSet={FETCH_ASSETS ? undefined : srcSet} />;
}
