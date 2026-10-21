# Needle scrolling and cold image cache repair

User report: 2026-10-21, Render deployment 55ea99d, Chrome on macOS, search `dogs`.

## Scoped QA charter

Check the results page's wheel/keyboard scrolling, virtualized artwork reachability and scroll restoration; then the category map's original image loading at retina sizes, cold derivative cache and warm repeat visits. Preserve all corpus bytes, search ranking, bundled images and existing delivery security/cache identity. Source writes are limited to presentation scrolling, image call-site fallbacks and build-time preview preparation, with native regression tests. Use owned browser tabs and temporary local caches. Deployment to the existing Needle service is authorized in this conversation.

The optional gstack launcher is absent in this environment (`gstack-skill-start`: no such file). Its browser/evidence executables cannot run. Verification uses the connected Chrome browser and the repository's existing Node test runner; no new browser framework is installed. The gstack integration can be restored with its `./setup` command in its installation.

## Baseline observations

- Results at 1512×682: the shell is fixed; only `.needle-wall` scrolls. A real wheel gesture over the visible heading at (750,270) leaves the wall at scrollTop 0. This explains the dead scrolling area. Prior tests exercised the grid directly, missing the page interaction.
- The category map's native scroll itself advances to scrollTop 560 using a real wheel gesture. All 120 bundled images remain present, with original search matches and visited context.
- `prepare-previews.mjs` warms only 160px AVIF. Chrome on the user's retina display requests 320px thumbnails; zoom/high-density screens and the collection wall also use 640px. These derivatives miss the build cache and contend with uncached museum requests in the shared three-task transform queue. A later warm visit loaded 134/140 map images; that does not establish cold-cache readiness.

## Regression value

- ISSUE-001: protects page-owned scrolling and virtual row offsets; fails when the wall measures itself instead of its page; previous test only covered an independently scrolling grid; no production test seam. Mock DOM geometry does not establish native browser scrolling; a real wheel/keyboard replay is required.
- ISSUE-002: protects every bundled preview being ready before a retina visitor arrives; fails if the build omits 320/640px; existing delivery tests covered individual derivative generation and hits, not build warmup. Uses real pack JPEGs, Sharp, filesystem cache and child build script; does not prove remote Met availability.

## Verification and deployment

Both regressions failed before repair for the reported causes: page geometry used the 700,000px wall height instead of the 600px scroll viewport, and a cold preview build contained 120 files instead of 360. After repair, `npm run verify` passed all 61 tests, with zero failures or skips. The frozen corpus, graph, 120 original JPEGs and original logic/image-delivery modules remain byte-identical.

Release commit: `fe5a5ff929d79abc2b29fd933e607620fed3140e`, fast-forwarded to the existing `test` and `main` branches. Render deployment `dep-dbchksmea8bs73b5mdc0` became live on 2026-10-21 at 20:03:52 UTC. Build logs explicitly confirmed 120 local previews at 160/320/640px, 360 cached derivatives. Served bootstrap: `bootstrap-942624C7.js`; stylesheet: `redesign-0A38AC34.css`.

Connected Chrome verification of this release at `https://needle-portfolio.onrender.com/`, using the user's `dogs` query:

- Real wheel gesture over the previously dead heading area moved the results page 520px, then 1700px. The heading scrolls away and the search remains fixed. The grid mounted the corresponding rows (indices 15–34), instead of retaining the initial window.
- At 390×844, wheel scrolling advanced the page from 1800 to 2400px and mounted indices 18–29. Restored the default desktop viewport after this check.
- Native End reached the final artwork, index 9999, at page scrollTop 715678. Browser Back/Forward restored the earlier 1800px scroll position and matching virtualized rows.
- All 45 visible images at the top of the map and all 46 in the scrolled area decoded. After visiting the map, all 140 mounted map images decoded, with zero loading placeholders/fallback elements and zero console errors.
- Clicking the map's Scarab of Sebekhotep V opened the existing inspector and loaded that artwork's original detail image. Closing the inspector and returning to results worked.
- Native cold-cache test uses a newly created empty directory and all real bundled JPEGs. Every 160/320/640px request is already a cache hit after preparation; no first-visitor derivative files are created. This is stronger than reusing a warm browser cache. It does not guarantee availability of every remote Met source among the full 10,000 works.

Screenshot: `evidence/needle-map-fixed.png`. One bundled museum JPEG itself contains an “Images Restricted” notice; preserving its bytes also preserves that original content. This repair addresses blank loading tiles and scrolling, not replacement of museum content.

Browser setup limitation: the cloud browser could not reach the isolated local preview port, so final browser checks were performed on the actual Render deployment after native verification. Optional gstack automation remains unavailable; no gstack execution or full-product QA score is claimed. Both scoped defects are verified fixed.
