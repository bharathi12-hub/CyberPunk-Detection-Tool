/**
 * Intelligence Route
 * Proxies AbuseIPDB, Google Safe Browsing, and VirusTotal lookups — these
 * MUST live server-side since they require secret API keys that should
 * never ship in extension code.
 */

import express from 'express';
import { checkIpReputation, checkUrlIntelligence } from '../controllers/intelligenceController.js';

const router = express.Router();

router.get('/ip/:ip', checkIpReputation);
router.post('/url', checkUrlIntelligence);

export default router;
