const jwt = require('jsonwebtoken');

// Требуем установленный секретный ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    '[SECURITY] JWT_SECRET не задан в переменных окружения. ' +
    'Установи сильный секрет в .env (JWT_SECRET=сложный_ключ).'
  );
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Нет токена, авторизация отклонена' });
  }

  const token = parts[1];

  if (!token) {
    return res.status(401).json({ message: 'Нет токена, авторизация отклонена' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET || 'your-secret-key');
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role || 'user'
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Токен недействителен' });
  }
};

module.exports = authMiddleware;