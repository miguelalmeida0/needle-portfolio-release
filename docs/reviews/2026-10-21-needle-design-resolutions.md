# Review follow-up and final validation

Review receipt: `2026-10-21-needle-design-review.json`, status complete, run `20261021-175120-0524f471`. Six reviewers completed; an independent validator retained findings 1, 2, 3, 4, 6 and 7. No different-provider CLI was available; no cross-model agreement is claimed.

All retained findings were applied in one coupled navigation/history batch:

| Finding | Resolution | Verification |
| --- | --- | --- |
| 1 | Enter navigation requires the real Composer input; Clear retains its edit-only command | Original Composer event harness and browser keyboard Clear |
| 2 | History stores artwork identity; readiness restores it once without constraining later inspector actions | Different-artwork Back/Forward/reload tests and actual shell effect |
| 3 | Opening search measurements subscribe to captured scroll and visual viewport changes | Short 640×360 browser viewport: after 117px scroll, slot and input both at 164.4375px |
| 4 | Inert updates run before focus restoration in layout effects | Browser Escape returns focus to Search tools |
| 6 | Back wording uses stored predecessor; logo resumes results without adding a map/results loop | History tests and browser results/map/logo round trip |
| 7 | Semantic artwork query nodes open details for a real queryArtworkId | Guarded click bridge; existing local experimental gate remains unchanged |

Supplemental browser finding: a hidden wall previously measured zero size and collapsed its virtual scroll range. A separate wall batch ignores nonpositive dimensions. Lifecycle regression tests verify hidden/visible geometry and cleanup; browser verification retained scrollTop 635924 and final artwork index 9999 across map and Back. Hidden stage height remains 636482px.

The three simplification passes found no safe reuse replacement. Applied two quality improvements (dead CSS removal and readable JSX formatting) and two efficiency improvements (memoized backdrop selection and removal of a redundant layout read). No safety or accessibility guard was removed.

Final checks: `npm run verify` passes 59 tests with no skips, including deterministic active export, token contract, corpus integrity, immutable core/image checks and search parity. `npm run prepare:previews` prepared all 120 bundled images. `npm run security:history` found no credential patterns. `git diff --check` passes. No separate lint or typecheck scripts are configured.

Active export: bootstrap-BC245A6F.js and redesign-EC8A3064.css. Main and the production deployment remain unchanged. Original remote Met image delivery cannot be fully visually verified in the restricted preview; URLs and delivery logic are unchanged. There are no justified review findings left unresolved.
