const loggingService = require('../services/loggingService'); // это уже singleton экземпляр

class LogsController {
    getLogs = async (req, res) => {
        try {
            const { limit = 100, type, method, statusCode, search } = req.query;

            const filters = {
                limit: limit, // передаём как есть (строку "together", "all" или число)
                type,
                method,
                statusCode,
                search
            };

            const result = await loggingService.getLogs(filters);

            res.json({
                status: 'ok',
                data: result.logs,
                statisticsFiltered: result.statisticsFiltered,
                statisticsTotal: result.statisticsTotal,
                filteredStats: result.filteredStats,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка чтения логов',
                error: error.message
            });
        }
    };

    getAllLogs = async (req, res) => {
        try {
            const result = await loggingService.getAllLogs();

            res.json({
                status: 'ok',
                data: result.logs,
                total: result.total,
                statistics: result.statistics,
                timestamp: result.timestamp
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения всех логов',
                error: error.message
            });
        }
    };

    searchLogs = async (req, res) => {
        try {
            const { q, startDate, endDate, limit = 200 } = req.query;

            const filters = {
                search: q,
                limit: limit === 'all' || limit === 'together' ? 'together' : limit
                // даты пока не фильтруем (можно добавить позже)
            };

            const result = await loggingService.getLogs(filters);

            res.json({
                status: 'ok',
                data: result.logs,
                count: result.logs.length,
                query: q,
                dateRange: { startDate, endDate }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка поиска по логам',
                error: error.message
            });
        }
    };

    getLogStatistics = async (req, res) => {
        try {
            const stats = await loggingService.getLogStatistics();
            res.json({ status: 'ok', data: stats });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения статистики',
                error: error.message
            });
        }
    };

    clearLogs = async (req, res) => {
        try {
            const { password } = req.body;
            const result = await loggingService.clearLogs(password);

            res.json({
                status: 'ok',
                message: 'Логи успешно очищены',
                clearedCount: result.clearedCount,
                timestamp: result.timestamp
            });
        } catch (error) {
            res.status(403).json({
                status: 'error',
                message: error.message || 'Ошибка очистки логов'
            });
        }
    };

    getLogFileInfo = async (req, res) => {
        try {
            const info = await loggingService.getLogFileInfo();
            res.json({ status: 'ok', data: info });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения информации о логах',
                error: error.message
            });
        }
    };

    exportLogs = async (req, res) => {
        try {
            const { format = 'json' } = req.query;
            const { logs } = loggingService.getAllLogs(); // синхронно, т.к. getAllLogs синхронный в твоей версии

            if (format === 'csv') {
                let csv = 'id,type,method,url,statusCode,responseTime,timestamp,ip,userAgent,dataSize\n';
                logs.forEach(log => {
                    const values = [
                        log.id || '',
                        log.type || '',
                        log.method || '',
                        log.url || '',
                        log.statusCode || '',
                        log.responseTime || '',
                        log.timestamp || '',
                        log.ip || '',
                        log.userAgent || '',
                        log.dataSize || ''
                    ];
                    const row = values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
                    csv += row + '\n';
                });

                res.header('Content-Type', 'text/csv');
                res.header('Content-Disposition', `attachment; filename=logs_${Date.now()}.csv`);
                res.send(csv);
            } else {
                res.json({
                    status: 'ok',
                    data: logs,
                    format: 'json',
                    total: logs.length
                });
            }
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка экспорта логов',
                error: error.message
            });
        }
    };
}

// ВАЖНО: экспортируем готовый экземпляр!
module.exports = new LogsController();