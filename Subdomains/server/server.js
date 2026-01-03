const express = require('express');
const path = require('path');
const cors = require('cors');

const loggerMiddleware = require('./src/middlewares/loggerMiddleware');
const responseTimeMiddleware = require('./src/middlewares/responseTimeMiddleware');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   🔓 CORS (Vite Frontend)
========================= */
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

/* =========================
   🧩 MIDDLEWARES
========================= */
app.use(express.json());
app.use(loggerMiddleware);
app.use(responseTimeMiddleware);

/* =========================
   🚏 ROUTES
========================= */
app.use('/', routes);

/* =========================
   ❌ 404
========================= */
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Маршрут не найден',
        requestedUrl: req.url
    });
});

/* =========================
   💥 ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);

    res.status(500).json({
        status: 'error',
        message: 'Внутренняя ошибка сервера',
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Произошла ошибка'
    });
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Платформа: ${process.platform}`);
    console.log(`📁 Логи сохраняются в: ${path.join(__dirname, '../dataServer')}`);
    console.log(`🌐 Мониторинг сети активирован`);
    console.log(`⏰ Время запуска: ${new Date().toLocaleString('ru-RU')}`);

    console.log('\n📡 Доступные эндпоинты:');
    console.log('  GET /api/server-load          - Все метрики сервера');
    console.log('  GET /api/cpu/usage            - Использование CPU');
    console.log('  GET /api/cpu/detailed         - Детальная информация о CPU');
    console.log('  GET /api/memory/usage         - Использование памяти');
    console.log('  GET /api/memory/details       - Детальная информация о памяти');
    console.log('  GET /api/disk/usage           - Использование диска');
    console.log('  GET /api/disk/all             - Все диски');
    console.log('  GET /api/network/speed        - Скорость сети');
    console.log('  GET /api/network/speedtest    - Тест скорости');
    console.log('  GET /api/network/interfaces   - Сетевые интерфейсы');
    console.log('  GET /api/network/history      - История скорости');
    console.log('  GET /api/network/connections  - Активные соединения');
    console.log('  GET /api/logs                 - Логи');
    console.log('  GET /api/logs/search          - Поиск по логам');
    console.log('  GET /api/logs/stats           - Статистика логов');
    console.log('  GET /api/health               - Проверка здоровья');

    console.log('\n💡 Используйте query-параметры для фильтрации и пагинации');
});

module.exports = app;
