/**
 * AI Risk Explainer
 * Takes the combined output of all engines and produces a plain-English
 * explanation of the site's risk, matching the spec's example output:
 *
 *   "Trust Score: 88/100. HTTPS enabled. Domain registered 8 years ago.
 *    No phishing indicators detected. 3 trackers found. Security headers
 *    configured properly. Overall Risk: Low."
 *
 * Calls the backend AI endpoint (which holds the Anthropic API key) — the
 * extension itself never talks to the Anthropic API directly.
 */

const BACKEND_AI_ENDPOINT = 'http://localhost:3000/api/ai/explain-risk';
const FETCH_TIMEOUT_MS = 2500; // hard cap — never let a slow/unreachable backend stall the UI

/**
 * Local, instant, non-AI fallback explanation — used if the backend/AI call
 * fails or is disabled, so the popup never shows nothing.
 */
export function buildLocalSummary(scan) {
  const lines = [];
  lines.push(`Trust Score: ${scan.risk.finalScore}/100`);
  lines.push(scan.reputation.https ? 'HTTPS enabled.' : 'HTTPS not enabled — connection is unencrypted.');

  if (scan.reputation.domainAge !== null) {
    lines.push(`Domain registered ${scan.reputation.domainAge} year(s) ago.`);
  }

  lines.push(
    scan.phishing.isPotentialPhishing
      ? `Phishing indicators detected (${scan.phishing.confidence}% confidence).`
      : 'No phishing indicators detected.'
  );

  lines.push(`${scan.tracker.trackersFound} tracker(s) found.`);

  lines.push(
    scan.headers.securityHeadersScore >= 70
      ? 'Security headers configured properly.'
      : 'Security headers are incomplete or misconfigured.'
  );

  lines.push(`Overall Risk: ${scan.risk.classification.replace(' RISK', '')}.`);

  return lines.join(' ');
}

/**
 * Main entry point — asks the backend's AI endpoint to generate a natural-
 * language explanation, falling back to the local summary on any failure.
 * @param {object} scan - { reputation, phishing, tracker, headers, cookies, permissions, downloads, risk }
 */
export async function explainRisk(scan) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(BACKEND_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error('backend unavailable');
    const data = await res.json();
    return { explanation: data.explanation, source: 'ai' };
  } catch {
    return { explanation: buildLocalSummary(scan), source: 'local-fallback' };
  } finally {
    clearTimeout(timeoutId);
  }
}
