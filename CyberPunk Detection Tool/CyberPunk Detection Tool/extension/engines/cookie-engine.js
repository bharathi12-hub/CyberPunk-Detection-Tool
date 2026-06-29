/**
 * Cookie Engine
 * Checks: Secure, HttpOnly, SameSite attributes
 * Output: Per-cookie risk flags (e.g. "Session Cookie Missing HttpOnly" -> Session Hijacking Risk)
 */

/**
 * Heuristic: a cookie is treated as a "session cookie" if its name matches
 * common session-token naming conventions, or it has no Expires/Max-Age (session-only).
 */
function looksLikeSessionCookie(cookie) {
  const sessionNamePattern = /sess|sid|token|auth|jwt|login/i;
  return sessionNamePattern.test(cookie.name) || cookie.session === true;
}

/**
 * Main entry point. Called via chrome.cookies.getAll() results from background-worker.
 * @param {object} cookie - chrome.cookies.Cookie shape: { name, domain, secure, httpOnly, sameSite, session }
 */
export function analyzeCookie(cookie) {
  const issues = [];
  const isSession = looksLikeSessionCookie(cookie);

  if (!cookie.httpOnly) {
    issues.push({
      flag: 'Missing HttpOnly',
      risk: isSession ? 'Session Hijacking Risk' : 'XSS Cookie Theft Risk',
      detail: 'Cookie is readable by JavaScript — vulnerable to theft via XSS',
    });
  }

  if (!cookie.secure) {
    issues.push({
      flag: 'Missing Secure',
      risk: 'Man-in-the-Middle Risk',
      detail: 'Cookie can be transmitted over unencrypted HTTP',
    });
  }

  if (!cookie.sameSite || cookie.sameSite === 'no_restriction' || cookie.sameSite === 'unspecified') {
    issues.push({
      flag: 'Missing/Weak SameSite',
      risk: 'CSRF Risk',
      detail: 'Cookie can be sent in cross-site requests, enabling CSRF attacks',
    });
  }

  return {
    name: cookie.name,
    domain: cookie.domain,
    isSessionCookie: isSession,
    issues,
    hasRisk: issues.length > 0,
    summary: issues.length
      ? `${isSession ? 'Session Cookie' : 'Cookie'} Missing ${issues.map((i) => i.flag.replace('Missing ', '')).join(', ')}`
      : 'No issues detected',
  };
}

/**
 * Batch analyze all cookies for a domain.
 * @param {object[]} cookies
 */
export function analyzeCookies(cookies = []) {
  const results = cookies.map(analyzeCookie);
  const flagged = results.filter((c) => c.hasRisk);

  return {
    totalCookies: results.length,
    flaggedCookies: flagged.length,
    cookies: results,
  };
}
