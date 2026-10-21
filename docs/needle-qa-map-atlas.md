# Bundled map preview delivery

2026-10-21, production https://needle.miguelalmeida.xyz/.

## Defect and repair

The user's cleared-search map showed mostly colored image placeholders. Its 120 bundled artwork thumbnails used 120 independent responsive image requests. Native lazy loading also scheduled nearby offscreen tiles.

The presentation now clips those same 120 original artworks from one build-generated, content-addressed AVIF sheet (283,785 bytes). The map and small map preview share that resource. It is preloaded at low priority and served by the existing data-pack route with `public, max-age=31536000, immutable`. No request-time transformation is needed for these map tiles. Image failures retain the original image loader.

The full 10K corpus, all 120 original JPEGs, all 58 pinned core files, rankings, filters, saved scopes, gallery ordering and inspector actions remain unchanged. Non-bundled images and full artwork detail delivery retain their existing paths. This fixes bundled map preview fan-out; it is not a claim that every remote museum image is instantaneous.

## Verification

- `npm run verify`: 72 passed, 0 failed, 0 skipped. Includes byte preservation, search ranking, map scope, atlas-to-artwork identity, deterministic export and one-source request-budget checks.
- Production deployment `dep-dbcj26mq1p3s73c8u3e0`, code commit `d795811c1373cc460062eda2dbda0657dd1a5362`, live 2026-10-21 21:40:26 UTC.
- Live custom hostname serves `bootstrap-4D5C64D6.js`, `redesign-0F0E20C0.css`, and `atlas-BDD7C757.avif`.
- Clear search on the live map: 12 categories, 120 image elements, 120 decoded, one unique image resource.
- Scrolling lower map categories: scrollTop 810, zero visible pending images.
- Map artwork click opens Scarab of Sebekhotep V in the original inspector; correct full museum image decoded.
- Back to results: all 12 mini-map images decoded from the same sheet. Reopening map: 120/120 decoded.
- HTTP HEAD on the exact custom hostname: 200, image/avif, content length 283785, immutable one-year browser cache.
- Connected user-browser access became unresponsive during verification; final live checks used the cloud browser on the exact production hostname. No synthetic timing score or universal cold-cache latency claim.

Evidence: `evidence/needle-map-atlas-live.jpg`.
