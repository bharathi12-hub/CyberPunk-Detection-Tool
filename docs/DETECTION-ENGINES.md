# Detection Engines

Each engine in `extension/engines/` is a **pure function**: structured input in, a score out, with no
network or DOM access. That makes them independently testable — see `tests/risk-engine.test.js`.

Engines report on a "higher = safer" 0–100 scale; `risk-engine.js` combines them.

---

## Scoring model

`engines/risk-engine.js` produces the final **Website Risk Score**:

| Signal | Weight |
| --- | --- |
| Reputation | 25% |
| Phishing | 25% |
| Trackers | 10% |
| Security headers | 10% |
| Cookies | 10% |
| Permissions | 10% |
| Downloads | 10% |

Additional penalties are subtracted from the weighted total:

| Condition | Penalty |
| --- | --- |
| Crypto-scam content detected | −20 |
| Typosquatting match | −15 |
| Flagged form (per form) | −10 |
| QR code detected on page | −10 |
| Sensitive data exposure | −10 |
| Fingerprinting detected | −5 |
| Composite phishing score | −20% of that score |

The result is clamped to 0–100 and classified:

| Score | Classification |
| --- | --- |
| 80–100 | `LOW RISK` |
| 50–79 | `MEDIUM RISK` |
| 0–49 | `HIGH RISK` |

> The score is a **reference signal, not a guarantee.**

---

## The engines

### `reputation-engine.js`
HTTPS usage, domain age via RDAP, and URL-shortener expansion. Domain-age lookups are cached per
hostname with a **7-day TTL** because `rdap.org` enforces a strict 10-requests-per-10-seconds limit;
a rate-limited result is reported distinctly from a genuinely unavailable one.

### `phishing-engine.js`
Brand impersonation via homograph detection (Levenshtein distance) **plus combo-squat detection**,
which catches domains like `paypal-secure-login.com` that embed a full brand name padded with extra
text — a pattern edit-distance alone cannot catch.

### `tracker-engine.js`
Matches subresource requests against known tracker domains and derives a privacy score.

### `cookie-engine.js`
Inspects `Secure`, `HttpOnly`, `SameSite`, and expiry. The score is the ratio of flagged to total
cookies (no cookies at all scores 100).

### `header-engine.js`
Checks CSP, HSTS, X-Frame-Options, and the cross-origin isolation headers (CORP/COOP/COEP).

### `permission-engine.js`
Scores risky permission prompts, with an extra penalty for repeated asks
(High −15, Medium −8, repeated ask −10).

### `download-engine.js`
Flags executables, double extensions, and archives observed during the session
(High Risk −25, Medium Risk −10).

### `fingerprint-engine.js`
Detects canvas, audio, WebGL, font, and related fingerprinting probes, fed by the
`fingerprint-probe.js` content script running in the MAIN world.

### `form-analysis-engine.js`
Flags insecure form actions, cross-origin submissions, and sensitive input fields.

### `password-engine.js`
Password breach checking via HaveIBeenPwned's **k-anonymity** API — only a 5-character hash prefix
ever leaves the browser. Free and keyless.

### `crypto-scam-engine.js`
Detects crypto-scam phrasing on the page (fake giveaways, airdrops, wallet-drainer language).

### `ml-phishing-engine.js`
A **composite feature score**, not a trained model. It combines the other engines' features into a
single phishing-likelihood number. See the note in [AI-SYSTEM.md](AI-SYSTEM.md#note-on-ai-vs-ml).

### `risk-engine.js`
The combiner described above. Fully covered by unit tests.

---

## Content scripts

| Script | World | Purpose |
| --- | --- | --- |
| `scanner.js` | Isolated | DOM, forms, page text signals |
| `qr-scanner.js` | Isolated | QR codes on the page ("quishing" vector) |
| `fingerprint-probe.js` | MAIN | Observes fingerprinting API access directly |
