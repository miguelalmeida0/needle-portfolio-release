# Needle

Visual search across 10,000 artworks from The Metropolitan Museum of Art.

[Open Needle](https://needle.miguelalmeida.xyz) · [Documentation](docs/README.md) · [Architecture](docs/architecture.md) · [Operations](docs/operations.md) · [Security](SECURITY.md)

Needle combines a prepared HNSW graph with field-weighted museum metadata and a lexical index. Retrieval runs in a browser worker. A Node server delivers the frozen corpus, application modules and size-specific artwork previews.

The useful unit is a visible artwork, not a search timing alone. Index loading, rendering and image delivery have separate budgets and failure modes.

## Run locally

Use Node 26 (see `.node-version`).

```sh
npm ci
npm run verify
npm run prepare:previews
npm start
```

Open `http://localhost:4173`. If the port is occupied, the server tries the next available port and prints the address. Preview preparation uses the 120 bundled opening images; it does not require a museum request.

## Container

```sh
docker build -t needle .
docker run --rm -p 8000:8000 needle
```

Open `http://localhost:8000`. The image runs as the unprivileged `node` user and prepares opening previews during its build. No API key or `.env` file is required.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `dist/` | Exported browser application, worker modules and prepared graph |
| `data-packs/` | Frozen 10K corpus, active-pack pointer, manifest and 120 opening images |
| `scripts/serve.mjs` | Static/data-pack routing, HTTP validation and compression |
| `scripts/image-delivery.mjs` | Bounded derivative generation and disk cache |
| `prepare-previews.mjs` | Build-time AVIF preparation using the runtime image pipeline |
| `tests/` | Release integrity, request boundaries and image-cache behavior |

**Do not remove `dist/` or `data-packs/` as generic generated folders.** This is the deployable release package, exported from application revision `de4c6c46a4503d369a98f9f0a5aab0f5fce5e2f6`. It is not the original frontend development workspace. Browser changes require a new validated application export; server and documentation changes can be made here.

## Verification

```sh
npm run verify
npm run security:history
npm audit --omit=dev
```

`verify` checks tracked files for recognizable credential patterns and forbidden secret files, validates corpus/manifest/graph identity, and runs the runtime tests. `security:history` also inspects every reachable Git blob. Pattern scanning cannot prove the absence of every possible secret; suspected credentials must be revoked, not merely removed from a later commit.

## Scope and limitations

- The published retrieval representation is metadata-based. Experimental neural retrieval is not enabled on public hosts.
- Opening previews are local. Other artwork images depend on museum availability and may show an explicit fallback.
- A prepared graph removes graph construction from the compatible startup path. The corpus must still transfer, parse and be encoded.
- Runtime derivatives are cached in the container filesystem. They need an explicit persistent mount to survive container replacement.
- This package does not include the original before/after performance reports. It does not certify historical speedup claims or internet latency.

## License

Application code: [MIT](LICENSE). Dataset and artwork attribution: [third-party notices](THIRD_PARTY_NOTICES.md).
