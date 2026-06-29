/**
 * Options Page Logic
 * Persists all settings to chrome.storage.local under the 'bsa_settings' key.
 * Theme/mode changes apply live (to this page immediately, and to the
 * popup/dashboard via theme-loader.js's storage-change listener) without
 * requiring a page reload anywhere.
 */

const DEFAULTS = {
  theme: 'cyan',
  mode: 'dark',
  notifyHighRisk: true,
  notifyDownloads: true,
  notifyPermissions: true,
  autoScan: true,
  blockTrackers: false,
  riskSensitivity: 'balanced',
  historyRetention: '30',
  defaultExportFormat: 'txt',
  backendUrl: 'http://localhost:3000',
};

const $ = (id) => document.getElementById(id);
let currentSettings = { ...DEFAULTS };

async function loadSettings() {
  const { bsa_settings } = await chrome.storage.local.get('bsa_settings');
  currentSettings = { ...DEFAULTS, ...(bsa_settings || {}) };

  document.body.setAttribute('data-theme', currentSettings.theme);
  document.body.setAttribute('data-mode', currentSettings.mode);

  highlightActiveSwatch(currentSettings.theme);
  highlightActiveMode(currentSettings.mode);

  $('notif-high-risk').checked = currentSettings.notifyHighRisk;
  $('notif-downloads').checked = currentSettings.notifyDownloads;
  $('notif-permissions').checked = currentSettings.notifyPermissions;
  $('auto-scan').checked = currentSettings.autoScan;
  $('block-trackers').checked = currentSettings.blockTrackers;
  $('risk-sensitivity').value = currentSettings.riskSensitivity;
  $('history-retention').value = currentSettings.historyRetention;
  $('default-export-format').value = currentSettings.defaultExportFormat;
  $('backend-url').value = currentSettings.backendUrl;
}

function highlightActiveSwatch(theme) {
  document.querySelectorAll('.swatch').forEach((el) => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

function highlightActiveMode(mode) {
  document.querySelectorAll('.mode-btn').forEach((el) => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });
}

/**
 * Theme/mode are saved immediately on click (not gated behind the main Save
 * button) so the live preview and the persisted value never disagree —
 * flipping a swatch and then closing the page without hitting "Save
 * Settings" should still keep the new theme.
 */
async function saveThemeAndMode() {
  currentSettings.theme = document.querySelector('.swatch.active')?.dataset.theme || DEFAULTS.theme;
  currentSettings.mode = document.querySelector('.mode-btn.active')?.dataset.mode || DEFAULTS.mode;
  await chrome.storage.local.set({ bsa_settings: currentSettings });
}

async function saveSettings() {
  currentSettings = {
    ...currentSettings,
    notifyHighRisk: $('notif-high-risk').checked,
    notifyDownloads: $('notif-downloads').checked,
    notifyPermissions: $('notif-permissions').checked,
    autoScan: $('auto-scan').checked,
    blockTrackers: $('block-trackers').checked,
    riskSensitivity: $('risk-sensitivity').value,
    historyRetention: $('history-retention').value,
    defaultExportFormat: $('default-export-format').value,
    backendUrl: $('backend-url').value.trim() || DEFAULTS.backendUrl,
  };

  await chrome.storage.local.set({ bsa_settings: currentSettings });

  const status = $('status');
  status.textContent = 'Settings saved ✓';
  setTimeout(() => (status.textContent = ''), 2000);
}

async function clearHistory() {
  const confirmed = confirm('This permanently deletes all stored scan history, both locally and on the backend (if running). This cannot be undone. Continue?');
  if (!confirmed) return;

  // Clear local per-tab scan cache
  const all = await chrome.storage.local.get(null);
  const scanKeys = Object.keys(all).filter((k) => k.startsWith('lastScan_'));
  if (scanKeys.length) await chrome.storage.local.remove(scanKeys);

  // Best-effort clear on the backend too
  try {
    const res = await fetch(`${currentSettings.backendUrl}/api/scans/history`);
    if (res.ok) {
      const data = await res.json();
      const scans = data.scans || [];
      await Promise.all(
        scans
          .filter((s) => s._id !== undefined)
          .map((s) => fetch(`${currentSettings.backendUrl}/api/scans/${s._id}`, { method: 'DELETE' }).catch(() => {}))
      );
    }
  } catch {
    // backend offline — local history is still cleared, which is the most
    // important part for the user's immediate privacy expectation
  }

  const status = $('status');
  status.textContent = 'History cleared ✓';
  setTimeout(() => (status.textContent = ''), 2500);
}

function init() {
  loadSettings();

  $('back-btn').addEventListener('click', () => {
    // chrome.runtime.openOptionsPage() opens this in a fresh tab with no
    // history entry to go "back" to, so closing the tab IS the correct
    // "back" behavior — it returns focus to whatever tab the user came from.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  document.querySelectorAll('.swatch').forEach((el) => {
    el.addEventListener('click', () => {
      highlightActiveSwatch(el.dataset.theme);
      document.body.setAttribute('data-theme', el.dataset.theme);
      saveThemeAndMode();
    });
  });

  document.querySelectorAll('.mode-btn').forEach((el) => {
    el.addEventListener('click', () => {
      highlightActiveMode(el.dataset.mode);
      document.body.setAttribute('data-mode', el.dataset.mode);
      saveThemeAndMode();
    });
  });

  $('save-btn').addEventListener('click', saveSettings);
  $('clear-history-btn').addEventListener('click', clearHistory);
}

init();
