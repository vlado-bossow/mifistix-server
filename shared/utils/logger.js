/**
 * Централизованное логирование
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Создаём папку для логов, если её нет
const logDir = config.logging.file.path;
if (config.logging.file.enabled && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Формат логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Формат для консоли (более читаемый)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Транспорты
const transports = [
  // Консоль
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logging.level,
  }),
];

// Файловые транспорты (если включены)
if (config.logging.file.enabled) {
  // Общий лог
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
    })
  );

  // Все логи
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
    })
  );
}

// Создаём логгер
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Создаём stream для Express morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;

