/**
 * Scans Controller
 */

import { query } from '../../postgres/db.js';

export async function storeScan(req, res) {
  const scan = req.body;

  if (!scan?.url || !scan?.risk) {
    return res.status(400).json({ error: 'Invalid scan payload — missing url or risk' });
  }

  try {
    await query(
      `INSERT INTO scans
        (url, hostname, trust_score, classification, https_enabled, domain_age_years,
         phishing_confidence, trackers_found, headers_score, cookies_flagged, cookies_total, raw_scan, scanned_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, to_timestamp($13/1000.0))`,
      [
        scan.url,
        scan.hostname,
        scan.risk.finalScore,
        scan.risk.classification,
        scan.reputation?.https ?? null,
        scan.reputation?.domainAge ?? null,
        scan.phishing?.confidence ?? null,
        scan.tracker?.trackersFound ?? null,
        scan.headers?.securityHeadersScore ?? null,
        scan.cookies?.flaggedCookies ?? null,
        scan.cookies?.totalCookies ?? null,
        JSON.stringify(scan),
        scan.scannedAt || Date.now(),
      ]
    );

    // Upsert threat_statistics aggregate row for this hostname
    await query(
      `INSERT INTO threat_statistics (hostname, total_scans, high_risk_count, phishing_flag_count, last_scanned_at)
       VALUES ($1, 1, $2, $3, now())
       ON CONFLICT (hostname) DO UPDATE SET
         total_scans = threat_statistics.total_scans + 1,
         high_risk_count = threat_statistics.high_risk_count + $2,
         phishing_flag_count = threat_statistics.phishing_flag_count + $3,
         last_scanned_at = now()`,
      [scan.hostname, scan.risk.classification === 'HIGH RISK' ? 1 : 0, scan.phishing?.isPotentialPhishing ? 1 : 0]
    );

    res.status(201).json({ stored: true });
  } catch (err) {
    console.error('storeScan error:', err);
    res.status(500).json({ error: 'Failed to store scan' });
  }
}

export async function getScanHistory(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    const result = await query(
      `SELECT id, raw_scan FROM scans ORDER BY scanned_at DESC LIMIT $1`,
      [limit]
    );
    // Attach the DB row id onto each scan object so the client has a stable
    // identifier to delete by (raw_scan itself has no durable primary key).
    const scans = result.rows.map((r) => ({ ...r.raw_scan, _id: r.id }));
    res.json({ scans });
  } catch (err) {
    console.error('getScanHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
}

export async function deleteScan(req, res) {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid scan id' });
  }

  try {
    const result = await query(`DELETE FROM scans WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json({ deleted: true, id: Number(id) });
  } catch (err) {
    console.error('deleteScan error:', err);
    res.status(500).json({ error: 'Failed to delete scan' });
  }
}

/**
 * Enforces the user's configured history-retention window (set in
 * options-page) by deleting scans older than N days. Called by the
 * extension's background-worker on a daily chrome.alarms trigger.
 * retentionDays=0 means "keep forever" — caller should simply not invoke
 * this endpoint in that case, but it's also handled defensively here.
 */
export async function deleteOlderThan(req, res) {
  const retentionDays = parseInt(req.body?.retentionDays, 10);

  if (!retentionDays || retentionDays <= 0) {
    return res.json({ deleted: 0, message: 'retentionDays <= 0 means keep forever — no scans deleted' });
  }

  try {
    const result = await query(
      `DELETE FROM scans WHERE scanned_at < now() - ($1 || ' days')::interval RETURNING id`,
      [retentionDays]
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('deleteOlderThan error:', err);
    res.status(500).json({ error: 'Failed to enforce retention policy' });
  }
}
