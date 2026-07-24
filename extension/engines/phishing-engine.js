/**
 * Phishing Engine
 * Detects: Homograph attacks (paypaI.com vs paypal.com), Brand impersonation
 * Output: Potential Phishing Site + Confidence %
 */

// Visually-confusable character substitutions (homograph attack table, simplified Latin subset)
const CONFUSABLES = {
  '0': 'o', 'o': '0',
  '1': 'l', 'l': '1', 'i': 'l',
  '5': 's', 's': '5',
  'rn': 'm',
  'vv': 'w',
  'I': 'l',
};

// High-value brands frequently targeted by phishing kits
const PROTECTED_BRANDS = [
  'paypal', 'microsoft', 'google', 'amazon', 'apple', 'facebook', 'instagram',
  'netflix', 'bankofamerica', 'chase', 'wellsfargo', 'irs', 'dhl', 'fedex',
  'linkedin', 'github', 'binance', 'coinbase',
];
const TYPO_PATTERNS = [
  /go+gle/i,
  /amaz[o0]n/i,
  /paypa[l1i]/i,
  /micr[o0]soft/i,
  /facebo[o0]k/i,
  /instagrarn/i,
  /linkedln/i
];

export function detectTyposquatting(hostname) {
  const findings = [];

  for (const pattern of TYPO_PATTERNS) {
    if (pattern.test(hostname)) {
      findings.push({
        severity: "high",
        issue: "Potential typosquatting domain"
      });
    }
  }

  return findings;
}
/**
 * Normalize a hostname by reversing common confusable substitutions,
 * then check Levenshtein distance against protected brand list.
 */
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function stripCommonSuffixes(hostname) {
  return hostname.replace(/^www\./, '').split('.').slice(0, -1).join('.') || hostname;
}

/**
 * Detects homograph / typosquatting attempts against a known brand list.
 */
function detectHomographAttack(hostname) {
  const core = stripCommonSuffixes(hostname).toLowerCase();
  const matches = [];

  for (const brand of PROTECTED_BRANDS) {
    if (core === brand) continue; // it IS the real domain
    const distance = levenshtein(core, brand);
    // Close edit distance relative to brand length = likely typosquat/homograph
    const threshold = brand.length <= 6 ? 1 : 2;
    if (distance > 0 && distance <= threshold) {
      matches.push({ brand, distance, similarity: 1 - distance / brand.length });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Detects brand impersonation in the page title/content even when the
 * domain itself is unrelated to the brand (common in compromised-site phishing).
 */
function detectBrandImpersonation(hostname, pageText = '') {
  const core = stripCommonSuffixes(hostname).toLowerCase();
  const lowerText = pageText.toLowerCase();
  const flagged = [];

  for (const brand of PROTECTED_BRANDS) {
    if (core.includes(brand)) continue; // legit-ish, brand owns a related domain string
    // Brand mentioned prominently in content/title but domain has no relation
    const mentions = (lowerText.match(new RegExp(brand, 'g')) || []).length;
    if (mentions >= 2) {
      flagged.push({ brand, mentions });
    }
  }

  return flagged;
}

/**
 * Detects "combo-squatting": a domain that contains a full protected brand
 * name plus extra words or hyphens (e.g. paypal-secure-login.com,
 * amazon-support-team.net, micr0soft-support.net). This is structurally
 * different from a homograph attack — the brand name is fully intact, just
 * padded with extra text — so Levenshtein distance alone won't catch it
 * (the edit distance to the bare brand name is large once "-support" etc.
 * is appended).
 */
function detectComboSquatting(hostname) {
  const core = stripCommonSuffixes(hostname).toLowerCase();
  const matches = [];

  for (const brand of PROTECTED_BRANDS) {
    if (core === brand) continue; // it IS the real domain

    // Allow common 0/o, 1/l substitutions to still register as "contains brand"
    const normalizedCore = core.replace(/0/g, 'o').replace(/1/g, 'l');
    const labels = normalizedCore.split('-');

    // A legitimate subdomain of the brand (e.g. "accounts.google" before TLD
    // stripping is irrelevant here since stripCommonSuffixes already removed
    // the TLD) would appear as brand itself or brand as the LAST label
    // (mail.google -> labels ['mail','google'], brand is the root, not padding).
    const brandIsPadded = labels.includes(brand) && labels.length > 1 && labels[labels.length - 1] !== brand;
    const brandWithExtraSuffix = normalizedCore.startsWith(brand) && normalizedCore.length > brand.length && !normalizedCore.includes('.');

    if (brandIsPadded || brandWithExtraSuffix) {
      matches.push({ brand, pattern: 'combo-squat' });
    }
  }

  return matches;
}

/**
 * Main entry point.
 * @param {string} url
 * @param {string} [pageText] - optional page title/visible text for content-based brand checks
 */
export function analyzePhishing(url, pageText = '') {
  const hostname = new URL(url).hostname;
  const homographMatches = detectHomographAttack(hostname);
  const comboSquatMatches = detectComboSquatting(hostname);
  const brandImpersonation = detectBrandImpersonation(hostname, pageText);

  let confidence = 0;
  const reasons = [];

  if (homographMatches.length > 0) {
    const top = homographMatches[0];
    confidence += Math.round(top.similarity * 70);
    reasons.push(
      `Domain closely resembles "${top.brand}" (edit distance ${top.distance}) — possible homograph/typosquat`
    );
  }

  if (comboSquatMatches.length > 0) {
    confidence += 65;
    comboSquatMatches.forEach((m) =>
      reasons.push(`Domain contains "${m.brand}" padded with extra text — possible combo-squat phishing domain`)
    );
  }

  if (brandImpersonation.length > 0) {
    confidence += 30;
    brandImpersonation.forEach((b) =>
      reasons.push(`Page repeatedly references "${b.brand}" but domain is unrelated`)
    );
  }

  confidence = Math.min(100, confidence);

  return {
    url,
    hostname,
    isPotentialPhishing: confidence >= 50,
    confidence,
    reasons,
    homographMatches,
    comboSquatMatches,
    brandImpersonation,
  };
}
