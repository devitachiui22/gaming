const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');

// @route   GET /api/v1/users/profile
// @desc    Obter dados completos do perfil do usuário logado
// @access  Private
router.get('/profile', auth, userController.getProfile);

// @route   GET /api/v1/users/wallet
// @desc    Obter histórico de transações financeiras
// @access  Private
router.get('/wallet', auth, userController.getWalletHistory);

// @route   GET /api/v1/users/ranking
// @desc    Obter o ranking global de jogadores
// @access  Public (Para atrair novos jogadores)
router.get('/ranking', userController.getRanking);

// @route   PATCH /api/v1/users/profile
// @desc    Atualizar nome ou avatar
// @access  Private
router.patch('/profile', auth, userController.updateProfile);

module.exports = router;