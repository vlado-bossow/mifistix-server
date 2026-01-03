/**
 * Шаблон для создания поддоменов
 */
const express = require('express');
const config = require('../config');
const { errorHandler, asyncHandler } = require('./errors');
const logger = require('./logger');
const { setupHelmet, apiLimiter, setupCORS } = require('../middleware/security');
const { setupRequestLogging, errorLogger } = require('../middleware/logger');
const { healthCheck } = require('../middleware/healthCheck');

/**
 * Создаёт базовое Express приложение для поддомена
 */
function createSubdomainApp(subdomainName, port, options = {}) {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Безопасность
  app.use(setupHelmet());
  setupCORS(app);

  // Логирование
  setupRequestLogging(app);

  // Парсинг JSON
  app.use(express.json({ limit: options.jsonLimit || '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: options.urlLimit || '10mb' }));

  // Rate limiting (если не отключено)
  if (options.rateLimit !== false) {
    app.use('/api/', apiLimiter);
  }

  // Health check
  app.get('/health', healthCheck);

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

  return app;
}

/**
 * Запускает сервер поддомена
 */
function startSubdomainServer(subdomainName, app, port, host = 'localhost') {
  app.listen(port, host, () => {
    logger.info(`${subdomainName} server started`, {
      port,
      host,
      subdomain: subdomainName,
      environment: config.app.env,
    });
    console.log(`🚀 ${subdomainName} server running on ${host}:${port}`);
  });
}

module.exports = {
  createSubdomainApp,
  startSubdomainServer,
};

