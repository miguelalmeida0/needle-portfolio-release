# Needle control dragging: 2026-10-24

The public Hetzner site still served `bootstrap-1FB9CE23.js` and `redesign-07B0D620.css` during this investigation. Its search input remains outside the home card, using fixed coordinates. The screenshot's input overlap matches the layout defect already repaired in `8395b9a`, which was not yet deployed. See `mobile-search-layout-fix.md` for that repair's earlier browser evidence.

This release retains that in-flow layout and cancels native `dragstart` at the React shell, including events from the search portal. WebKit element dragging is disabled inside the shell; button labels cannot become accidental text selections. It does not cancel pointer down/move, text selection in inputs, touch scrolling, pinch zoom, or incoming upload drops.

## Validation

- Clean starting revision: `b551542246b3003e8fe791095d4f8fc1914d5550`; work performed on `test`.
- New regression in `tests/presentation-events.test.mjs`: failed before the guard, passed afterward. It exercises the actual shell's event boundary with input, button, SVG, image, and link targets. Existing typing, clear, IME and submission checks pass.
- `npm run verify`: 108 tests pass, release integrity, design exports and token contracts pass.
- `npm run security:history`: no credential patterns detected. `npm audit --omit=dev`: zero vulnerabilities.
- Five deployment tests pass, including simulated rollback failures. Their printed deployment messages describe test fixtures, not a real production deployment.
- Manual review covered only the event guard, CSS and generated release. No additional abstractions were introduced.

The cloud browser inspected the old public build and exercised input editing and a desktop drag gesture. No persistent control displacement was reproduced there. It could not reach the local corrected build: port 8000 reached a different service and port 5173 refused the connection. The new release has not been browser-verified in this run, and physical iOS touch behavior remains unverified. Automated event tests do not prove physical touch behavior or portal event delivery in a browser.

Value: protects=native drag cancellation without suppressing pointer/edit/drop handlers; fails_when=shell drag guard is absent; why_new=existing presentation tests cover submission and navigation only; seam=none; no_claim=physical Safari gestures or browser layout.

## Deployment

The existing Docker/Caddy deployment helper is pinned to the new release and verifies its HTML and asset hashes before and after switching. It preserves the image cache and previous container. GitHub publication does not deploy this Hetzner host; no SSH identity or Hetzner connector was available in this session.

Expected public bootstrap after deployment: `bootstrap-627F899F.js`. Expected stylesheet: `redesign-356C7A7B.css`.
