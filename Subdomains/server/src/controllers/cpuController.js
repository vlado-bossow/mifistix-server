const cpuService = require('../services/cpuService');

class CpuController {
    async getCpuUsage(req, res) {
        try {
            const cpuInfo = cpuService.getCpuUsage();
            res.json({
                status: 'ok',
                data: cpuInfo,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения данных CPU',
                error: error.message
            });
        }
    }

    async getDetailedCpuInfo(req, res) {
        try {
            const detailedInfo = cpuService.getDetailedCpuInfo();
            res.json({
                status: 'ok',
                data: {
                    summary: cpuService.getCpuUsage(),
                    cores: detailedInfo
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения детальной информации CPU',
                error: error.message
            });
        }
    }
}

module.exports = new CpuController();