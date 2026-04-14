const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST /api/v1/auth/register
// @desc    Registrar um novo jogador e dar bônus inicial
// @access  Public
router.post('/register', authController.register);

// @route   POST /api/v1/auth/login
// @desc    Autenticar usuário e retornar JWT
// @access  Public
router.post('/login', authController.login);

module.exports = router;