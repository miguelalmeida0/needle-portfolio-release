# Needle design integration validation

The approved opening, collection wall, category map and contextual navigation are implemented as a presentation layer over the production runtime. The original semantic/focus renderer and search controls remain reachable through Search tools.

## Preservation evidence

`tests/fixtures/design-preservation.json` was captured at `d61d2ab` before implementation. Tests protect 58 logic modules, all 120 bundled JPEGs and four corpus/graph/pointer/manifest files. Real fast/exact search cases cover text queries, normalized and compound catalog filters, and saved collection scopes. The redesigned JSX wall is compared with the deployed wall's complete ordering at 2/3/4/5 columns, including virtualized tail windows and keyboard traversal.

The new bootstrap retains the deployed viewport subscription, runtime startup/disposal, image intent handling and local-only experimental visual gate. Original SearchComposer, ArtworkImage, InspectorPanel, saved collections, recent queries, query recipe, truth and tuning controls are reused. GSAP is pinned to the same 3.15.0 version already present in the deployed semantic renderer.

## Browser checks

Internal production-backed preview, Chrome, 1363px desktop and iframe viewports at 320px, 390px and short 640×360 landscape:

- Opening panel fits at 320px; search stays mounted across views.
- Golden query returns the real production eight IDs, beginning met-470767 and met-194170.
- Image-only wall uses five desktop columns and two phone columns; complete collection remains virtualized.
- Both map preview and map action open category groups; map images open the original inspector.
- Bundled artwork met-552610 loads in the map and detail view; closing details restores focus to its image. Reloading details restores that same artwork after startup.
- Search input rectangle is unchanged between phone results and map (same x/y/width/height).
- Search tools opens the existing filter menu above the tools layer; both layers dismiss independently. Escape restores focus to the tools opener.
- Keyboard Clear stays home; explicit Enter navigates once. Short viewport scrolling keeps the search field aligned with its panel.
- Deep wall position 635924 and final artwork index 9999 survive a map round trip.

Remote Met image requests are restricted in this preview environment. Original remote URLs, local thumbnails, detail fallbacks, derivative loader and server delivery code are unchanged. This validation does not claim every remote image was visually loaded.

## Operational validation for a future production promotion

This integration targets `test`; no production deployment is part of this change. Existing main/test history is retained. Before promoting a focused release, verify the active immutable bootstrap/CSS hashes, original corpus/graph identities, normal search/IME/clear behavior, saved scopes, filter/truth controls, and original Met image delivery in the deployed environment. Compare the frozen query IDs and image checksums, rather than the prototype's curated demo results.

Owner: repository owner Miguel Almeida. During initial release smoke checks and the first normal browsing session, inspect browser errors and failed corpus/worker/image requests. Unexpected missing artwork, ranking changes or inaccessible controls block promotion; restore the prior HTML asset references as a focused rollback if a production issue appears. No application telemetry service or production log query is documented in this release repository.
