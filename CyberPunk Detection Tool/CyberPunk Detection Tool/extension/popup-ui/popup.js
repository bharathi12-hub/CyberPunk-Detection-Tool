/**
 * Popup UI Logic
 * Renders instantly — no blocking "Scanning current page..." spinner state.
 * If a scan already exists for the tab, it renders immediately. If not yet
 * available (e.g. page just navigated and background-worker is still
 * running the async reputation/domain-age lookups), it shows a lightweight
 * "Scanning…" label inline on the classification line and polls briefly
 * in the background, updating in place the moment data arrives — never
 * blocking the rest of the UI from being visible and interactive.
 */

import { explainRisk } from '../ai/risk-explainer.js';
import { applyTheme, watchThemeChanges } from '../shared/theme-loader.js';

const $ = (id) => document.getElementById(id);
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // matches r=52 in popup.html's SVG
const POLL_INTERVAL_MS = 600;
const POLL_TIMEOUT_MS = 6000;

function colorFor(classification) {
  if (classification === 'LOW RISK') return 'var(--low)';
  if (classification === 'MEDIUM RISK') return 'var(--medium)';
  return 'var(--high)';
}

function render(scan) {
  $('error').classList.add('hidden');
  $('content').classList.remove('hidden');

  const score = scan.risk.finalScore;
  const ring = $('ring-progress');
  const offset = RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE;

  ring.style.stroke = colorFor(scan.risk.classification);
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = offset;
  });

  $('score-value').textContent = score;
  $('classification').textContent = scan.risk.classification;
  $('classification').style.color = colorFor(scan.risk.classification);
  $('hostname').textContent = scan.hostname;

  $('metric-https').textContent = scan.reputation.https ? 'Enabled' : 'Disabled';
  $('metric-age').textContent = scan.reputation.domainAge !== null ? `${scan.reputation.domainAge} yrs` : 'Unknown';
  $('metric-phishing').textContent = scan.phishing.isPotentialPhishing
    ? `${scan.phishing.confidence}%`
    : 'Clean';
  $('metric-trackers').textContent = scan.tracker.trackersFound;
  $('metric-headers').textContent = `${scan.headers.securityHeadersScore}/100`;
  $('metric-cookies').textContent = `${scan.cookies.flaggedCookies}/${scan.cookies.totalCookies}`;

  // AI summary loads progressively and never blocks the rest of the UI —
  // explainRisk() has its own 2.5s internal timeout and always resolves
  // (falling back to an instant local summary), so this can't hang.
  explainRisk(scan).then(({ explanation }) => {
    $('ai-summary-text').textContent = explanation;
  });
}

function getCurrentScan() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_SCAN' }, (scan) => {
        if (chrome.runtime.lastError) {
          resolve(null); // background worker not reachable — treat as "no scan yet"
          return;
        }
        resolve(scan || null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function init() {
  await applyTheme();
  watchThemeChanges();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    $('content').classList.add('hidden');
    $('error').classList.remove('hidden');
    return;
  }

  let scan = await getCurrentScan();

  if (scan) {
    render(scan);
  } else {
    // No scan yet — page may have just navigated. Show the shell immediately
    // (no spinner gate) with placeholders, and poll briefly in the background.
    $('classification').textContent = 'Scanning…';
    $('content').classList.remove('hidden');

    const startedAt = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(poll);
        if (!scan) {
          $('classification').textContent = 'No data';
          $('hostname').textContent = 'Reload the page to scan it';
        }
        return;
      }
      const result = await getCurrentScan();
      if (result) {
        clearInterval(poll);
        scan = result;
        render(scan);
      }
    }, POLL_INTERVAL_MS);
  }

  $('dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });
}

init();
