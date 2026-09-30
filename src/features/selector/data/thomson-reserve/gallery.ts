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
    src: src("pools-lawn.jpg"),
    title: "Pools, lawns and forest",
    caption: "A chain of pools and gardens runs the length of the site, with the towers rising behind.",
    alt: "A long infinity pool and lawn framed by tropical trees, with residential towers behind. Artist's impression.",
  },
  {
    src: src("arrival-court.jpg"),
    title: "Arrival court",
    caption: "The drop-off courtyard off Bright Hill Drive, lit for coming home at night.",
    alt: "A circular drop-off court at night, ringed by lit timber fins around a planted tree, with the pools beyond. Artist's impression.",
  },
  {
    src: src("grand-clubhouse.jpg"),
    title: "The Grand Clubhouse",
    caption: "A pool deck and planted roof at the heart of the development.",
    alt: "The Grand Clubhouse at dusk, with a curved planted roof above a wide lit pool and sun loungers. Artist's impression.",
  },
  {
    src: src("poolside-homes.jpg"),
    title: "Homes on the water",
    caption: "The lowest homes open onto lawns and the pool deck.",
    alt: "Ground-level homes with private terraces beside a lawn, palms and a pool with sun loungers. Artist's impression.",
  },
  {
    src: src("lawn.jpg"),
    title: "Room to run",
    caption: "Open lawns, a shaded pavilion and play features beside the clubhouse.",
    alt: "A wide lawn with a pavilion and timber play features, the clubhouse and towers behind. Artist's impression.",
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
    src: src("spa-pavilion.jpg"),
    title: "Hydrotherapy pools",
    caption: "Spa pools under a timber pavilion, wrapped in greenery.",
    alt: "Bubbling spa pools beneath a curved timber-slatted pavilion, surrounded by trees. Artist's impression.",
  },
  {
    src: src("lounge.jpg"),
    title: "Garden lounge",
    caption: "A quiet room to read or meet friends, looking onto the garden.",
    alt: "A lounge with curved sofas, striped cushions and a green tiled wall, opening onto a garden. Artist's impression.",
  },
  {
    src: src("yoga.jpg"),
    title: "Yoga studio",
    caption: "Timber floors and full-height glass onto the trees.",
    alt: "A yoga studio laid with mats and blocks, with a mirrored wall and glass onto a garden deck. Artist's impression.",
  },
  {
    src: src("kids-room.jpg"),
    title: "Children's room",
    caption: "A forest-themed room for the youngest residents.",
    alt: "A children's room with low tables, green and orange chairs and a wall of stylised trees. Artist's impression.",
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
  return find("poolside-homes.jpg");
}

export const locationMap = {
  src: src("location-map-2000.jpg"),
  srcSet: `${src("location-map-1200.jpg")} 1200w, ${src("location-map-2000.jpg")} 2000w`,
  alt: "Location map: Thomson Reserve on Upper Thomson Road beside Upper Thomson MRT, with the Central Catchment Nature Reserve, MacRitchie Reservoir, Windsor Nature Park and the Singapore Island Country Club to the west, and Bishan, Ang Mo Kio and nearby schools to the east.",
};
