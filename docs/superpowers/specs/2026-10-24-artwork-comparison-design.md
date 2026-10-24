# Needle: artwork comparison — approved design

Date: 2026-10-24. Visual reference: user-selected mockup in ChatGPT dated 2026-10-24 21:27 Berlin.

## Intent
Let a visitor compare two artworks from the actual search results without losing query, filters, scroll position or the current Needle identity.

## Visual contract
Retain the existing beige canvas, serif title, green controls, header, search composer, result-grid geometry and map. User selects two real artworks using independent controls on their result images. Present a right-aligned two-thirds-width comparison surface below the existing header with the results dimmed behind it. Display a small kicker, title, two authentic museum images with source metadata, an evidence-based connection and a Save both works control. The surface becomes full width on narrow screens. Match the selected reference rather than rebuilding the app.

## Alternatives
- **Separate comparison route:** makes sharing simple, but breaks the search/results context and the exact chosen layout.
- **Reuse legacy inspector ComparePanel:** cheaper, but does not match the approved right-side composition or selection model.
- **Presentation-only comparison overlay (chosen):** preserves the production search runtime, original artwork images and saved-collection APIs.

## State and scope
Selection is temporary presentation state; the pair is copied to the existing history-navigation state for forward/back/reload. Lookup always uses actual corpus IDs. Save both creates a normal saved collection using existing runtime operations. No new network APIs, search rules, corpus changes, ranking changes, made-up titles, or invented artwork relationships.

## Accessibility and performance
Independent buttons, visible selected states, accessible names, initial dialog focus, Tab containment, Escape/backdrop dismissal, focus restore, inert underlying page, touch controls, reduced-motion behavior. Reuse existing ArtworkImage and the current virtualized CollectionWall; mount only the selected two detail images in the overlay.

## Verification
Unit-test comparison selection and catalogue-based copy, verify JSX integration and source markers, then run the repository release build and full suite, including browser visual/keyboard/mobile checks. Do not promote to main or deploy without verified release artifacts.
