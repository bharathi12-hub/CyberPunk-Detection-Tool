# REST API

All endpoints are served by `backend/api/server.js`.

**Base URL:** `http://localhost:3000` (port configurable via `PORT`)

**Applied to every request:** `helmet()`, CORS (`ALLOWED_ORIGIN`, default `*`), a 2 MB JSON body
limit, and a global rate limit of **120 requests per minute**.

> ⚠️ There is **no authentication**. This API is designed for local / self-hosted use — read
> [`../SECURITY.md`](../SECURITY.md) before exposing it publicly.

---

## Health

### `GET /health`

```json
{ "status": "ok" }
```

---

## Scans

### `POST /api/scans`

Stores a scan produced by the extension's background worker. The complete object is also persisted
verbatim as `raw_scan`.

```json
{
  "url": "https://example.com/login",
  "hostname": "example.com",
  "risk": { "finalScore": 82, "classification": "LOW RISK" },
  "reputation": { "https": true, "domainAge": 8.4 },
  "phishing": { "confidence": 12, "isPotentialPhishing": false },
  "tracker": { "trackersFound": 3 },
  "headers": { "securityHeadersScore": 70 },
  "cookies": { "flaggedCookies": 1, "totalCookies": 9 },
  "scannedAt": 1750000000000
}
```

| Status | Body |
| --- | --- |
| `201` | `{ "stored": true }` |
| `400` | `{ "error": "Invalid scan payload — missing url or risk" }` |
| `500` | `{ "error": "Failed to store scan" }` |

Also upserts the per-hostname aggregate row in `threat_statistics`.

### `GET /api/scans/history`

| Query | Default | Max |
| --- | --- | --- |
| `limit` | 100 | 500 |

```json
{ "scans": [ { "url": "…", "risk": { "…": "…" }, "_id": 42 } ] }
```

`_id` is the database row id, added so the client has a stable handle for deletion.

### `DELETE /api/scans/:id`

`:id` must be numeric.

| Status | Body |
| --- | --- |
| `200` | `{ "deleted": true, "id": 42 }` |
| `400` | `{ "error": "Invalid scan id" }` |
| `404` | `{ "error": "Scan not found" }` |

### `POST /api/scans/retention`

Enforces the history-retention window configured in the extension's Options page.

```json
{ "retentionDays": 30 }
```

```json
{ "deleted": 12 }
```

`retentionDays <= 0` means "keep forever" and deletes nothing.

---

## AI

Both endpoints call Anthropic Claude and return a short plain-English explanation. If
`ANTHROPIC_API_KEY` is unset or the call fails, they return `500` and the extension falls back to
local rule-based text — the UI never blocks on the AI.

### `POST /api/ai/explain-risk`

```json
{ "scan": { "…": "structured scan object" } }
```

```json
{ "explanation": "Trust Score: 88/100. HTTPS enabled. No phishing indicators detected. …" }
```

### `POST /api/ai/explain-phishing`

```json
{ "phishingResult": { "…": "…" }, "formResult": { "…": "…" } }
```

```json
{ "explanation": "Flagged because the domain contains a brand name padded with extra text. …" }
```

---

## Threat intelligence

Both responses are cached in Redis for **6 hours** to respect free-tier rate limits. Cached
responses include `"fromCache": true`.

### `GET /api/intelligence/ip/:ip`

IPv4 only; other formats return `400`.

```json
{ "listed": false, "abuseScore": 0, "totalReports": 0, "source": "AbuseIPDB" }
```

`listed` is `true` when the AbuseIPDB confidence score is **≥ 25**.

### `POST /api/intelligence/url`

```json
{ "url": "https://example.com" }
```

```json
{
  "results": [
    { "listed": false, "source": "Google Safe Browsing", "details": null },
    { "listed": false, "source": "VirusTotal", "maliciousCount": 0 }
  ]
}
```

A missing key yields `{ "error": "no_api_key_configured" }` on that entry only — the other still runs.

---

## Analytics

### `GET /api/analytics/summary`

```json
{
  "totals": {
    "total_scans": 143,
    "high_risk_count": 9,
    "medium_risk_count": 31,
    "low_risk_count": 103,
    "avg_trust_score": 78,
    "total_trackers_found": 512
  },
  "topRiskyHostnames": [
    { "hostname": "example.com", "total_scans": 12, "high_risk_count": 5, "phishing_flag_count": 2 }
  ],
  "recentTrend": [ { "day": "2026-07-01T00:00:00.000Z", "scans": 14, "avg_score": 81 } ]
}
```

`recentTrend` covers the last 14 days; `topRiskyHostnames` is capped at 10.

---

## Report export

Report generation and `.txt` / `.pdf` / `.docx` export happen **entirely client-side** in
`extension/ai/report-generator.js`. There are no server-side export endpoints.
