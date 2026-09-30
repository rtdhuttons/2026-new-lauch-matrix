// Thomson Reserve images: artist's impressions from the developer's
// marketing material (e-book cover and the architect's agent brief).

const base = process.env.NEXT_PUBLIC_TR_IMAGE_BASE ?? "/thomson-reserve/images";
const src = (file: string) => `${base}/${file}`;

export interface GalleryImage {
  src: string;
  alt: string;
  title: string;
  caption: string;
}

export const heroImage = {
  src: src("hero-1920.jpg"),
  srcSet: `${src("hero-960.jpg")} 960w, ${src("hero-1920.jpg")} 1920w`,
  alt: "Thomson Reserve's towers rising above a green landscape at dusk, with the pools and the Upper Thomson skyline behind. Artist's impression.",
};

export const gallery: GalleryImage[] = [
  {
    src: src("sunset-view.jpg"),
    title: "Sunsets over the nature reserve",
    caption: "Upper floors facing south-west look over the landed estates to the forest of Windsor Nature Park and MacRitchie.",
    alt: "Sunset over a green forest horizon seen from a high balcony at Thomson Reserve. Artist's impression.",
  },
  {
    src: src("clubhouse.jpg"),
    title: "The Grand Clubhouse",
    caption: "One of three clubs, set on the water between the two collections.",
    alt: "The Grand Clubhouse with a planted roof beside a wide pool. Artist's impression.",
  },
  {
    src: src("pool-2.jpg"),
    title: "Poolside living",
    caption: "Garden-level homes open onto lawns and water.",
    alt: "Sun loungers on a lawn beside the pool, below the residential tower. Artist's impression.",
  },
  {
    src: src("drop-off.jpg"),
    title: "Arrival court",
    caption: "The drop-off courtyard off Bright Hill Drive.",
    alt: "A circular covered drop-off court around a planted centrepiece. Artist's impression.",
  },
  {
    src: src("facade.jpg"),
    title: "Towers of 21 and 30 storeys",
    caption: "Two Luxury towers of 30 storeys and four Classic towers of 21.",
    alt: "Two slender residential towers against a clear sky. Artist's impression.",
  },
  {
    src: src("pool-1.jpg"),
    title: "A mini reservoir",
    caption: "Pools shaped like the reservoirs nearby run the length of the site.",
    alt: "Pools edged with tropical planting, towers in the distance. Artist's impression.",
  },
];

/** Image shown beside the level illustration, by height band. */
export function levelImage(level: number): GalleryImage {
  const find = (file: string) => gallery.find((g) => g.src.endsWith(file))!;
  if (level >= 21) return find("sunset-view.jpg");
  if (level >= 5) return find("facade.jpg");
  return find("pool-2.jpg");
}
