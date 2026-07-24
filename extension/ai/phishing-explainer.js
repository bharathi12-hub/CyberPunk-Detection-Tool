/**
 * AI Phishing Explainer
 * Generates a focused, human-readable explanation of WHY a page was flagged
 * as a potential phishing site, e.g.:
 *   "Potential Phishing Site — Confidence: 94%. This page mimics PayPal's
 *    login form but submits credentials to a different domain."
 */

const BACKEND_AI_ENDPOINT = 'http://localhost:3000/api/ai/explain-phishing';
const FETCH_TIMEOUT_MS = 2500; // hard cap — never let a slow/unreachable backend stall the UI

export function buildLocalPhishingSummary(phishingResult, formResult) {
  const lines = [];

  if (phishingResult.isPotentialPhishing) {
    lines.push(`Potential Phishing Site — Confidence: ${phishingResult.confidence}%.`);
    phishingResult.reasons.forEach((r) => lines.push(r + '.'));
  } else {
    lines.push('No strong phishing indicators detected on this page.');
  }

  if (formResult?.flaggedForms?.length) {
    formResult.flaggedForms.forEach((f) => {
      lines.push(`Login form submits to "${f.actionHostname}" instead of "${f.pageHostname}".`);
    });
  }

  return lines.join(' ');
}

/**
 * @param {object} phishingResult - output of analyzePhishing()
 * @param {object} [formResult] - output of analyzeForms()
 */
export async function explainPhishing(phishingResult, formResult = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(BACKEND_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phishingResult, formResult }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error('backend unavailable');
    const data = await res.json();
    return { explanation: data.explanation, source: 'ai' };
  } catch {
    return { explanation: buildLocalPhishingSummary(phishingResult, formResult), source: 'local-fallback' };
  } finally {
    clearTimeout(timeoutId);
  }
}
