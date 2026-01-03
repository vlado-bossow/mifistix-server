const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');

// Регистрация
router.post('/register', authController.register);

// Авторизация
router.post('/login', authController.login);

// Проверка токена
router.get('/verify', authController.verify);

module.exports = router;

