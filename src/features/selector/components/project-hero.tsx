"use client";

import { useRef, useState } from "react";
import type { GalleryImage } from "../data/thomson-reserve/gallery";

/** Full-bleed opening image with the project's name and key facts. */
export function ProjectHero({
  image,
  name,
  eyebrow,
  facts,
  children,
}: {
  image: { src: string; srcSet: string; alt: string };
  name: string;
  eyebrow: string;
  facts: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section aria-label={`${name} at a glance`} className="relative isolate overflow-hidden bg-canopy text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- plain img so the standalone build can load it */}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="100vw"
        alt={image.alt}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1d14]/90 via-[#0b1d14]/35 to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1d14]/60 via-[#0b1d14]/15 to-transparent" />
      <div className="mx-auto flex min-h-[min(78vh,720px)] max-w-7xl flex-col justify-end px-4 pb-10 pt-40 sm:px-8 sm:pb-14">
        <p className="font-display-normal text-sm font-semibold uppercase tracking-[0.18em] text-white/85">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[3rem] font-extrabold leading-[0.95] tracking-tight sm:text-[5.5rem]">{name}</h1>
        {children}
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/25 pt-5 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="font-display-normal text-[0.8125rem] text-white/75">{f.label}</dt>
              <dd className="font-display-normal text-lg font-semibold sm:text-xl">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-right font-display-normal text-xs text-white/70">Artist&apos;s impression</p>
      </div>
    </section>
  );
}

/** One large and four small images, each opening larger on tap. */
export function Gallery({ images }: { images: GalleryImage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<GalleryImage | null>(null);
  const show = (img: GalleryImage) => {
    setOpen(img);
    dialog.current?.showModal();
  };
  const [feature, ...rest] = images.slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        {[feature, ...rest].map((img, i) => (
          <figure
            key={img.src}
            className={`group relative overflow-hidden rounded-xl bg-canopy ${
              i === 0 ? "col-span-2 row-span-2 aspect-[4/3] lg:aspect-auto" : "aspect-[4/3] lg:aspect-auto"
            } lg:min-h-[210px]`}
          >
            <button
              type="button"
              onClick={() => show(img)}
              aria-label={`${img.title}. Open larger`}
              className="absolute inset-0 h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- see ProjectHero */}
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </button>
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-white">
              <span className={`block font-display-normal font-semibold ${i === 0 ? "text-lg sm:text-xl" : "text-sm"}`}>{img.title}</span>
              {i === 0 && <span className="mt-0.5 block max-w-[48ch] text-sm text-white/85">{img.caption}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 font-display-normal text-xs text-stone">Artist&apos;s impressions from the developer&apos;s marketing material.</p>
      <dialog
        ref={dialog}
        aria-label={open?.title ?? "Image"}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(1000px,94vw)] overflow-hidden rounded-xl bg-paper p-0 backdrop:bg-canopy/70"
      >
        {open && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- see ProjectHero */}
            <img src={open.src} alt={open.alt} className="block h-auto w-full" />
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-display-normal font-semibold">{open.title}</p>
                <p className="text-sm text-canopy/80">{open.caption} Artist&apos;s impression.</p>
              </div>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="shrink-0 rounded-full border border-canopy/20 px-3 py-1 font-display-normal text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
