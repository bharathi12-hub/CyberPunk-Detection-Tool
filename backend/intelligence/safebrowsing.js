/**
 * Google Safe Browsing Intelligence Source
 * Free tier requires a free API key from Google Cloud Console
 * (enable the "Safe Browsing API" on a project, then create an API key).
 * https://developers.google.com/safe-browsing/v4/get-started
 *
 * BACKEND-ONLY: the API key must never ship inside extension code, since
 * client-side JS is fully readable by anyone who inspects the extension.
 */

const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * @param {string} url
 * @param {string} apiKey - from process.env.SAFE_BROWSING_API_KEY
 * @returns {Promise<{listed: boolean, source: string, details?: object}>}
 */
export async function checkSafeBrowsing(url, apiKey) {
  if (!apiKey) {
    return { listed: false, source: 'Google Safe Browsing', error: 'no_api_key_configured' };
  }

  try {
    const response = await fetch(`${SAFE_BROWSING_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'cyberpunk-detection-tool', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });

    if (!response.ok) {
      return { listed: false, source: 'Google Safe Browsing', error: `http_${response.status}` };
    }

    const data = await response.json();

    return {
      listed: !!data.matches,
      source: 'Google Safe Browsing',
      details: data.matches || null,
    };
  } catch (err) {
    return { listed: false, source: 'Google Safe Browsing', error: err.message };
  }
}
