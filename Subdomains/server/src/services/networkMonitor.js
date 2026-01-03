const os = require('os');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');

class NetworkMonitor {
    constructor() {
        this.initialStats = this.getNetworkStats();
        this.lastCheckTime = Date.now();
        this.speedHistory = [];
        this.maxHistorySize = 100;
        
        setInterval(() => this.updateNetworkSpeed(), 5000);
    }

    getNetworkStats() {
        const interfaces = os.networkInterfaces();
        let totalRxBytes = 0;
        let totalTxBytes = 0;
        let activeInterfaces = [];
        
        for (const [name, iface] of Object.entries(interfaces)) {
            for (const config of iface) {
                if (!config.internal && config.family === 'IPv4') {
                    activeInterfaces.push({
                        name,
                        address: config.address,
                        mac: config.mac,
                        type: config.family
                    });
                }
            }
        }
        
        return {
            interfaces: activeInterfaces,
            totalRxBytes,
            totalTxBytes,
            timestamp: Date.now()
        };
    }

    async updateNetworkSpeed() {
        try {
            const currentStats = await this.getCurrentNetworkUsage();
            const currentTime = Date.now();
            const timeDiff = (currentTime - this.lastCheckTime) / 1000;
            
            if (timeDiff > 0 && this.initialStats) {
                const rxDiff = currentStats.rxBytes - this.initialStats.totalRxBytes;
                const txDiff = currentStats.txBytes - this.initialStats.totalTxBytes;
                
                const rxSpeed = rxDiff / timeDiff;
                const txSpeed = txDiff / timeDiff;
                
                const speedData = {
                    timestamp: new Date().toISOString(),
                    downloadSpeed: +(rxSpeed / 1024).toFixed(2),
                    uploadSpeed: +(txSpeed / 1024).toFixed(2),
                    downloadMbps: +((rxSpeed * 8) / (1024 * 1024)).toFixed(2),
                    uploadMbps: +((txSpeed * 8) / (1024 * 1024)).toFixed(2),
                    interfaces: currentStats.interfaces
                };
                
                this.speedHistory.unshift(speedData);
                if (this.speedHistory.length > this.maxHistorySize) {
                    this.speedHistory = this.speedHistory.slice(0, this.maxHistorySize);
                }
                
                this.initialStats = currentStats;
                this.lastCheckTime = currentTime;
                
                return speedData;
            }
        } catch (error) {
            console.error('Ошибка обновления скорости сети:', error);
        }
        
        return null;
    }

    async getCurrentNetworkUsage() {
        return new Promise((resolve, reject) => {
            if (process.platform === 'win32') {
                exec(
                    'powershell "Get-NetAdapterStatistics | Select-Object Name,ReceivedBytes,SentBytes"',
                    (err, stdout) => {
                        if (err) {
                            return this.getFallbackNetworkStats(resolve);
                        }
                        
                        this.parseWindowsNetworkStats(stdout, resolve);
                    }
                );
            } else {
                exec(
                    'cat /proc/net/dev 2>/dev/null || netstat -ib 2>/dev/null || echo "No network stats"',
                    (err, stdout) => {
                        if (err) {
                            return this.getFallbackNetworkStats(resolve);
                        }
                        
                        this.parseLinuxNetworkStats(stdout, resolve);
                    }
                );
            }
        });
    }

    parseWindowsNetworkStats(stdout, resolve) {
        const lines = stdout.trim().split('\r\n').filter(line => line.trim());
        let totalRx = 0;
        let totalTx = 0;
        const interfaces = [];
        
        lines.slice(1).forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                const name = parts[0];
                const rxBytes = parseInt(parts[1]) || 0;
                const txBytes = parseInt(parts[2]) || 0;
                
                totalRx += rxBytes;
                totalTx += txBytes;
                
                interfaces.push({
                    name,
                    rxBytes,
                    txBytes,
                    rxSpeed: 0,
                    txSpeed: 0
                });
            }
        });
        
        resolve({
            rxBytes: totalRx,
            txBytes: totalTx,
            interfaces,
            timestamp: Date.now()
        });
    }

    parseLinuxNetworkStats(stdout, resolve) {
        let totalRx = 0;
        let totalTx = 0;
        const interfaces = [];
        
        stdout.split('\n').forEach(line => {
            if (line.includes(':')) {
                const parts = line.trim().split(/\s+/);
                const ifaceName = parts[0].replace(':', '');
                
                if (!ifaceName.includes('lo') && parts.length > 9) {
                    const rxBytes = parseInt(parts[1]) || 0;
                    const txBytes = parseInt(parts[9]) || 0;
                    
                    totalRx += rxBytes;
                    totalTx += txBytes;
                    
                    interfaces.push({
                        name: ifaceName,
                        rxBytes,
                        txBytes,
                        rxSpeed: 0,
                        txSpeed: 0
                    });
                }
            }
        });
        
        resolve({
            rxBytes: totalRx,
            txBytes: totalTx,
            interfaces,
            timestamp: Date.now()
        });
    }

    getFallbackNetworkStats(resolve) {
        const interfaces = os.networkInterfaces();
        const activeIfaces = [];
        
        for (const [name, configs] of Object.entries(interfaces)) {
            for (const config of configs) {
                if (!config.internal && config.family === 'IPv4') {
                    activeIfaces.push({
                        name,
                        address: config.address,
                        mac: config.mac,
                        rxBytes: 0,
                        txBytes: 0,
                        rxSpeed: 0,
                        txSpeed: 0
                    });
                }
            }
        }
        
        resolve({
            rxBytes: 0,
            txBytes: 0,
            interfaces: activeIfaces,
            timestamp: Date.now()
        });
    }

    getCurrentSpeed() {
        return this.speedHistory[0] || {
            timestamp: new Date().toISOString(),
            downloadSpeed: 0,
            uploadSpeed: 0,
            downloadMbps: 0,
            uploadMbps: 0,
            interfaces: []
        };
    }

    getSpeedHistory(limit = 20) {
        return this.speedHistory.slice(0, limit);
    }

    async testDownloadSpeed(url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Icecat1-300x300.svg/600px-Icecat1-300x300.svg.png') {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, (response) => {
                let dataLength = 0;
                
                response.on('data', (chunk) => {
                    dataLength += chunk.length;
                });
                
                response.on('end', () => {
                    const endTime = Date.now();
                    const duration = (endTime - startTime) / 1000;
                    const speedBps = dataLength / duration;
                    const speedKbps = speedBps / 1024;
                    const speedMbps = (speedBps * 8) / (1024 * 1024);
                    
                    resolve({
                        success: true,
                        url,
                        fileSize: dataLength,
                        duration: +(duration.toFixed(2)),
                        speedBps: +speedBps.toFixed(2),
                        speedKbps: +speedKbps.toFixed(2),
                        speedMbps: +speedMbps.toFixed(2),
                        timestamp: new Date().toISOString()
                    });
                });
            });
            
            request.on('error', (error) => {
                resolve({
                    success: false,
                    url,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            });
            
            request.setTimeout(10000, () => {
                request.destroy();
                resolve({
                    success: false,
                    url,
                    error: 'Timeout',
                    timestamp: new Date().toISOString()
                });
            });
        });
    }

    getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const activeInterfaces = [];
        
        for (const [name, configs] of Object.entries(interfaces)) {
            for (const config of configs) {
                if (!config.internal) {
                    activeInterfaces.push({
                        name,
                        address: config.address,
                        netmask: config.netmask,
                        mac: config.mac,
                        family: config.family,
                        internal: config.internal
                    });
                }
            }
        }
        
        return activeInterfaces;
    }

    getActiveConnections() {
        return new Promise((resolve) => {
            const platform = process.platform;
            
            if (platform === 'win32') {
                exec(
                    'netstat -an | findstr ESTABLISHED',
                    (err, stdout) => {
                        if (err) {
                            resolve([]);
                            return;
                        }
                        
                        const connections = this.parseWindowsConnections(stdout);
                        resolve(connections);
                    }
                );
            } else {
                exec(
                    'netstat -an | grep ESTABLISHED',
                    (err, stdout) => {
                        if (err) {
                            resolve([]);
                            return;
                        }
                        
                        const connections = this.parseLinuxConnections(stdout);
                        resolve(connections);
                    }
                );
            }
        });
    }

    parseWindowsConnections(stdout) {
        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    protocol: parts[0],
                    localAddress: parts[1],
                    foreignAddress: parts[2],
                    state: parts[3]
                };
            });
    }

    parseLinuxConnections(stdout) {
        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    protocol: parts[0],
                    localAddress: parts[3],
                    foreignAddress: parts[4],
                    state: parts[5]
                };
            });
    }
}

module.exports = new NetworkMonitor();