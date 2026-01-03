/**
 * Middleware для логирования запросов
 */
const morgan = require('morgan');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Формат логов для morgan
 */
const morganFormat = config.app.env === 'production'
  ? 'combined'
  : 'dev';

/**
 * Настройка логирования запросов
 */
const setupRequestLogging = (app) => {
  app.use(morgan(morganFormat, {
    stream: logger.stream,
    skip: (req, res) => {
      // Пропускаем health checks в production
      if (config.app.env === 'production' && req.path === '/health') {
        return true;
      }
      return false;
    },
  }));
};

/**
 * Middleware для логирования ошибок
 */
const errorLogger = (err, req, res, next) => {
  logger.error('Request Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next(err);
};

module.exports = {
  setupRequestLogging,
  errorLogger,
};

