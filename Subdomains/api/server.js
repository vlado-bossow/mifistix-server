const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const apiRoutes = require('./Routes/apiRoutes');

const app = express();

// Базовая защита HTTP-заголовков
app.use(helmet());

// CORS - разрешаем только для поддомена api.mifistix.com
app.use(cors({
  origin: ['https://api.mifistix.com', 'http://api.mifistix.com', 'http://localhost:3001','http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Ограничение частоты запросов
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 300, // максимум 300 запросов с одного IP за окно
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Парсинг JSON
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'api.mifistix.pl',
    message: 'API Server',
    endpoints: {
      health: '/health',
      allUsers: 'GET /api/users',
      allPosts: 'GET /api/posts',
      users: 'GET /api/users/:uid',
      userPosts: 'GET /api/users/:uid/posts',
      post: 'GET /api/posts/:postId',
      postStats: 'GET /api/posts/:postId/stats',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api.mifistix.pl' });
});

// API Routes
app.use('/api', apiRoutes);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API Server (api.mifistix.com) running on port ${PORT}`);
  console.log(`📡 API доступен: http://localhost:${PORT}/api`);
  console.log(`   GET /api/users - получить всех пользователей`);
  console.log(`   GET /api/posts - получить все посты`);
  console.log(`   GET /api/users/:uid - получить профиль пользователя`);
  console.log(`   GET /api/users/:uid/posts - получить посты пользователя`);
  console.log(`   GET /api/posts/:postId - получить пост`);
  console.log(`   GET /api/posts/:postId/stats - получить статистику поста`);
});