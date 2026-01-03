const loggingService = require('../services/loggingService');

function loggerMiddleware(req, res, next) {
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    req.requestId = requestId;
    req.startTime = startTime;
    
    loggingService.logRequest({
        type: 'REQUEST_START',
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent']
    });
    
    const originalSend = res.send;
    const originalJson = res.json;
    
    res.send = function(data) {
        const responseTime = Date.now() - startTime;
        const timestamp = new Date().toISOString();
        
        loggingService.logRequest({
            type: 'REQUEST_END',
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            timestamp,
            dataSize: typeof data === 'string' ? data.length : JSON.stringify(data).length
        });
        
        return originalSend.call(this, data);
    };
    
    res.json = function(data) {
        const responseTime = Date.now() - startTime;
        const timestamp = new Date().toISOString();
        
        if (data && typeof data === 'object') {
            if (data.data) {
                data.data.responseTimeMs = responseTime;
                data.data.requestId = requestId;
            } else {
                data.responseTimeMs = responseTime;
                data.requestId = requestId;
            }
        }
        
        loggingService.logRequest({
            type: 'REQUEST_END',
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            timestamp,
            dataSize: JSON.stringify(data).length
        });
        
        return originalJson.call(this, data);
    };
    
    next();
}

module.exports = loggerMiddleware;