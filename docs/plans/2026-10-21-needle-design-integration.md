---
title: Needle approved visual integration
execution: code
status: accepted
---

# Needle approved visual integration

## Goal and authority

Integrate the opening search, image-only collection wall, compact category map and contextual navigation approved in this conversation. The user explicitly requires the deployed images, collection, search logic and existing functionality to remain intact. The standalone HTML is visual evidence, never a replacement dataset or search implementation.

Canonical workspace: `needle-integration`, working branch `test`. Production baseline: `origin/main` at `0de8c73`. Existing test work: `427ce97709dbd5af21b4e452cb198bf709868c98`. Preserve both histories. Never merge or deploy to `main` as part of this task.

Implementation engine: native Codex, current model. No enabled checkout engine configuration exists. No external implementation provider was requested. Work units share the presentation contract and generated export; execute their writes serially. Read-only inventory/review may run independently.

## Session-settled requirements

- **R1, user-directed:** the supplied opening screen is the first screen; preserve Needle's approved ivory/green identity and existing font families.
- **R2, user-approved:** the main result display is an even image-only wall, five columns on desktop and two on phones, with no image card panels, captions or ranking tracks. Every image opens artwork details.
- **R3, user-approved:** the map keeps the search field in the same place, groups real artworks by category, includes contextual non-matching works and highlights matches. No ambient dot layer or permanently visible technical panels. Use larger thumbnails and 6px within-group gaps.
- **R4, user-approved:** the preview picture and map button both open the map; contextual Back is visible near the top; logo returns to current results; New search is explicit. Preserve position while navigating.
- **R5, current user-directed preservation constraint:** retain all 10,000 corpus records, existing image URLs and derivative/fallback/prefetch pipeline, search ranking, instant typing, history, composition protection, stale-response rejection, filters, scopes, saved collections, branches, compare, recommendations, truth mode, tuning and local-only experiments.
- **R6, implementation boundary:** relocate secondary production controls to intentional dialogs/disclosures. Their existing commands and persistence remain authoritative. They must remain reachable without returning the legacy permanent sidebar/stacked containers to the primary views.

## What already exists

- Approved reference: `../Needle.html` and `../needle/src/opening/`, including rendered evidence. Reuse the visual vocabulary and approved layouts.
- Production `AppRuntime`, store/reducer, selectors, search packages/worker, graph and data pack. These remain unchanged after reconciling main into test.
- `SearchComposer`: instant `submitDraft(false)` on input, explicit history-recording submit, IME guards and clear behavior. Reuse the component rather than the prototype input controller.
- `CollectionWall`, `wallWindow`, `scopedCorpusItems`, `matchesQueryFilters`, `visibleHits`: preserve collection membership, ordering, filter/scope semantics, virtualization and keyboard behavior. Only presentation geometry and markup may differ.
- `ArtworkImage` and artwork intent: preserve all image delivery and fallback behavior and `data-artwork-id` targets.
- `QueryFilterMenu`, `QueryCanvas`, `RecentQueries`, `SavedCollections`, `TruthLens`, `AccuracyControl`, `InspectorPanel`, `ComparePanel`, discovery commands and experimental detail overlay. Reuse their production callbacks.
- Existing release integrity, image delivery, HTTP boundary, instant search, responsive, token and accessibility tests. No DESIGN.md exists; approved HTML and the deployed token styles provide the concrete design contract.

## Hierarchy and interaction contract

| Screen | First | Second | Third |
| --- | --- | --- | --- |
| Opening | Search question and input | Three existing approved example prompts | Quiet existing-artwork backdrop and Saved |
| Collection | Persistent search and contextual navigation | Query heading, real match count, existing filters/map action | Full virtualized image wall, ranked matches first |
| Category map | Same search and navigation | Category names and larger artwork groups | Quiet zoom/reset and matched/context distinction |
| Artwork details | Selected full artwork | Catalogue metadata and source | Existing compare, refine, feature and collection actions |
| Search tools / Saved | User-requested production tools | Existing recipe/filter/history/branch controls | Truth/tuning and advanced view controls |

Search tools are closed by default. This is presentation-only relocation of existing features, not feature deletion. Instant results follow the live store; no cached prototype hit IDs, hardcoded title overrides or synthetic relevance labels may replace them. Saved collection opening calls `scopeCollection`; saving uses existing runtime methods and storage keys.

## Interaction states

| Feature | Loading | Empty | Error | Success / partial |
| --- | --- | --- | --- | --- |
| Search | Existing loading/progress state; input remains editable | Existing blank-clear behavior | Existing runtime error with retry | Live fast/exact hits; explicit submit opens the collection |
| Wall | Existing image skeleton/fallback pipeline | Existing filter context and clear/reset action | Image fallback and unavailable treatment | All scoped works remain reachable through virtualization |
| Map | Real available thumbnails and live state | Clear active filter/scope | Existing image fallback | Current matches plus contextual corpus works |
| Saved | Existing persisted collections | Warm existing empty text and return action | Runtime feedback | Existing scope/add/save/restore commands |
| Artwork | Existing full-image loading | No modal until selection | Existing image fallback | Metadata, comparison and actions remain available |

## Accepted journey storyboard

| Step | User does | Desired experience | Implementation requirement |
| --- | --- | --- | --- |
| 1 | Opens Needle | Understands the task immediately | Approved opening composition |
| 2 | Types | Receives immediate local results | Existing Composer semantics unchanged |
| 3 | Submits | Sees artwork, not technical chrome | Image-only collection wall |
| 4 | Opens an image | Gets the full work and its context | Existing image and inspector commands |
| 5 | Opens map | Understands category neighborhoods | Same search position, compact groups |
| 6 | Goes Back | Continues without starting over | Restore view/scroll/zoom and live runtime context |
| 7 | Uses advanced tools | Finds existing capabilities on demand | Existing controls in deliberate disclosures |

## Responsive, accessibility and motion

- Collection columns: 5 desktop, 4 small desktop, 3 tablet, 2 phone. Keep image buttons borderless; preserve accessible artwork names and keyboard traversal.
- Map: 4 category columns desktop, 2 phone; larger real thumbnails with 6px gaps; scroll rather than compress images into tiny nodes.
- Search uses the same header slot in collection and map; phone input remains at least 16px. No horizontal overflow at 320px.
- Native dialogs: labelled heading, Escape dismissal, focus containment and return to originating control. Keep existing semantic buttons and input accessibility names.
- Preserve contrast from approved palette/deployed tokens; no placeholder-only accessible naming. No content waits behind animation.
- Pointer navigation transitions stay around 200–240ms; browser/keyboard navigation is immediate; honor reduced motion. No repeated entrance animation when returning to the wall.

## Implementation units

### U1. Reconcile and characterize the production baseline

Files: merge only existing main/test changes; add `tests/design-preservation.test.mjs` and a parity fixture/report.

Approach: merge current production main into test, preserving the test branch's unique commits. Resolve overlap by retaining deployed runtime/assets plus existing HTTP safety changes. Capture hashes for corpus, graph, local images, runtime/reducer/search and image modules. Characterize existing fast/exact search, filters/scopes and wall ordering before presentation edits.

Verification: baseline suite and integrity checks; pinned query outputs; clean distinction between merge reconciliation and new design diff. Do not treat elapsed milliseconds as stable output.

### U2. Integrate the approved presentation

Files: `src/redesign/`, `scripts/build-redesign.mjs`, package build/dev dependency declarations, active `dist/index.html`, new immutable export assets/manifest.

Approach: create a presentation shell around production runtime/components. Adapt wall layout geometry while preserving its data selection/order/window and keyboard behavior. Source map membership from production corpus/selectors, not scene.json. Reuse production image components and existing controls. Keep one runtime, worker and image pipeline. The prototype adapter, embedded images and curated nine-result query do not enter the production export.

Verification: production command parity tests, untouched core/image hashes, full 10K wall count and bounded mounted nodes, immediate typing, clearing, composition, history, full images, filters/scopes, saved/branches, compare, truth/tuning and experimental opt-in boundaries.

### U3. Verify and review the integrated UI

Files: focused tests, browser evidence, integration verification report.

Approach: run the complete suite and deterministic export/integrity checks. Exercise real runtime in browser at desktop, tablet and 320/390px; compare visuals to the approved HTML. Use actual production results and images even when they differ from the prototype's curated examples. Complete Compound Engineering simplification and code review before delivery.

Verification: test receipts, before/after invariance hashes, real browser screenshots and review findings resolved or explicitly reported. Preserve all remote branch history. Ship to test only; do not promote unrelated existing test work into main.

## NOT in scope

- Search/index/embedding/ranking changes: expressly excluded by the user.
- Image replacements, downloads into the frozen pack, new corpus or graph: expressly excluded.
- New product capabilities, new vendors or framework migrations: not needed for the visual integration.
- Replacing runtime persistence with prototype localStorage keys: violates preservation.
- Production merge/deployment: not authorized; main remains unchanged.

## Seven-pass design review

| Pass | Before → after | Evaluation and evidence |
| --- | --- | --- |
| 1 Information architecture | 9 → 9 | Approved hierarchy above; existing secondary tools remain reachable. No new design choice required. |
| 2 Interaction states | 9 → 9 | Preserve existing loading/empty/error behaviors and image fallbacks; state table copies that contract. No new remedy. |
| 3 Journey | 9 → 9 | Storyboard records approved search/wall/map/back behavior and the current preservation constraint. No new remedy. |
| 4 Intentional design | 9 → 9 | EXPERIENCE/OPERATE hybrid. Approved ivory/green serif direction is user-selected. No decorative cards around images. Existing approved thumbnail treatment remains; full artifacts open in detail. No new stylistic decision. |
| 5 Design system | 8 → 8 | No DESIGN.md; concrete approved CSS and deployed token files are available. Reuse those rather than inventing a system. |
| 6 Responsive/accessibility | 9 → 9 | Concrete column, input, focus, contrast and reduced-motion contracts above; verify in browser during U3. |
| 7 Decision register | unscored | The user already selected the layouts and explicitly required complete behavior preservation. No unapproved visual alternative is introduced. |

Litmus: Needle identity YES; artwork/search visual anchor YES; scannable hierarchy YES; one job per section YES; image buttons earn their existence YES; motion supports continuity YES; no decorative shadows needed YES. No hard-rejection pattern is introduced; the user-directed image collection is the content, not a generic SaaS feature-card grid.

## Design Review Completion Summary

Step 0 initial completeness: 8/10. Overall rated score: 8/10 → 8/10 (minimum of six passes). Existing approvals reused; zero new design decisions. No deferred TODOs. This review records the accepted UI and preservation contract, not a new visual exploration.

Review tooling: native source/approved-HTML review. The gstack launcher, designer and external review automation are unavailable in this workspace (`gstack-skill-start`: file not found). Approved working HTML and screenshots serve as the fallback wireframes. No automated or cross-model review is claimed. Full gstack automation requires its `./setup` or `/gstack-upgrade` on an installed checkout.

Durable learning: production main and test diverged; the prototype changes behavior despite sharing AppRuntime. Preserve the live selectors/image pipeline and reconcile both branches before the visual integration.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| Design Review | user `@plan design review` | UI/preservation plan | 1 | native review complete | 8/10 → 8/10; existing approvals reused |
| Outside Review | gstack automation | Independent coverage | 0 | unavailable | No external completion claimed |
| Eng Review | Compound Engineering implementation/review | Behavior parity and tests | 0 | required before shipping | U1/U3 verification and code review pending |

**VERDICT:** Design contract reviewed; engineering verification and code review required before shipping. No new product/design choices requested beyond the user's explicit approved scope.

NO UNRESOLVED DECISIONS
