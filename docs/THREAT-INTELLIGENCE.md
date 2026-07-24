# Threat Intelligence

CyberPunk queries six external feeds, split by whether they require a secret API key.

## Keyless feeds — run in the browser

These need no API key and are called directly from `extension/intelligence/`:

| Feed | What it provides |
| --- | --- |
| **OpenPhish** | Known phishing URL feed |
| **PhishTank** | Community-verified phishing URLs |
| **URLhaus** | Malware-distribution URLs (abuse.ch) |
| **HaveIBeenPwned** | Password breach check via k-anonymity (5-char hash prefix only) |
| **RDAP** | Domain registration date, for domain-age scoring |

Responses are cached client-side by `intelligence/local-cache.js`. Domain-age lookups use a **7-day
TTL** because RDAP's free endpoint rate-limits aggressively.

## Key-gated feeds — backend only

These require secret keys and are **never** called from extension code, because extension JavaScript
is readable by anyone who inspects it. They live in `backend/intelligence/`:

| Feed | Key | Free tier | Endpoint |
| --- | --- | --- | --- |
| **Google Safe Browsing** | `SAFE_BROWSING_API_KEY` | Generous | `POST /api/intelligence/url` |
| **VirusTotal** | `VIRUSTOTAL_API_KEY` | 4 req/min, 500/day | `POST /api/intelligence/url` |
| **AbuseIPDB** | `ABUSEIPDB_API_KEY` | 1000 checks/day | `GET /api/intelligence/ip/:ip` |

Every key is **optional**. A missing key returns `{ "error": "no_api_key_configured" }` for that
feed only — it never blocks the rest of the scan.

## Caching

Backend intelligence responses are cached in **Redis for 6 hours**, which is what makes VirusTotal's
4-requests-per-minute free tier practical during normal browsing. Cached responses are returned with
`"fromCache": true`.

Redis fails soft: if it is unreachable, `cacheGet`/`cacheSet` no-op and requests still succeed
without caching.

## Hostname → IP resolution

AbuseIPDB checks IP addresses, not domains. `backend/intelligence/abuseipdb.js` resolves hostnames
first via **DNS-over-HTTPS** (Google's resolver — free, keyless). An IP is flagged as `listed` when
its AbuseIPDB confidence score is **≥ 25**.

## Getting keys

| Feed | Sign-up |
| --- | --- |
| VirusTotal | <https://www.virustotal.com/gui/my-apikey> |
| AbuseIPDB | <https://www.abuseipdb.com/account/api> |
| Google Safe Browsing | <https://developers.google.com/safe-browsing> |

Add them to `backend/.env` — see [`../backend/.env.example`](../backend/.env.example).
