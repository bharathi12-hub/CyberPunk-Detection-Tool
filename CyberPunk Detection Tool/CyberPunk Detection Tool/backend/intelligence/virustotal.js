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
  // VirusTotal v3 identifies URLs by base64 (URL-safe, no padding) of the URL string.
  // Bounded padding match (base64 padding is 0-2 '=' chars) instead of an
  // unbounded `+` (CodeQL: polynomial regex).
  return Buffer.from(url).toString('base64').replace(/={1,2}$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const VIRUSTOTAL_ORIGIN = 'https://www.virustotal.com';

function vtUrl(path) {
  // Anchor every outbound request to VirusTotal's fixed origin. `path` is
  // built from `encodeUrlId`'s URL-safe-base64 output, which can never
  // contain '/', ':' or other URL-structural characters — but resolving
  // through `new URL()` and checking the resulting origin means that stays
  // true even if that encoding were ever loosened later, instead of relying
  // implicitly on it (CWE-918: server-side request forgery).
  const resolved = new URL(path, VIRUSTOTAL_ORIGIN + '/api/v3/');
  if (resolved.origin !== VIRUSTOTAL_ORIGIN) {
    throw new Error('refusing to call unexpected origin');
  }
  return resolved.toString();
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
    let response = await fetch(vtUrl(`urls/${urlId}`), {
      headers: { 'x-apikey': apiKey },
    });

    // Not previously scanned — submit it for analysis
    if (response.status === 404) {
      const submitRes = await fetch(vtUrl('urls'), {
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
