# Chrome Extension

A **Manifest V3** extension. There is no build step — plain JS/HTML/CSS loaded directly via
**Load unpacked**.

## Loading it

1. Open `chrome://extensions` and enable **Developer mode**
2. Click **Load unpacked**
3. Select the **`extension/`** folder — the one that directly contains `manifest.json`.
   Selecting the repository root will fail with *"Manifest file is missing or unreadable."*

Reload the extension (circular arrow on its card) after editing any file under `extension/` —
Chrome caches loaded extension code.

## Structure

| Folder | Purpose |
| --- | --- |
| `popup-ui/` | Toolbar popup: score ring, stat tiles, AI summary |
| `dashboard/` | Full-page dashboard: overview, history, reports |
| `options-page/` | Settings: themes, mode, notifications, retention |
| `background-worker/` | Service worker — orchestrates every engine |
| `content-scripts/` | DOM scanner, fingerprint probe, QR scanner |
| `engines/` | Pure scoring engines ([details](DETECTION-ENGINES.md)) |
| `intelligence/` | Keyless threat feeds + local cache |
| `ai/` | Explanations + report generation/export |
| `notification-engine/` | Chrome notifications for high-risk events |
| `shared/` | Theme system shared by all three UIs |
| `vendor/` | Locally vendored jsPDF + fflate (CSP-safe) |
| `icons/` | Toolbar icons and in-UI logo |

## Permissions

Declared in `manifest.json`:

`activeTab` · `tabs` · `webRequest` · `webNavigation` · `cookies` · `downloads` · `storage` ·
`notifications` · `scripting` · `alarms`, plus `host_permissions: ["<all_urls>"]`.

`<all_urls>` is required because the tool analyzes whichever page you are currently on. What that
access is used for — and what is never collected — is documented in [`../PRIVACY.md`](../PRIVACY.md).

## Content scripts

| Script | Runs at | World |
| --- | --- | --- |
| `scanner.js`, `qr-scanner.js` | `document_idle` | Isolated |
| `fingerprint-probe.js` | `document_start` | `MAIN` |

The probe runs in the MAIN world at `document_start` so it can observe fingerprinting API access
before page scripts execute.

## Theming

`shared/themes.css` defines 5 accent themes × dark/light (10 combinations) as CSS-variable blocks.
`shared/theme-loader.js` applies the saved theme before paint and listens for
`chrome.storage.onChanged`, so switching themes in Settings propagates live to any open popup or
dashboard without a reload.

## Why libraries are vendored

Manifest V3's default Content Security Policy disallows remote code — no CDN `<script>` tags, no
`eval`. `vendor/` therefore contains local ES-module builds of jsPDF and fflate, and
`vendor/docx-builder.js` hand-assembles a minimal valid OOXML document zipped with fflate.

## Working without the backend

The extension is fully functional standalone: all engines, keyless feeds, scoring, theming, and
report export work with no server. The backend only adds persistent history, aggregate analytics,
AI explanations, and the key-gated feeds.
