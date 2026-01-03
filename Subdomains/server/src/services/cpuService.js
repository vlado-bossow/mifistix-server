const os = require('os');

class CpuService {
    getCpuUsage() {
        const cpus = os.cpus();

        let idle = 0;
        let total = 0;

        cpus.forEach(core => {
            for (let type in core.times) {
                total += core.times[type];
            }
            idle += core.times.idle;
        });

        return {
            cores: cpus.length,
            usagePercent: +(100 - (idle / total) * 100).toFixed(2),
            loadAverage: os.loadavg().map(v => +v.toFixed(2)),
            model: cpus[0]?.model || 'Unknown',
            speed: cpus[0]?.speed || 0
        };
    }

    getDetailedCpuInfo() {
        const cpus = os.cpus();
        return cpus.map((core, index) => ({
            core: index + 1,
            model: core.model,
            speed: core.speed + ' MHz',
            times: {
                user: core.times.user,
                nice: core.times.nice,
                sys: core.times.sys,
                idle: core.times.idle,
                irq: core.times.irq
            }
        }));
    }
}

module.exports = new CpuService();