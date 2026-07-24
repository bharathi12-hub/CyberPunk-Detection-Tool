/**
 * Analytics Controller
 * Aggregates threat statistics across all stored scans — powers a
 * "global" analytics view (e.g. most-flagged domains, trend over time)
 * distinct from the per-tab dashboard overview.
 */

import { query } from '../../postgres/db.js';

export async function getSummary(req, res) {
  try {
    const [totals, topRisky, recentTrend] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total_scans,
          COUNT(*) FILTER (WHERE classification = 'HIGH RISK')::int AS high_risk_count,
          COUNT(*) FILTER (WHERE classification = 'MEDIUM RISK')::int AS medium_risk_count,
          COUNT(*) FILTER (WHERE classification = 'LOW RISK')::int AS low_risk_count,
          ROUND(AVG(trust_score))::int AS avg_trust_score,
          SUM(trackers_found)::int AS total_trackers_found
        FROM scans
      `),
      query(`
        SELECT hostname, total_scans, high_risk_count, phishing_flag_count
        FROM threat_statistics
        ORDER BY high_risk_count DESC, phishing_flag_count DESC
        LIMIT 10
      `),
      query(`
        SELECT date_trunc('day', scanned_at) AS day, COUNT(*)::int AS scans, ROUND(AVG(trust_score))::int AS avg_score
        FROM scans
        WHERE scanned_at > now() - interval '14 days'
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    res.json({
      totals: totals.rows[0],
      topRiskyHostnames: topRisky.rows,
      recentTrend: recentTrend.rows,
    });
  } catch (err) {
    console.error('getSummary error:', err);
    res.status(500).json({ error: 'Failed to compute analytics summary' });
  }
}
