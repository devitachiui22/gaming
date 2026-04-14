const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const auth = require('../middlewares/authMiddleware');

// @route   POST /api/v1/games/match-result
// @desc    Submeter resultado de uma partida e ganhar prêmios
// @access  Private
router.post('/match-result', auth, gameController.submitMatchResult);

// @route   POST /api/v1/games/scan
// @desc    Resgatar código QR/Barcode para recompensa financeira
// @access  Private
router.post('/scan', auth, gameController.processScan);

module.exports = router;