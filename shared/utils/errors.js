/**
 * Централизованная обработка ошибок
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR', true);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR', true);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Authorization failed') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT', true);
  }
}

/**
 * Обработчик ошибок для Express
 */
const errorHandler = (err, req, res, next) => {
  // Логирование ошибки
  if (err.isOperational) {
    console.error('Operational Error:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    console.error('Unexpected Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Формирование ответа
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      timestamp: err.timestamp || new Date().toISOString(),
    },
  };

  // Добавляем детали валидации, если есть
  if (err.errors && Array.isArray(err.errors)) {
    response.error.errors = err.errors;
  }

  // В production не показываем stack trace
  if (process.env.NODE_ENV !== 'production' && !err.isOperational) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper для автоматической обработки ошибок
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  errorHandler,
  asyncHandler,
};

