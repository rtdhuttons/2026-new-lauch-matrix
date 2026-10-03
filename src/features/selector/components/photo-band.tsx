"use client";

// A wide photo between sections of the numbers-heavy tabs, so the figures
// sit alongside a sense of the place. Always labelled as an artist's impression.

import type { GalleryImage } from "../model/project";
import { AssetImg } from "./asset-image";

export function PhotoBand({ image, className = "" }: { image: GalleryImage | undefined; className?: string }) {
  if (!image) return null;
  return (
    <figure className={`relative overflow-hidden rounded-2xl bg-canopy ${className}`}>
      <AssetImg src={image.src} alt={image.alt} loading="lazy" className="h-48 w-full object-cover sm:h-60 lg:h-72" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <p className="font-display text-lg font-extrabold text-white sm:text-2xl">{image.title}</p>
        <p className="mt-1 hidden max-w-[60ch] text-sm text-white/85 sm:block">{image.caption}</p>
      </figcaption>
      <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 font-display-normal text-[0.6875rem] text-white">Artist&apos;s impression</span>
    </figure>
  );
}
