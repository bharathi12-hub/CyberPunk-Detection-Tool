/**
 * Intelligence Layer — Aggregator
 * Combines OpenPhish, PhishTank, and URLhaus (all free, no-key-required from
 * the extension) into a single reputation check, with local caching to
 * respect rate limits.
 *
 * Google Safe Browsing, VirusTotal, and AbuseIPDB all require secret API
 * keys, so they are NEVER called directly from the extension. Instead, the
 * extension calls its own backend's /api/intelligence/url endpoint, which
 * holds the keys server-side and proxies the checks
 * (see backend/intelligence/safebrowsing.js, virustotal.js, abuseipdb.js).
 */

import { checkOpenPhish } from './openphish.js';
import { checkPhishTank } from './phishtank.js';
import { checkUrlhaus } from './urlhaus.js';
import { getCached, setCached } from './local-cache.js';

const RESULT_TTL_MS = 60 * 60 * 1000; // 1 hour — balance freshness vs. free-tier rate limits
const BACKEND_URL_CHECK_ENDPOINT = 'http://localhost:3000/api/intelligence/url';

/**
 * Asks the backend to run the key-gated checks (Safe Browsing + VirusTotal).
 * Fails soft — if the backend is offline, the keyed checks are simply
 * skipped rather than blocking the whole reputation check.
 */
async function checkBackendIntelligence(url) {
  try {
    const res = await fetch(BACKEND_URL_CHECK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return []; // backend offline — degrade gracefully to the free, keyless feeds only
  }
}

/**
 * Checks a URL against all available threat-intel sources.
 * @param {string} url
 * @returns {Promise<{listed: boolean, sources: string[], details: object[]}>}
 */
export async function checkUrlReputation(url) {
  const cacheKey = `urlrep_${url}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached; // cache check happens BEFORE any network calls, including backend ones

  const [openphish, phishtank, urlhaus, backendResults] = await Promise.all([
    checkOpenPhish(url),
    checkPhishTank(url),
    checkUrlhaus(url),
    checkBackendIntelligence(url),
  ]);

  const allResults = [openphish, phishtank, urlhaus, ...backendResults];
  const listedBy = allResults.filter((r) => r.listed);

  const result = {
    listed: listedBy.length > 0,
    sources: listedBy.map((r) => r.source),
    details: allResults,
  };

  await setCached(cacheKey, result, RESULT_TTL_MS);
  return result;
}
