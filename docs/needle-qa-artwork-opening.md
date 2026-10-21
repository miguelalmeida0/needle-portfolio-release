# QA: artwork opening latency

Scope: the user's 22:26 screenshot of `cats` → `Feeding Poor Puss` on Render, showing a loaded gallery behind a blank detail image. Preserve search, commands, corpus, images, server cache and the approved layout.

## Diagnosis

The previous gallery fix did not cover the original inspector import. Live DOM inspection showed the gallery already decoded `https://images.metmuseum.org/CRDImages/ph/web-large/DP143471.jpg`, while opening the inspector requested a separate `/_image?...&w=640&format=avif` and marked it lazy. The gallery's native image was also outside the original loader's private decoded-preview map, so that path supplied no immediate preview. The screenshot's blank area is consistent with waiting for this unnecessary transform; the inspected old deployment eventually decoded its transformed image.

## Correction

The presentation exporter now binds only the original InspectorPanel and ComparePanel's ArtworkImage imports to the presentation image component. Original panel modules, event handlers, commands, selections and fallback loader are unchanged. The image component normalizes original/web-large URLs using the existing helper, eagerly loads detail images at high priority, and shares the gallery's exact native image URL. All 9,880 remote records have equal normalized gallery/detail sources. The 120 bundled records retain their prepared cache and use their own 640px preview as the detail background until the remote image loads. Direct museum failures retain the original optimized fallback pipeline.

## Automated evidence

`npm run verify`: 66 passed, 0 failed, 0 skipped, including frozen implementation/data/JPEG byte checks and original fast/exact ranking. `git diff --check` passed.

Two focused regressions extend `tests/gallery-request-budget.test.mjs`: execute the real image presentation with the screenshot's corpus item, checking identical URL, eager/high priority, no srcset and bundled-preview lifecycle; and bundle the real application with esbuild metadata, checking inspector/comparison route to the presentation while the original fallback import does not loop. The production exporter is checked for enabling that binding. The eager-detail regression fails against the previous image presentation (`lazy !== eager`) and passes with the fix.

The optional gstack launcher is absent; available connected Chrome and native tests provide the evidence. No synthetic performance score or network/cache timing claim is made.

## Live verification

Code commit `29dbd05e60e1d3a4dcf1a20b2d86349061d653a6`; Render deployment `dep-dbci2s59fdbs73a07ld0` live at 22:33:36 Berlin on 2026-10-21. Confirmed actual page bootstrap `/assets/bootstrap-B3229BD8.js`; stylesheet unchanged.

Connected Chrome on the deployed Render URL, after reload:

- Search `cats`, verify Feeding Poor Puss's wall image decoded, open its original inspector. The first post-click DOM check shows the exact same Met URL, decoded, eager and high priority, with no proxy URL. Captured `evidence/needle-artwork-opening-fixed.png` shows the full image in the same view that was blank in the user's screenshot.
- Open A Boy with a Cat—Morning: same gallery URL, decoded at the first post-click observation. Open Compare: both existing comparison images decoded with their gallery URLs. Close comparison and inspector successfully.
- Open the bundled Trionfo Di Virtu result: correct remote detail decoded at the first check. The native regression separately exercises its bundled preview before the load event and its removal afterwards.
- Open the category map, select A Boy with a Cat—Morning, verify correct decoded detail, close and return to the unchanged `cats` results.
- At 390×844 open the first result: image decoded and dialog width 366px, fitting the viewport. Close and reset desktop viewport; reopen Feeding Poor Puss for the evidence capture.
- Browser console errors: none observed.

These observations verify reuse and removal of the unnecessary transform on selection. They do not establish a millisecond latency guarantee for uncached networks or museum outages. Original source links, refine/compare actions, search logic, corpus and server cache remain intact.
