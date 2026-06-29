/**
 * Content Script: Scanner
 * Runs in the isolated content-script world on every page. Responsibilities:
 *   1. Scan all <form> elements for login-form analysis + sensitive data text
 *   2. Hook navigator.permissions / getUserMedia calls to report permission requests
 *   3. Listen for fingerprint events relayed from the MAIN-world probe
 *
 * IMPORTANT — "Extension context invalidated" handling:
 * When the extension is reloaded/updated/disabled while a tab that already
 * has this content script injected stays open, Chrome destroys the old
 * extension context but the content script keeps running in that page until
 * it's refreshed. Any chrome.runtime.* call made after that point throws
 * "Extension context invalidated" as an UNCAUGHT error, which is exactly
 * what showed up in chrome://extensions's Errors list. Every messaging call
 * below goes through safeSendMessage(), which checks chrome.runtime?.id
 * first (it becomes undefined once the context is gone) and wraps the call
 * in try/catch as a second layer, so this is a silent no-op afterward
 * instead of an uncaught exception — there is nothing meaningful to do with
 * a message once the receiving end no longer exists, so silently dropping
 * it is the correct behavior, not a workaround.
 */

function safeSendMessage(message) {
  if (!chrome?.runtime?.id) return; // context already invalidated — nothing to send to
  try {
    chrome.runtime.sendMessage(message);
  } catch (err) {
    // "Extension context invalidated" or similar — the receiving end is
    // gone. Nothing more to do; swallow it rather than letting it surface
    // as an uncaught error in chrome://extensions.
  }
}

function scanForms() {
  const forms = Array.from(document.querySelectorAll('form')).map((form) => {
    const fields = Array.from(form.querySelectorAll('input')).map((input) => ({
      type: input.type,
      name: input.name,
    }));
    return {
      action: form.getAttribute('action'),
      method: form.getAttribute('method') || 'get',
      fields,
      pageHostname: window.location.hostname,
    };
  });

  // Grab visible text for sensitive-data pattern scanning (capped for performance)
  const visibleText = document.body ? document.body.innerText.slice(0, 50000) : '';

  safeSendMessage({
    type: 'FORM_SCAN',
    forms,
    pageText: visibleText,
  });
}

// ---------------------------------------------------------------------------
// Permission hooks: wrap getUserMedia and geolocation so requests are reported
// to the background-worker for permission-engine analysis BEFORE the browser's
// native prompt appears.
// ---------------------------------------------------------------------------
function hookPermissionAPIs() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
      if (constraints?.video) {
        safeSendMessage({ type: 'PERMISSION_REQUEST', permission: 'camera' });
      }
      if (constraints?.audio) {
        safeSendMessage({ type: 'PERMISSION_REQUEST', permission: 'microphone' });
      }
      return originalGetUserMedia(constraints);
    };
  }

  if (navigator.geolocation) {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = function (...args) {
      safeSendMessage({ type: 'PERMISSION_REQUEST', permission: 'geolocation' });
      return originalGetCurrentPosition(...args);
    };
  }

  if (window.Notification && Notification.requestPermission) {
    const originalRequestPermission = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = function (...args) {
      safeSendMessage({ type: 'PERMISSION_REQUEST', permission: 'notifications' });
      return originalRequestPermission(...args);
    };
  }
}

// ---------------------------------------------------------------------------
// Relay fingerprint probe events from the MAIN world (window.postMessage)
// to the background-worker (chrome.runtime.sendMessage)
// ---------------------------------------------------------------------------
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'BSA_FINGERPRINT_EVENT') return;

  safeSendMessage({
    type: 'FINGERPRINT_EVENT',
    probeEvents: event.data.probeEvents,
  });
});

// ---------------------------------------------------------------------------
// Init
// (QR-code image scanning lives in its own content script — qr-scanner.js —
// already registered separately in manifest.json; it is not duplicated here.)
// ---------------------------------------------------------------------------
hookPermissionAPIs();

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  scanForms();
} else {
  window.addEventListener('DOMContentLoaded', scanForms);
}

// Re-scan forms if the page is a SPA that injects forms dynamically
const observer = new MutationObserver(() => {
  clearTimeout(window.__bsaScanDebounce);
  window.__bsaScanDebounce = setTimeout(scanForms, 1000);
});
observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
