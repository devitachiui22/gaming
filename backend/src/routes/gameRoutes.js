/**
 * =============================================================================
 * FLUX GAME - GAME LOGIC ROUTES
 * Purpose: Protected endpoints for gameplay telemetry and rewards.
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const auth = require('../middlewares/authMiddleware');

/**
 * @route   POST /api/v1/games/match-result
 * @desc    Submits game points and processes financial/XP rewards
 * @access  Private (JWT Required)
 */
router.post('/match-result', auth, gameController.submitMatchResult);

/**
 * @route   POST /api/v1/games/scan
 * @desc    Redeems unique QR/Barcodes for instant wallet credit
 * @access  Private (JWT Required)
 */
router.post('/scan', auth, gameController.processScan);

module.exports = router;