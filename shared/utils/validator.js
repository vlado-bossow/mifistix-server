/**
 * Валидация входных данных
 */
const { ValidationError } = require('./errors');

/**
 * Валидация регистрации
 */
const validateRegister = (data) => {
  const errors = [];

  // Имя
  if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length < 2) {
    errors.push({ field: 'firstName', message: 'Имя должно содержать минимум 2 символа' });
  }

  // Фамилия
  if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length < 2) {
    errors.push({ field: 'lastName', message: 'Фамилия должна содержать минимум 2 символа' });
  }

  // Username
  if (!data.username || typeof data.username !== 'string') {
    errors.push({ field: 'username', message: 'Имя пользователя обязательно' });
  } else {
    const usernameRegex = /^[a-zA-Z0-9._-]{3,20}$/;
    if (!usernameRegex.test(data.username)) {
      errors.push({ 
        field: 'username', 
        message: 'Имя пользователя должно содержать 3-20 символов (буквы, цифры, точка, дефис, подчёркивание)' 
      });
    }
  }

  // Пароль
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Пароль обязателен' });
  } else {
    if (data.password.length < 8) {
      errors.push({ field: 'password', message: 'Пароль должен содержать минимум 8 символов' });
    }
    if (!/[A-Za-zА-Яа-я]/.test(data.password)) {
      errors.push({ field: 'password', message: 'Пароль должен содержать буквы' });
    }
    if (!/[0-9]/.test(data.password)) {
      errors.push({ field: 'password', message: 'Пароль должен содержать цифры' });
    }
  }

  // Подтверждение пароля
  if (data.password !== data.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Пароли не совпадают' });
  }

  // Телефон (опционально)
  if (data.phone && typeof data.phone === 'string') {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(data.phone.replace(/[\s()-]/g, ''))) {
      errors.push({ field: 'phone', message: 'Неверный формат телефона' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Ошибки валидации', errors);
  }

  return true;
};

/**
 * Валидация авторизации
 */
const validateLogin = (data) => {
  const errors = [];

  if (!data.username || typeof data.username !== 'string' || data.username.trim().length === 0) {
    errors.push({ field: 'username', message: 'Имя пользователя обязательно' });
  }

  if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
    errors.push({ field: 'password', message: 'Пароль обязателен' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Ошибки валидации', errors);
  }

  return true;
};

/**
 * Валидация UID
 */
const validateUid = (uid) => {
  const numUid = parseInt(uid, 10);
  if (isNaN(numUid) || numUid <= 0 || numUid.toString().length !== 12) {
    throw new ValidationError('Неверный формат UID');
  }
  return numUid;
};

/**
 * Валидация Post ID
 */
const validatePostId = (postId) => {
  const numId = parseInt(postId, 10);
  if (isNaN(numId) || numId <= 0) {
    throw new ValidationError('Неверный формат ID поста');
  }
  return numId;
};

/**
 * Санитизация строки
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Санитизация объекта
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = {
  validateRegister,
  validateLogin,
  validateUid,
  validatePostId,
  sanitizeString,
  sanitizeObject,
};

