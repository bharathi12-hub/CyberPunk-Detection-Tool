/**
 * Risk Engine
 * Combines all engine outputs into a single weighted Website Risk Score.
 *
 * Weights (from project spec):
 *   Reputation Score   25%
 *   Phishing Score     25%
 *   Tracker Score      10%
 *   Headers Score      10%
 *   Cookie Score       10%
 *   Permissions Score  10%
 *   Downloads Score    10%
 *   (remaining 0% buffer reserved for fingerprint/form signals as bonus penalties)
 */

const WEIGHTS = {
  reputation: 0.25,
  phishing: 0.25,
  tracker: 0.10,
  headers: 0.10,
  cookie: 0.10,
  permissions: 0.10,
  downloads: 0.10,
};

function classify(score) {
  if (score >= 80) return 'LOW RISK';
  if (score >= 50) return 'MEDIUM RISK';
  return 'HIGH RISK';
}

/**
 * Converts a "phishing confidence" (0-100, higher = more dangerous) into a
 * "phishing score" (0-100, higher = safer) so it combines additively with
 * the other engines, which are all "higher = safer".
 */
function invert(confidenceOrRisk) {
  return Math.max(0, 100 - confidenceOrRisk);
}

/**
 * Main entry point. Takes the raw outputs of each engine and produces the
 * final combined Website Risk Score.
 *
 * @param {object} inputs
 * @param {object} inputs.reputation - output of analyzeReputation() -> uses .trustScore
 * @param {object} inputs.phishing - output of analyzePhishing() -> uses .confidence (inverted)
 * @param {object} inputs.tracker - output of analyzeTrackers() -> uses .privacyScore
 * @param {object} inputs.headers - output of analyzeHeaders() -> uses .securityHeadersScore
 * @param {object} inputs.cookies - output of analyzeCookies() -> derives a score from flagged ratio
 * @param {object} inputs.permissions - array of analyzePermissionRequest() results -> derives a score
 * @param {object} inputs.downloads - array of analyzeDownload() results (optional, defaults safe)
 * @param {object} [inputs.fingerprint] - output of analyzeFingerprinting() -> bonus penalty only
 * @param {object} [inputs.forms] - output of analyzeForms() -> bonus penalty only
 */

export function calculateRiskScore(inputs) {
  const reputationScore = inputs.reputation?.trustScore ?? 100;
  const phishingScore = invert(inputs.phishing?.confidence ?? 0);
  const trackerScore = inputs.tracker?.privacyScore ?? 100;
  const headersScore = inputs.headers?.securityHeadersScore ?? 100;

  // Cookie score: penalize proportionally to flagged-cookie ratio
  const totalCookies = inputs.cookies?.totalCookies ?? 0;
  const flaggedCookies = inputs.cookies?.flaggedCookies ?? 0;
  const cookieScore = totalCookies === 0
    ? 100
    : Math.round(100 * (1 - flaggedCookies / totalCookies));

  // Permissions score: penalize for high-risk requests, more for repeated asks
  const permissionRequests = inputs.permissions ?? [];
  let permissionsScore = 100;
  permissionRequests.forEach((p) => {
    if (p.riskLevel === 'High') permissionsScore -= 15;
    else if (p.riskLevel === 'Medium') permissionsScore -= 8;
    if (p.repeatedAsk) permissionsScore -= 10;
  });
  permissionsScore = Math.max(0, permissionsScore);

  // Downloads score: penalize for any high/medium risk downloads observed this session
  const downloadEvents = inputs.downloads ?? [];
  let downloadsScore = 100;
  downloadEvents.forEach((d) => {
    if (d.riskLevel === 'High Risk') downloadsScore -= 25;
    else if (d.riskLevel === 'Medium Risk') downloadsScore -= 10;
  });
  downloadsScore = Math.max(0, downloadsScore);

  let weighted =
    reputationScore * WEIGHTS.reputation +
    phishingScore * WEIGHTS.phishing +
    trackerScore * WEIGHTS.tracker +
    headersScore * WEIGHTS.headers +
    cookieScore * WEIGHTS.cookie +
    permissionsScore * WEIGHTS.permissions +
    downloadsScore * WEIGHTS.downloads;
    if (inputs.typoResults?.length > 0) {
  weighted -= 15;
}

if (inputs.cryptoResults?.length > 0) {
  weighted -= 20;
}

if (inputs.mlScore > 0) {
  weighted -= Math.floor(inputs.mlScore * 0.2);
}

if (inputs.qrDetected) {
  weighted -= 10;
}

  // Bonus penalties (not separately weighted, but meaningfully drag the score down)
  if (inputs.fingerprint?.fingerprintingDetected) {
    weighted -= 5;
  }
  if (inputs.forms?.flaggedForms?.length) {
    weighted -= 10 * inputs.forms.flaggedForms.length;
  }
  if (inputs.forms?.sensitiveData?.sensitiveDataDetected) {
    weighted -= 10;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(weighted)));

  return {
    finalScore,
    classification: classify(finalScore),
    breakdown: {
      reputationScore,
      phishingScore,
      trackerScore,
      headersScore,
      cookieScore,
      permissionsScore,
      downloadsScore,
    },
  };
}
