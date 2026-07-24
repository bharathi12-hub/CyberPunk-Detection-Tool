# CyberPunk Detection Tool

An AI-powered browser extension that scans every page you visit for phishing, typosquatting,
crypto-scam content, malicious URLs, trackers, fingerprinting, weak cookies, missing security
headers, risky downloads, QR-code phishing, and data leakage — then combines everything into a
single Website Risk Score, explained in plain English and exportable as a full SOC-style report
(text, PDF, or Word).

---

## 1. Project Structure

```
Browser-Security-Assistant/
├── extension/                  # Chrome Extension (Manifest V3) — fully self-contained
│   ├── manifest.json
│   ├── popup-ui/                 # Toolbar popup: score ring, stat tiles, AI summary
│   ├── options-page/             # Settings: themes, dark/light mode, notifications, retention
│   ├── dashboard/                 # Full-page SOC dashboard: overview, history, reports
│   ├── background-worker/        # Service worker — orchestrates every engine
│   ├── content-scripts/          # DOM scanner, fingerprint probe, QR-code scanner
│   ├── notification-engine/      # Chrome notifications for high-risk events
│   ├── shared/                    # Theme system (5 themes × dark/light) used by all 3 UIs
│   ├── vendor/                    # Locally-vendored jsPDF + fflate (no remote code, CSP-safe)
│   ├── icons/                     # Toolbar icons + in-UI logo (bird mark)
│   ├── engines/                   # Pure-logic scoring engines
│   │   ├── reputation-engine.js
│   │   ├── phishing-engine.js        # homograph + combo-squat detection
│   │   ├── tracker-engine.js
│   │   ├── fingerprint-engine.js
│   │   ├── permission-engine.js
│   │   ├── download-engine.js
│   │   ├── password-engine.js
│   │   ├── cookie-engine.js
│   │   ├── header-engine.js
│   │   ├── form-analysis-engine.js
│   │   ├── crypto-scam-engine.js      # detects crypto-scam phrasing on page
│   │   ├── ml-phishing-engine.js      # composite ML-style risk score from features
│   │   └── risk-engine.js             # combines every signal into the final score
│   ├── intelligence/              # Free-tier threat feeds (client-safe, no secret keys)
│   │   ├── openphish.js
│   │   ├── phishtank.js
│   │   ├── urlhaus.js
│   │   ├── local-cache.js
│   │   └── index.js                   # aggregator, also calls the backend for keyed feeds
│   └── ai/                        # AI explanation + report layer
│       ├── risk-explainer.js          # backend-call w/ 2.5s timeout + instant local fallback
│       ├── phishing-explainer.js      # same pattern, phishing-specific
│       └── report-generator.js        # builds + exports reports (txt/pdf/docx, single or bulk)
│
├── backend/                    # Node.js + Express + PostgreSQL + Redis (separate runtime)
│   ├── api/
│   │   ├── server.js
│   │   ├── routes/                    # scans, ai, intelligence, analytics
│   │   └── controllers/
│   ├── intelligence/
│   │   ├── abuseipdb.js               # secret-key feed — backend-only by design
│   │   ├── safebrowsing.js            # secret-key feed — backend-only by design
│   │   └── virustotal.js              # secret-key feed — backend-only by design
│   ├── postgres/
│   ├── redis/
│   └── .env.example
│
└── docs/
```

> **Why `engines/`, `intelligence/`, `ai/`, `shared/`, and `vendor/` all live inside `extension/`:**
> Chrome only grants a loaded unpacked extension access to files inside the folder you select in
> `chrome://extensions`. The three secret-key-requiring intelligence feeds
> (AbuseIPDB, Safe Browsing, VirusTotal) are the one deliberate exception — they live in
> `backend/intelligence/` and are only ever called from the backend, never shipped to the browser.

---

## 2. What's New From the Original Browser Security Assistant Build

This is a rebrand + feature expansion of the original project, with the following changes:

- **Rebranded** to CyberPunk Detection Tool, with a custom bird-mark logo replacing all prior icons.
- **AI "Ask" feature removed entirely** — `security-advisor.js` and its backend route are gone.
  The popup/dashboard now only surface the automatic risk/phishing explanations.
- **No more blocking "Scanning current page…" spinner** — the popup renders instantly with
  whatever data is available and fills in the rest progressively, with a hard 2.5s timeout on
  every AI explanation call so a slow/offline backend can never visibly hang the UI.
- **5 accent themes × dark/light mode** (10 total combinations), switchable live from Settings
  with no reload needed, shared consistently across popup, dashboard, and options.
- **New SOC-dashboard-style stat cards** with mini sparkline visualizations per metric.
- **Trust Score Trend chart** — a line chart (replacing an earlier bubble-chart "Predictive Model
  Deployment" panel) plotting the last 20 scans' trust scores over time, with color-coded points
  per risk classification and hover tooltips.
- **Scan History**: serial numbers, per-row delete (works against both backend Postgres and local
  per-tab cache), and a search bar.
- **Reports**: export as `.txt`, `.pdf`, or `.docx` (vendored jsPDF + a hand-built minimal DOCX
  writer — both verified to produce real, readable files, not just well-formed-looking output),
  plus a one-click "Export All Reports" bulk action.
- **Search bars** added to the dashboard's top bar (global) and individually to History and Report
  sections (scoped).
- **Settings moved off the dashboard** into its own page, reachable only via a dedicated settings
  button (sidebar corner on the dashboard, floating corner button on the popup) — no more inline
  Settings button next to "Open Dashboard."
- **New engines**: crypto-scam phrase detection, a composite ML-style phishing score, and a
  QR-code-on-page detector (a real "quishing" vector) — all three feed into the final risk score
  and are now also surfaced in exported reports.
- **Phishing engine hardened**: added combo-squat detection (catches domains like
  `paypal-secure-login.com` that contain a full brand name padded with extra text — a pattern the
  original Levenshtein-distance-only check could not catch).

---

## 3. Bug Fixes (Session 2)

Real, root-caused issues found and fixed — documented here so the reasoning isn't lost:

- **"Phishing Risk" tile showed Clean on actually-flagged sites.** The popup's Phishing Risk metric
  only ever read `phishing-engine.js`'s brand-impersonation result, never the threat-feed listing
  (OpenPhish/PhishTank/URLhaus), typosquatting, crypto-scam language, or ML score — all of which
  are separately computed and DO affect the overall Trust Score. A site like a known-malicious
  test URL that doesn't impersonate any specific brand could show 100% clean on this one tile while
  still tanking the overall score. Fixed in `background-worker/index.js`: all phishing-adjacent
  signals are now merged into one `phishing` object before being saved, so every consumer (popup,
  dashboard, reports) sees the complete picture consistently.
- **Domain age stopped showing for most sites after the first session.** Root cause:
  `rdap.org`'s free Cloudflare-fronted endpoint enforces a strict 10-requests-per-10-seconds limit.
  Normal multi-tab browsing blew through that almost immediately with zero caching in place. Fixed
  by caching domain-age lookups per-hostname with a 7-day TTL (registration dates don't change) in
  `engines/reputation-engine.js`, and distinguishing a `rate-limited` result from a genuine
  `unavailable` one so the two aren't conflated.
- **`expandShortUrl` crash risk + unconditional network call.** Every single page load was running
  an extra "expand the URL" network round-trip — even for sites that obviously weren't shortened
  links — and if that fetch succeeded but returned a falsy `response.url` (a real possibility for
  certain opaque cross-origin responses), the next line would throw `Invalid URL` uncaught. Fixed:
  the expansion call only runs when the hostname actually matches a known shortener, and the
  function never returns a falsy value.
- **Tracker counts (and memory usage) grew unbounded across a tab's lifetime.** `requestUrls` was
  never reset between page navigations on the same tab — only when a tab's cache entry was first
  created. This meant tracker counts on page 2 of a session included every tracker from page 1, page
  3 included pages 1+2, and so on, and the array grew without limit on long-lived tabs/SPAs. Fixed
  with a `webNavigation.onCommitted` listener that resets per-page accumulator state at the correct
  moment (before the new page's subresources start loading), plus a defensive 2000-entry cap as a
  backstop against any single pathological page.
- **Hardened the highest-frequency listeners** (`onBeforeRequest`, `onHeadersReceived`, the full
  `onMessage` handler) with try/catch, since these fire on every single network request across every
  page — even a rare malformed input compounds into "something breaks after extended use" given the
  sheer call volume. An uncaught throw in any of these would surface as a logged runtime error on
  the extension's card in `chrome://extensions`.
- **Inconsistent logo across surfaces.** The toolbar/extension-card icon was a simplified two-tone
  cyan silhouette (needed for legibility at 16px) while the popup/dashboard/settings headers used
  the full-color gradient bird. Standardized on the full-color version everywhere per explicit
  request; the 16px toolbar icon is consequently a bit soft, which is the accepted tradeoff for
  full visual consistency.

---

## 4. Bug Fixes (Session 3)

- **"Uncaught Error: Extension context invalidated."** Reproduced directly from a Chrome
  `chrome://extensions` Errors report at `content-scripts/scanner.js:26`. Root cause: when the
  extension is reloaded/updated while a tab that already has this content script injected stays
  open, Chrome destroys the old extension context, but the content script keeps running in that
  page until it's refreshed. Any `chrome.runtime.sendMessage` call made after that point throws
  this error as an UNCAUGHT exception. Fixed by routing every messaging call in `scanner.js` and
  `qr-scanner.js` through a `safeSendMessage()` helper that checks `chrome.runtime?.id` first and
  wraps the call in try/catch as a second layer, so it's a silent no-op afterward instead of an
  uncaught error.
- **Removed a duplicate, broken QR-detection function.** While fixing the above, found
  `scanQrImages()` inside `scanner.js` — dead code (never called from anywhere except itself) that
  called itself recursively as its first statement with no base case, an instant stack-overflow
  crash risk if anyone ever wired it up. The correct, working QR detector already exists as its
  own content script (`qr-scanner.js`, registered separately in the manifest) — the broken
  duplicate has been removed entirely.
- **PDF export reliability.** `exportAsPdf` relied on jsPDF's built-in `.save()`, which contains
  legacy-browser fallback logic (including a `window.open()` path that real browsers' popup
  blockers can silently kill). Replaced with an explicit `output('blob')` + manual
  `URL.createObjectURL` + anchor-click download — the same predictable pattern `exportAsDocx`
  already used — removing the dependency on jsPDF's internal browser-detection branching. Both
  export buttons also now surface visible error feedback (a disabled "Exporting…" state, and an
  alert with the actual error message on failure) instead of failing silently.

---

## 5. Changes (Session 4)

- **Disclaimer text updated everywhere** a score appears (popup, dashboard stat card, trend chart,
  About section, every exported report) to the exact wording: "The Score is only for Reference not
  a Guarantee."
- **Fixed a real sticky-topbar overlap bug**, reproduced and confirmed via screenshots showing the
  Overview stat cards and About section's text visibly rendering behind/through the sticky
  "Dashboard" tab bar while scrolled. Root cause: `.main`'s `22px` top padding sat *above* the
  sticky topbar in the document flow, creating a strip of the scroll container that the topbar's
  `position: sticky; top: 0` couldn't cover as content scrolled underneath it — a classic
  sticky-inside-a-padded-scroll-container bug. Fixed by moving that spacing into the topbar's own
  padding instead, so its background fully covers the scrolled area. Verified by rendering the
  actual production `dashboard.html`/`dashboard.css` in a headless browser and screenshotting both
  the unscrolled and scrolled state — confirmed the overlap is gone and there's no regression to
  the initial layout.
- **Removed the Server Location (IP geolocation) feature** added in Session 3 — popup card,
  dashboard history column, report section, the backend's `/api/intelligence/location/:hostname`
  route and `geolocation.js` module, and `background-worker`'s async fetch/patch logic. Removed
  per explicit request; see Session 3's notes above (now historical) for what it did when present.
- **Found and fixed the actual PDF/DOCX export bug** (Session 3's fix above was a real
  improvement but didn't address the root cause, since it was diagnosed purely in Node, which
  resolves Node-style module specifiers that real browsers cannot). Rendered the actual production
  `dashboard.html` in a real headless browser via Playwright, injected fake scan data, and clicked
  the real Export .pdf / .docx buttons to capture the real error:
  `TypeError: Failed to resolve module specifier "module"`. Root cause: the vendored
  `fflate.esm.js` had `import { createRequire } from 'module'` at its top level — Node's built-in
  `module`, used only to support an optional Worker-thread acceleration path, which doesn't exist
  in any browser. Since `jspdf.es.min.js` *also* imports `fflate.esm.js` for its own zlib needs,
  this single bad import broke both PDF and DOCX export simultaneously — both formats failed with
  the identical error, exactly as reported. Fixed by removing the Node-only import; the file's own
  existing `try/catch` around the worker-thread `require()` call already handles the resulting
  `undefined` gracefully, falling back to fflate's non-worker code path (the only one this project
  uses). Re-ran the same real-browser test after the fix: both PDF and DOCX now download
  successfully, and the downloaded files were independently validated (`pypdf`, `python-docx`) to
  contain correct content. Also swept every vendored file for the same bug class (bare,
  non-relative import specifiers) — found three more in jsPDF (`html2canvas`, `dompurify`,
  `canvg`), but confirmed those are wrapped in feature-gated dynamic `import()` calls for jsPDF's
  HTML-rendering method, which this project never calls, so they're inert and not a risk.

---

## 6. Changes (Session 5)

- **"Export All Reports" now offers a format choice.** Previously it downloaded a combined
  `.txt` of every scan's report unconditionally. Clicking it now opens a small dropdown menu
  (positioned under the button, closes on an outside click) offering .txt / .pdf / .docx for the
  combined report — reusing the same `exportAsPdf`/`exportAsDocx` functions as the single-report
  export buttons, so the combined report gets the same pagination, styling, and disclaimer text.
  Verified in a real rendered browser: the menu opens and closes correctly, and all three formats
  were downloaded and independently validated (`pypdf`, `python-docx`) to contain every scan in
  the batch, including a HIGH RISK example, across multiple pages where the content required it.
- **Added a "Delete All" option to Scan History.** A red ghost button in the panel header (top
  right, next to the title) deletes every scan currently visible in the table — which respects an
  active search filter, so typing a query and clicking "Delete All" only clears the matching
  subset, not the entire history. Confirms first (the message text differs depending on whether a
  filter is active, e.g. "Delete 3 scan(s) matching your current search?" vs "Delete all 12
  scan(s) from history?"), then deletes every targeted scan in parallel — correctly routing each
  through local `chrome.storage.local` removal or a backend `DELETE /api/scans/:id` call depending
  on where that particular scan is persisted, same as the existing per-row delete — and refreshes
  every dependent view (Overview stats, donut, top hosts, trend chart, report dropdown) once at the
  end. Verified in a real rendered browser with a mix of scans: confirmed the dialog text is
  correct in both the filtered and unfiltered case, the underlying storage is genuinely emptied
  (not just hidden in the UI), and a non-matching scan survives a filtered delete-all untouched.

---

## 7. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 18+ (tested on 22) | Backend server, ES modules |
| Google Chrome | Latest | Loads the Manifest V3 extension (`color-mix()` CSS requires Chrome 111+, which any current Chrome satisfies) |
| PostgreSQL | 14+ | Scan history storage |
| Redis | 6+ | Server-side caching (IP reputation, Safe Browsing, VirusTotal) |

No API keys are required for a working MVP. OpenPhish, PhishTank, URLhaus, and the
HaveIBeenPwned password-breach check are all free and keyless. Optional keys unlock more:
- **Anthropic API key** — AI explanations (falls back to instant local rule-based summaries if absent)
- **AbuseIPDB**, **Google Safe Browsing**, **VirusTotal** — each optional, each degrades gracefully
  to `no_api_key_configured` if not set, never blocking the rest of the app

---

## 8. Backend Setup

### 8.1 Install dependencies

```bash
cd Browser-Security-Assistant/backend
npm install
```

### 8.2 Set up PostgreSQL

```bash
psql -U postgres -c "CREATE USER bsa_user WITH PASSWORD 'bsa_password';"
psql -U postgres -c "CREATE DATABASE browser_security_assistant OWNER bsa_user;"
```

### 8.3 Set up Redis

```bash
# macOS (Homebrew)
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt install redis-server && sudo systemctl start redis-server

# Or via Docker (works anywhere)
docker run -d -p 6379:6379 --name bsa-redis redis:7
```

### 8.4 Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:
```ini
PORT=3000
DATABASE_URL=postgresql://bsa_user:bsa_password@localhost:5432/browser_security_assistant
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=                  # optional — leave blank to use local-fallback explanations
ABUSEIPDB_API_KEY=                  # optional — free key from https://www.abuseipdb.com/register
SAFE_BROWSING_API_KEY=              # optional — free key via Google Cloud Console
VIRUSTOTAL_API_KEY=                 # optional — free tier: 4 req/min, 500/day
PHISHTANK_API_KEY=                  # optional
ALLOWED_ORIGIN=*
```

### 8.5 Run the database migration

```bash
npm run migrate
```

### 8.6 Start the backend

```bash
npm start        # or: npm run dev (auto-reload)
```

You should see: `⚡ CyberPunk Detection Tool backend running on http://localhost:3000`

Verify it's alive: `curl http://localhost:3000/health` → `{"status":"ok"}`

---

## 9. Load the Extension in Chrome

1. Open `chrome://extensions`, toggle **Developer mode** on
2. Click **Load unpacked**
3. Select the **`Browser-Security-Assistant/extension`** folder specifically — the one that
   directly contains `manifest.json`. Selecting the outer project folder will fail with
   "Manifest file is missing or unreadable."
4. The bird-mark icon should appear in your toolbar

Reload the extension (circular arrow on its card in `chrome://extensions`) after editing any file
under `extension/` — Chrome caches loaded extension code.

### Test it
1. Make sure the backend is running
2. Visit any HTTPS site
3. Click the toolbar icon — the score ring, stat tiles, and AI summary render immediately
4. Click the gear icon (bottom-left of the popup) to open Settings — try switching themes and
   dark/light mode; both should apply instantly across popup, dashboard, and the settings page itself
5. Open the dashboard (button in the popup) to see Overview, Scan History (with delete + search),
   and the Report view (try all three export formats, plus "Export All Reports")

---

## 10. API Routes Reference

```
POST   /api/scans                 store a new scan
GET    /api/scans/history         retrieve scan history (includes _id for delete support)
DELETE /api/scans/:id              delete an individual scan record
POST   /api/scans/retention        delete scans older than N days (history-retention setting)
POST   /api/ai/explain-risk        AI risk explanation (Anthropic-backed, optional)
POST   /api/ai/explain-phishing    AI phishing explanation (Anthropic-backed, optional)
GET    /api/intelligence/ip/:ip    AbuseIPDB IP reputation (optional key)
POST   /api/intelligence/url       Safe Browsing + VirusTotal URL check (optional keys)
GET    /api/analytics/summary      aggregate threat statistics
```

---

## 11. What Works Out of the Box (No Keys Needed)

| Feature | Status |
|---|---|
| HTTPS, domain age, homograph + combo-squat detection | ✅ Works immediately |
| OpenPhish / PhishTank / URLhaus feeds | ✅ Free, no key |
| Tracker, fingerprint, cookie, header, form, download checks | ✅ Works immediately |
| Crypto-scam phrase detection, ML-style risk score, QR-code detection | ✅ Works immediately |
| Password breach check (HaveIBeenPwned, k-anonymity) | ✅ Free, no key |
| 5 themes + dark/light mode | ✅ Works immediately |
| Report export (txt/pdf/docx, single + bulk) | ✅ Works immediately, fully client-side |
| Scan history search, serial numbers, delete | ✅ Works immediately |
| AI explanations | ⚠️ Needs `ANTHROPIC_API_KEY` — instant local-fallback text if missing |
| AbuseIPDB / Safe Browsing / VirusTotal | ⚠️ Each needs its own optional free key |
### Settings that are saved but not yet behaviorally wired
Two settings persist your preference but don't yet change behavior — flagged honestly rather than
faked: **Auto-block known trackers** (needs a `declarativeNetRequest` rule set — see
`docs/upgrades.md` item #1) and **Risk sensitivity** (needs `risk-engine.js` threshold tuning).
Every other setting — auto-scan, all notification toggles, history retention, default export
format, theme, and mode — is fully wired to real behavior.

---

## 12. Architecture Notes

**Settings location:** Settings live only in `options-page/`, reachable via the "Settings" entry
pinned to the bottom of the dashboard's sidebar — there is no settings affordance in the popup
itself. To reach Settings: open the Dashboard (button in the popup), then click Settings in the
sidebar's bottom-left corner. The Settings page itself has a back button (top-left) that closes
the tab, since `chrome.runtime.openOptionsPage()` opens a fresh tab with no navigation history to
return to.

**Typography:** All three surfaces use `Angsana New` as the primary font (via the `--font-sans`/
`--font-mono` variables in `extension/shared/themes.css`), with `Inter`/`JetBrains Mono` and
system sans-serif/monospace as fallbacks. Angsana New is a Windows-bundled font and is not
available as a web font — on macOS, Linux, ChromeOS, or any system without it installed, the UI
gracefully falls back to the next font in the stack rather than breaking.

**Theme system:** `extension/shared/themes.css` defines 10 CSS-variable blocks
(`body[data-theme="X"][data-mode="Y"]`). `extension/shared/theme-loader.js` reads the saved
theme/mode from `chrome.storage.local` and applies the `data-theme`/`data-mode` attributes on
`<body>` before paint, and listens for `chrome.storage.onChanged` so a theme switch in Settings
propagates live to any already-open popup or dashboard without a reload.

**Why a vendored PDF/DOCX library instead of a CDN:** Manifest V3's default Content Security
Policy disallows remote code execution — no CDN `<script>` tags, no `eval`. `extension/vendor/`
contains a locally-bundled `jspdf.es.min.js` (ES module build) and `fflate.esm.js` (a small,
dependency-free DEFLATE/zip library), both verified to contain no `eval`/`new Function` in any
code path this project calls. `docx-builder.js` hand-assembles a minimal valid Word document
(the required OOXML parts: `[Content_Types].xml`, relationships, `document.xml`, `styles.xml`)
and zips them with `fflate`'s `zipSync` — verified to open correctly in `python-docx` and produce
correctly-styled headings/bullets/paragraphs.

**Key security principle:** the Anthropic key and the optional threat-feed keys
(AbuseIPDB, Safe Browsing, VirusTotal) live only in `backend/.env`, never in extension code.
The extension calls its own backend; the backend calls the third-party APIs.

**Dashboard layout:** the sidebar is pinned at a fixed `100vh` height and never scrolls with the
page; only the main content area (`.main`) scrolls independently, with the top bar (Dashboard tab
+ global search) sticky within it so it stays visible while scrolling through long content. The
global search bar is hidden specifically on the Report view, since that view has its own
purpose-scoped "Search reports by host…" input.

**About section:** a dedicated `About` entry in the dashboard sidebar explains what the tool scans
for, how the scan pipeline works end-to-end, how to operate it, and is explicit about current
limitations (the two not-yet-wired settings, and the inherent limits of name-based
brand-impersonation detection) rather than overstating what it does.

---

## 13. Project Commands Reference

```bash
# Backend
cd backend
npm install          # install dependencies
npm run migrate       # create/update Postgres schema
npm start             # run the server
npm run dev           # run with auto-reload

# Extension
# No build step — plain JS/HTML/CSS loaded directly via "Load unpacked"
```

See `docs/upgrades.md` for the detailed roadmap (tracker blocking, real SSL cert inspection,
password manager integration, a trained risk-scoring model, live WebSocket dashboard updates,
and team/enterprise mode).
