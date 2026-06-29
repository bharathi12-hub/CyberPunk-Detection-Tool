/**
 * Redis Client
 * Used for: caching threat-intel lookups server-side (longer TTL than the
 * extension's local-cache), and as a fast lookup for repeated AbuseIPDB/
 * Safe Browsing/VirusTotal checks.
 *
 * IMPORTANT: Redis is a performance/rate-limit optimization, not a hard
 * dependency for correctness. If Redis is unreachable, every cache call
 * fails soft (returns null / no-ops) instead of hanging the request —
 * the backend should keep working, just without caching, when Redis is down.
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 2000, // fail fast instead of hanging the caller
    reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 200, 1000)),
  },
});

redisClient.on('error', (err) => {
  // Logged once per error event by the client itself; avoid crashing the process.
  console.error('Redis Client Error:', err.message);
});

let connectionAttempted = false;
let isConnected = false;

/**
 * Attempts to connect once. If Redis is unreachable, marks the client as
 * unavailable and returns false instead of throwing/hanging — callers should
 * check the return value and skip caching rather than awaiting forever.
 */
async function ensureRedisConnected() {
  if (isConnected) return true;
  if (connectionAttempted) return false; // already tried and failed this process lifetime

  connectionAttempted = true;
  try {
    await redisClient.connect();
    isConnected = true;
    return true;
  } catch (err) {
    console.error('Redis unavailable — caching disabled for this session:', err.message);
    return false;
  }
}

redisClient.on('end', () => {
  isConnected = false;
});

export async function cacheGet(key) {
  const ready = await ensureRedisConnected();
  if (!ready) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('cacheGet error:', err.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  const ready = await ensureRedisConnected();
  if (!ready) return false;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.error('cacheSet error:', err.message);
    return false;
  }
}
