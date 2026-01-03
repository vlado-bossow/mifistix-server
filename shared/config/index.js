/**
 * Централизованная конфигурация для всех серверов
 */
require('dotenv').config();
const path = require('path');

const config = {
  // Общие настройки
  app: {
    name: process.env.APP_NAME || 'Mifistix Server',
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },

  // Настройки серверов
  servers: {
    database: {
      port: parseInt(process.env.DB_SERVER_PORT || '8484', 10),
      host: process.env.DB_SERVER_HOST || 'localhost',
    },
    main: {
      port: parseInt(process.env.MAIN_SERVER_PORT || '5000', 10),
      host: process.env.MAIN_SERVER_HOST || 'localhost',
    },
    api: {
      port: parseInt(process.env.API_PORT || '3001', 10),
      host: process.env.API_HOST || 'localhost',
      subdomain: process.env.API_SUBDOMAIN || 'api.mifistix.pl',
    },
    id: {
      port: parseInt(process.env.ID_PORT || '3002', 10),
      host: process.env.ID_HOST || 'localhost',
      subdomain: process.env.ID_SUBDOMAIN || 'id.mifistix.pl',
    },
    promo: {
      port: parseInt(process.env.PROMO_PORT || '3003', 10),
      host: process.env.PROMO_HOST || 'localhost',
      subdomain: process.env.PROMO_SUBDOMAIN || 'promo.mifistix.pl',
    },
    blog: {
      port: parseInt(process.env.BLOG_PORT || '3004', 10),
      host: process.env.BLOG_HOST || 'localhost',
      subdomain: process.env.BLOG_SUBDOMAIN || 'blog.mifistix.pl',
    },
    support: {
      port: parseInt(process.env.SUPPORT_PORT || '3005', 10),
      host: process.env.SUPPORT_HOST || 'localhost',
      subdomain: process.env.SUPPORT_SUBDOMAIN || 'support.mifistix.pl',
    },
    test: {
      port: parseInt(process.env.TEST_PORT || '3006', 10),
      host: process.env.TEST_HOST || 'localhost',
      subdomain: process.env.TEST_SUBDOMAIN || 'test.mifistix.pl',
    },
    staging: {
      port: parseInt(process.env.STAGING_PORT || '3007', 10),
      host: process.env.STAGING_HOST || 'localhost',
      subdomain: process.env.STAGING_SUBDOMAIN || 'staging.mifistix.pl',
    },
    dev: {
      port: parseInt(process.env.DEV_PORT || '3008', 10),
      host: process.env.DEV_HOST || 'localhost',
      subdomain: process.env.DEV_SUBDOMAIN || 'dev.mifistix.pl',
    },
    cron: {
      port: parseInt(process.env.CRON_PORT || '3009', 10),
      host: process.env.CRON_HOST || 'localhost',
      subdomain: process.env.CRON_SUBDOMAIN || 'cron.mifistix.pl',
    },
    backup: {
      port: parseInt(process.env.BACKUP_PORT || '3010', 10),
      host: process.env.BACKUP_HOST || 'localhost',
      subdomain: process.env.BACKUP_SUBDOMAIN || 'backup.mifistix.pl',
    },
    analytics: {
      port: parseInt(process.env.ANALYTICS_PORT || '3011', 10),
      host: process.env.ANALYTICS_HOST || 'localhost',
      subdomain: process.env.ANALYTICS_SUBDOMAIN || 'analytics.mifistix.pl',
    },
    mail: {
      port: parseInt(process.env.MAIL_PORT || '3012', 10),
      host: process.env.MAIL_HOST || 'localhost',
      subdomain: process.env.MAIL_SUBDOMAIN || 'mail.mifistix.pl',
    },
    admin: {
      port: parseInt(process.env.ADMIN_PORT || '3013', 10),
      host: process.env.ADMIN_HOST || 'localhost',
      subdomain: process.env.ADMIN_SUBDOMAIN || 'admin.mifistix.pl',
    },
  },

  // Безопасность
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'change-this-secret-key-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    bcrypt: {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    },
    cors: {
      allowedOrigins: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',')
        : [
            'http://localhost:3000', 
            'http://localhost:3001', 
            'http://localhost:3002',
            'http://localhost:5173',
            'http://localhost:5174',
            'https://mifistix.pl',
            'https://www.mifistix.pl',
            'https://api.mifistix.pl',
            'https://id.mifistix.pl',
          ],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 минут
      max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
      authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '50', 10), // Для авторизации
    },
  },

  // База данных
  database: {
    rootPath: process.env.DB_ROOT_PATH || 'E:\\SOCIAL_DB',
    sharding: {
      shardCount: parseInt(process.env.DB_SHARD_COUNT || '1000', 10),
      shardDigits: parseInt(process.env.DB_SHARD_DIGITS || '3', 10),
    },
  },

  // Логирование
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      path: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs'),
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '14', 10),
    },
  },

  // Мониторинг
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      path: process.env.HEALTH_CHECK_PATH || '/health',
    },
  },
};

// Валидация критических настроек
if (config.app.env === 'production') {
  if (config.security.jwt.secret === 'change-this-secret-key-in-production') {
    console.warn('⚠️  WARNING: Using default JWT secret in production!');
  }
  if (config.security.cors.allowedOrigins.includes('http://localhost:3000')) {
    console.warn('⚠️  WARNING: Localhost origins allowed in production!');
  }
}

module.exports = config;

