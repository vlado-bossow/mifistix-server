const networkMonitor = require('../services/networkMonitor');

class NetworkController {
    async getNetworkSpeed(req, res) {
        try {
            const currentSpeed = networkMonitor.getCurrentSpeed();
            const history = networkMonitor.getSpeedHistory(20);
            
            res.json({
                status: 'ok',
                data: {
                    current: currentSpeed,
                    history,
                    units: {
                        downloadSpeed: 'KB/s',
                        uploadSpeed: 'KB/s',
                        downloadMbps: 'Mbps',
                        uploadMbps: 'Mbps'
                    }
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения скорости сети',
                error: error.message
            });
        }
    }

    async speedTest(req, res) {
        try {
            const { url } = req.query;
            const result = await networkMonitor.testDownloadSpeed(url);
            
            res.json({
                status: result.success ? 'ok' : 'error',
                data: result,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка теста скорости',
                error: error.message
            });
        }
    }

    async getNetworkInterfaces(req, res) {
        try {
            const interfaces = networkMonitor.getNetworkInterfaces();
            
            res.json({
                status: 'ok',
                data: {
                    interfaces,
                    total: interfaces.length,
                    platform: process.platform,
                    hostname: require('os').hostname()
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения информации о сетевых интерфейсах',
                error: error.message
            });
        }
    }

    async getNetworkHistory(req, res) {
        try {
            const { limit = 50 } = req.query;
            const history = networkMonitor.getSpeedHistory(parseInt(limit));
            
            const stats = history.length > 0 ? {
                avgDownload: +(history.reduce((sum, h) => sum + h.downloadMbps, 0) / history.length).toFixed(2),
                avgUpload: +(history.reduce((sum, h) => sum + h.uploadMbps, 0) / history.length).toFixed(2),
                maxDownload: +Math.max(...history.map(h => h.downloadMbps)).toFixed(2),
                maxUpload: +Math.max(...history.map(h => h.uploadMbps)).toFixed(2),
                minDownload: +Math.min(...history.map(h => h.downloadMbps)).toFixed(2),
                minUpload: +Math.min(...history.map(h => h.uploadMbps)).toFixed(2)
            } : null;
            
            res.json({
                status: 'ok',
                data: {
                    history,
                    statistics: stats,
                    timeRange: history.length > 0 ? {
                        start: history[history.length - 1].timestamp,
                        end: history[0].timestamp
                    } : null
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения истории сети',
                error: error.message
            });
        }
    }

    async getActiveConnections(req, res) {
        try {
            const connections = await networkMonitor.getActiveConnections();
            
            res.json({
                status: 'ok',
                data: {
                    connections,
                    total: connections.length,
                    platform: process.platform
                },
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка получения активных соединений',
                error: error.message
            });
        }
    }
}

module.exports = new NetworkController();