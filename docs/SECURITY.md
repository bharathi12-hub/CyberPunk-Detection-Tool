# Security Design

This page describes the **security posture of the application itself**. To report a vulnerability,
see the disclosure policy in [`../SECURITY.md`](../SECURITY.md).

## What is implemented today

| Control | Where | Status |
| --- | --- | --- |
| Parameterized SQL (no concatenation) | all controllers | ✅ |
| Input validation (numeric ids, IPv4 regex, payload checks) | controllers | ✅ |
| Result-set caps (`LIMIT` max 500) | `scansController.js` | ✅ |
| `helmet()` security headers | `api/server.js` | ✅ |
| Global rate limiting (120 req/min) | `api/server.js` | ✅ |
| CORS origin control (`ALLOWED_ORIGIN`) | `api/server.js` | ✅ |
| Secrets only in `backend/.env` (gitignored) | backend | ✅ |
| Secret-key feeds never shipped to the browser | `backend/intelligence/` | ✅ |
| No remote code execution (MV3 CSP, vendored libs) | `extension/vendor/` | ✅ |
| Generic error responses (no stack traces leaked) | `api/server.js` | ✅ |
| Dependency install verified in CI | `.github/workflows/ci.yml` | ✅ |

## Known limitations — read before deploying

- **There is no authentication.** Every endpoint is unauthenticated. This is acceptable for the
  intended local / self-hosted single-user model, and **not** acceptable on a public host.
- **CORS defaults to `*`.** Restrict `ALLOWED_ORIGIN` before exposing the API.
- **API-key quota is the real risk.** An exposed, unauthenticated backend lets anyone burn your
  Anthropic / VirusTotal / AbuseIPDB quotas. Rate limiting slows that down; it does not prevent it.
- **The extension requests broad permissions** (`<all_urls>`), which is inherent to analyzing
  whichever page you are on. What is and isn't collected is documented in
  [`../PRIVACY.md`](../PRIVACY.md).
- **Detection is heuristic.** Brand-impersonation and phishing checks are name- and
  pattern-based, so both false positives and false negatives are possible. The score is a reference
  signal, not a guarantee.

## Secrets handling

All secrets are supplied via environment variables — never committed. `.gitignore` excludes `.env`
and `.env.local`; the template [`../backend/.env.example`](../backend/.env.example) is committed
with empty values only.

If a key is ever committed by accident, **rotate it immediately** — removing it in a later commit
does not remove it from git history.

## Not implemented

For clarity, these are **not** present in the current version, despite being common in similar
projects: user accounts, JWT or session authentication, role-based access control, audit logging,
and automated dependency vulnerability scanning. See the [roadmap](ROADMAP.md).
