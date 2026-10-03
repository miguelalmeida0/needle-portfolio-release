# Security

Report a suspected vulnerability privately through [Miguel Almeida's contact page](https://miguelalmeida.xyz/#contact). Do not put tokens, private keys or sensitive payloads in a public issue.

The release requires no API credentials. Environment files and private-key files are excluded from both version control and the Docker build context. CI scans tracked content and reachable history for recognizable credential patterns. A clean scan reduces risk; it cannot certify that arbitrary strings contain no secrets.

The runtime serves read-only GET/HEAD requests. Image sources are restricted to local artwork paths and an explicit museum host/path. Remote redirects, oversized responses and unsupported transformations are rejected. Transform work, decoding and cache growth are bounded. The container runs as a non-root user.

If a credential has been committed, revoke or rotate it immediately. Removing it from the working tree does not remove it from Git history or copies already downloaded. Coordinate any history rewrite before changing shared refs.

Application integrity, dependency advisories and deployment configuration are separate checks. Run `npm run verify`, `npm run security:history` and `npm audit --omit=dev` before publishing a release.
