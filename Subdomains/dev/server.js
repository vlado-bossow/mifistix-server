const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('dev.mifistix.com', config.servers.dev.port, {
  rateLimit: false, // Отключаем rate limiting для dev
});

// Dev routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'dev.mifistix.com',
    message: 'Development Environment Server',
    environment: 'development',
    debug: true,
    endpoints: {
      health: '/health',
      api: '/api',
      debug: '/api/debug',
    },
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Development API endpoint',
      version: config.app.version,
      environment: config.app.env,
    },
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    success: true,
    data: {
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
      },
      config: {
        env: config.app.env,
        version: config.app.version,
      },
    },
  });
});

startSubdomainServer('dev.mifistix.com', app, config.servers.dev.port, config.servers.dev.host);

