const { exec } = require('child_process');

class DiskService {
    getDiskUsage(diskLetter = 'E') {
        return new Promise((resolve, reject) => {
            const platform = process.platform;
            
            if (platform === 'win32') {
                exec(
                    `powershell "Get-PSDrive -Name ${diskLetter} | Select-Object Used,Free | ForEach-Object { $_.Used, $_.Free }"`,
                    (err, stdout) => {
                        if (err) {
                            this.getAlternativeDiskInfo(diskLetter)
                                .then(resolve)
                                .catch(reject);
                            return;
                        }
                        
                        this.parseWindowsDiskOutput(stdout, diskLetter, resolve, reject);
                    }
                );
            } else {
                const diskPath = '/';
                exec(
                    `df -k "${diskPath}" | tail -1`,
                    (err, stdout) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        this.parseLinuxDiskOutput(stdout, diskPath, resolve);
                    }
                );
            }
        });
    }

    parseWindowsDiskOutput(stdout, diskLetter, resolve, reject) {
        const lines = stdout.trim().split('\r\n').filter(line => line.trim() !== '');
        if (lines.length >= 2) {
            const used = parseFloat(lines[0]) || 0;
            const free = parseFloat(lines[1]) || 0;
            const total = used + free;
            
            resolve({
                disk: `${diskLetter}:`,
                totalGB: +(total / 1024 ** 3).toFixed(2),
                usedGB: +(used / 1024 ** 3).toFixed(2),
                freeGB: +(free / 1024 ** 3).toFixed(2),
                usagePercent: total > 0 ? +((used / total) * 100).toFixed(2) : 0
            });
        } else {
            reject(new Error('Не удалось получить данные о диске'));
        }
    }

    parseLinuxDiskOutput(stdout, diskPath, resolve) {
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 4) {
            const totalKB = parseInt(parts[1]) || 0;
            const usedKB = parseInt(parts[2]) || 0;
            const freeKB = parseInt(parts[3]) || 0;
            
            resolve({
                disk: diskPath,
                totalGB: +(totalKB / 1024 / 1024).toFixed(2),
                usedGB: +(usedKB / 1024 / 1024).toFixed(2),
                freeGB: +(freeKB / 1024 / 1024).toFixed(2),
                usagePercent: totalKB > 0 ? +((usedKB / totalKB) * 100).toFixed(2) : 0
            });
        } else {
            resolve({
                disk: diskPath,
                totalGB: 0,
                usedGB: 0,
                freeGB: 0,
                usagePercent: 0,
                error: 'Не удалось проанализировать данные'
            });
        }
    }

    async getAlternativeDiskInfo(diskLetter) {
        return new Promise((resolve) => {
            exec(
                `powershell "Get-WmiObject Win32_LogicalDisk -Filter \\"DeviceID='${diskLetter}:'\\" | Select-Object Size,FreeSpace"`,
                (err, stdout) => {
                    if (err) {
                        resolve(this.getDefaultDiskInfo(diskLetter));
                        return;
                    }
                    
                    const lines = stdout.trim().split('\r\n');
                    let size = 0;
                    let freeSpace = 0;
                    
                    lines.forEach(line => {
                        if (line.includes('Size')) {
                            const match = line.match(/Size\s+:\s+(\d+)/);
                            if (match) size = parseInt(match[1]);
                        }
                        if (line.includes('FreeSpace')) {
                            const match = line.match(/FreeSpace\s+:\s+(\d+)/);
                            if (match) freeSpace = parseInt(match[1]);
                        }
                    });
                    
                    const used = size - freeSpace;
                    resolve({
                        disk: `${diskLetter}:`,
                        totalGB: +(size / 1024 ** 3).toFixed(2),
                        usedGB: +(used / 1024 ** 3).toFixed(2),
                        freeGB: +(freeSpace / 1024 ** 3).toFixed(2),
                        usagePercent: size > 0 ? +((used / size) * 100).toFixed(2) : 0
                    });
                }
            );
        });
    }

    getDefaultDiskInfo(diskLetter) {
        return {
            disk: `${diskLetter}:`,
            totalGB: 0,
            usedGB: 0,
            freeGB: 0,
            usagePercent: 0,
            error: 'Не удалось получить данные о диске'
        };
    }

    async getAllDisks() {
        if (process.platform === 'win32') {
            return this.getWindowsDisks();
        } else {
            return this.getLinuxDisks();
        }
    }

    async getWindowsDisks() {
        return new Promise((resolve) => {
            exec(
                'powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free"',
                (err, stdout) => {
                    if (err) {
                        resolve([]);
                        return;
                    }
                    
                    const disks = [];
                    const lines = stdout.trim().split('\r\n').filter(line => line.trim());
                    
                    lines.slice(1).forEach(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            const name = parts[0];
                            const used = parseFloat(parts[1]) || 0;
                            const free = parseFloat(parts[2]) || 0;
                            const total = used + free;
                            
                            disks.push({
                                disk: `${name}:`,
                                totalGB: +(total / 1024 ** 3).toFixed(2),
                                usedGB: +(used / 1024 ** 3).toFixed(2),
                                freeGB: +(free / 1024 ** 3).toFixed(2),
                                usagePercent: total > 0 ? +((used / total) * 100).toFixed(2) : 0
                            });
                        }
                    });
                    
                    resolve(disks);
                }
            );
        });
    }

    async getLinuxDisks() {
        return new Promise((resolve) => {
            exec(
                'df -k | tail -n +2',
                (err, stdout) => {
                    if (err) {
                        resolve([]);
                        return;
                    }
                    
                    const disks = [];
                    const lines = stdout.trim().split('\n').filter(line => line.trim());
                    
                    lines.forEach(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 6) {
                            const filesystem = parts[0];
                            const totalKB = parseInt(parts[1]) || 0;
                            const usedKB = parseInt(parts[2]) || 0;
                            const freeKB = parseInt(parts[3]) || 0;
                            const mount = parts[5];
                            
                            disks.push({
                                disk: mount,
                                filesystem,
                                totalGB: +(totalKB / 1024 / 1024).toFixed(2),
                                usedGB: +(usedKB / 1024 / 1024).toFixed(2),
                                freeGB: +(freeKB / 1024 / 1024).toFixed(2),
                                usagePercent: totalKB > 0 ? +((usedKB / totalKB) * 100).toFixed(2) : 0
                            });
                        }
                    });
                    
                    resolve(disks);
                }
            );
        });
    }
}

module.exports = new DiskService();