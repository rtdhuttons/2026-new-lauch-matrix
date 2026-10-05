// Photos for the map's project cards: the artist's impressions already in
// the repo for the projects loaded so far, else a saved copy of the API's
// main image (public/catalogue/, from sync-catalogue.py), else the API's
// own address for it (which the single-page build can't load).

import type { CatalogueProject } from "../model";
import { catalogueImages } from "./catalogue-images";

const base = process.env.NEXT_PUBLIC_TR_IMAGE_BASE ?? "/thomson-reserve/images";
const thumbs = process.env.NEXT_PUBLIC_CATALOGUE_IMAGE_BASE ?? "/catalogue";

const LOCAL: Record<string, string> = {
  "Thomson Reserve": `${base}/hero-960.jpg`,
  "Lentor Gardens Residences": `${base}/alt-lentor-gardens.jpg`,
  Lentoria: `${base}/alt-lentoria.jpg`,
  "Springleaf Residence": `${base}/alt-springleaf-residence.jpg`,
  "Chuan Park": `${base}/alt-chuan-park.jpg`,
};

export const imageFor = (p: CatalogueProject): string | null =>
  LOCAL[p.name] ?? (catalogueImages.has(p.id) ? `${thumbs}/${p.id}.jpg` : null) ?? p.image ?? null;
