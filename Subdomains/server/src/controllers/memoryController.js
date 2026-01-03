const memoryService = require('../services/memoryService');

class MemoryController {
    async getMemoryUsage(req, res) {
        try {
            const memoryInfo = memoryService.getMemoryUsage();
            res.json({
                status: 'ok',
                data: memoryInfo,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения данных памяти',
                error: error.message
            });
        }
    }

    async getMemoryDetails(req, res) {
        try {
            const memoryDetails = memoryService.getMemoryDetails();
            res.json({
                status: 'ok',
                data: memoryDetails,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения детальной информации о памяти',
                error: error.message
            });
        }
    }
}

module.exports = new MemoryController();