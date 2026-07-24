# System Architecture

CyberPunk has two independent runtimes: a **self-contained Chrome extension** that performs all page
analysis locally, and an **optional Node.js backend** that adds persistence, aggregate analytics, and
the key-gated threat feeds. The extension works without the backend — it degrades gracefully.

## Scan pipeline

```text
Page load
   │
   ├─ content-scripts/         scanner.js · fingerprint-probe.js · qr-scanner.js
   │                           (DOM, forms, fingerprinting APIs, QR codes)
   ▼
background-worker/index.js     orchestrates everything, per tab
   │
   ├─ engines/                 pure-logic scoring (reputation, phishing, cookies,
   │                           headers, trackers, downloads, crypto-scam, …)
   │
   ├─ intelligence/            keyless feeds in-browser (OpenPhish, PhishTank, URLhaus)
   │        └── backend call ──► key-gated feeds (Safe Browsing, VirusTotal, AbuseIPDB)
   ▼
engines/risk-engine.js         combines every signal → Website Risk Score (0–100)
   │
   ├─ ai/risk-explainer.js ───► POST /api/ai/explain-risk (2.5s timeout, local fallback)
   ▼
popup-ui/ · dashboard/         render score, tiles, history, reports
   │
   └─ POST /api/scans ────────► backend ──► PostgreSQL (history) + Redis (intel cache)
```

## Components

| Component | Runtime | Responsibility |
| --- | --- | --- |
| `content-scripts/` | Page | Collect DOM / form / fingerprint / QR signals |
| `background-worker/` | Extension service worker | Orchestrate engines, own per-tab state |
| `engines/` | Extension | Pure scoring functions — no I/O, unit-testable |
| `intelligence/` | Extension | Keyless threat feeds + local cache |
| `ai/` | Extension | Explanations, report generation and export |
| `backend/api/` | Node.js | REST API (scans, ai, intelligence, analytics) |
| `backend/intelligence/` | Node.js | Secret-key feeds — never shipped to the browser |
| PostgreSQL | Server | Scan history, per-host aggregates, reports |
| Redis | Server | Threat-intel response cache (fails soft) |

## Key design decisions

- **Engines are pure functions.** Files in `engines/` take structured input and return scores with no
  network or DOM access. That is why `risk-engine.js` is directly unit-testable — see `tests/`.
- **Secret keys never reach the browser.** Extension JavaScript is readable by anyone who inspects it,
  so the three key-gated feeds live in `backend/intelligence/` and are only ever called server-side.
- **Everything degrades gracefully.** No backend → local scoring still works. No API key → that feed
  returns `no_api_key_configured`. Redis down → caching is skipped and requests still succeed.
- **No remote code.** Manifest V3's CSP forbids CDN scripts, so jsPDF and fflate are vendored into
  `extension/vendor/`.

See [GUIDE.md](GUIDE.md) for the full narrative walkthrough.
