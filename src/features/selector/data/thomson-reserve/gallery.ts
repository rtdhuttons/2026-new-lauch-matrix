// Thomson Reserve images: artist's impressions from the developer's
// marketing material.

const base = process.env.NEXT_PUBLIC_TR_IMAGE_BASE ?? "/thomson-reserve/images";
const src = (file: string) => `${base}/${file}`;

export interface GalleryImage {
  src: string;
  alt: string;
  title: string;
  caption: string;
}

export const heroImage = {
  src: src("sunset-1920.jpg"),
  srcSet: `${src("sunset-960.jpg")} 960w, ${src("sunset-1920.jpg")} 1920w`,
  alt: "Sunset over the forest, golf course and reservoir, seen past the upper balconies of a Thomson Reserve tower, with landed homes below. Artist's impression.",
};

export const gallery: GalleryImage[] = [
  {
    src: src("sunset-1920.jpg"),
    title: "Sunsets over the nature reserve",
    caption: "Upper floors facing south-west look over the landed estates to the forest, the golf course and the reservoir.",
    alt: "Sunset over the forest, golf course and reservoir beyond landed homes, seen from a high balcony. Artist's impression.",
  },
  {
    src: src("grand-clubhouse.jpg"),
    title: "The Grand Clubhouse",
    caption: "A pool deck and planted roof at the heart of the development.",
    alt: "The Grand Clubhouse at dusk, with a curved planted roof above a wide lit pool and sun loungers. Artist's impression.",
  },
  {
    src: src("clubhouse-dining.jpg"),
    title: "Dining and lounge",
    caption: "A double-height room for long dinners with family and friends.",
    alt: "A double-height dining room and lounge with a long table, timber walls and a marble kitchen. Artist's impression.",
  },
  {
    src: src("gym.jpg"),
    title: "Gym in the garden",
    caption: "Glass walls onto the greenery and the pool.",
    alt: "A long gym with treadmills and cross-trainers behind floor-to-ceiling glass facing the garden. Artist's impression.",
  },
  {
    src: src("towers.jpg"),
    title: "Towers of 21 and 30 storeys",
    caption: "Two Luxury towers of 30 storeys and four Classic towers of 21, set in parkland.",
    alt: "Thomson Reserve's towers rising over trees and pools under a blue sky. Artist's impression.",
  },
];

/** Image shown beside the level illustration, by height band. */
export function levelImage(level: number): GalleryImage {
  const find = (file: string) => gallery.find((g) => g.src.endsWith(file))!;
  if (level >= 21) return find("sunset-1920.jpg");
  if (level >= 5) return find("towers.jpg");
  return {
    ...find("grand-clubhouse.jpg"),
    title: "Close to the gardens",
    caption: "The lowest homes sit just above the pools and landscaped decks.",
  };
}
