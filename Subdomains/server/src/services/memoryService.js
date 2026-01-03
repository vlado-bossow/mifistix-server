const os = require('os');

class MemoryService {
    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        return {
            totalMB: Math.round(total / 1024 / 1024),
            usedMB: Math.round(used / 1024 / 1024),
            freeMB: Math.round(free / 1024 / 1024),
            usagePercent: +((used / total) * 100).toFixed(2),
            totalGB: +(total / 1024 ** 3).toFixed(2),
            usedGB: +(used / 1024 ** 3).toFixed(2),
            freeGB: +(free / 1024 ** 3).toFixed(2)
        };
    }

    getMemoryDetails() {
        const memory = this.getMemoryUsage();
        return {
            ...memory,
            platform: process.platform,
            arch: os.arch(),
            swap: {
                total: os.totalmem() > 0 ? +(os.totalmem() / 1024 ** 3).toFixed(2) : 0,
                free: os.freemem() > 0 ? +(os.freemem() / 1024 ** 3).toFixed(2) : 0
            }
        };
    }
}

module.exports = new MemoryService();