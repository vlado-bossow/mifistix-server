const express = require('express');
const router = express.Router();
const adminController = require('../Controllers/adminController');

// Авторизация
router.post('/auth/login', adminController.login);

// Регистрация
router.post('/auth/register', adminController.register);

// Проверка токена
router.get('/auth/verify', adminController.verify);

module.exports = router;








