# Text search relevance correction

User authorization: 2026-10-22, replace the preserved search behavior with a relevance fix. Pre-fix HEAD: `ddec4b6acba619d736465770da59fe52fb7848cb`, clean working tree, branch `test`. Repository policy permits only `test` and `main`; no feature branch or history rewrite.

## Problem and cause

`cars` ranked an Emma Carson portrait because the old lexical title fallback accepts substrings (`dist/modules/packages/search-runtime/src/lexical-index.js`, title `includes`). Unsupported subjects have only residual hash coordinates in `art-semantic-encoder.js`; the old hybrid scorer returns nearest neighbours without requiring subject evidence. The wall then appends the entire 10K collection after the hits. Exact vector search does not fix missing subject evidence.

## Repair

A versioned engine in `src/search` adds whole-word postings, conservative plural/Unicode normalization, selected synonyms, quoted phrases, AND requirements, OR alternatives and coordinated exclusions. Every substantive positive group must have catalogue evidence. An unknown object cannot disappear because its color matched. Catalog filters apply before ranking. Title evidence is discounted for long credit/series strings so incidental title words do not outrank direct subject titles.

Supported text candidates retain a small vector tie-breaker and the existing graph trace. Image, artwork and mixed-query retrieval delegate to the original engine. Both the exported browser worker and local fallback resolve to the new engine through an explicit build binding. Worker and bootstrap are content-addressed; the original frozen runtime and graph remain available and byte-identical.

The main text wall shows only returned matching IDs. No matches produces an inline status and no filler images/map preview. Clearing search restores collection browsing. The positive map retains the user-requested, explicitly labelled unrelated collection context; empty searches do not get contextual images masquerading as matches.

## Verification and review

The original reproduction failed 8 new relevance tests before the fix, including cars, red cars, absent objects and saved-scope nonmatches. Added independent controlled examples for whole words, plurals, color/object conjunctions, exclusions, OR, quoted phrases, accents and creator names. Tests execute the shipped worker as well as checking local fallback resolution and the real wall rendering boundary.

Three read-only simplification reviews covered reuse, quality and resource usage, followed by a targeted manual correctness scan. Applied findings: remove retained per-document token maps; retain field weights with normalized fields instead of reconstructing them per phrase; correct coordinated exclusions; reject blank filter values; complete wall memo dependencies. The suggested removal of unrelated positive-map context was declined because the user expressly requested that labelled context. Kept two lines of wall response selection local to preserve its isolated renderer boundary.

Preservation tests remain intact and do not certify the new ranking by themselves. New relevance tests validate the corrected boundary. Full release checks and final test count are recorded with live evidence after deployment. No new framework, model provider, paid infrastructure, data records or replacement images were introduced.

## Limits

This is precision-oriented catalogue retrieval. It deliberately returns fewer results when not all requested terms have evidence; it can miss relevant images whose metadata omit those terms. It does not provide general visual object recognition, typo correction, arbitrary natural-language understanding, or a guarantee for every query. The catalogue still contains no car-labelled records. No numerical universal accuracy claim is made from controlled examples or keyword-grounded checks.

For true image-content understanding beyond the catalogue, evaluate image-text embeddings and an independently labelled relevance set as a separate model/data change. Do not pass off hash residuals as general image understanding or silently fabricate missing collection subjects.
