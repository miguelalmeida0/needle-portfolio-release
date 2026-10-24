# Home search layout repair

The home search used a fixed element in the header and copied the empty card slot's viewport coordinates. Its ResizeObserver observed the slot's dimensions, not its position. Text/font reflow moved the slot without resizing it, leaving the input over the description. Scroll/visual-viewport synchronization also relied on JavaScript repaint timing.

Reproduction at 390px: enlarge the home heading to 60px without resizing the viewport. Before: input top 382.969px, slot top 449.031px, description bottom 425.031px. After: input and slot top both 449.031px. The input remains below the description, including a 320px-wide, 400px-high viewport scrolled by 100px.

A stable React portal target now lives in the actual home or header slot. The composer is mounted once, so runtime ownership, draft, composition handlers and submission remain intact. Native layout handles font reflow, scrolling and viewport changes. The host move preserves focus/selection where supported, with a fallback for older browsers. The hidden home slot stays mounted; decorative home images are only mounted on home.

Validation: full npm run verify, 107 passing tests. Existing presentation tests cover IME, submission and history identity; their DOM-free harness now exposes the portal seam. Browser checks verified the before/after failure, narrow/short scrolling, submission, results and New search with the retained draft. Browser testing used Chromium, not physical iOS hardware. Three focused reuse/quality/efficiency reviews completed; redundant styles/comments were removed and off-route backdrop loading avoided.

Deployment is separate from GitHub: run the checksum-verified pinned deployment script on the existing Hetzner Docker/Caddy host. It preserves runtime/cache and retains rollback behavior. No host connection was available in the editing environment.
