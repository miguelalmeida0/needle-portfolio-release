# Architecture

## Search initialization

The browser worker fetches the corpus and the prepared graph in parallel. `BrowserCorpusRepository` computes SHA-256 over corpus bytes. The graph is reused only when its corpus checksum matches and its encoder version is `1`. An incompatible or rejected snapshot falls back to graph construction.

The worker still parses the corpus, encodes metadata vectors and creates search documents. A prepared graph does not make those costs disappear. Results carry a request ID; the application also compares an active search sequence before committing a result so an older request cannot replace a newer query.

Inspect `dist/modules/packages/search-runtime/src/search.worker.js`, `search.service.js`, and `dist/modules/apps/web/src/app/app.runtime.js`.

## Image delivery

The image component requests AVIF, then WebP, then JPEG on failure, before trying a distinct fallback source. It uses responsive widths, asynchronous decoding and native lazy loading. Detail views can retain a previously decoded preview while the larger image loads. The decoded-source map is bounded to 96 entries.

The server accepts four derivative widths: 160, 320, 640 and 1280 pixels. Remote sources must use HTTPS on `images.metmuseum.org`, with the expected `CRDImages/.../web-large/...` path, no credentials, port or query string. Redirects are rejected. Local images resolve through the active pack or the permitted static artwork path.

The pipeline limits remote reads to 12 MiB and 10 seconds, image decoding to 40 million pixels, simultaneous transforms to three and distinct pending derivatives to 96. Duplicate requests share the same in-flight derivative. Source bytes are shared briefly between overlapping sizes and formats.

Disk pruning targets a 256 MiB cache and runs at most once a minute. This is a pruning target, not a strict instantaneous disk cap. Failed sources receive a 30-second backoff. The queue limit and fallback are failure controls, not a guarantee that every museum image will load.

## Identity and HTTP caching

| Resource | Identity | Delivery policy |
| --- | --- | --- |
| Corpus | Actual bytes, SHA-256 in manifest/graph | `no-cache`; revalidation allowed |
| Search graph | Corpus checksum + encoder version | `no-cache` |
| HTML and pack manifest | Current deployment/active pack | `no-store` |
| Local pack artwork | Versioned pack path | One year, immutable |
| Local derivative | Source path + size/mtime + width + format + pipeline version | One year, immutable; key is the ETag |
| Remote derivative | Source URL + daily bucket + width + format + pipeline version | One day; key is the ETag |
| Other static modules | File size and mtime ETag | Five minutes unless filename matches the hashed-asset rule |

`If-None-Match` returns 304 for matching resources. `no-cache` means validate before reuse, not forbid storage. Pack IDs and immutable URLs must change when assets change. A server-side fingerprint alone does not invalidate an already fresh browser response at the same URL.

## Rendering

The spatial view keeps the full corpus in its model but selects a bounded set of artwork DOM nodes. Its preview budget depends on viewport width. The collection wall uses row windowing with one row of overscan before and after the visible region. Neither mechanism requires one image element per catalog record.

## Release boundaries

The checked-in graph and corpus can be validated locally. Deployment topology, cache-volume configuration, public-host uptime, retrieval quality and historical timing improvements require separate observations. This repository does not provide those measurements.
