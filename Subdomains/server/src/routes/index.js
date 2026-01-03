const express = require('express');
const router = express.Router();

// Импортируем все роуты
const cpuRoutes = require('./cpuRoutes');
const memoryRoutes = require('./memoryRoutes');
const diskRoutes = require('./diskRoutes');
const networkRoutes = require('./networkRoutes');
const logsRoutes = require('./logsRoutes');
const metricsRoutes = require('./metricsRoutes');

// Объединяем все роуты под префиксом /api
router.use('/api', cpuRoutes);
router.use('/api', memoryRoutes);
router.use('/api', diskRoutes);
router.use('/api', networkRoutes);
router.use('/api', logsRoutes);
router.use('/api', metricsRoutes);

// Общий эндпоинт для всех метрик
router.get('/api/server-load', async (req, res) => {
    try {
        const cpuService = require('../services/cpuService');
        const memoryService = require('../services/memoryService');
        const diskService = require('../services/diskService');
        const networkMonitor = require('../services/networkMonitor');
        
        const [cpu, memory, disk, networkSpeed] = await Promise.all([
            Promise.resolve(cpuService.getCpuUsage()),
            Promise.resolve(memoryService.getMemoryUsage()),
            diskService.getDiskUsage('E'),
            Promise.resolve(networkMonitor.getCurrentSpeed())
        ]);
        
        res.json({
            status: 'ok',
            data: {
                cpu,
                memory,
                disk,
                network: networkSpeed,
                uptimeSeconds: Math.floor(process.uptime()),
                timestamp: Date.now(),
                platform: process.platform
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка получения данных мониторинга',
            error: error.message
        });
    }
});

// Эндпоинт для проверки здоровья
router.get('/api/health', (req, res) => {
    const networkMonitor = require('../services/networkMonitor');
    const currentSpeed = networkMonitor.getCurrentSpeed();
    
    res.json({
        status: 'ok',
        message: 'Сервер работает нормально',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: '1.2.0',
        network: {
            download: currentSpeed.downloadMbps + ' Mbps',
            upload: currentSpeed.uploadMbps + ' Mbps'
        }
    });
});

// Эндпоинт для получения версии и информации о системе
router.get('/api/system-info', (req, res) => {
    try {
        const os = require('os');
        
        res.json({
            status: 'ok',
            data: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                hostname: os.hostname(),
                totalMemory: Math.round(os.totalmem() / (1024 * 1024)) + ' MB',
                freeMemory: Math.round(os.freemem() / (1024 * 1024)) + ' MB',
                cpus: os.cpus().length,
                uptime: Math.floor(process.uptime()),
                serverTime: new Date().toISOString(),
                userInfo: os.userInfo(),
                networkInterfaces: Object.keys(os.networkInterfaces())
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка получения информации о системе',
            error: error.message
        });
    }
});

// Эндпоинт для перезагрузки сервера (только для админов)
router.post('/api/restart', (req, res) => {
    try {
        const { password } = req.body;
        
        if (password !== 'admin123') {
            return res.status(403).json({
                status: 'error',
                message: 'Доступ запрещен'
            });
        }
        
        res.json({
            status: 'ok',
            message: 'Сервер перезапускается...',
            timestamp: new Date().toISOString()
        });
        
        // Запускаем перезагрузку через 2 секунды
        setTimeout(() => {
            process.exit(0);
        }, 2000);
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка перезагрузки сервера',
            error: error.message
        });
    }
});

// Эндпоинт для получения текущей конфигурации
router.get('/api/config', (req, res) => {
    try {
        const config = {
            server: {
                port: process.env.PORT || 3000,
                environment: process.env.NODE_ENV || 'development',
                logLevel: process.env.LOG_LEVEL || 'info'
            },
            monitoring: {
                updateInterval: 5000,
                maxLogs: 10000,
                cacheTime: 5000
            },
            services: {
                cpuMonitoring: true,
                memoryMonitoring: true,
                diskMonitoring: true,
                networkMonitoring: true,
                logMonitoring: true
            }
        };
        
        res.json({
            status: 'ok',
            data: config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка получения конфигурации',
            error: error.message
        });
    }
});

// Эндпоинт для очистки кэша
router.post('/api/clear-cache', (req, res) => {
    try {
        const { password } = req.body;
        
        if (password !== 'admin123') {
            return res.status(403).json({
                status: 'error',
                message: 'Доступ запрещен'
            });
        }
        
        // Здесь можно очистить кэш разных сервисов
        const serverMonitoringService = require('../services/ServerMonitoring');
        serverMonitoringService.clearCache();
        
        res.json({
            status: 'ok',
            message: 'Кэш успешно очищен',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка очистки кэша',
            error: error.message
        });
    }
});

module.exports = router;