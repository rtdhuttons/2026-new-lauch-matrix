// Photos for the map's project cards: the artist's impressions already in
// the repo for the projects loaded so far, else the API's main image.

import type { CatalogueProject } from "../model";

const base = process.env.NEXT_PUBLIC_TR_IMAGE_BASE ?? "/thomson-reserve/images";

const LOCAL: Record<string, string> = {
  "Thomson Reserve": `${base}/hero-960.jpg`,
  "Lentor Gardens Residences": `${base}/alt-lentor-gardens.jpg`,
  Lentoria: `${base}/alt-lentoria.jpg`,
  "Springleaf Residence": `${base}/alt-springleaf-residence.jpg`,
  "Chuan Park": `${base}/alt-chuan-park.jpg`,
};

export const imageFor = (p: CatalogueProject): string | null => LOCAL[p.name] ?? p.image ?? null;
