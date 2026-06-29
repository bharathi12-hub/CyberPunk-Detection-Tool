/**
 * Background Worker (Manifest V3 service worker)
 * The orchestrator: listens for navigation/network/cookie/download/permission
 * events, runs every engine, combines results via the risk engine, caches the
 * scan per-tab, and triggers notifications for high-risk findings.
 */

import { analyzeReputation } from '../engines/reputation-engine.js';
import { analyzePhishing } from '../engines/phishing-engine.js';
import { analyzeTrackers, classifyRequest } from '../engines/tracker-engine.js';
import { detectTyposquatting } from "../engines/phishing-engine.js";
import { detectCryptoScam } from "../engines/crypto-scam-engine.js";
import { calculateMLScore } from "../engines/ml-phishing-engine.js";
import { analyzeFingerprinting } from '../engines/fingerprint-engine.js';
import { analyzeHeaders } from '../engines/header-engine.js';
import { analyzeCookies } from '../engines/cookie-engine.js';
import { analyzePermissionRequest } from '../engines/permission-engine.js';
import { analyzeDownload } from '../engines/download-engine.js';
import { analyzeForms } from '../engines/form-analysis-engine.js';
import { calculateRiskScore } from '../engines/risk-engine.js';
import { notifyHighRisk, notifyDownloadRisk, notifyPermissionAbuse } from '../notification-engine/index.js';

// ---------------------------------------------------------------------------
// Settings cache — read once, kept in sync via storage.onChanged so the
// background worker never needs to await chrome.storage on every hot path.
// ---------------------------------------------------------------------------
const SETTINGS_DEFAULTS = {
  autoScan: true,
  notifyHighRisk: true,
  notifyDownloads: true,
  notifyPermissions: true,
};
let cachedSettings = { ...SETTINGS_DEFAULTS };

chrome.storage.local.get('bsa_settings').then(({ bsa_settings }) => {
  cachedSettings = { ...SETTINGS_DEFAULTS, ...(bsa_settings || {}) };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.bsa_settings) {
    cachedSettings = { ...SETTINGS_DEFAULTS, ...(changes.bsa_settings.newValue || {}) };
  }
});

// In-memory per-tab state. Service workers can be evicted/restarted by Chrome,
// so this is a performance cache only — nothing critical is stored here long-term.
const tabScans = new Map(); // tabId -> { requestUrls: [], headers: {}, scan: {...} }

function getTabState(tabId) {
  if (!tabScans.has(tabId)) {
    tabScans.set(tabId, { requestUrls: [], headers: null, downloads: [], permissions: [] });
  }
  return tabScans.get(tabId);
}

// ---------------------------------------------------------------------------
// 1. Track all outgoing requests per tab (for tracker-engine)
// ---------------------------------------------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (details.tabId < 0) return;
      const state = getTabState(details.tabId);
      const MAX_TRACKED_REQUESTS = 2000; // defensive cap — a single pathological page (e.g. infinite scroll) shouldn't grow this unbounded
      if (state.requestUrls.length < MAX_TRACKED_REQUESTS) {
        state.requestUrls.push(details.url);
      }
    } catch (err) {
      console.error('[Background Worker] onBeforeRequest error:', err);
    }
  },
  { urls: ['<all_urls>'] }
);

// ---------------------------------------------------------------------------
// 2. Capture response headers for the main frame (for header-engine)
// ---------------------------------------------------------------------------
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    try {
      if (details.type !== 'main_frame') return;
      const state = getTabState(details.tabId);
      const headerObj = {};
      (details.responseHeaders || []).forEach((h) => {
        if (!h?.name) return; // skip malformed header entries instead of throwing
        headerObj[h.name.toLowerCase()] = h.value;
      });
      state.headers = headerObj;
    } catch (err) {
      console.error('[Background Worker] onHeadersReceived error:', err);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// ---------------------------------------------------------------------------
// 2.5. Reset per-page accumulator state when a NEW navigation is confirmed
// (not when it completes — onCommitted fires before the new page's
// subresources start loading, which is the correct point to clear state from
// the previous page). Without this, requestUrls/headers accumulated forever
// across every page ever visited in a tab's lifetime: tracker counts grew
// unbounded and reflected stale pages, not just the current one, and memory
// usage grew without limit on long-lived tabs/SPAs.
// ---------------------------------------------------------------------------
chrome.webNavigation.onCommitted.addListener((details) => {
  try {
    if (details.frameId !== 0) return; // main frame only
    const state = getTabState(details.tabId);
    state.requestUrls = [];
    state.headers = null;
  } catch (err) {
    console.error('[Background Worker] onCommitted error:', err);
  }
});

// ---------------------------------------------------------------------------
// 3. On navigation complete, run the full engine pipeline for that tab
// ---------------------------------------------------------------------------
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  if (!cachedSettings.autoScan) return; // user disabled auto-scan-on-navigation
  const { tabId, url } = details;
  if (!url.startsWith('http')) return; // skip chrome://, about:, etc.

  await runFullScan(tabId, url);
});

async function runFullScan(tabId, url) {
  const state = getTabState(tabId);
  state.qrDetected = false; // reset per-navigation flags so stale signals from the previous page don't leak in
  const hostname = new URL(url).hostname;

  try {
    const [reputation, cookieList] = await Promise.all([
      analyzeReputation(url),
      chrome.cookies.getAll({ domain: hostname }),
    ]);

    const phishing = analyzePhishing(url);
    const tracker = analyzeTrackers(state.requestUrls);
    const headers = analyzeHeaders(state.headers || {});
    const cookies = analyzeCookies(cookieList);
    const typoResults = detectTyposquatting(hostname);
    const cryptoResults = state.lastPageText
      ? detectCryptoScam(state.lastPageText)
      : [];

const features = {
  ipAddress: false,
  shortener: false,
  loginForm: false,
  youngDomain: false,
  typosquatting: typoResults.length > 0
};

const mlScore = calculateMLScore(features);

// "Phishing Risk" as shown in the UI should reflect EVERY phishing-adjacent
// signal we have — brand-impersonation/combo-squat (phishing-engine),
// threat-feed listing (OpenPhish/PhishTank/URLhaus, surfaced via
// reputation.threatFeedClean), typosquatting, crypto-scam language, and the
// composite ML score — not just the brand-impersonation check in isolation.
// Without this merge, a site correctly flagged by a threat feed (e.g.
// testsafebrowsing.appspot.com) showed "Phishing Risk: Clean" simply because
// its domain doesn't impersonate any brand in our hardcoded list.
const phishingReasons = [...phishing.reasons];
let phishingConfidence = phishing.confidence;

if (!reputation.threatFeedClean) {
  phishingConfidence = Math.max(phishingConfidence, 90);
  phishingReasons.push(`URL is listed on a known threat feed (${reputation.threatFeedSources.join(', ')})`);
}
if (typoResults.length > 0) {
  phishingConfidence = Math.max(phishingConfidence, 70);
  typoResults.forEach((t) => phishingReasons.push(t.issue));
}
if (cryptoResults.length > 0) {
  phishingConfidence = Math.max(phishingConfidence, 60);
  phishingReasons.push(`Crypto-scam language detected on page: ${cryptoResults.join(', ')}`);
}
if (mlScore >= 60) {
  phishingConfidence = Math.max(phishingConfidence, mlScore);
  phishingReasons.push(`Composite ML risk score elevated (${mlScore}/100)`);
}

phishing.confidence = phishingConfidence;
phishing.isPotentialPhishing = phishingConfidence >= 50;
phishing.reasons = phishingReasons;

 const risk = calculateRiskScore({
  reputation,
  phishing,
  tracker,
  headers,
  cookies,
  permissions: state.permissions,
  downloads: state.downloads,

  typoResults,
  cryptoResults,
  mlScore,
  qrDetected: state.qrDetected || false,

  fingerprint: state.fingerprint,
  forms: state.forms
});

    const scan = {
      url, hostname, reputation, phishing, tracker, headers, cookies, risk,
      typoResults, cryptoResults, mlScore,
      qrDetected: state.qrDetected || false,
      scannedAt: Date.now(),
    };
    state.scan = scan;
    tabScans.set(tabId, state);

    await chrome.storage.local.set({
  [`lastScan_${tabId}`]: scan
});

    // Badge: color-coded risk indicator on the toolbar icon
    updateBadge(tabId, risk);

    if (risk.classification === 'HIGH RISK' && cachedSettings.notifyHighRisk) {
      notifyHighRisk(hostname, risk);
    }

    // Send to backend analytics (best-effort, non-blocking)
    reportScanToBackend(scan).catch(() => {});
  } catch (err) {
    console.error('[Background Worker] Scan failed:', err);
  }
}

function updateBadge(tabId, risk) {
  const colorMap = { 'LOW RISK': '#2ecc71', 'MEDIUM RISK': '#f39c12', 'HIGH RISK': '#e74c3c' };
  chrome.action.setBadgeText({ tabId, text: String(risk.finalScore) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: colorMap[risk.classification] || '#999' });
}

async function reportScanToBackend(scan) {
  await fetch('http://localhost:3000/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scan),
  });
}

// ---------------------------------------------------------------------------
// 4. Downloads — flag dangerous file types
// ---------------------------------------------------------------------------
chrome.downloads.onCreated.addListener((downloadItem) => {
  const result = analyzeDownload({
    filename: downloadItem.filename,
    url: downloadItem.url,
    fileSize: downloadItem.fileSize,
    mimeType: downloadItem.mime,
  });

  if (result.isHighRisk && cachedSettings.notifyDownloads) {
    notifyDownloadRisk(result);
    // Optional: chrome.downloads.cancel(downloadItem.id) for auto-block; left
    // as a notify-only default so users aren't surprised by silently blocked files.
  }
});

// ---------------------------------------------------------------------------
// 5. Permissions — chrome.permissions only covers *extension* permission
// grants. Per-site Camera/Mic/Geo prompts are surfaced to us via messages
// from content-scripts/scanner.js, which hooks navigator.permissions.
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    return handleRuntimeMessage(message, sender, sendResponse);
  } catch (err) {
    console.error('[Background Worker] Unhandled error in onMessage listener:', err);
    try { sendResponse(null); } catch { /* response channel may already be closed */ }
    return true;
  }
});

function handleRuntimeMessage(message, sender, sendResponse) {

  if (message.type === 'GET_CURRENT_SCAN') {

    chrome.tabs.query(
      {
        active: true,
        currentWindow: true
      },
      (tabs) => {

        const activeTabId = tabs[0]?.id;

        if (!activeTabId) {
          sendResponse(null);
          return;
        }

        const state = tabScans.get(activeTabId);

        if (state && state.scan) {
          sendResponse(state.scan);
          return;
        }

        chrome.storage.local.get(
          ['lastScan_' + activeTabId],
          function(result) {

            const scan =
              result['lastScan_' + activeTabId];

            sendResponse(scan || null);
          }
        );
      }
    );

    return true;
  }

  const tabId = sender.tab?.id;

  if (!tabId) {
    sendResponse(null);
    return true;
  }

  const state = getTabState(tabId);

  switch (message.type) {

    case 'QR_FOUND': {

  state.qrDetected = true;

  if (state.scan) {

    state.scan.qrDetected = true;

  }

  sendResponse({
    detected:true
  });

  break;
}

    case 'PERMISSION_REQUEST': {

      const origin =
        new URL(sender.tab.url).origin;

      const result =
        analyzePermissionRequest(
          origin,
          message.permission
        );

      state.permissions.push(result);

      if (result.repeatedAsk && cachedSettings.notifyPermissions) {
        notifyPermissionAbuse(result);
      }

      sendResponse(result);
      break;
    }

    case 'FINGERPRINT_EVENT': {

      const result =
        analyzeFingerprinting(
          message.probeEvents
        );

      state.fingerprint = result;

      if (state.scan) {
        state.scan.fingerprint = result;
      }

      sendResponse(result);
      break;
    }

    case 'FORM_SCAN': {

      const result =
        analyzeForms(
          message.forms,
          message.pageText
        );

      state.forms = result;
      state.lastPageText = message.pageText || '';

      if (state.scan) {
        state.scan.forms = result;
      }

      sendResponse(result);
      break;
    }

    default:
      sendResponse(null);
      break;
  }

  return true;
}

// ---------------------------------------------------------------------------
// 6. History retention — daily alarm enforces the user's configured
// retention window (set in options-page) by asking the backend to delete
// scans older than N days. retentionDays === '0' means "keep forever",
// in which case we simply don't call the endpoint.
// ---------------------------------------------------------------------------
const RETENTION_ALARM_NAME = 'bsa-history-retention';

chrome.alarms.create(RETENTION_ALARM_NAME, { periodInMinutes: 60 * 24 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RETENTION_ALARM_NAME) return;

  const { bsa_settings } = await chrome.storage.local.get('bsa_settings');
  const retentionDays = parseInt(bsa_settings?.historyRetention, 10);
  if (!retentionDays || retentionDays <= 0) return; // "keep forever" or unset

  const backendUrl = bsa_settings?.backendUrl || 'http://localhost:3000';
  try {
    await fetch(`${backendUrl}/api/scans/retention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays }),
    });
  } catch {
    // backend offline — retention simply doesn't run this cycle, tried again
    // automatically on the next daily alarm
  }
});