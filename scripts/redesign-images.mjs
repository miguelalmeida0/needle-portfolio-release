import { resolve } from 'node:path';

// Keep the original inspector/compare commands and markup byte-identical.
// Only their image presentation uses the gallery's shared browser cache key.
export const redesignImages = {
  name: 'needle-detail-image-presentation',
  setup(build) {
    build.onResolve({ filter: /shared\/ui\/ArtworkImage\.js$/ }, args => {
      if (!/\/features\/(inspector\/InspectorPanel|compare\/ComparePanel)\.js$/.test(args.importer)) return;
      return { path: resolve('src/redesign/GalleryImage.jsx') };
    });
  },
};
