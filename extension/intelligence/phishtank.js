/**
 * PhishTank Intelligence Source
 * Free phishing URL database. Works without a key at low volume; an
 * optional free API key raises rate limits.
 * Docs: https://www.phishtank.com/developer_info.php
 *
 * Set PHISHTANK_API_KEY in backend/.env to enable the keyed (higher-limit) mode.
 * Without a key, this still works for moderate request volumes.
 */

const PHISHTANK_ENDPOINT = 'https://checkurl.phishtank.com/checkurl/';

/**
 * @param {string} url
 * @param {string} [apiKey] - optional, only used server-side (backend)
 * @returns {Promise<{listed: boolean, verified: boolean|null, source: string}>}
 */
export async function checkPhishTank(url, apiKey = null) {
  try {
    const body = new URLSearchParams({
      url,
      format: 'json',
      ...(apiKey ? { app_key: apiKey } : {}),
    });

    const res = await fetch(PHISHTANK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return { listed: false, verified: null, source: 'PhishTank', error: 'unavailable' };

    const data = await res.json();
    const result = data.results;
    if (result && result.in_database) {
      return {
        listed: true,
        verified: result.verified === 'y' || result.verified === true,
        source: 'PhishTank',
      };
    }
    return { listed: false, verified: null, source: 'PhishTank' };
  } catch (err) {
    return { listed: false, verified: null, source: 'PhishTank', error: err.message };
  }
}
