function responseTimeMiddleware(req, res, next) {
    const startTime = Date.now();
    
    const originalJson = res.json;
    res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        if (data && typeof data === 'object') {
            if (data.data) {
                data.data.apiProcessingTimeMs = responseTime;
            } else {
                data.apiProcessingTimeMs = responseTime;
            }
        }
        
        return originalJson.call(this, data);
    };
    
    next();
}

module.exports = responseTimeMiddleware;