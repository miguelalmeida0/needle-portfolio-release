# Implementation plan: Needle comparison

1. Establish baseline on the approved `test` branch; preserve existing main/test history.
2. Add `src/redesign/comparison.mjs` and `tests/comparison.test.mjs`. Test duplicate selection, removal, capped pairs, URL-safe query titles and honest source-tag comparisons; run `node --test tests/comparison.test.mjs` red/green.
3. Extend the virtualized presentation-only `CollectionWall.jsx` with a sibling Compare control for each visible tile. Do not nest buttons. Keep result membership and arrow-key navigation.
4. Extend `NeedleApp.jsx` with a two-selection tray, dedicated compare overlay history route, clean dialog close/focus restoration, and inert underlying content.
5. Add `CompareOverlay.jsx` and `needle-compare.css` to reproduce the selected reference at desktop/tablet/mobile. Integrate existing artwork image and saved collection runtime methods. Ground all claims in real catalogue tags/materials.
6. Run `npm run build:design && npm run verify && npm run security:history` on a complete checkout, inspect responsive 1440/768/390 widths and keyboard/Escape behavior. Commit generated immutable exports and their manifest only after those checks. Do not deploy on unverified changes.

## Negative cases
Empty corpus on reload, missing artwork ID, same work twice, three sequential toggles, interrupted saves, existing shared collection, long title, unknown maker, absent images, mobile viewport, touch-only, reduced motion, browser Back/Forward.
