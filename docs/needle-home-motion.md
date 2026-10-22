# Opening artwork motion

The twelve existing pictures around the opening search panel drift slowly using
CSS transforms. Each moves 4–6 px vertically, 2–3 px horizontally and at most
0.3 degrees from its resting position. Different durations, negative delays and
alternate directions keep the pictures out of sync with smooth turnarounds.

Only `.needle-backdrop img` animates. Its wrapper retains the existing placement;
the panel, search field, image sources and loading/caching behavior are unchanged.
No JavaScript, dependency or additional image requests were introduced. The
animation is enabled only for `prefers-reduced-motion: no-preference`; the existing
reduced-motion override also disables it.

Validation: `npm run build:design` and `npm run verify` passed, including all 105
application checks and the frozen data/image/runtime preservation checks. The
bootstrap remains `880A9278` and search worker remains `BA61762A`; only the design
stylesheet changes to `07B0D620`.

The connected browser rejected a standalone data-URL preview. No new-motion
browser verification is claimed: inspect the served HTTPS release after the
Hetzner update. The existing app remains on its previous stylesheet until then.
