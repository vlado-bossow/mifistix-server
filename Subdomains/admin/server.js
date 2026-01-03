const express = require('express');
const path = require('path');

// Shared модули
const config = require('../../shared/config');
const { errorHandler, asyncHandler } = require('../../shared/utils/errors');
const logger = require('../../shared/utils/logger');
const { setupHelmet, authLimiter, setupCORS } = require('../../shared/middleware/security');
const { setupRequestLogging, errorLogger } = require('../../shared/middleware/logger');
const { healthCheck } = require('../../shared/middleware/healthCheck');

const adminRoutes = require('./Routes/adminRoutes');

const app = express();

// Trust proxy для правильной работы за reverse proxy
app.set('trust proxy', 1);

// Безопасность
app.use(setupHelmet());

// CORS для админки - разрешаем Vite dev server
const cors = require('cors');
app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin
    if (!origin) {
      return callback(null, true);
    }
    
    // Разрешаем localhost с любым портом для разработки
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }
    
    // Проверяем разрешенные источники из конфига
    if (config.security.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Логирование
setupRequestLogging(app);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting для админки
app.use('/api/admin/', authLimiter);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: config.servers.admin.subdomain,
    message: 'Admin Panel Server',
    endpoints: {
      health: '/health',
      login: 'POST /api/admin/auth/login',
      register: 'POST /api/admin/auth/register',
      verify: 'GET /api/admin/auth/verify',
    },
  });
});

// Health check
app.get('/health', healthCheck);

// API Routes
app.use('/api/admin', adminRoutes);

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
const PORT = config.servers.admin.port;
const HOST = config.servers.admin.host;

app.listen(PORT, HOST, () => {
  logger.info(`🔐 Admin Server (${config.servers.admin.subdomain}) started`, {
    port: PORT,
    host: HOST,
    environment: config.app.env,
  });
  console.log(`🔐 Admin Server (${config.servers.admin.subdomain}) running on ${HOST}:${PORT}`);
  console.log(`📡 Admin API доступен: http://${HOST}:${PORT}/api/admin`);
  console.log(`   POST /api/admin/auth/login - авторизация`);
  console.log(`   POST /api/admin/auth/register - регистрация`);
  console.log(`   GET  /api/admin/auth/verify - проверка токена`);
});

