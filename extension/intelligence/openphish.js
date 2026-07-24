/**
 * OpenPhish Intelligence Source
 * Uses OpenPhish's free community feed (a periodically-updated text list of
 * known phishing URLs). No API key required for the community feed.
 * Docs: https://openphish.com/phishing_feeds.html
 *
 * Strategy: download the feed periodically (e.g. every 6h via background-worker
 * alarm), cache it in chrome.storage.local as a Set, and check membership locally
 * — this avoids per-URL network calls and keeps lookups instant.
 */

import { getCached, setCached } from './local-cache.js';

const OPENPHISH_FEED_URL = 'https://openphish.com/feed.txt';
const FEED_CACHE_KEY = 'openphish_feed';
const FEED_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function refreshFeed() {
  try {
    const res = await fetch(OPENPHISH_FEED_URL);
    if (!res.ok) return null;
    const text = await res.text();
    const urls = text.split('\n').map((l) => l.trim()).filter(Boolean);
    await setCached(FEED_CACHE_KEY, urls, FEED_TTL_MS);
    return urls;
  } catch {
    return null;
  }
}

async function getFeed() {
  const cached = await getCached(FEED_CACHE_KEY);
  if (cached) return cached;
  const fresh = await refreshFeed();
  return fresh || [];
}

/**
 * @param {string} url
 * @returns {Promise<{listed: boolean, source: string}>}
 */
export async function checkOpenPhish(url) {
  const feed = await getFeed();
  // Exact match or "starts with" since feed entries sometimes include path components
  const listed = feed.some((entry) => url === entry || url.startsWith(entry));
  return { listed, source: 'OpenPhish' };
}
