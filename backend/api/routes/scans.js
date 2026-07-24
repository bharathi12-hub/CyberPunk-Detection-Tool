/**
 * Scans Route
 * Stores incoming scans from the extension's background-worker, serves
 * history to the dashboard, supports deleting individual scan records, and
 * enforces the user's configured history-retention window.
 */

import express from 'express';
import { storeScan, getScanHistory, deleteScan, deleteOlderThan } from '../controllers/scansController.js';

const router = express.Router();

router.post('/', storeScan);
router.get('/history', getScanHistory);
router.delete('/:id', deleteScan);
router.post('/retention', deleteOlderThan);

export default router;
