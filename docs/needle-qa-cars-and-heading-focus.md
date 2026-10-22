# Cars search and heading focus QA

2026-10-22. Baseline code 7f6aa964d95ad7eddd26ec21df1985473eecde91. Public production: https://needle.miguelalmeida.xyz/.

## Scope

Remove the visible focus rectangle from the noninteractive results title. Audit cars search without changing the user-preserved retrieval logic, corpus, ranking or data sources. Only presentation CSS changes are being deployed.

## Heading defect

Entering a query and pressing Enter moves focus to `h1#needle-results-title[tabindex="-1"]`. The general `.needle-app :focus-visible` rule paints a green rectangle across its width. Reproduced in the connected user browser: focused title `cars`, computed outline `rgb(30, 61, 46) solid 2px`.

Repair: suppress the outline only on programmatically focused `h1[tabindex="-1"]` elements. Focus movement for assistive technology remains; buttons, links, artwork tiles and editable controls retain their focus styles. This CSS defect is checked in the real browser, not by a mirror implementation test.

## Cars search: relevance fails

The live first eight artwork IDs match the in-memory production-engine replay exactly. This is a retrieval-quality failure, not a missing-image symptom.

- No whole-word car/cars/automobile/motorcar record appears in the loaded 10,000-record catalogue's titles, object names, classification, medium or tags. This is a metadata coverage finding; it cannot prove the subject is absent from every pixel in every image.
- `cars` and `car` have no recognized semantic dimensions in the shipped encoder. They are encoded only into 24 hashed residual dimensions. Collisions can therefore produce unrelated neighbors.
- The lexical title fallback uses `title.includes(normalizedQuery)`. `cars` matches **Carson** in the actress Emma Carson's title. It does not match a car subject. That record is ranked first in the screenshot and the replay.
- The engine always takes at least one nearest candidate and up to k=8; it has no reliable no-relevant-results gate for this case.
- Full exact search also returns unrelated material. Switching from approximate to exact search does not resolve the meaning/coverage problem.
- Adjacent queries `cats` and `doors` retrieve the expected titled cat/door works. This does not certify relevance for arbitrary queries.
- Singular `car` has 279 lexical hits because substring matching also catches words such as cartouches and caricatures. Those are not 279 catalogue car subjects.

Evidence: `docs/needle-qa-cars-observations.json` contains exact/fast results and encoder/lexical observations for cars, car, automobile, carriage, cats and doors. It is audit evidence, not a passing relevance fixture. The existing preservation suite proves the engine files and original data are byte-identical to the pre-design release; preserving behavior is not the same as proving result quality.

## Required retrieval follow-up (not applied in this design-only patch)

Use token or phrase boundaries for title boosts; evaluate unknown-subject and no-relevant-match handling against positive and negative queries; expose a truthful empty-result state rather than unrelated images as matches. Adding actual automobile coverage needs suitable source records and, if image-content recognition is intended, an encoder that represents that subject. Do not relabel carriage or portrait images as cars, silently replace the dataset, or regenerate preservation fixtures to disguise changes.

## QA limits

The gstack launcher is absent on this host (exit 127). Repository-native checks and the available connected Chrome are used; no gstack health score or broad search-quality certification is claimed. Search relevance remains an open finding. No provider/network/model migration is part of this repair.
