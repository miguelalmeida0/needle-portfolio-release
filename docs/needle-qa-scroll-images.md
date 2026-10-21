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

Verification and deployment results will be appended after the fixes are checked.
