/**
 * Утилиты для HTTP сервера
 */

// Конфигурация CORS
const allowedOrigins = [
    'http://localhost:5174', // Vite/React
    'http://localhost:5173', // Vite default
    'http://localhost:8484', // Сервер БД
    'http://localhost:3000', // CRA
    'http://localhost:8080', // Vue
    'http://localhost:4200'  // Angular
  ];
  
  // Добавляем продакшен домены если нужно
  const productionOrigins = [
    // Добавьте свои продакшен-домены сюда
  ];
  
  const ALL_ORIGINS = process.env.NODE_ENV === 'production' 
    ? productionOrigins 
    : [...allowedOrigins, ...productionOrigins];
  
  /**
   * Установка CORS заголовков
   * Возвращает true если CORS разрешен, false если запрещен
   */
  export function setCORSHeaders(req, res) {
    const origin = req.headers.origin;
    
    // Если origin не указан (например, запрос из curl/postman) - разрешаем
    if (!origin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return true;
    }
    
    // Проверяем, разрешен ли origin
    const isOriginAllowed = ALL_ORIGINS.includes(origin) || origin.includes('localhost');
    
    if (isOriginAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      // Origin не разрешен
      return false;
    }
  
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа
    
    // Дополнительные заголовки безопасности
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    return true;
  }
  
  /**
   * Обработка OPTIONS запросов (preflight)
   */
  export function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
      const corsAllowed = setCORSHeaders(req, res);
      
      if (!corsAllowed) {
        res.writeHead(403);
        res.end('CORS not allowed');
        return false;
      }
      
      res.writeHead(204);
      res.end();
      return true;
    }
    
    return false;
  }
  
  /**
   * Безопасная отправка JSON с проверкой заголовков
   */
  export function sendJSON(req, res, statusCode, data, headers = {}) {
    // Проверяем, не отправлены ли уже заголовки
    if (res.headersSent) {
      console.warn('Headers already sent for:', req.url);
      return;
    }
    
    // Устанавливаем CORS если еще не установлены
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      setCORSHeaders(req, res);
    }
    
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...headers
    };
  
    try {
      res.writeHead(statusCode, responseHeaders);
      
      let responseData;
      try {
        responseData = JSON.stringify(data, null, 2);
      } catch (error) {
        console.error('Ошибка при сериализации JSON:', error);
        
        // Если заголовки еще не отправлены, отправляем ошибку
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Internal server error', 
            message: 'Failed to serialize response data' 
          }));
        }
        return;
      }
      
      res.end(responseData);
    } catch (error) {
      console.error('Error in sendJSON:', error);
    }
  }
  
  /**
   * Безопасная отправка ошибки
   */
  export function sendError(req, res, statusCode, message, details = null) {
    // Проверяем, не отправлены ли уже заголовки
    if (res.headersSent) {
      console.warn('Cannot send error, headers already sent for:', req.url);
      return;
    }
    
    const errorResponse = {
      error: true,
      message: message,
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    };
  
    if (details) {
      errorResponse.details = details;
    }
  
    sendJSON(req, res, statusCode, errorResponse);
  }
  
  /**
   * Парсинг тела запроса
   */
  export async function parseBody(req) {
    return new Promise((resolve, reject) => {
      // Только для методов с телом
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return resolve({});
      }
  
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          if (!body) return resolve({});
          
          const contentType = req.headers['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(body));
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams(body);
            const result = {};
            for (const [key, value] of params) {
              result[key] = value;
            }
            resolve(result);
          } else if (contentType.includes('multipart/form-data')) {
            // Для multipart/form-data нужно использовать библиотеку
            resolve({ raw: body, type: 'multipart' });
          } else {
            // Пробуем как JSON, если не получится, возвращаем как текст
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ raw: body });
            }
          }
        } catch (error) {
          reject(new Error(`Ошибка парсинга тела: ${error.message}`));
        }
      });
      
      req.on('error', reject);
    });
  }
  
  /**
   * Парсинг query параметров из URL
   */
  export function parseQuery(url, host = 'localhost') {
    try {
      const urlObj = new URL(url, `http://${host}`);
      const query = {};
      
      urlObj.searchParams.forEach((value, key) => {
        // Поддержка массивов: param[]=value1&param[]=value2
        if (key.endsWith('[]')) {
          const cleanKey = key.slice(0, -2);
          if (!query[cleanKey]) {
            query[cleanKey] = [];
          }
          query[cleanKey].push(value);
        } else {
          // Поддержка дублирующихся параметров
          if (query[key] !== undefined) {
            if (Array.isArray(query[key])) {
              query[key].push(value);
            } else {
              query[key] = [query[key], value];
            }
          } else {
            query[key] = value;
          }
        }
      });
      
      return query;
    } catch (error) {
      console.error('Error parsing query:', error);
      return {};
    }
  }
  
  /**
   * Валидация входящих данных
   */
  export function validateData(data, schema) {
    const errors = [];
  
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const isRequired = rules.required !== false;
  
      if (isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
  
      if (value !== undefined && value !== null) {
        if (rules.type) {
          let isValidType = false;
          const expectedType = rules.type;
          
          if (expectedType === 'array') {
            isValidType = Array.isArray(value);
          } else if (expectedType === 'number') {
            isValidType = typeof value === 'number' && !isNaN(value);
          } else if (expectedType === 'integer') {
            isValidType = Number.isInteger(value);
          } else if (expectedType === 'boolean') {
            isValidType = typeof value === 'boolean';
          } else if (expectedType === 'string') {
            isValidType = typeof value === 'string';
          } else if (expectedType === 'object') {
            isValidType = typeof value === 'object' && !Array.isArray(value) && value !== null;
          }
          
          if (!isValidType) {
            errors.push(`${field} must be ${rules.type}`);
          }
        }
        
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
        
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} has invalid format`);
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }
        
        if (rules.custom && !rules.custom(value)) {
          errors.push(`${field} failed custom validation`);
        }
      }
    }
  
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  
    return true;
  }
  
  /**
   * Рейт-лимитинг
   */
  export class RateLimiter {
    constructor(windowMs = 15 * 60 * 1000, max = 100) {
      this.windowMs = windowMs;
      this.max = max;
      this.hits = new Map();
    }
  
    check(ip) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      // Очистка старых записей
      for (const [key, { timestamp }] of this.hits.entries()) {
        if (timestamp < windowStart) {
          this.hits.delete(key);
        }
      }
  
      const hit = this.hits.get(ip);
      
      if (!hit) {
        this.hits.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: this.max - 1 };
      }
  
      if (hit.timestamp < windowStart) {
        this.hits.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: this.max - 1 };
      }
  
      if (hit.count >= this.max) {
        return { allowed: false, remaining: 0 };
      }
  
      hit.count++;
      return { allowed: true, remaining: this.max - hit.count };
    }
  
    reset() {
      this.hits.clear();
    }
  }
  
  /**
   * Мидлвара для аутентификации
   */
  export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(req, res, 401, 'Authentication required. Please provide a Bearer token.');
    }
    
    const token = authHeader.slice(7);
    
    // Здесь должна быть реальная проверка токена
    // Для примера: простейшая проверка JWT-like токена
    try {
      // Простейшая проверка (в реальном приложении используйте библиотеку JWT)
      if (token.length < 10) {
        throw new Error('Invalid token');
      }
      
      // Заглушка: всегда успешная аутентификация для тестирования
      req.user = { 
        id: 1, 
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
        token: token.substring(0, 10) + '...' // Не храним полный токен
      };
      
      if (next) next();
    } catch (error) {
      return sendError(req, res, 401, 'Invalid or expired token');
    }
  }
  
  /**
   * Логгирование запросов с улучшенным форматом
   */
  export function requestLogger(req, res) {
    const startTime = Date.now();
    const originalEnd = res.end;
    const originalWriteHead = res.writeHead;
    
    let statusCode = 200;
    let responseHeaders = {};
    
    // Перехватываем writeHead для получения статуса
    res.writeHead = function(code, headers) {
      statusCode = code;
      responseHeaders = headers || {};
      return originalWriteHead.apply(this, arguments);
    };
    
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      const timestamp = new Date().toISOString();
      
      // Цветное логирование в зависимости от статуса
      let statusColor = '\x1b[32m'; // зеленый для 2xx
      if (statusCode >= 400 && statusCode < 500) statusColor = '\x1b[33m'; // желтый для 4xx
      if (statusCode >= 500) statusColor = '\x1b[31m'; // красный для 5xx
      
      const logLine = `${timestamp} ${req.method} ${req.url} ${statusColor}${statusCode}\x1b[0m ${duration}ms`;
      
      console.log(logLine);
      
      // Логирование ошибок
      if (statusCode >= 400) {
        console.debug('Error details:', {
          method: req.method,
          url: req.url,
          status: statusCode,
          duration: `${duration}ms`,
          headers: responseHeaders
        });
      }
      
      originalEnd.apply(res, args);
    };
  }
  
  /**
   * Генерация уникального ID
   */
  export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return prefix + timestamp + random;
  }
  
  /**
   * Форматирование ответа с пагинацией
   */
  export function paginatedResponse(data, page, limit, total) {
    const currentPage = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const totalItems = parseInt(total) || data.length;
    
    return {
      data,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: currentPage * pageSize < totalItems,
        hasPrev: currentPage > 1,
        nextPage: currentPage * pageSize < totalItems ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null
      }
    };
  }
  
  /**
   * Middleware для обработки CORS (использовать в начале handleRequest)
   */
  export function corsMiddleware(req, res) {
    // Обработка preflight запросов
    if (req.method === 'OPTIONS') {
      const corsAllowed = setCORSHeaders(req, res);
      
      if (!corsAllowed) {
        res.writeHead(403);
        res.end('CORS not allowed');
        return false;
      }
      
      res.writeHead(204);
      res.end();
      return true; // Запрос обработан
    }
    
    // Для обычных запросов устанавливаем CORS
    const corsAllowed = setCORSHeaders(req, res);
    
    if (!corsAllowed) {
      res.writeHead(403);
      res.end('CORS not allowed');
      return false;
    }
    
    return true; // CORS установлен, можно продолжать
  }
  
  /**
   * Универсальный обработчик ошибок
   */
  export function errorHandler(error, req, res) {
    console.error('Unhandled error:', error);
    
    if (res.headersSent) {
      console.error('Cannot send error response, headers already sent');
      return;
    }
    
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'Internal server error';
    
    sendError(req, res, statusCode, message, 
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    );
  }
  
  /**
   * Проверка Content-Type
   */
  export function requireContentType(req, res, contentType = 'application/json') {
    const reqContentType = req.headers['content-type'];
    
    if (!reqContentType || !reqContentType.includes(contentType)) {
      sendError(req, res, 415, `Unsupported Media Type. Expected: ${contentType}`);
      return false;
    }
    
    return true;
  }