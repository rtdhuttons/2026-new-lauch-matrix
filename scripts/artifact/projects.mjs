// Per-project settings for the single-page (Artifact) build. Add an entry
// when a project gets its own folder under src/features/selector/data/.
//
// entry:    the project's entry.tsx (only this project's data is bundled)
// out:      output file name in dist-artifact/
// title:    browser tab title
// defines:  build-time values the project's data reads (image locations)
// embed:    image folders to compress into data URIs: [folder, published prefix, max width, JPEG quality]
// planImage / planMask: files inlined for the 3D site plan, if any

export const ARTIFACT_PROJECTS = {
  "thomson-reserve": {
    entry: "src/features/selector/data/thomson-reserve/entry.tsx",
    out: "selector.html",
    title: "TRM · Thomson Reserve",
    planImage: { env: "NEXT_PUBLIC_TR_SITE_PLAN", file: "public/thomson-reserve/site-plan.jpg", type: "image/jpeg" },
    planMask: { env: "NEXT_PUBLIC_TR_SITE_PLAN_MASK", file: "public/thomson-reserve/site-plan-mask.png", type: "image/png" },
    defines: { NEXT_PUBLIC_TR_PLAN_BASE: "plans", NEXT_PUBLIC_TR_IMAGE_BASE: "images" },
    embed: [
      ["public/thomson-reserve/images", "images", 1200, 70, "skip-small-variants"],
      ["public/thomson-reserve/plans", "plans", 1100, 62, "all"],
    ],
  },
  "the-serra-residences": {
    entry: "src/features/selector/data/the-serra-residences/entry.tsx",
    out: "the-serra-residences.html",
    title: "TRM · The Serra Residences",
    planImage: { env: "NEXT_PUBLIC_SERRA_SITE_PLAN", file: "public/the-serra-residences/site-plan.jpg", type: "image/jpeg" },
    defines: { NEXT_PUBLIC_SERRA_PLAN_BASE: "plans", NEXT_PUBLIC_SERRA_IMAGE_BASE: "images" },
    embed: [
      ["public/the-serra-residences/images", "images", 1051, 72, "all"],
      ["public/the-serra-residences/plans", "plans", 1500, 65, "all"],
    ],
  },
  "huttons-map": {
    entry: "src/features/catalogue/artifact-entry.tsx",
    out: "huttons-map.html",
    title: "TRM · New launches map",
    defines: { NEXT_PUBLIC_TR_IMAGE_BASE: "images", NEXT_PUBLIC_CATALOGUE_IMAGE_BASE: "catalogue" },
    embed: [
      ["public/thomson-reserve/images", "images", 720, 70, "map-cards"],
      ["public/catalogue", "catalogue", 480, 62, "all"],
    ],
  },
  "sample-wrenfield": {
    entry: "src/features/selector/data/demo/entry.tsx",
    out: "sample-wrenfield.html",
    title: "TRM · Sample project (not for publication)",
    defines: {},
    embed: [],
  },
};
