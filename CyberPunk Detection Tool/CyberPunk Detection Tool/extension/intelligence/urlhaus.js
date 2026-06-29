/**
 * URLhaus Intelligence Source
 * Free, no-API-key-required malware/malicious-URL feed by abuse.ch.
 * Docs: https://urlhaus-api.abuse.ch/
 */

const URLHAUS_ENDPOINT = 'https://urlhaus-api.abuse.ch/v1/url/';

/**
 * @param {string} url - full URL to check
 * @returns {Promise<{listed: boolean, threat: string|null, source: string}>}
 */
export async function checkUrlhaus(url) {
  try {
    const res = await fetch(URLHAUS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    });

    if (!res.ok) return { listed: false, threat: null, source: 'URLhaus', error: 'unavailable' };

    const data = await res.json();
    if (data.query_status === 'ok') {
      return { listed: true, threat: data.threat || 'malware_download', source: 'URLhaus' };
    }
    return { listed: false, threat: null, source: 'URLhaus' };
  } catch (err) {
    return { listed: false, threat: null, source: 'URLhaus', error: err.message };
  }
}
