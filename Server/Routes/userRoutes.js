const express = require('express');
const router = express.Router();
const userController = require('../Controllers/userController');
const authMiddleware = require('../Middlewares/authMiddleware');

// Регистрация
router.post('/register', userController.register);

// Авторизация
router.post('/login', userController.login);

// Получение профиля (защищенный маршрут)
router.get('/profile', authMiddleware, userController.getProfile);

module.exports = router;