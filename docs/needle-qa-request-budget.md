# QA: remote search image loading

Report: 2026-10-21, user's `Ruins after a fire` screenshot on Render. Scope: image requests caused by the new presentation, query-to-results flow, inactive views, map, inspector and mobile scrolling. Preserve the original search/runtime, corpus, original JPEGs and server cache. Use owned browser tabs and the existing Node test runner. No new paid infrastructure or framework.

## Root cause and correction

The previous cache repair covered the 120 bundled previews, not arbitrary remote search results. The new wall, miniature preview and map requested different derivatives of each remote artwork. The unchanged server limits generation to three tasks, including upstream fetches. Visited views remained mounted and continued updating eager images while hidden, adding more obsolete query work to that queue.

The presentation now reuses the same official Met web-large JPEG URL across wall, preview and map. This lets the museum CDN and browser reuse one resource instead of generating multiple presentation-specific derivatives. The original optimized loader remains the fallback on a direct-image error; bundled images continue using their prepared 160/320/640px derivatives. Inactive wall/map components retain their last visible snapshot, preventing source changes and eager requests until reopened. They show the current real runtime results when activated.

No changes to `scripts/image-delivery.mjs`, `scripts/serve.mjs`, the search engine, selectors, reducer, runtime or original image helpers. No data or preservation fixture changes. All frozen byte and ranking checks pass.

## Regression evidence

Three new native regressions in `tests/gallery-request-budget.test.mjs` failed before repair and passed afterwards:

- One remote work shares one original CDN URL at preview/map/wall sizes. The old component generated a proxy derivative URL instead. Local packs retain the original optimized loader; a simulated direct-image error returns to that loader.
- A hidden wall retains its previous image sources during a different instant query, and refreshes when opened.
- A hidden category map does the same, preserving its scroll/zoom DOM while inactive.

Value: protects the visible gallery's request budget; fails when per-view transforms or hidden source updates return; why_new: earlier tests protected content/ranking and bundled warmup, not remote presentation traffic; seam=none. Native render adapters do not establish CDN availability; live browser replay is required.

`npm run verify`: 64 passed, 0 failed, 0 skipped. This includes byte-identical original implementation/data/images, fast/exact search parity, clear/IME/history, cache/security boundaries, responsive windowing and the previous scrolling regressions.

## Live verification

Fix: `e8ccd15977ae9c5cf3f21a8e2e3e6c901daff34e`. Render deployment `dep-dbchsrcs728c73evb9a0` became live at 20:20:44 UTC (22:20:44 Berlin). Active bootstrap `bootstrap-C1F36F85.js`, stylesheet unchanged at `redesign-0A38AC34.css`.

Connected Chrome, original desktop viewport and 390×844:

- Replayed the exact `Ruins after a fire` prompt in a new tab. Six of eight results had decoded at the first approximately one-second automation observation; all eight then decoded. Wall and miniature preview used identical official image URLs. No first-eight proxy fallbacks.
- A separate `cats` query decoded all eight results at the first post-submit observation, including one bundled image using its existing cache. This was not a prebuilt curated result set.
- Opened the map, returned to results and changed the query. The hidden map's source attributes stayed exactly unchanged. Reopening the map displayed the current eight cats results; all 45 images in the visible map area were decoded.
- Clicking the first ruins result opened the original inspector and decoded the correct Embroidered Mantle Fragment detail through the unchanged proxy. Close/return worked; no console errors observed.
- Desktop wheel scrolling advanced the results page 800px. At 390×844 it advanced to 717px, with eight decoded images in the first mounted window. Reset the viewport to desktop afterwards.
- Repeated the ruins search: all eight results decoded, with no blank tiles in the captured viewport. Evidence: `evidence/needle-ruins-fixed.png`.

The image hosts and network still determine uncached transfer latency. These checks do not claim an absolute load-time guarantee or measure browser cache hit rate. They demonstrate removal of the redundant Render generation path from normal gallery loading and suppression of inactive-view image updates. Actual data, image identities and search behavior remain unchanged.

## Tool limits

The optional gstack launcher is absent (`gstack-skill-start`: no such file); its instrumentation was not run. The connected Chrome browser and existing native tests supplied the evidence above. Browser resource-timing instrumentation was unavailable in the read-only page scope, so no synthetic timing score or whole-product performance score is claimed. The scoped regressions are verified fixed.
