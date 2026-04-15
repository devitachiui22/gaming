/**
 * =============================================================================
 * FLUX GAME - AUTHENTICATION ROUTES
 * Purpose: Public endpoints for registration and login.
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registers a new player and initializes wallet/bonus
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticates user and returns JWT
 * @access  Public
 */
router.post('/login', authController.login);

module.exports = router;