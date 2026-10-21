# QA: blank saved-collection map preview

User's 22:57 screenshots show the Light collection with an empty search and a blank thumbnail above “See them on the map.”

Reproduced in an owned Chrome tab: Saved → Light (48) → Clear search. The wall contains 48 real artworks, but the preview has zero image elements. Clicking See them on the map also yields zero map artworks. No collection contents were edited.

Cause: the preview used only visibleHits, which correctly becomes empty after clearing search. The full category map sampled the original global preview ranks; arbitrary saved items can have no qualifying preview ranks, so it also produced no nodes.

Repair: one presentation helper supplies both views from the existing scoped selectors and original map selector. Search hits retain their original order. For a saved scope, or an otherwise empty map sample, append real scoped items up to the existing presentation limit. The preview takes 12; map limits remain 72/120 plus original mandatory hits/selection. Empty scopes remain empty and no blank preview action is displayed. Preview calculation is memoized. Original core search, selectors, corpus, collections, images, server pipeline and layout are unchanged.

`npm run verify`: 70 passed, 0 failed, 0 skipped. New regression uses 48 actual corpus records outside global preview eligibility, applies the original collection scope/clear reducers, confirms the former map sampler returns zero, and checks the repaired preview has 12 actual images and the full map all 48. A second case verifies empty-scope isolation and bounded larger scopes. Existing ranking, saved-scope, hidden-view request, image cache and navigation checks pass. No fixture assertions were weakened; component harnesses bind the new real helper. `git diff --check` passes.

The optional gstack launcher is absent; no gstack instrumentation score is claimed. Available native tests and connected Chrome provide the evidence.

Live code `c38b8a0ec39c3b51917de932e91324d8c320a9c7`, Render `dep-dbcigi1srm7s73b68btg`, live at 23:03:07 Berlin on 2026-10-21. Confirmed bootstrap `A8D7BAF5`, CSS unchanged at `4CC5E6B2`. Initial startup exceeded the browser selector wait deadline; inspected the current page, confirmed startup completed without console errors, and continued without another reload.

Replayed Saved → Light (48) → Clear search: preview now has 12 image elements, all decoded at the first inspection. The text button opens 48 map artworks; all 30 images within the captured desktop viewport were decoded. Back returns to the collection. Clicking the preview image also opens the 48-work map. Selected Gas Lighting Fixture, confirmed the correct decoded detail, then closed and returned. At 390×844, the existing mobile layout intentionally hides the miniature; its text button still opens all 48 map artworks without document-level horizontal overflow. Reset the viewport to desktop. No browser console errors observed. Evidence: `evidence/needle-saved-map-preview-fixed.png`.
