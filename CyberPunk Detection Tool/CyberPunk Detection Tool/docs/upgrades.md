# Suggested Upgrades & New Features

Detailed expansion of the roadmap mentioned in the main README. Each item includes why it
matters, roughly how hard it is, and where in the existing codebase it would plug in.

---

## 1. Active Tracker Blocking (not just detection)

**Why:** Right now `tracker-engine.js` only *reports* trackers found via `webRequest.onBeforeRequest`.
A real privacy tool should optionally block them.

**How:** Use Manifest V3's `declarativeNetRequest` API with static or dynamic rules.

Add to `manifest.json`:
```json
"permissions": ["declarativeNetRequest", "declarativeNetRequestFeedback"]
```

Create `extension/engines/tracker-blocklist.json` (DNR rule format):
```json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": { "urlFilter": "||google-analytics.com", "resourceTypes": ["script", "xmlhttprequest"] }
  }
]
```

Register it in manifest:
```json
"declarative_net_request": {
  "rule_resources": [{ "id": "tracker_rules", "enabled": false, "path": "engines/tracker-blocklist.json" }]
}
```

Toggle `enabled: true/false` at runtime from `options.js` based on the "Auto-block known trackers" setting.

---

## 2. Real SSL Certificate Inspection

**Why:** `reputation-engine.js` currently only checks `https://` prefix, not certificate validity,
issuer, or expiry — a self-signed or expired cert looks identical to a valid one right now.

**How:** Chrome extensions can't directly read TLS certificate details via JS. Options:
- Use `chrome.webRequest.onHeadersReceived` with `securityInfo` (Chrome 117+, behind a flag in some channels) — check availability before relying on it.
- Simpler, immediate alternative: call a free backend service like `https://api.ssllabs.com/api/v3/analyze` from the backend (not extension) to grade the cert server-side, cache results in Redis.

**Where it plugs in:** new field in `reputation-engine.js`'s output, scored in `risk-engine.js`.

---

## 3. Password Manager Integration

**Why:** `password-engine.js` already does strength scoring + HaveIBeenPwned breach checks — but
nothing in the extension surfaces this to the user yet.

**How:**
- Content script detects `<input type="password">` on focus
- Sends value (in-memory only, never logged/stored) to `password-engine.analyzePassword()`
- Show inline strength meter + breach warning as a tooltip near the field
- **Critical:** never send the raw password to your backend or Postgres — keep this 100% client-side using the k-anonymity HIBP call, exactly as `password-engine.js` already does

---

## 4. Team / Enterprise Mode

**Why:** The `user_preferences` table already has a `client_id` column ready for this.

**How:**
- Add a `team_id` column to `user_preferences` and `scans`
- Add JWT-based auth middleware in `backend/api/middleware/auth.js`
- New dashboard view: "Team Risk Overview" aggregating `threat_statistics` across all team members' `client_id`s

---

## 5. VirusTotal as a 4th Threat Feed

**Why:** Broader coverage than OpenPhish/PhishTank/URLhaus alone. Free tier: 4 requests/min, 500/day.

**How:** Create `intelligence/virustotal.js` mirroring `urlhaus.js`'s shape:
```js
const VT_ENDPOINT = 'https://www.virustotal.com/api/v3/urls';
// POST the URL to get an analysis ID, then GET the report
// Requires VIRUSTOTAL_API_KEY — backend-only, like AbuseIPDB
```
Add it to `intelligence/index.js`'s `Promise.all` alongside the existing three. Given the strict
rate limit, route it through the backend + Redis cache (6h+ TTL) rather than calling it directly
from the extension.

---

## 6. "Scan This Link" Context Menu

**Why:** Right now scanning only happens on full page navigation. Users often want to vet a link
*before* clicking it (e.g. in an email or chat).

**How:** Add to `manifest.json`:
```json
"permissions": ["contextMenus"]
```
In `background-worker/index.js`:
```js
chrome.contextMenus.create({
  id: 'scan-link',
  title: 'Scan this link with CyberPunk Detection Tool',
  contexts: ['link'],
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'scan-link') {
    const result = await runFullScan(null, info.linkUrl); // tabId null = standalone scan
    // show result in a popup notification or small overlay
  }
});
```

---

## 7. Trained Risk-Scoring Model

**Why:** `risk-engine.js` currently uses hand-tuned weights (25/25/10/10/10/10/10). Once you have
real scan data accumulating in the `scans` table, you can train a model that learns better weights
or even flags combinations humans wouldn't think to hand-code.

**How (incremental, no need to rip out the existing engine):**
1. Export `raw_scan` JSONB rows from Postgres as a labeled dataset (label = whether the site was
   later confirmed phishing/malicious, e.g. via manual review or a "report this site" button you add)
2. Train a simple logistic regression or gradient-boosted tree (Python, scikit-learn) offline
3. Export learned weights and swap them into `WEIGHTS` in `risk-engine.js`, or run inference via
   a small backend endpoint `/api/ai/score` that `risk-engine.js` calls as an optional override

---

## 8. Real-Time Dashboard via WebSockets

**Why:** The dashboard currently polls the backend once on load. For a "live SOC view" feel
(relevant to your Blue Team / SOC analyst interests), push updates as scans happen.

**How:**
- Add `ws` package to backend, create a WebSocket server alongside Express in `server.js`
- In `scansController.js`'s `storeScan`, broadcast the new scan to connected WebSocket clients
- In `dashboard.js`, open a WebSocket connection and prepend new scans to the history table live

---

## Suggested Priority Order (if building incrementally)

1. Tracker blocking (#1) — quick win, high visible value
2. Scan-this-link context menu (#6) — quick win, very usable
3. Password manager integration (#3) — ties directly into existing `password-engine.js`
4. VirusTotal feed (#5) — broadens detection coverage
5. SSL certificate inspection (#2) — closes a real gap in reputation scoring
6. WebSocket live dashboard (#8) — polish
7. Team mode (#4) and trained model (#7) — larger, longer-term efforts
