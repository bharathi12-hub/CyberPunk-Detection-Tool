/**
 * AbuseIPDB Intelligence Source
 * Free tier requires a free API key (1000 checks/day). Sign up at:
 * https://www.abuseipdb.com/register
 *
 * IMPORTANT: This call MUST go through the backend (backend/api), never
 * directly from the extension, because it requires a secret API key that
 * should never ship inside client-side extension code.
 *
 * This module is intended to run in the backend (Node.js) environment.
 */

const ABUSEIPDB_ENDPOINT = 'https://api.abuseipdb.com/api/v2/check';

/**
 * @param {string} ipAddress
 * @param {string} apiKey - from process.env.ABUSEIPDB_API_KEY
 * @returns {Promise<{listed: boolean, abuseScore: number, source: string}>}
 */
export async function checkAbuseIPDB(ipAddress, apiKey) {
  if (!apiKey) {
    return { listed: false, abuseScore: 0, source: 'AbuseIPDB', error: 'no_api_key_configured' };
  }

  try {
    const res = await fetch(
      `${ABUSEIPDB_ENDPOINT}?ipAddress=${encodeURIComponent(ipAddress)}&maxAgeInDays=90`,
      {
        headers: {
          Key: apiKey,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) return { listed: false, abuseScore: 0, source: 'AbuseIPDB', error: 'unavailable' };

    const data = await res.json();
    const score = data.data?.abuseConfidenceScore ?? 0;

    return {
      listed: score >= 25, // threshold: flag IPs with meaningful abuse history
      abuseScore: score,
      totalReports: data.data?.totalReports ?? 0,
      source: 'AbuseIPDB',
    };
  } catch (err) {
    return { listed: false, abuseScore: 0, source: 'AbuseIPDB', error: err.message };
  }
}

/**
 * Resolve a hostname to an IP via DNS-over-HTTPS (free, no key — Cloudflare/Google),
 * since AbuseIPDB checks IPs, not domains.
 */
export async function resolveHostnameToIp(hostname) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    const data = await res.json();
    const answer = (data.Answer || []).find((a) => a.type === 1); // type 1 = A record
    return answer ? answer.data : null;
  } catch {
    return null;
  }
}
