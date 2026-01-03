const diskService = require('../services/diskService');

class DiskController {
    async getDiskUsage(req, res) {
        try {
            const { disk = 'E' } = req.query;
            const diskInfo = await diskService.getDiskUsage(disk);
            
            res.json({
                status: 'ok',
                data: diskInfo,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения данных диска',
                error: error.message
            });
        }
    }

    async getAllDisks(req, res) {
        try {
            const disks = await diskService.getAllDisks();
            
            res.json({
                status: 'ok',
                data: {
                    disks,
                    total: disks.length,
                    platform: process.platform
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения данных о всех дисках',
                error: error.message
            });
        }
    }
}

module.exports = new DiskController();