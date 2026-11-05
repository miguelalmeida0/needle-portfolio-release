# Operations

## Runtime configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` (`8000` in Docker) | Listening port |
| `HOST` | `127.0.0.1` | Address; `npm start` explicitly binds `0.0.0.0` |
| `NEEDLE_PACKS_ROOT` | Legacy data-pack location | Override pack root; `npm start` explicitly uses `data-packs` |
| `NEEDLE_IMAGE_CACHE_ROOT` | `.needle-cache/derivatives` | Derivative storage |
| `NEEDLE_IMAGE_TRANSFORMS_ENABLED` | `1` | Set `0` to stop cold transforms; cached derivatives still work |
| `NEEDLE_IMAGE_REMOTE_ENABLED` | `1` | Set `0` to stop cold museum downloads; local/cached images still work |
| `NEEDLE_IMAGE_DAILY_TRANSFORMS` | `2000` | Maximum new transforms per UTC day |
| `NEEDLE_IMAGE_TRANSFORMS_PER_MINUTE` | `120` | Maximum new transforms per UTC minute |
| `NEEDLE_IMAGE_DAILY_REMOTE_REQUESTS` | `1000` | Maximum museum fetch attempts per UTC day |
| `NEEDLE_IMAGE_DAILY_REMOTE_BYTES` | `268435456` | 256 MiB daily museum download budget |
| `NEEDLE_IMAGE_DAILY_RESPONSE_BYTES` | `1073741824` | 1 GiB daily image response budget, including original image URLs |
| `NEEDLE_ALLOW_DEMO` | Disabled | Permit legacy static corpus fallback; leave disabled for this release |

These are configuration values, not credentials. Put TLS termination in front of the container. The Node service itself serves HTTP.

## Validate a release

1. Run `npm ci`, `npm run verify`, `npm run security:history` and `npm audit --omit=dev`.
2. Prepare bundled derivatives with `npm run prepare:previews`.
3. Start the server, open the collection wall and execute a known text query.
4. Check mobile separately, including image fallback, inspector access and scrolling.
5. Build and smoke-test the container before changing a deployment.

A successful local run does not prove public-host availability or browser performance on a slow connection.

## Deploy to the existing host

After verifying and publishing the production commit, run its deployment helper from
the existing root SSH prompt:

```sh
python3 scripts/deploy-hetzner.py --release <reviewed-40-character-commit-sha>
```

The release argument is required; branch names and abbreviated hashes are rejected.
The helper verifies the fetched commit, existing Docker runtime contract, candidate
assets and public HTTPS before completing the switch. It preserves the environment
and final stopped-container cache snapshot, and retains the old container for rollback.
It does not configure SSH credentials or print preserved environment values.

## Cache persistence

Docker builds include the opening derivatives. Later derivatives accumulate in the writable container layer. Container replacement discards those runtime additions unless storage is mounted at `NEEDLE_IMAGE_CACHE_ROOT`.

Mounting an empty volume over the build-time cache also hides the bundled derivatives. Prepare the cache in that volume before switching traffic, or allow regeneration and account for the initial cost. The mount must be writable by the container's `node` user.

## Image work and traffic budgets

Image usage is reserved transactionally in `.usage.sqlite` inside the cache directory.
Counters survive restarts and are shared by processes using that disk. Preserve this
file during deployment; deleting it resets the allowance. The deployment helper takes
a final copy after stopping the old container so counters cannot move backward during
a release. Separate replicas with separate disks do not share the budget: retain the
single-instance deployment or add shared edge/account limits before scaling.

Each museum fetch reserves its full 12 MiB input ceiling before connecting. Completed
reads settle actual bytes; failures/crashes keep the reservation. Retries count as new
attempts. Cache hits avoid transform/download counters; image GET bytes are reserved
before streaming and never refunded after disconnects. HEAD does not generate a cold
derivative. HEAD and 304 responses do not spend response bytes.

Quota exhaustion returns 429 with Retry-After. Disabled work or unavailable accounting
returns 503. Numeric settings accept nonnegative integers; `0` denies new reservations.
The two enable switches accept `0` to stop work. Restart after changing settings.

At most 32 unique jobs, including three active jobs, can be pending. Queue waits expire
after five seconds; remote reads and native Sharp processing each have a ten-second
timeout. Museum destination, redirect, public-path and symlink restrictions remain.
Fragments, duplicate parameters and oversized image URLs are rejected. Local aliases
and equivalent percent encodings share cache identities. Outputs fit within 1280 × 4096
pixels and 4 MiB. Build-time preview preparation is trusted offline work and does not
consume public allowances.

Work limits cover `/_image`; traffic limits include original/static image URLs. They do
not cover non-image static-file bandwidth or proxy connection costs.
Use host/provider traffic limits and Caddy edge controls for the rest of the site. Cache
pruning still periodically targets 256 MiB; the usage ledger is excluded from pruning.

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
