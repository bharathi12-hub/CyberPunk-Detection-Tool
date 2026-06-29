/**
 * Dashboard Logic
 * Pulls scan history from chrome.storage.local (per-tab scans saved by
 * background-worker) AND from the backend's /api/scans/history endpoint
 * (persistent, cross-session history), then renders overview stats with
 * mini sparklines, a risk-classification donut, a top-flagged-hosts panel,
 * a predictive-model bubble visualization, a searchable/numbered scan
 * history table with delete support, and exportable reports (txt/pdf/docx,
 * single or bulk).
 */

import { buildReport, renderReportAsText, renderCombinedReportsAsText, exportAsPdf, exportAsDocx } from '../ai/report-generator.js';
import { applyTheme, watchThemeChanges } from '../shared/theme-loader.js';

const $ = (id) => document.getElementById(id);
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 64; // matches r=64 in dashboard.html's SVG
const BACKEND_BASE = 'http://localhost:3000';

let allScans = [];
let filteredHistoryScans = [];

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  $(`view-${viewName}`).classList.remove('hidden');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
}

async function fetchScanHistory() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scans/history`);
    if (res.ok) {
      const data = await res.json();
      return data.scans || [];
    }
  } catch {
    // backend offline — fall back to local
  }

  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith('lastScan_'))
    .map(([key, value]) => ({ ...value, _id: key, _local: true }));
}

// ---------------------------------------------------------------------------
// Overview: stat cards + mini sparklines
// ---------------------------------------------------------------------------

function renderMiniViz(svgId, values, color) {
  const svg = $(svgId);
  if (!values.length) {
    svg.innerHTML = '';
    return;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = 100 / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = 28 - ((v - min) / range) * 26; // leave 2px margin top/bottom within 30-height viewBox
    return `${x},${y}`;
  });

  const linePoints = points.join(' ');
  const areaPoints = `0,30 ${linePoints} 100,30`;

  svg.innerHTML = `
    <polyline points="${areaPoints}" fill="${color}" fill-opacity="0.12" stroke="none" />
    <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
  `;
}

/**
 * Buckets scans into time-ordered groups (oldest to newest) to drive the
 * mini sparklines — each bucket's count/avg becomes one point on the line.
 */
function bucketScansByTime(scans, bucketCount = 12) {
  const sorted = [...scans].sort((a, b) => (a.scannedAt || 0) - (b.scannedAt || 0));
  if (sorted.length === 0) return [];
  if (sorted.length <= bucketCount) return sorted.map((s) => [s]);

  const bucketSize = Math.ceil(sorted.length / bucketCount);
  const buckets = [];
  for (let i = 0; i < sorted.length; i += bucketSize) {
    buckets.push(sorted.slice(i, i + bucketSize));
  }
  return buckets;
}

function renderOverview(scans) {
  $('stat-total-scans').textContent = scans.length;
  $('stat-high-risk').textContent = scans.filter((s) => s.risk?.classification === 'HIGH RISK').length;
  $('stat-trackers').textContent = scans.reduce((sum, s) => sum + (s.tracker?.trackersFound || 0), 0);

  const avg = scans.length
    ? Math.round(scans.reduce((sum, s) => sum + (s.risk?.finalScore || 0), 0) / scans.length)
    : 0;
  $('stat-avg-score').textContent = avg;

  const buckets = bucketScansByTime(scans);
  const totalScansSeries = buckets.map((b) => b.length);
  const highRiskSeries = buckets.map((b) => b.filter((s) => s.risk?.classification === 'HIGH RISK').length);
  const trackersSeries = buckets.map((b) => b.reduce((sum, s) => sum + (s.tracker?.trackersFound || 0), 0));
  const avgScoreSeries = buckets.map((b) =>
    b.length ? b.reduce((sum, s) => sum + (s.risk?.finalScore || 0), 0) / b.length : 0
  );

  const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#22d3ee';
  const highColor = getComputedStyle(document.body).getPropertyValue('--high').trim() || '#ef4d5e';
  const lowColor = getComputedStyle(document.body).getPropertyValue('--low').trim() || '#1fc98c';

  renderMiniViz('viz-total-scans', totalScansSeries, accentColor);
  renderMiniViz('viz-high-risk', highRiskSeries, highColor);
  renderMiniViz('viz-trackers', trackersSeries, accentColor);
  renderMiniViz('viz-avg-score', avgScoreSeries, lowColor);
}

// ---------------------------------------------------------------------------
// Risk classification donut
// ---------------------------------------------------------------------------

function renderDonut(scans) {
  const low = scans.filter((s) => s.risk?.classification === 'LOW RISK').length;
  const medium = scans.filter((s) => s.risk?.classification === 'MEDIUM RISK').length;
  const high = scans.filter((s) => s.risk?.classification === 'HIGH RISK').length;
  const total = low + medium + high;

  $('legend-low').textContent = low;
  $('legend-medium').textContent = medium;
  $('legend-high').textContent = high;

  if (total === 0) {
    ['donut-low', 'donut-medium', 'donut-high'].forEach((id) => {
      $(id).style.strokeDasharray = `0 ${DONUT_CIRCUMFERENCE}`;
    });
    return;
  }

  const lowLen = (low / total) * DONUT_CIRCUMFERENCE;
  const mediumLen = (medium / total) * DONUT_CIRCUMFERENCE;
  const highLen = (high / total) * DONUT_CIRCUMFERENCE;

  const lowEl = $('donut-low');
  const mediumEl = $('donut-medium');
  const highEl = $('donut-high');

  lowEl.style.strokeDasharray = `${lowLen} ${DONUT_CIRCUMFERENCE - lowLen}`;
  lowEl.style.strokeDashoffset = '0';

  mediumEl.style.strokeDasharray = `${mediumLen} ${DONUT_CIRCUMFERENCE - mediumLen}`;
  mediumEl.style.strokeDashoffset = `${-lowLen}`;

  highEl.style.strokeDasharray = `${highLen} ${DONUT_CIRCUMFERENCE - highLen}`;
  highEl.style.strokeDashoffset = `${-(lowLen + mediumLen)}`;
}

// ---------------------------------------------------------------------------
// Top flagged hosts
// ---------------------------------------------------------------------------

function renderTopHosts(scans) {
  const counts = new Map();
  scans.forEach((s) => {
    if (!s.hostname) return;
    counts.set(s.hostname, (counts.get(s.hostname) || 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const body = $('top-hosts-body');
  body.innerHTML = '';

  if (sorted.length === 0) {
    body.innerHTML = '<tr><td colspan="2">No scans yet</td></tr>';
    return;
  }

  sorted.forEach(([hostname, count]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${hostname}</td><td>${count}</td>`;
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Trust Score Trend — modern line chart
// Plots the trust score of the most recent scans in chronological order, so
// the overall trajectory of browsing risk is visible at a glance.
// ---------------------------------------------------------------------------

function renderTrendChart(scans) {
  const svg = $('trend-viz');
  if (!svg) return;
  svg.innerHTML = '';

  const sorted = [...scans]
    .filter((s) => typeof s.risk?.finalScore === 'number' && s.scannedAt)
    .sort((a, b) => a.scannedAt - b.scannedAt)
    .slice(-20);

  if (sorted.length === 0) {
    svg.innerHTML = `<text x="300" y="110" text-anchor="middle" fill="var(--text-dim)" font-size="13">No scan data yet</text>`;
    return;
  }

  const width = 600, height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xStep = sorted.length > 1 ? plotWidth / (sorted.length - 1) : 0;
  const yFor = (score) => padding.top + plotHeight - (score / 100) * plotHeight;
  const xFor = (i) => padding.left + i * xStep;

  let html = '';

  // Gridlines + y-axis labels at 0/25/50/75/100
  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = yFor(tick);
    html += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
    html += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-dim)" font-size="10" font-family="var(--font-mono)">${tick}</text>`;
  });

  // Build the line path and a filled area beneath it for a modern look
  const linePoints = sorted.map((s, i) => `${xFor(i)},${yFor(s.risk.finalScore)}`).join(' ');
  const areaPoints = `${padding.left},${padding.top + plotHeight} ${linePoints} ${xFor(sorted.length - 1)},${padding.top + plotHeight}`;

  html += `
    <defs>
      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon points="${areaPoints}" fill="url(#trendFill)" />
    <polyline points="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
  `;

  // Data point dots, colored by that scan's risk classification, with a
  // native <title> tooltip for the hostname + score on hover.
  sorted.forEach((s, i) => {
    const x = xFor(i);
    const y = yFor(s.risk.finalScore);
    const color = s.risk.classification === 'LOW RISK' ? 'var(--low)'
      : s.risk.classification === 'MEDIUM RISK' ? 'var(--medium)'
      : 'var(--high)';
    html += `
      <circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="1.5">
        <title>${s.hostname || 'Unknown'} — ${s.risk.finalScore}/100</title>
      </circle>
    `;
  });

  svg.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Scan History — serial numbers, search filtering, delete
// ---------------------------------------------------------------------------

async function deleteScanRecord(scan) {
  if (scan._local) {
    await chrome.storage.local.remove(scan._id);
  } else if (scan._id !== undefined) {
    try {
      await fetch(`${BACKEND_BASE}/api/scans/${scan._id}`, { method: 'DELETE' });
    } catch {
      // backend offline — nothing more we can do for a persisted record right now
    }
  }
  allScans = allScans.filter((s) => s !== scan);
  renderHistory(applyHistorySearch($('history-search')?.value || ''));
  renderOverview(allScans);
  renderDonut(allScans);
  renderTopHosts(allScans);
  renderTrendChart(allScans);
  populateReportSelect(allScans);
}

/**
 * Deletes every scan currently visible in the history table — i.e. respects
 * an active search filter, so "Delete All" with a search typed in only
 * clears the matching subset, not the entire history. Runs all individual
 * deletes in parallel (each scan handles its own local-vs-backend removal,
 * same as a single delete) rather than reusing deleteScanRecord in a loop,
 * since that would re-render every other view once per scan instead of once
 * at the end.
 */
async function deleteAllScans() {
  const targets = filteredHistoryScans;
  if (targets.length === 0) return;

  const isFiltered = targets.length !== allScans.length;
  const confirmed = confirm(
    isFiltered
      ? `Delete ${targets.length} scan(s) matching your current search? This cannot be undone.`
      : `Delete all ${targets.length} scan(s) from history? This cannot be undone.`
  );
  if (!confirmed) return;

  await Promise.all(
    targets.map(async (scan) => {
      if (scan._local) {
        await chrome.storage.local.remove(scan._id);
      } else if (scan._id !== undefined) {
        try {
          await fetch(`${BACKEND_BASE}/api/scans/${scan._id}`, { method: 'DELETE' });
        } catch {
          // backend offline — nothing more we can do for this record right now
        }
      }
    })
  );

  const targetSet = new Set(targets);
  allScans = allScans.filter((s) => !targetSet.has(s));
  renderHistory(applyHistorySearch($('history-search')?.value || ''));
  renderOverview(allScans);
  renderDonut(allScans);
  renderTopHosts(allScans);
  renderTrendChart(allScans);
  populateReportSelect(allScans);
}

function renderHistory(scans) {
  filteredHistoryScans = scans;
  const body = $('history-body');
  body.innerHTML = '';

  const sorted = [...scans].sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0));

  if (sorted.length === 0) {
    const hasActiveSearch = ($('history-search')?.value || '').trim().length > 0;
    const message = hasActiveSearch
      ? 'No scans match your search'
      : 'No scan history yet — browse a few pages to see scans appear here';
    body.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
    return;
  }

  sorted.forEach((scan, i) => {
    const tr = document.createElement('tr');
    const time = scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'Unknown';
    tr.innerHTML = `
      <td class="col-serial">${i + 1}</td>
      <td>${scan.hostname || 'Unknown'}</td>
      <td>${scan.risk?.finalScore ?? '--'}/100</td>
      <td>${scan.risk?.classification ?? '--'}</td>
      <td>${time}</td>
      <td><button class="row-delete-btn" data-index="${i}">Delete</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('.row-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scan = sorted[Number(btn.dataset.index)];
      deleteScanRecord(scan);
    });
  });
}

function applyHistorySearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return allScans;
  return allScans.filter((s) =>
    (s.hostname || '').toLowerCase().includes(q) ||
    (s.risk?.classification || '').toLowerCase().includes(q) ||
    (s.url || '').toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// Report view — select, export single (txt/pdf/docx), export all
// ---------------------------------------------------------------------------

function populateReportSelect(scans) {
  const select = $('report-site-select');
  const previousValue = select.value;
  select.innerHTML = '';
  scans.forEach((scan, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${scan.hostname || 'Unknown'} — ${scan.risk?.classification || ''}`;
    select.appendChild(opt);
  });

  if (previousValue && Number(previousValue) < scans.length) {
    select.value = previousValue;
  }

  if (scans.length) renderReportFor(scans[select.value || 0]);
}

function normalizeScanForReport(scan) {
  return {
    permissions: [],
    downloads: [],
    fingerprint: null,
    forms: null,
    typoResults: [],
    cryptoResults: [],
    mlScore: 0,
    qrDetected: false,
    ...scan,
  };
}

function renderReportFor(scan) {
  if (!scan) {
    $('report-output').textContent = 'No scans available to report on yet.';
    return;
  }
  const report = buildReport(normalizeScanForReport(scan));
  $('report-output').textContent = renderReportAsText(report);
}

function getCurrentReportText() {
  return $('report-output').textContent;
}

function getCurrentReportHostname() {
  const select = $('report-site-select');
  const scan = allScans[select.value];
  return scan?.hostname || 'report';
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function applyDefaultExportFormatStyling() {
  const { bsa_settings } = await chrome.storage.local.get('bsa_settings');
  const preferred = bsa_settings?.defaultExportFormat || 'txt';

  const buttonsByFormat = {
    txt: $('export-txt-btn'),
    pdf: $('export-pdf-btn'),
    docx: $('export-docx-btn'),
  };

  Object.entries(buttonsByFormat).forEach(([format, btn]) => {
    btn.classList.toggle('btn-primary', format === preferred);
    btn.classList.toggle('btn-secondary', format !== preferred);
  });
}

async function init() {
  await applyTheme();
  watchThemeChanges();

  allScans = await fetchScanHistory();
  renderOverview(allScans);
  renderDonut(allScans);
  renderTopHosts(allScans);
  renderTrendChart(allScans);
  renderHistory(allScans);
  populateReportSelect(allScans);
  await applyDefaultExportFormatStyling();

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  $('settings-fab').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  $('history-search').addEventListener('input', (e) => {
    renderHistory(applyHistorySearch(e.target.value));
  });

  $('delete-all-btn').addEventListener('click', deleteAllScans);

  $('report-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const select = $('report-site-select');
    Array.from(select.options).forEach((opt) => {
      const scan = allScans[opt.value];
      const matches = !q || (scan?.hostname || '').toLowerCase().includes(q);
      opt.hidden = !matches;
    });
    // If the currently-selected option just got hidden, jump to the first visible one
    const currentOpt = select.options[select.selectedIndex];
    if (currentOpt?.hidden) {
      const firstVisible = Array.from(select.options).find((o) => !o.hidden);
      if (firstVisible) {
        select.value = firstVisible.value;
        renderReportFor(allScans[firstVisible.value]);
      }
    }
  });

  $('report-site-select').addEventListener('change', (e) => {
    renderReportFor(allScans[e.target.value]);
  });

  $('export-txt-btn').addEventListener('click', () => {
    try {
      downloadTextFile(getCurrentReportText(), `${getCurrentReportHostname()}-security-report.txt`);
    } catch (err) {
      console.error('Export .txt failed:', err);
      alert('Could not export .txt: ' + err.message);
    }
  });

  $('export-pdf-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      await exportAsPdf(getCurrentReportText(), `${getCurrentReportHostname()}-security-report.pdf`);
    } catch (err) {
      console.error('Export .pdf failed:', err);
      alert('Could not export .pdf: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  $('export-docx-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      await exportAsDocx(getCurrentReportText(), `Security Report — ${getCurrentReportHostname()}`, `${getCurrentReportHostname()}-security-report.docx`);
    } catch (err) {
      console.error('Export .docx failed:', err);
      alert('Could not export .docx: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  $('export-all-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('export-all-menu').classList.toggle('hidden');
  });

  // Close the menu when clicking anywhere outside it
  document.addEventListener('click', (e) => {
    const menu = $('export-all-menu');
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target.id !== 'export-all-btn') {
      menu.classList.add('hidden');
    }
  });

  document.querySelectorAll('.export-all-option').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const format = btn.dataset.format;
      $('export-all-menu').classList.add('hidden');

      const reports = allScans.map((s) => buildReport(normalizeScanForReport(s)));
      const combined = renderCombinedReportsAsText(reports);

      const originalLabel = btn.textContent;
      try {
        if (format === 'txt') {
          downloadTextFile(combined, 'all-security-reports.txt');
        } else if (format === 'pdf') {
          btn.textContent = 'Exporting…';
          await exportAsPdf(combined, 'all-security-reports.pdf');
        } else if (format === 'docx') {
          btn.textContent = 'Exporting…';
          await exportAsDocx(combined, 'All Security Reports', 'all-security-reports.docx');
        }
      } catch (err) {
        console.error(`Export all reports as .${format} failed:`, err);
        alert(`Could not export all reports as .${format}: ${err.message}`);
      } finally {
        btn.textContent = originalLabel;
      }
    });
  });
}

init();
