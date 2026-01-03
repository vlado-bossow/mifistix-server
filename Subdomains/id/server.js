const express = require('express');
const path = require('path');

// Shared модули
const config = require('../../shared/config');
const { errorHandler, asyncHandler } = require('../../shared/utils/errors');
const logger = require('../../shared/utils/logger');
const { setupHelmet, authLimiter, setupCORS } = require('../../shared/middleware/security');
const { setupRequestLogging, errorLogger } = require('../../shared/middleware/logger');
const { healthCheck } = require('../../shared/middleware/healthCheck');

const authRoutes = require('./Routes/authRoutes');

const app = express();

// Trust proxy для правильной работы за reverse proxy
app.set('trust proxy', 1);

// Безопасность
app.use(setupHelmet());
setupCORS(app);

// Логирование
setupRequestLogging(app);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting для авторизации
app.use('/api/auth/', authLimiter);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: config.servers.id.subdomain,
    message: 'Identity & Authentication Server',
    endpoints: {
      health: '/health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      verify: 'GET /api/auth/verify',
    },
  });
});

// Health check
app.get('/health', healthCheck);

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      path: req.path,
    },
  });
});

// Error handling
app.use(errorLogger);
app.use(errorHandler);

// Start server
const PORT = config.servers.id.port;
const HOST = config.servers.id.host;

app.listen(PORT, HOST, () => {
  logger.info(`🔐 Identity Server (${config.servers.id.subdomain}) started`, {
    port: PORT,
    host: HOST,
    environment: config.app.env,
  });
  console.log(`🔐 Identity Server (${config.servers.id.subdomain}) running on ${HOST}:${PORT}`);
  console.log(`📡 Auth API доступен: http://${HOST}:${PORT}/api/auth`);
  console.log(`   POST /api/auth/register - регистрация`);
  console.log(`   POST /api/auth/login - авторизация`);
  console.log(`   GET  /api/auth/verify - проверка токена`);
});

