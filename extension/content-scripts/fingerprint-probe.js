/**
 * Content Script: Fingerprint Probe
 * Runs in the page's MAIN world (real window object, not isolated) so it can
 * hook the actual Canvas/WebGL/Audio/Font APIs the page itself uses. This is
 * required because fingerprinting libraries call these APIs directly on
 * `window`, which the isolated content-script world cannot intercept.
 *
 * Communicates back to scanner.js via window.postMessage (cross-world boundary).
 */

(function () {
  const events = {
    canvas: false,
    canvasCallCount: 0,
    webgl: false,
    audio: false,
    fontEnumeration: false,
    fontProbeCount: 0,
  };

  let reportScheduled = false;
  function scheduleReport() {
    if (reportScheduled) return;
    reportScheduled = true;
    setTimeout(() => {
      window.postMessage({ type: 'BSA_FINGERPRINT_EVENT', probeEvents: { ...events } }, '*');
      reportScheduled = false;
    }, 500);
  }

  // --- Canvas fingerprinting ---
  // Heuristic: toDataURL/getImageData called on a canvas that was never
  // appended to the visible DOM (offscreen) — the classic fingerprinting pattern.
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    events.canvasCallCount++;
    if (!document.body.contains(this) || this.width <= 16 || this.height <= 16) {
      events.canvas = true;
      scheduleReport();
    }
    return originalToDataURL.apply(this, args);
  };

  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    events.canvasCallCount++;
    events.canvas = true;
    scheduleReport();
    return originalGetImageData.apply(this, args);
  };

  // --- WebGL fingerprinting ---
  // Heuristic: querying the debug renderer info extension, which reveals GPU details.
  const wrapGetParameter = (proto) => {
    const original = proto.getParameter;
    proto.getParameter = function (param) {
      // UNMASKED_RENDERER_WEBGL = 37446, UNMASKED_VENDOR_WEBGL = 37445
      if (param === 37446 || param === 37445) {
        events.webgl = true;
        scheduleReport();
      }
      return original.call(this, param);
    };
  };
  if (window.WebGLRenderingContext) wrapGetParameter(WebGLRenderingContext.prototype);
  if (window.WebGL2RenderingContext) wrapGetParameter(WebGL2RenderingContext.prototype);

  // --- Audio fingerprinting ---
  // Heuristic: creating an OfflineAudioContext (no audible output needed —
  // a strong tell that it's being used for fingerprinting, not playback).
  if (window.OfflineAudioContext || window.webkitOfflineAudioContext) {
    const OriginalOfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const WrappedOfflineCtx = function (...args) {
      events.audio = true;
      scheduleReport();
      return new OriginalOfflineCtx(...args);
    };
    WrappedOfflineCtx.prototype = OriginalOfflineCtx.prototype;
    window.OfflineAudioContext = WrappedOfflineCtx;
    if (window.webkitOfflineAudioContext) window.webkitOfflineAudioContext = WrappedOfflineCtx;
  }

  // --- Font enumeration ---
  // Heuristic: many repeated measureText() calls in a short window, which is
  // how font-detection libraries probe for installed fonts.
  let measureTextCalls = 0;
  let measureTextWindowStart = Date.now();
  const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
  CanvasRenderingContext2D.prototype.measureText = function (...args) {
    const now = Date.now();
    if (now - measureTextWindowStart > 2000) {
      measureTextCalls = 0;
      measureTextWindowStart = now;
    }
    measureTextCalls++;
    events.fontProbeCount = measureTextCalls;
    if (measureTextCalls > 20) {
      events.fontEnumeration = true;
      scheduleReport();
    }
    return originalMeasureText.apply(this, args);
  };
})();
