/**
 * AI Route
 * Proxies requests to the Anthropic API (key stays server-side, never shipped
 * to the extension). Powers ai/risk-explainer.js and ai/phishing-explainer.js
 * on the client.
 */

import express from 'express';
import { explainRisk, explainPhishing } from '../controllers/aiController.js';

const router = express.Router();

router.post('/explain-risk', explainRisk);
router.post('/explain-phishing', explainPhishing);

export default router;
