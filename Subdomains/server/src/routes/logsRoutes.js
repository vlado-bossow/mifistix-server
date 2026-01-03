const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');

// Получить логи с фильтрацией и лимитом
router.get('/logs', logsController.getLogs);

// Получить все логи без ограничений
router.get('/logs/all', logsController.getAllLogs);

// Поиск по логам
router.get('/logs/search', logsController.searchLogs);

// Статистика логов
router.get('/logs/stats', logsController.getLogStatistics);

// Информация о файлах логов
router.get('/logs/info', logsController.getLogFileInfo);

// Экспорт логов
router.get('/logs/export', logsController.exportLogs);

// Очистка логов (POST с паролем в теле)
router.post('/logs/clear', logsController.clearLogs);

// Получить методы из логов
router.get('/logs/methods', async (req, res) => {
    try {
        const logs = await logsController.getAllLogs();
        const methods = {};
        logs.data?.forEach(log => {
            if (log.method) methods[log.method] = (methods[log.method] || 0) + 1;
        });
        res.json({
            status: 'ok',
            data: {
                methods: Object.keys(methods),
                counts: methods,
                totalMethods: Object.keys(methods).length
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка получения методов',
            error: error.message
        });
    }
});

// Получить типы логов
router.get('/logs/types', async (req, res) => {
    try {
        const logs = await logsController.getAllLogs();
        const types = {};
        logs.data?.forEach(log => {
            if (log.type) types[log.type] = (types[log.type] || 0) + 1;
        });
        res.json({
            status: 'ok',
            data: {
                types: Object.keys(types),
                counts: types,
                totalTypes: Object.keys(types).length
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка получения типов логов',
            error: error.message
        });
    }
});

module.exports = router;
