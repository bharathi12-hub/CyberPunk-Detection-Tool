/**
 * Intelligence Controller
 */

import dotenv from 'dotenv';
import { checkAbuseIPDB } from '../../intelligence/abuseipdb.js';
import { checkSafeBrowsing } from '../../intelligence/safebrowsing.js';
import { checkVirusTotal } from '../../intelligence/virustotal.js';
import { cacheGet, cacheSet } from '../../redis/client.js';

dotenv.config();

export async function checkIpReputation(req, res) {
  const { ip } = req.params;
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipPattern.test(ip)) {
    return res.status(400).json({ error: 'Invalid IP address format' });
  }

  try {
    const cacheKey = `abuseipdb_${ip}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });

    const result = await checkAbuseIPDB(ip, process.env.ABUSEIPDB_API_KEY);
    await cacheSet(cacheKey, result, 6 * 60 * 60); // 6h TTL, respects free-tier limits

    res.json(result);
  } catch (err) {
    console.error('checkIpReputation error:', err);
    res.status(500).json({ error: 'IP reputation check failed' });
  }
}

/**
 * Runs the key-gated URL checks (Google Safe Browsing + VirusTotal) used by
 * extension/intelligence/index.js. Cached aggressively in Redis since
 * VirusTotal's free tier is limited to 4 requests/minute.
 */
export async function checkUrlIntelligence(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const cacheKey = `urlintel_${url}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ results: cached, fromCache: true });

    const [safeBrowsing, virusTotal] = await Promise.all([
      checkSafeBrowsing(url, process.env.SAFE_BROWSING_API_KEY),
      checkVirusTotal(url, process.env.VIRUSTOTAL_API_KEY),
    ]);

    const results = [safeBrowsing, virusTotal];
    await cacheSet(cacheKey, results, 6 * 60 * 60); // 6h TTL, respects VirusTotal's tight free-tier limit

    res.json({ results });
  } catch (err) {
    console.error('checkUrlIntelligence error:', err);
    res.status(500).json({ error: 'URL intelligence check failed' });
  }
}
