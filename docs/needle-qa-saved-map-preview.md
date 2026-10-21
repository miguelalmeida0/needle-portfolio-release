# QA: blank saved-collection map preview

User's 22:57 screenshots show the Light collection with an empty search and a blank thumbnail above “See them on the map.”

Reproduced in an owned Chrome tab: Saved → Light (48) → Clear search. The wall contains 48 real artworks, but the preview has zero image elements. Clicking See them on the map also yields zero map artworks. No collection contents were edited.

Cause: the preview used only visibleHits, which correctly becomes empty after clearing search. The full category map sampled the original global preview ranks; arbitrary saved items can have no qualifying preview ranks, so it also produced no nodes.

Repair: one presentation helper supplies both views from the existing scoped selectors and original map selector. Search hits retain their original order. For a saved scope, or an otherwise empty map sample, append real scoped items up to the existing presentation limit. The preview takes 12; map limits remain 72/120 plus original mandatory hits/selection. Empty scopes remain empty and no blank preview action is displayed. Preview calculation is memoized. Original core search, selectors, corpus, collections, images, server pipeline and layout are unchanged.

`npm run verify`: 70 passed, 0 failed, 0 skipped. New regression uses 48 actual corpus records outside global preview eligibility, applies the original collection scope/clear reducers, confirms the former map sampler returns zero, and checks the repaired preview has 12 actual images and the full map all 48. A second case verifies empty-scope isolation and bounded larger scopes. Existing ranking, saved-scope, hidden-view request, image cache and navigation checks pass. No fixture assertions were weakened; component harnesses bind the new real helper. `git diff --check` passes.

The optional gstack launcher is absent; no gstack instrumentation score is claimed. Available native tests and connected Chrome provide the evidence.
