/**
 * Form Analysis Engine
 * Checks: <form> actions for suspicious targets, login form legitimacy
 * Detects: Credit card patterns, API keys, tokens, passwords, Aadhaar-like numbers
 * Output: "Potential Phishing Site" + confidence, or "Sensitive Data Detected" warning
 */

// Regex patterns for sensitive data types. Designed to flag PATTERNS only —
// this engine never stores or transmits the matched values themselves.
const SENSITIVE_PATTERNS = {
  creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
  apiKey: /\b(sk|pk|api|key)[-_][a-zA-Z0-9]{16,}\b/gi,
  jwtToken: /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
  awsKey: /\bAKIA[0-9A-Z]{16}\b/g,
  genericSecret: /\b(password|passwd|pwd|secret)\s*[:=]\s*['"]?[^\s'"]{6,}['"]?/gi,
};

/**
 * Scans visible page text / form field values for sensitive data patterns.
 * Returns which categories were found WITHOUT including the raw matched value.
 */
export function detectSensitiveData(text = '') {
  const findings = [];
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      findings.push({ type, count: matches.length });
    }
  }
  return {
    sensitiveDataDetected: findings.length > 0,
    findings,
  };
}

/**
 * Analyzes a parsed form descriptor (from content-script DOM scan) for
 * suspicious submission targets — the classic fake-login-page tell.
 *
 * @param {object} form - { action, method, fields: [{type, name}], pageHostname }
 */
export function analyzeLoginForm(form) {
  const { action, fields = [], pageHostname } = form;
  const reasons = [];
  let suspicionScore = 0;

  const hasPasswordField = fields.some((f) => f.type === 'password');
  if (!hasPasswordField) {
    return { isLoginForm: false, isPotentialPhishing: false, confidence: 0, reasons: [] };
  }

  let actionHostname = null;
  try {
    actionHostname = action ? new URL(action, `https://${pageHostname}`).hostname : pageHostname;
  } catch {
    reasons.push('Form action URL is malformed');
    suspicionScore += 30;
  }

  // Form submits to a different domain than the page itself
  if (actionHostname && actionHostname !== pageHostname) {
    reasons.push(`Login form submits to a different domain (${actionHostname}) than the page (${pageHostname})`);
    suspicionScore += 50;
  }

  // Form action uses plain HTTP — credentials sent unencrypted
  if (action && action.startsWith('http://')) {
    reasons.push('Form submits credentials over unencrypted HTTP');
    suspicionScore += 40;
  }

  // No action attribute at all combined with inline JS submission can hide destination
  if (!action) {
    reasons.push('Form has no explicit action — destination may be set dynamically via JS');
    suspicionScore += 15;
  }

  const confidence = Math.min(100, suspicionScore);

  return {
    isLoginForm: true,
    isPotentialPhishing: confidence >= 50,
    confidence,
    reasons,
    actionHostname,
    pageHostname,
  };
}

/**
 * Combined entry point used by content-scripts: runs both the form
 * legitimacy check and the sensitive-data scan over the page.
 */
export function analyzeForms(forms = [], visiblePageText = '') {
  const formResults = forms.map(analyzeLoginForm).filter((r) => r.isLoginForm);
  const dataResults = detectSensitiveData(visiblePageText);

  return {
    forms: formResults,
    flaggedForms: formResults.filter((f) => f.isPotentialPhishing),
    sensitiveData: dataResults,
  };
}
