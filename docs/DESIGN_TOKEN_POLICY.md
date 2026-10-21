# Production design-token policy

This release preserves the token layer already running at needle.miguelalmeida.xyz. It promotes only that layer onto production main (baseline cf6857299a9f875f5c58a0819ab0239772a61a60), not the separate 639-property test migration.

## Contract

- Active CSS: `styles-06391554.css`, SHA-256 `0639155478a0dafc954b1de7523af49434afdb869f220821b248213db08ad8a5`.
- 19 ordered source modules; 564 added definitions and 1,031 value-preserving substitutions.
- `npm ci`, `npm run check:tokens`, then `npm run verify` validate the committed release. Lifecycle scripts must be enabled; on macOS use the canonical `TMPDIR=/private/tmp` if the system temp directory is a symlink.
- The pinned esbuild compiler must reproduce the committed CSS byte for byte. The validator compares every resolved selector/declaration/media condition in order against the retained pre-token immutable `styles-69276BA0.css` baseline. Source drift, cycles, new unresolved references and changed instant-search bootstrap fail.
- Never overwrite immutable historical assets. `styles-STARTUP20261007.css` remains byte-identical and is not the active stylesheet. Its old proposed edit is deliberately not promoted.
- Preserve corpus, graph, JavaScript, all image assets, server/security boundaries and runtime configuration.
- Existing unresolved `--ink-900` is retained as exact production visual debt; it is not a new token regression. The runtime properties `--node-x`, `--node-y`, `--node-delay`, `--cluster-x`, `--cluster-y`, `--cluster-color`, `--range-progress` are compared with the frozen baseline. Defining defaults or changing this debt requires a separately reviewed visual change. This check does not claim zero historical debt or complete accessibility certification.
- Existing contrast, 28px remove-action/36px inspector-action, 16px mobile input, viewport, search and security tests remain enforced. The only existing test adaptation parses final CSS declarations independently of whitespace/token spelling.

## Required file scope

The original mission checkout and its five requested files remain backed up and untouched. This production package has the following exact changed-file scope; unchanged accessibility/discovery source modules and all old immutable assets remain in place.

| File | Why required |
| --- | --- |
| `.github/workflows/design-tokens.yml` | Runs token and repository verification on main/test and pull requests. |
| `dist/assets/styles-06391554.css` | Exact live compiled artifact; reproducible from the ordered source graph. |
| `dist/index.html` | Selects the exact currently live immutable stylesheet; retains the instant-search bootstrap. |
| `dist/styles/component-tokens.css` | Live component values referenced by the migrated source rules. |
| `dist/styles/detail.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/featured-match.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/index.css` | Imports semantic, component and mobile input layers in the live cascade order. |
| `dist/styles/inspector.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/layout.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/map.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/release-input.css` | Preserves the previously bundle-only 16px mobile input and zoom safeguards. |
| `dist/styles/reset.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/responsive.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/semantic-tokens.css` | Live semantic roles required by component and source declarations. |
| `dist/styles/sidebar.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/tokens.css` | Live primitive values and original aliases. |
| `dist/styles/toolbar.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/truth.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/tuning.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `dist/styles/wall.css` | Exact live source module; consumes the new token aliases while preserving original ordered declarations. |
| `docs/DESIGN_TOKEN_POLICY.md` | Documents the bounded production contract, dependencies and retained baseline debt. |
| `docs/design-token-release.json` | Locks the production baseline, ordered source files, deployed CSS and bootstrap hashes. |
| `package-lock.json` | Pins esbuild and PostCSS plus their transitive/platform dependencies; old dependency entries unchanged. |
| `package.json` | Adds the explicit token command and only the two build-time verification dependencies. |
| `scripts/check-design-tokens.mjs` | Checks exact rebuild/hash, reference debt, cycles, source graph, cascade and runtime identity. |
| `scripts/style-contract.mjs` | Parser, import expansion and token/cascade resolution used by the validator and tests. |
| `tests/accessibility-assets.test.mjs` | Checks the same contrast and control sizes through parsed/resolved CSS instead of whitespace-sensitive matching. |
| `tests/design-token-contract.test.mjs` | Proves cycles, responsive-value changes and cascade reordering cannot pass token parity. |
