const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('support.mifistix.com', config.servers.support.port);

// Support routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'support.mifistix.com',
    message: 'Support & Help Desk Server',
    endpoints: {
      health: '/health',
      tickets: '/api/tickets',
      faq: '/api/faq',
      knowledge: '/api/knowledge',
    },
  });
});

app.get('/api/tickets', (req, res) => {
  res.json({
    success: true,
    data: {
      tickets: [],
      message: 'Support tickets endpoint',
    },
  });
});

app.post('/api/tickets', (req, res) => {
  res.json({
    success: true,
    data: {
      ticket: {
        id: Date.now(),
        ...req.body,
        status: 'open',
        createdAt: new Date().toISOString(),
      },
      message: 'Ticket created',
    },
  });
});

app.get('/api/faq', (req, res) => {
  res.json({
    success: true,
    data: {
      faq: [],
      message: 'FAQ endpoint',
    },
  });
});

app.get('/api/knowledge', (req, res) => {
  res.json({
    success: true,
    data: {
      articles: [],
      message: 'Knowledge base endpoint',
    },
  });
});

startSubdomainServer('support.mifistix.com', app, config.servers.support.port, config.servers.support.host);

