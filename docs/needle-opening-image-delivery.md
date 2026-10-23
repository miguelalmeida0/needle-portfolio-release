# Opening image delivery

## Problem and cause

The opening search panel appeared before its twelve surrounding pictures.
At base `b51b016d8b636fb967aae2021f6063d489fd9e38`, `NeedleApp.jsx`
passed `state.corpus?.items ?? []` to `HomeBackdrop`. `AppRuntime.start()`
awaits catalogue loading and search-worker initialization before dispatching
`BOOTSTRAP_READY` (`dist/modules/apps/web/src/app/app.runtime.js:36–50`).
The catalogue is 18,297,599 bytes. Before that dispatch, the backdrop rendered
zero pictures. Afterwards, the shared loader began twelve lazy `/_image`
requests. The live browser confirmed those twelve lazy URLs.

Existing preservation and atlas tests covered image identity and map request
sharing, but did not render the opening backdrop before catalogue readiness.

## Fix

`buildHomePreviews()` prepares the exact same twelve artworks, in their existing
order, as 140 × 176 WebP derivatives. The combined encoded image data is 45,524
bytes, bounded to 48 KB by the build. The generated manifest is bundled with
the content-hashed bootstrap. `HomeBackdrop` renders eager inline pictures on
its first render, without reading catalogue state or starting image requests.

This preserves the original images, placement, float animation, data pack,
search worker, catalogue logic, map atlas, and gallery/detail cache pipeline.
The compressed bootstrap increases from 90,838 to 138,649 bytes. This is a
deliberate first-screen tradeoff: twelve ready images share the immutable
application cache rather than waiting for the full catalogue and HTTP images.

## Verification

- Regression reproduced before the fix: zero opening pictures before catalogue
  readiness, failing the expected count of twelve.
- The same check now passes: twelve real, eager pictures with inline sources,
  correct IDs/order, valid 140 × 176 image data and a combined byte budget.
- `npm run verify`: 106 passing tests, including frozen corpus, original image,
  search/runtime preservation and deterministic build checks.
- Code reuse and quality reviewers found no actionable issues. The efficiency
  reviewer suggested build-only read sharing and parallel encoding; these were
  deferred to keep the runtime fix focused. There are no runtime review blockers.
- Targeted manual diff review found no additional defects. No separate lint or
  typecheck is configured; the release verifier and production build both pass.
- A browser reload-to-last-picture check measured 9,751 ms on the old release,
  including automation overhead and warm caches. This is not a paint-time or
  cold-network measurement. Browser performance timing APIs were unavailable.

The new release must be deployed on the existing Hetzner host before a live
before/after browser check. No new-release browser latency is claimed here.
