/**
 * Middleware для безопасности
 */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Настройка Helmet
 */
const setupHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
};

/**
 * Rate limiter для API
 */
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Слишком много запросов, попробуйте позже',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => {
    // Пропускаем health checks
    return req.path === '/health' || req.path === '/healthz';
  },
});

/**
 * Rate limiter для авторизации (более строгий)
 */
const authLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Слишком много попыток авторизации, попробуйте позже',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skipSuccessfulRequests: true, // Не считаем успешные запросы
});

/**
 * CORS настройка
 */
const setupCORS = (app) => {
  const cors = require('cors');
  app.use(cors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, Postman, мобильные приложения)
      if (!origin) {
        return callback(null, true);
      }

      if (config.security.cors.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: config.security.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));
};

module.exports = {
  setupHelmet,
  apiLimiter,
  authLimiter,
  setupCORS,
};

