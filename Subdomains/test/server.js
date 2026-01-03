const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('test.mifistix.com', config.servers.test.port, {
  rateLimit: false, // Отключаем rate limiting для тестов
});

// Test routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'test.mifistix.com',
    message: 'Testing & QA Server',
    environment: 'test',
    endpoints: {
      health: '/health',
      test: '/api/test',
      mock: '/api/mock',
    },
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Test endpoint',
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/mock', (req, res) => {
  res.json({
    success: true,
    data: {
      received: req.body,
      message: 'Mock endpoint for testing',
    },
  });
});

startSubdomainServer('test.mifistix.com', app, config.servers.test.port, config.servers.test.host);

