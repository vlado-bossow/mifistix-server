const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const userRoutes = require('./Routes/userRoutes');

const app = express();

// Базовая защита HTTP-заголовков
app.use(helmet());

// CORS (при желании можно сузить origin до конкретного домена)
app.use(cors());

// Ограничение частоты запросов (защита от брутфорса и DDoS)
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
    service: 'mifistix.pl',
    message: 'Main Server',
    endpoints: {
      users: 'GET /api/users/*',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mifistix.pl' });
});

// Routes
app.use('/api/users', userRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});