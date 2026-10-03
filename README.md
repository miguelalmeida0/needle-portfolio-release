# Needle portfolio release

Standalone deployment package from source commit de4c6c46a4503d369a98f9f0a5aab0f5fce5e2f6.
Includes the real 10,000-record Met corpus and prepared HNSW graph.
Experimental neural visual search is not enabled on public hosts.

Runtime: Node26.0.0. Build: npm ci --omit=dev && NEEDLE_IMAGE_CACHE_ROOT=.needle-cache/derivatives node prepare-previews.mjs. Start: npm start.
