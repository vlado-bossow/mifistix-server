const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('staging.mifistix.com', config.servers.staging.port);

// Staging routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'staging.mifistix.com',
    message: 'Staging Environment Server',
    environment: 'staging',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Staging API endpoint',
      version: config.app.version,
    },
  });
});

startSubdomainServer('staging.mifistix.com', app, config.servers.staging.port, config.servers.staging.host);

