/**
 * Backend API Server
 * Express app exposing:
 *   POST   /api/scans              - store a new scan from the extension
 *   GET    /api/scans/history      - retrieve scan history for dashboard
 *   DELETE /api/scans/:id          - delete an individual scan record
 *   POST   /api/scans/retention    - enforce history-retention window (deletes scans older than N days)
 *   POST   /api/ai/explain-risk    - AI risk explanation (Anthropic-backed)
 *   POST   /api/ai/explain-phishing - AI phishing explanation
 *   GET    /api/intelligence/ip/:ip - AbuseIPDB-backed IP reputation check
 *   POST   /api/intelligence/url    - Safe Browsing + VirusTotal URL check
 *   GET    /api/analytics/summary  - aggregate threat statistics
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import scansRouter from './routes/scans.js';
import aiRouter from './routes/ai.js';
import intelligenceRouter from './routes/intelligence.js';
import analyticsRouter from './routes/analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

// Global rate limit — generous, since most calls come from a single user's
// own extension instance, but protects against runaway loops/bugs.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/scans', scansRouter);
app.use('/api/ai', aiRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/analytics', analyticsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`⚡ CyberPunk Detection Tool backend running on http://localhost:${PORT}`);
});
