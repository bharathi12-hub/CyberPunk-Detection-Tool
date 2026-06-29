/**
 * Header Engine
 * Analyzes: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
 * Output: Security Headers Score (0-100)
 */

const HEADER_CHECKS = [
  {
    header: 'content-security-policy',
    label: 'Content-Security-Policy',
    weight: 30,
    missingMessage: 'No CSP header — site is more vulnerable to XSS and data injection attacks',
  },
  {
    header: 'strict-transport-security',
    label: 'HSTS',
    weight: 25,
    missingMessage: 'No HSTS header — browser won\'t enforce HTTPS on future visits',
  },
  {
    header: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 15,
    missingMessage: 'No X-Frame-Options — site can be embedded in clickjacking iframes',
  },
  {
    header: 'referrer-policy',
    label: 'Referrer-Policy',
    weight: 15,
    missingMessage: 'No Referrer-Policy — full URLs (possibly with sensitive params) may leak to third parties',
  },
  {
    header: 'permissions-policy',
    label: 'Permissions-Policy',
    weight: 15,
    missingMessage: 'No Permissions-Policy — no restriction on which browser features embedded content can use',
  },
];

/**
 * Main entry point.
 * @param {Headers|object} responseHeaders - Fetch API Headers object, or a plain
 *   lowercase-keyed object (e.g. from chrome.webRequest.onHeadersReceived)
 */
export function analyzeHeaders(responseHeaders) {
  const getHeader = (name) => {
    if (responseHeaders instanceof Headers) return responseHeaders.get(name);
    return responseHeaders[name] || responseHeaders[name.toLowerCase()] || null;
  };

  let score = 0;
  const present = [];
  const missing = [];

  for (const check of HEADER_CHECKS) {
    const value = getHeader(check.header);
    if (value) {
      score += check.weight;
      present.push({ label: check.label, value });
    } else {
      missing.push({ label: check.label, message: check.missingMessage });
    }
  }

  // CSP with 'unsafe-inline' or 'unsafe-eval' is weaker than it looks — partial credit deduction
  const cspValue = getHeader('content-security-policy');
  if (cspValue && /unsafe-inline|unsafe-eval/.test(cspValue)) {
    score -= 10;
    missing.push({
      label: 'CSP Strength',
      message: "CSP allows 'unsafe-inline' or 'unsafe-eval', weakening XSS protection",
    });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    securityHeadersScore: score,
    present,
    missing,
  };
}
