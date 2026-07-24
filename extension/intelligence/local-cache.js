/**
 * Local Cache (Intelligence Layer)
 * Caches threat-intel lookups in chrome.storage.local to respect free-tier
 * rate limits and speed up repeat visits to the same domain.
 */

const CACHE_PREFIX = 'threatintel_cache_';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function isExtensionContext() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

// In-memory fallback for non-extension contexts (e.g. backend/Node, tests)
const memoryStore = new Map();

export async function getCached(key) {
  const fullKey = CACHE_PREFIX + key;

  if (isExtensionContext()) {
    const result = await chrome.storage.local.get(fullKey);
    const entry = result[fullKey];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await chrome.storage.local.remove(fullKey);
      return null;
    }
    return entry.value;
  }

  const entry = memoryStore.get(fullKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return null;
  }
  return entry.value;
}

export async function setCached(key, value, ttlMs = DEFAULT_TTL_MS) {
  const fullKey = CACHE_PREFIX + key;
  const entry = { value, expiresAt: Date.now() + ttlMs };

  if (isExtensionContext()) {
    await chrome.storage.local.set({ [fullKey]: entry });
  } else {
    memoryStore.set(fullKey, entry);
  }
}

export async function clearCache() {
  if (isExtensionContext()) {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
  } else {
    memoryStore.clear();
  }
}
