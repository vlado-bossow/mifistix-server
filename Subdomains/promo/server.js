const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('promo.mifistix.com', config.servers.promo.port);

// Promo routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'promo.mifistix.com',
    message: 'Promo & Marketing Server',
    endpoints: {
      health: '/health',
      campaigns: '/api/campaigns',
      offers: '/api/offers',
    },
  });
});

app.get('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    data: {
      campaigns: [],
      message: 'Promo campaigns endpoint',
    },
  });
});

app.get('/api/offers', (req, res) => {
  res.json({
    success: true,
    data: {
      offers: [],
      message: 'Special offers endpoint',
    },
  });
});

startSubdomainServer('promo.mifistix.com', app, config.servers.promo.port, config.servers.promo.host);

