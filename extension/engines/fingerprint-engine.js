/**
 * Fingerprint Engine
 * Detects: Canvas Fingerprinting, WebGL Fingerprinting, Audio Fingerprinting, Font Enumeration
 * Output: "Fingerprinting Attempt Detected" (boolean + technique breakdown)
 *
 * NOTE: This engine's detection logic runs INSIDE the page context via the
 * content-script's injected probe (see content-scripts/fingerprint-probe.js),
 * because it needs to hook real browser APIs (HTMLCanvasElement, AudioContext, etc).
 * This file analyzes the events reported back from that probe.
 */

const TECHNIQUE_WEIGHTS = {
  canvas: 30,
  webgl: 25,
  audio: 25,
  fontEnumeration: 20,
};

/**
 * @param {object} probeEvents - flags set by the injected probe, e.g.:
 *   { canvas: true, webgl: false, audio: true, fontEnumeration: false,
 *     canvasCallCount: 3, fontProbeCount: 0 }
 */
export function analyzeFingerprinting(probeEvents = {}) {
  const detected = [];
  let score = 0;

  if (probeEvents.canvas) {
    detected.push({
      technique: 'Canvas Fingerprinting',
      detail: `toDataURL/getImageData called ${probeEvents.canvasCallCount || 'multiple'} time(s) on a hidden/offscreen canvas`,
    });
    score += TECHNIQUE_WEIGHTS.canvas;
  }

  if (probeEvents.webgl) {
    detected.push({
      technique: 'WebGL Fingerprinting',
      detail: 'Queried GPU renderer/vendor strings via WebGL debug extension',
    });
    score += TECHNIQUE_WEIGHTS.webgl;
  }

  if (probeEvents.audio) {
    detected.push({
      technique: 'Audio Fingerprinting',
      detail: 'AudioContext used to generate a unique waveform signature',
    });
    score += TECHNIQUE_WEIGHTS.audio;
  }

  if (probeEvents.fontEnumeration) {
    detected.push({
      technique: 'Font Enumeration',
      detail: `Measured text rendering across ${probeEvents.fontProbeCount || 'many'} fonts to fingerprint installed font list`,
    });
    score += TECHNIQUE_WEIGHTS.fontEnumeration;
  }

  return {
    fingerprintingDetected: detected.length > 0,
    techniques: detected,
    fingerprintRiskScore: Math.min(100, score),
  };
}
