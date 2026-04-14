const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');

router.get('/profile', auth, userController.getProfile);
router.get('/wallet', auth, userController.getWalletHistory);
router.get('/ranking', userController.getRanking);

module.exports = router;