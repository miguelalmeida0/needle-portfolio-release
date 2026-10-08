# Contributing

Develop on `test`, release on `main`, and do not create additional branches. [`AGENTS.md`](AGENTS.md) defines the binding branch and attribution policy.

Use Node 26 and install dependencies with `npm ci`.

This repository owns the exported runtime, release data and deployment package. Browser modules in `dist/` come from the application build. Avoid hand-editing generated browser code; replace it with a validated export and preserve corpus/graph identity.

For a runtime change:

1. Reproduce the failure and add a test that distinguishes correct behavior.
2. Keep configuration, file routing and image transformation responsibilities separate.
3. Run `npm run verify`, `npm run security:history` and `npm audit --omit=dev`.
4. Explain the user-visible change, validation performed and remaining limits in the pull request.

Keep private environment files, credentials, generated caches and local logs outside version control. Publish benchmark numbers only with the original measurements and named conditions.
