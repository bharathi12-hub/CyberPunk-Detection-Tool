/**
 * Postgres Migration Script
 * Run with: npm run migrate
 * Creates all tables needed by the backend: scans, threat_stats, user_preferences, security_reports.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scans (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  trust_score INTEGER NOT NULL,
  classification TEXT NOT NULL,
  https_enabled BOOLEAN,
  domain_age_years NUMERIC,
  phishing_confidence INTEGER,
  trackers_found INTEGER,
  headers_score INTEGER,
  cookies_flagged INTEGER,
  cookies_total INTEGER,
  raw_scan JSONB NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_hostname ON scans (hostname);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans (scanned_at DESC);

CREATE TABLE IF NOT EXISTS threat_statistics (
  id SERIAL PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  total_scans INTEGER NOT NULL DEFAULT 0,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  phishing_flag_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  notify_high_risk BOOLEAN NOT NULL DEFAULT true,
  notify_downloads BOOLEAN NOT NULL DEFAULT true,
  block_trackers BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_reports (
  id SERIAL PRIMARY KEY,
  hostname TEXT NOT NULL,
  report JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(SCHEMA);
    console.log('✅ Migration complete: scans, threat_statistics, user_preferences, security_reports tables ready.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
