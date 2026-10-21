# Needle design preservation baseline

Captured on 2026-10-21 from clean integration `test` HEAD `d61d2ab89ff1771cf5892e93590ee8f64ea71c53`, after reconciling production `main` (`0de8c73`) and existing remote `test` work (`427ce97709dbd5af21b4e452cb198bf709868c98`), before presentation writes. This is the U1 characterization for `docs/plans/2026-10-21-needle-design-integration.md`, especially R5. Fixture values are observations of deployed code, not approved prototype results.

## Immutable contract

`tests/fixtures/design-preservation.json` records a deterministic, sorted path/SHA-256 set for 182 files:

- The active pack pointer, pack manifest, complete 10,000-record corpus and prepared search graph.
- Every one of the 120 local pack JPEGs, including their complete filename inventory.
- 58 deployed implementation files: runtime/store/reducer/selectors, discovery/truth configuration, SearchComposer, wall windowing, image component/sizing/intent, history/workspace/visual cache utilities, every JS module in the contracts/museum-corpus/query-encoder/search-runtime/vector-engine packages, and server/image/data-pack delivery implementation.

The test also detects additional implementation files in the protected package, shared image/utility and data-pack script directories. It excludes presentation assets, `dist/index.html` and source maps, so an intentional immutable presentation export can change without weakening the preservation contract.

| Input | SHA-256 |
| --- | --- |
| Corpus | `c52bdc345b74c48c8a5e51ecb0df66ff11d7baa8c2acfc0a983b08131f99674c` |
| Prepared graph | `78331993d7a66c256e18c82b5579e6dba865b48d642094e529dfe921ca1335a2` |
| JSON-serialized immutable path/digest set | `0ea7e0db63cc6ae6fa5190b02b0fe51eddfec7c6e46514fcbb643b355bf3ca6b` |

The set checksum is additionally pinned in the test. Do not regenerate this fixture to accommodate design changes. If the ignored static `dist/data/corpus.json` fallback has been assembled, its bytes must equal the tracked complete corpus.

## Real search observations

The test imports the deployed `ArtEmbeddingSpace`, `HybridSearchEngine`, `toSearchDocument`, corpus validator and selectors. It prepares all artwork vectors exactly as the deployed worker does, retaining existing visual descriptors when present, and restores the shipped graph snapshot. Graph encoder version 1 and the matching corpus checksum are asserted. Requests use the deployed bootstrap's `k = 8`, `efSearch = 64`, and text query kind.

IDs below omit their common `met-` prefix for readability. The fixture retains complete IDs, ranks and distances; distances use a `1e-12` comparison tolerance. Timings and trace execution durations are deliberately excluded.

| Query | Fast IDs in rank order | Exact IDs in rank order |
| --- | --- | --- |
| `Something small and golden` | 470767, 194170, 883956, 242726, 400025, 400002, 388133, 317683 | 470767, 883956, 388133, 317683, 57915, 308900, 317679, 312262 |
| `a dramatic landscape under a restless sky` (corpus default) | 663542, 342691, 342692, 42201, 12295, 15384, 58606, 459217 | 663542, 342691, 342692, 42201, 12295, 15384, 58606, 459217 |
| `Ruins after a fire` | 308076, 308101, 740702, 740709, 740777, 740778, 740793, 740878 | 316894, 308076, 308101, 740702, 740709, 740777, 740778, 740793 |
| `A room with a window` | 390276, 363849, 390403, 386497, 361866, 383809, 247014, 651193 | 344607, 390276, 363849, 390403, 386497, 321700, 403107, 724990 |

Three additional fast/exact pairs pin the golden query with a whitespace/case-normalized brass medium filter, a combined objects/Akan/before-1800 filter and a saved collection ID scope containing a nonexistent ID. The compound filter returns 317683 and 317677 in both modes. The saved ID scope returns all four real members and excludes the nonexistent ID. Its fast and exact order differ, which the fixture intentionally preserves.

## Collection and selector observations

The test executes the actual deployed `CollectionWall` function with minimal one-render React/hook adapters. It does not copy its sorting or filtering algorithm. Effects and DOM mounting are omitted; selectors, membership, ordering, windowing and JSX element construction run from deployed source.

| Scenario | Complete wall membership | Characterized behavior |
| --- | ---: | --- |
| Unscoped golden search | 10,000 | Fast hits first; contextual works follow in deployed highlight/preview/title order |
| Truth result mode | 10,000 | Exact hits first; full collection remains present |
| Normalized brass medium filter | 156 | Existing substring/case/whitespace filter semantics and filtered rank ordering |
| Animals cluster | 834 | Existing cluster membership and retained matching/contextual works |
| Saved collection ID scope | 4 | Corpus-order selector membership; ranked wall order; nonexistent ID omitted |

The baseline initial viewport renders 20 buttons for full/filtered/cluster cases. All first-window IDs are pinned in the fixture, including contextual artworks. The test verifies no corpus-order mutation. Separate deployed `wallWindow` assertions check bounded initial/final mounted ranges and reachability of artwork 10,000 at 2/3/4/5 columns. Year filters remain strictly before/after; equality and unknown years do not match.

## Verification receipt and limits

`node --test tests/design-preservation.test.mjs` passed all 17 tests (0 failures, 0 skips) after the baseline was captured. No install, build, server, commit, index operation or existing test edit was performed for this unit.

These tests characterize the real search packages and legacy component's data behavior. They do not execute the browser worker transport, image decoding/network delivery, effects, responsive layout, IME events, stale response scheduling, persistence UI or the new generated presentation bundle. Core byte preservation protects their deployed implementation; existing tests and U3 browser/command parity verification must establish that the integrated presentation still invokes them and exposes every retained control. In particular, a new presentation wall must consume the same selectors/ranking contract; passing the legacy wall characterization alone does not prove the new wall's integration.
