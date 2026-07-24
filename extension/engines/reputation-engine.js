/**
 * Reputation Engine
 * Checks: HTTPS, Domain age, SSL certificate, URL structure, Redirect chains, DNS reputation
 * Output: Trust Score (0-100), Domain Age, HTTPS status, Threat Feed status
 */

import { checkUrlReputation } from '../intelligence/index.js';
import { getCached, setCached } from '../intelligence/local-cache.js';

const SUSPICIOUS_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.work'];
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'buff.ly'];

// Domain registration dates never change, so a long cache TTL is both correct
// and necessary: RDAP.org's free Cloudflare-fronted endpoint enforces a strict
// 10-requests-per-10-seconds limit, which normal multi-tab browsing blows
// through almost immediately without caching — this was the root cause of
// "domain age only shows for some sites." A 7-day TTL means each distinct
// hostname is only looked up once per week at most, keeping us comfortably
// under the limit during real browsing sessions.
const DOMAIN_AGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Estimate domain age using a free RDAP lookup (no API key required).
 * Falls back gracefully if RDAP has no record (rate-limited or unsupported TLD).
 */
export async function expandShortUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow"
    });
    // response.url can be empty for opaque cross-origin responses even when
    // the fetch itself "succeeds" — never propagate a falsy URL upstream,
    // since callers do `new URL(result)` and an empty string throws.
    return response.url || url;
  } catch {
    return url;
  }
}
async function getDomainAge(hostname) {
  const cacheKey = `domainage_${hostname}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  let result;
  try {
    const res = await fetch(`https://rdap.org/domain/${hostname}`, { method: 'GET' });

    if (res.status === 429) {
      // Rate-limited — don't cache this outcome (it's transient, not a fact
      // about the domain), just report it distinctly so it's not confused
      // with "this TLD genuinely has no RDAP record."
      return { years: null, source: 'rate-limited' };
    }

    if (!res.ok) {
      result = { years: null, source: 'unavailable' };
    } else {
      const data = await res.json();
      const registrationEvent = (data.events || []).find(
        (e) => e.eventAction === 'registration'
      );

      if (!registrationEvent) {
        result = { years: null, source: 'unavailable' };
      } else {
        const registeredDate = new Date(registrationEvent.eventDate);
        const years = (Date.now() - registeredDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        result = { years: Math.floor(years * 10) / 10, source: 'rdap' };
      }
    }
  } catch (err) {
    return { years: null, source: 'error' }; // network error — also transient, don't cache
  }

  await setCached(cacheKey, result, DOMAIN_AGE_CACHE_TTL_MS);
  return result;
}

function checkHttps(url) {
  return url.startsWith('https://');
}

function checkUrlStructure(url) {
  const issues = [];
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { issues: ['Malformed URL'], suspicious: true };
  }

  // IP address as hostname instead of domain name
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipPattern.test(hostname)) {
    issues.push('Hostname is a raw IP address');
  }

  // Excessive subdomains (common obfuscation technique)
  const labelCount = hostname.split('.').length;
  if (labelCount >= 5) {
    issues.push('Unusually high number of subdomains');
  }

  // Suspicious TLD
  if (SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld))) {
    issues.push('Domain uses a TLD commonly associated with abuse');
  }

  // '@' in URL — classic redirect-spoofing trick
  if (url.includes('@')) {
    issues.push("URL contains '@' which can mask the real destination");
  }

  // Known URL shortener
  if (URL_SHORTENERS.some((s) => hostname.includes(s))) {
    issues.push('URL shortener detected — real destination is hidden');
  }

  // Hyphen-heavy hostnames imitating brands (e.g. paypal-secure-login.com)
  if ((hostname.match(/-/g) || []).length >= 3) {
    issues.push('Hostname has an unusually high number of hyphens');
  }

  return { issues, suspicious: issues.length > 0 };
}

/**
 * Follow redirect chain using a HEAD request (manual redirect mode).
 * Browser extensions can also get this via webRequest API; this is the
 * fallback/manual check used by background-worker.
 */
async function getRedirectChain(url, maxHops = 5) {
  const chain = [url];
  let current = url;

  for (let i = 0; i < maxHops; i++) {
    try {
      const res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
      const location = res.headers.get('location');
      if (!location || res.type !== 'opaqueredirect' && res.status < 300) break;
      if (!location) break;
      const next = new URL(location, current).href;
      if (chain.includes(next)) break; // redirect loop guard
      chain.push(next);
      current = next;
    } catch {
      break;
    }
  }
  return chain;
}

/**
 * Main entry point: scores a URL's reputation.
 * @param {string} url
 * @returns {Promise<object>} reputation result
 */
export async function analyzeReputation(url) {
  const initialHostname = new URL(url).hostname;
  if (URL_SHORTENERS.some((s) => initialHostname.includes(s))) {
    url = await expandShortUrl(url);
  }
  const hostname = new URL(url).hostname;

  const [domainAge, structure, threatFeed, redirectChain] = await Promise.all([
    getDomainAge(hostname),
    Promise.resolve(checkUrlStructure(url)),
    checkUrlReputation(url),
    getRedirectChain(url),
  ]);

  const https = checkHttps(url);

  // Scoring model (out of 100)
  let score = 100;
  if (!https) score -= 25;
  if (structure.suspicious) score -= structure.issues.length * 8;
  if (domainAge.years !== null && domainAge.years < 1) score -= 20;
  if (domainAge.years !== null && domainAge.years < 0.25) score -= 15; // extra penalty, brand-new domain
  if (threatFeed.listed) score -= 50;
  if (redirectChain.length > 2) score -= 10 * (redirectChain.length - 2);

  score = Math.max(0, Math.min(100, score));

  return {
    url,
    hostname,
    trustScore: score,
    https,
    domainAge: domainAge.years,
    domainAgeSource: domainAge.source,
    threatFeedClean: !threatFeed.listed,
    threatFeedSources: threatFeed.sources,
    urlStructureIssues: structure.issues,
    redirectChain,
    redirectCount: redirectChain.length - 1,
  };
}
