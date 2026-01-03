/**
 * Health check middleware
 */
const config = require('../config');
const { checkDatabaseHealth, getDatabaseStatus } = require('../utils/database');

/**
 * Простой health check
 */
const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env,
    version: config.app.version,
  });
};

/**
 * Расширенный health check с проверкой зависимостей
 */
const healthCheckDetailed = async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env,
    version: config.app.version,
    checks: {
      database: 'unknown',
      memory: 'unknown',
    },
  };

  // Проверка памяти
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };

  health.checks.memory = {
    status: 'ok',
    usage: memUsageMB,
  };

  // Проверка базы данных
  try {
    const dbAvailable = await checkDatabaseHealth();
    const dbStatus = getDatabaseStatus();
    
    if (dbAvailable) {
      health.checks.database = {
        status: 'ok',
        message: 'Database available',
        initialized: dbStatus.initialized,
      };
    } else {
      health.checks.database = {
        status: 'degraded',
        message: 'Database not available - server can work in degraded mode',
        error: dbStatus.error,
        canWorkWithoutDB: true,
      };
      // Сервер может работать без БД, поэтому не меняем общий статус на degraded
    }
  } catch (error) {
    health.checks.database = {
      status: 'error',
      message: error.message,
      canWorkWithoutDB: true,
    };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
};

module.exports = {
  healthCheck,
  healthCheckDetailed,
};

