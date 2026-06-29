/**
 * Password Engine
 * Checks: Password strength, common password lists, HaveIBeenPwned breach check (k-anonymity, free API)
 * Output: Strength score, breach status
 *
 * Password values NEVER leave the browser in plaintext for the breach check —
 * we use the k-anonymity model: only the first 5 chars of the SHA-1 hash are sent.
 */

const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password1',
  'admin', 'letmein', 'welcome', 'monkey', '111111', 'iloveyou', '123123',
]);

function scoreStrength(password) {
  if (!password) return { score: 0, label: 'Empty' };

  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  if (COMMON_PASSWORDS.has(password.toLowerCase())) score = Math.min(score, 10);

  let label = 'Very Weak';
  if (score >= 80) label = 'Strong';
  else if (score >= 60) label = 'Moderate';
  else if (score >= 35) label = 'Weak';

  return { score: Math.min(100, score), label };
}

async function sha1Hex(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Checks a password against the HaveIBeenPwned Pwned Passwords API
 * using k-anonymity (free, no API key required).
 * Docs: https://haveibeenpwned.com/API/v3#PwnedPasswords
 */
export async function checkBreachStatus(password) {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return { checked: false, breached: null };

    const text = await res.text();
    const lines = text.split('\n');
    const match = lines.find((line) => line.startsWith(suffix));

    if (match) {
      const count = parseInt(match.split(':')[1], 10);
      return { checked: true, breached: true, breachCount: count };
    }
    return { checked: true, breached: false, breachCount: 0 };
  } catch (err) {
    return { checked: false, breached: null, error: err.message };
  }
}

/**
 * Main entry point. Strength check is local/instant; breach check is async/network.
 * @param {string} password
 * @param {boolean} [includeBreachCheck=true]
 */
export async function analyzePassword(password, includeBreachCheck = true) {
  const strength = scoreStrength(password);
  const breach = includeBreachCheck
    ? await checkBreachStatus(password)
    : { checked: false, breached: null };

  return {
    strength: strength.score,
    strengthLabel: strength.label,
    isCommonPassword: COMMON_PASSWORDS.has(password.toLowerCase()),
    breach,
  };
}
