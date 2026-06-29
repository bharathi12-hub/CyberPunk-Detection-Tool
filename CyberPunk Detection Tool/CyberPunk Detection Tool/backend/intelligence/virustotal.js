/**
 * VirusTotal Intelligence Source
 * Free tier: 4 requests/minute, 500/day. Sign up at https://www.virustotal.com/gui/join-us
 *
 * BACKEND-ONLY: requires a secret API key, and the free-tier rate limit is
 * tight enough that calls must be cached aggressively (see intelligenceController.js).
 *
 * API flow: VirusTotal v3 requires submitting the URL for analysis, then
 * polling/reading the analysis result via its base64-encoded URL ID. For a
 * URL that's already been scanned before by anyone, the same ID lookup
 * returns existing results immediately without needing a fresh scan.
 */

function encodeUrlId(url) {
  // VirusTotal v3 identifies URLs by base64 (URL-safe, no padding) of the URL string
  return Buffer.from(url).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * @param {string} url
 * @param {string} apiKey - from process.env.VIRUSTOTAL_API_KEY
 * @returns {Promise<{listed: boolean, source: string, maliciousCount?: number}>}
 */
export async function checkVirusTotal(url, apiKey) {
  if (!apiKey) {
    return { listed: false, source: 'VirusTotal', error: 'no_api_key_configured' };
  }

  try {
    const urlId = encodeUrlId(url);

    // Try reading an existing analysis first (avoids burning a submission call)
    let response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
    });

    // Not previously scanned — submit it for analysis
    if (response.status === 404) {
      const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}`,
      });
      if (!submitRes.ok) {
        return { listed: false, source: 'VirusTotal', error: `submit_http_${submitRes.status}` };
      }
      // Newly submitted URLs need analysis time; report "not yet known" rather
      // than blocking the page load on a multi-second scan.
      return { listed: false, source: 'VirusTotal', pending: true };
    }

    if (!response.ok) {
      return { listed: false, source: 'VirusTotal', error: `http_${response.status}` };
    }

    const data = await response.json();
    const stats = data.data?.attributes?.last_analysis_stats;
    const maliciousCount = (stats?.malicious || 0) + (stats?.suspicious || 0);

    return {
      listed: maliciousCount > 0,
      source: 'VirusTotal',
      maliciousCount,
    };
  } catch (err) {
    return { listed: false, source: 'VirusTotal', error: err.message };
  }
}
