/**
 * =============================================================================
 * FLUX GAME - USER & SOCIAL ROUTES
 * Purpose: Managing profile data, wallet history, and competitive ranking.
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/v1/users/profile
 * @desc    Returns complete profile data including gamification progress
 * @access  Private
 */
router.get('/profile', auth, userController.getProfile);

/**
 * @route   GET /api/v1/users/wallet
 * @desc    Retrieves financial audit trail (transactions)
 * @access  Private
 */
router.get('/wallet', auth, userController.getWalletHistory);

/**
 * @route   GET /api/v1/users/ranking
 * @desc    Returns global top players list based on FluxCoins
 * @access  Public (No Auth required to encourage competition)
 */
router.get('/ranking', userController.getRanking);

/**
 * @route   PATCH /api/v1/users/profile
 * @desc    Updates user metadata (name, avatar)
 * @access  Private
 */
router.patch('/profile', auth, userController.updateProfile);

module.exports = router;