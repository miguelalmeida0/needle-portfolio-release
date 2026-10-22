import { resolve } from 'node:path';

// Route both worker and local fallback to the same versioned engine. The pinned
// original is retained as the base for graph and image-reference retrieval.
export const searchRelevance = {
  name: 'needle-catalogue-relevance',
  setup(build) {
    build.onResolve({ filter: /hybrid-search-engine\.js$/ }, args => {
      if (!args.importer.includes('/dist/modules/')) return;
      return { path: resolve('src/search/hybrid-search-engine.mjs') };
    });
  },
};
