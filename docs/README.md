# Needle release engineering

Needle is a **deployable release package**, not the original frontend development monorepo. The browser build, prepared search graph and 10K metadata pack are committed deliberately.

| Question | Document |
| --- | --- |
| What is this release? | [Project README](../README.md) |
| How does search and image delivery work? | [Architecture](architecture.md) |
| How do I start, configure or replace a pack? | [Operations](operations.md) |
| What can be changed here? | [Contributing](../CONTRIBUTING.md) |
| How do I verify integrity and investigate secrets? | [Security](../SECURITY.md) |
| Which branches may agents use? | [`AGENTS.md`](../AGENTS.md) |

## Source of truth

- `dist/` is the validated exported browser runtime; do **not** delete it or edit hashed browser modules by hand.
- `data-packs/` contains the versioned corpus and opening artwork previews; pack IDs, manifests and prepared graphs must agree.
- `scripts/` owns the HTTP/image/cache serving boundary; `tests/` protects integrity and request behavior.
- `prepare-previews.mjs` and `Dockerfile` reproduce the release preparation path.

## Before release

```bash
npm ci
npm run verify
npm run security:history
npm audit --omit=dev
npm run prepare:previews
```

A passing verification does not imply a measured search speedup, external image-host reliability or public deployment availability. See [operations](operations.md) for smoke testing and cache behavior.

Do not run a generic build-output cleanup, normalize away release data, or regenerate a pack without validating corpus/graph identity.
