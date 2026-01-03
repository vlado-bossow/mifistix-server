const fs = require('fs');
const path = require('path');

class LoggingService {
    constructor() {
        this.LOGS_DIR = path.join(__dirname, '../../dataServer');
        this.LOG_FILE_NAME = 'server_monitor_logs.json';
        this.LOG_FILE_PATH = path.join(this.LOGS_DIR, this.LOG_FILE_NAME);
        this.MAX_LOGS_TOTAL = 200000; // аварийный лимит при записи

        this.initLogDirectory();
        this.initLogFile();
    }

    initLogDirectory() {
        if (!fs.existsSync(this.LOGS_DIR)) {
            fs.mkdirSync(this.LOGS_DIR, { recursive: true });
        }
    }

    initLogFile() {
        if (!fs.existsSync(this.LOG_FILE_PATH)) {
            const initialData = {
                logs: [],
                statistics: {
                    totalRequests: 0,
                    averageResponseTime: 0,
                    errorCount: 0,
                    lastUpdate: new Date().toISOString(),
                    totalLogsEver: 0
                }
            };
            fs.writeFileSync(this.LOG_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
        }
    }

    logRequest(logData) {
        try {
            const data = JSON.parse(fs.readFileSync(this.LOG_FILE_PATH, 'utf8'));
            data.logs.push({
                id: logData.requestId || Date.now().toString(),
                ...logData,
                timestamp: logData.timestamp || new Date().toISOString()
            });

            // Обрезаем только при записи, если превышен аварийный лимит
            if (data.logs.length > this.MAX_LOGS_TOTAL) {
                data.logs = data.logs.slice(-this.MAX_LOGS_TOTAL);
            }

            if (logData.type === 'REQUEST_END') {
                data.statistics.totalRequests++;
                const prevAvg = data.statistics.averageResponseTime;
                const prevCount = data.statistics.totalRequests - 1;
                data.statistics.averageResponseTime =
                    ((prevAvg * prevCount) + (logData.responseTime || 0)) / data.statistics.totalRequests;

                if ((logData.statusCode || 0) >= 400) {
                    data.statistics.errorCount++;
                }
                data.statistics.lastUpdate = new Date().toISOString();
            }

            data.statistics.totalLogsEver = Math.max(data.statistics.totalLogsEver || 0, data.logs.length);

            fs.writeFileSync(this.LOG_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

            if (process.env.NODE_ENV !== 'production') {
                console.log(`📝 [${logData.type}] ${logData.method} ${logData.url} - ${logData.responseTime || 0}ms`);
            }

            return true;
        } catch (error) {
            console.error('Ошибка записи лога:', error);
            return false;
        }
    }

    // === ГЛАВНОЕ: ВСЕГДА ВОЗВРАЩАЕМ ВСЁ, ЧТО ЕСТЬ ПОСЛЕ ФИЛЬТРОВ ===
    getLogs(filters = {}) {
        try {
            const data = JSON.parse(fs.readFileSync(this.LOG_FILE_PATH, 'utf8'));
            let filteredLogs = [...data.logs]; // копия всего массива

            const { type, method, statusCode, search } = filters;

            // Применяем только фильтры (если они есть)
            if (type) filteredLogs = filteredLogs.filter(l => l.type === type);
            if (method) filteredLogs = filteredLogs.filter(l => l.method?.toUpperCase() === method.toUpperCase());
            if (statusCode) filteredLogs = filteredLogs.filter(l => l.statusCode === parseInt(statusCode));
            if (search) {
                const term = search.toLowerCase();
                filteredLogs = filteredLogs.filter(l => JSON.stringify(l).toLowerCase().includes(term));
            }

            // НИКАКИХ ЛИМИТОВ! Просто возвращаем всё, что осталось
            const logsToReturn = filteredLogs;

            // Статистика
            const statisticsTotal = this.calculateStatistics(data.logs);
            const statisticsFiltered = this.calculateStatistics(filteredLogs);

            const filteredStats = {
                types: this.countBy(filteredLogs, 'type'),
                methods: this.countBy(filteredLogs, 'method'),
                statusCodes: this.countBy(filteredLogs, 'statusCode')
            };

            return {
                logs: logsToReturn,              // ← ВСЁ, БЕЗ ОБРЕЗКИ
                statisticsTotal,
                statisticsFiltered,
                filteredStats
            };
        } catch (error) {
            throw new Error(`Ошибка чтения логов: ${error.message}`);
        }
    }
    // ========================================================

    getAllLogs() {
        try {
            const data = JSON.parse(fs.readFileSync(this.LOG_FILE_PATH, 'utf8'));
            return {
                logs: data.logs,
                statistics: data.statistics,
                total: data.logs.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Ошибка получения всех логов: ${error.message}`);
        }
    }

    getLogStatistics() {
        try {
            const data = JSON.parse(fs.readFileSync(this.LOG_FILE_PATH, 'utf8'));
            return data.statistics;
        } catch (error) {
            throw new Error('Ошибка чтения статистики');
        }
    }

    clearLogs(password) {
        const CLEAR_PASSWORD = process.env.LOG_CLEAR_PASSWORD || 'admin123'; // смени на свой

        if (password !== CLEAR_PASSWORD) {
            throw new Error('Неверный пароль');
        }

        const emptyData = {
            logs: [],
            statistics: {
                totalRequests: 0,
                averageResponseTime: 0,
                errorCount: 0,
                lastUpdate: new Date().toISOString(),
                totalLogsEver: 0
            }
        };

        fs.writeFileSync(this.LOG_FILE_PATH, JSON.stringify(emptyData, null, 2));

        return {
            clearedCount: 'all',
            timestamp: new Date().toISOString()
        };
    }

    getLogFileInfo() {
        try {
            const stats = fs.statSync(this.LOG_FILE_PATH);
            const data = JSON.parse(fs.readFileSync(this.LOG_FILE_PATH, 'utf8'));
            return [{
                file: this.LOG_FILE_NAME,
                size: stats.size,
                modified: stats.mtime.toISOString(),
                lines: data.logs.length
            }];
        } catch (error) {
            throw new Error('Ошибка получения информации о файле');
        }
    }

    calculateStatistics(logsArray) {
        const requests = logsArray.filter(l => l.type === 'REQUEST_END');
        const times = requests.map(r => r.responseTime || 0);
        const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;

        return {
            totalRequests: requests.length,
            averageResponseTime: avg,
            errorCount: requests.filter(r => (r.statusCode || 0) >= 400).length,
            lastUpdate: logsArray[logsArray.length - 1]?.timestamp || new Date().toISOString(),
            totalLogsEver: logsArray.length
        };
    }

    countBy(array, property) {
        return array.reduce((acc, item) => {
            const val = item[property];
            if (val !== undefined && val !== null) {
                acc[val] = (acc[val] || 0) + 1;
            }
            return acc;
        }, {});
    }
}

module.exports = new LoggingService();