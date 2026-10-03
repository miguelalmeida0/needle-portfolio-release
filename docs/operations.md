# Operations

## Runtime configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` (`8000` in Docker) | Listening port |
| `HOST` | `127.0.0.1` | Address; `npm start` explicitly binds `0.0.0.0` |
| `NEEDLE_PACKS_ROOT` | Legacy data-pack location | Override pack root; `npm start` explicitly uses `data-packs` |
| `NEEDLE_IMAGE_CACHE_ROOT` | `.needle-cache/derivatives` | Derivative storage |
| `NEEDLE_ALLOW_DEMO` | Disabled | Permit legacy static corpus fallback; leave disabled for this release |

These are configuration values, not credentials. Put TLS termination in front of the container. The Node service itself serves HTTP.

## Validate a release

1. Run `npm ci`, `npm run verify`, `npm run security:history` and `npm audit --omit=dev`.
2. Prepare bundled derivatives with `npm run prepare:previews`.
3. Start the server, open the collection wall and execute a known text query.
4. Check mobile separately, including image fallback, inspector access and scrolling.
5. Build and smoke-test the container before changing a deployment.

A successful local run does not prove public-host availability or browser performance on a slow connection.

## Cache persistence

Docker builds include the opening derivatives. Later derivatives accumulate in the writable container layer. Container replacement discards those runtime additions unless storage is mounted at `NEEDLE_IMAGE_CACHE_ROOT`.

Mounting an empty volume over the build-time cache also hides the bundled derivatives. Prepare the cache in that volume before switching traffic, or allow regeneration and account for the initial cost. The mount must be writable by the container's `node` user.

## Pack replacement

Treat the release pack as immutable. A corpus change requires a new pack ID, matching manifest checksum and a graph prepared for the new corpus/encoder. Run integrity validation before publishing. Changing files behind an immutable URL can leave browsers displaying an older artwork.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Search initialization fails | Corpus response, schema, active pack and worker error |
| Startup rebuilds the graph | Corpus hash/encoder version mismatch or invalid graph snapshot |
| Image unavailable | Allowed source, museum response, size budget, timeout and source backoff |
| Slow first image | Cold derivative cache, remote fetch and transform queue |
| Old artwork after release | Pack ID and immutable image URLs |
| Public visitor waits before any response | Reverse proxy and host startup; measure separately from browser initialization |
