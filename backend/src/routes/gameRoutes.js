const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const auth = require('../middlewares/authMiddleware');

router.post('/score', auth, gameController.submitScore);
router.post('/scan', auth, gameController.processScan);

module.exports = router;