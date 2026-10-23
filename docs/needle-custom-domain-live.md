# Needle production domain connected

## Restoration, 2026-10-22

The migration described below was reversed at the owner's request. The canonical
hostname again uses Porkbun A `needle` → `178.105.57.97`, TTL 600, on the existing
Hetzner server. Other DNS records were preserved. Public DNS and HTTPS confirmed
the restored route; that server was still serving bootstrap `9FA4D098` at this
point. DNS restoration alone did not deploy the latest application.

`scripts/deploy-hetzner.py` deploys pinned application commit
`ce4b1bb3a005d6e71f146a4446b57d452a55f8a8` to the existing Docker/Caddy host.
It preserves container environment and image cache, checks a candidate before
switching loopback port 8000, validates release asset hashes through Caddy HTTPS,
and retains the previous container for rollback. It changes no DNS or Caddy
configuration. Run it from the existing root SSH session, using an immutable
download and SHA-256 verification. Deployment is complete only when its checks
pass and the public site serves bootstrap `1FB9CE23`.

Local deployment tests: `python3 -m unittest discover -s tests -p 'deploy_hetzner_test.py'`.

## Historical migration (superseded)

2026-10-21. Canonical URL: https://needle.miguelalmeida.xyz/

Changed the existing Porkbun record in place from A `needle` → `178.105.57.97` to CNAME `needle` → `needle-portfolio.onrender.com`, TTL 600. The other four records stayed unchanged. Saved record confirmed in the DNS table. Render custom domain on service `srv-db0ltec9v7es73c13cq0` verified successfully and its dashboard confirmed the certificate was issued.

Public Google DNS independently returned the new CNAME and Render IPv4 endpoints. No conflicting AAAA address or restrictive CAA record was found. A TLS-validated request to the new public origin, resolving the domain to its published Render address, returned HTTP 200 and bootstrap `A8D7BAF5`.

Fresh cloud Chrome opened the exact HTTPS URL normally, without a resolver override or certificate bypass. DOM confirmed `/assets/bootstrap-A8D7BAF5.js` served from `needle.miguelalmeida.xyz`; the initial input stayed empty and 12 background images were present. Ran Something small and golden → results → See them on the map: real ranked results and category map opened on this same hostname. Returned to the canonical root and saved `evidence/needle-custom-domain-live.jpg` from that browser. The screenshot shows the current design at the production domain.

The already-open connected Chrome initially retained the old version after the DNS change, including on a new query-string URL. Fresh-browser verification establishes that the new DNS/HTTPS routing works; pre-existing client DNS/connection caches may outlast the switch. No browser-wide cache or network settings were modified.

No app code, data, search logic or image files changed in this domain connection. The application remains code commit `c38b8a0ec39c3b51917de932e91324d8c320a9c7`, Render deployment `dep-dbcigi1srm7s73b68btg`, with the previously verified 70 checks. No new deploy was needed.
