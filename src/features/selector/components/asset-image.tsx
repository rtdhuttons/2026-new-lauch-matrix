"use client";

import type { ImgHTMLAttributes } from "react";

// The Artifact viewer only shows images embedded in the page itself, so the
// standalone build defines this map of {published path: data URI}
// (scripts/artifact/embed_assets.py). The Next.js app leaves it undefined
// and loads the files from public/ as usual.
declare const __TRM_EMBEDDED_ASSETS__: Record<string, string> | undefined;
const EMBEDDED: Record<string, string> | null =
  typeof __TRM_EMBEDDED_ASSETS__ !== "undefined" ? __TRM_EMBEDDED_ASSETS__ : null;

/** A displayable URL for one of the page's own image files. */
export function assetSrc(src: string): string {
  return EMBEDDED?.[src] ?? src;
}

/** `<img>` for the page's own files; works in the Next.js app and the standalone build. */
export function AssetImg({ src, srcSet, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const embedded = EMBEDDED?.[src];
  // eslint-disable-next-line @next/next/no-img-element -- plain img so the standalone build can show embedded images
  return <img {...rest} alt={alt} src={embedded ?? src} srcSet={embedded ? undefined : srcSet} />;
}
