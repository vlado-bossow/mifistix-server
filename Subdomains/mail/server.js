const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('mail.mifistix.com', config.servers.mail.port);

// Mail routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'mail.mifistix.com',
    message: 'Mail & Email Server',
    endpoints: {
      health: '/health',
      send: '/api/send',
      status: '/api/status',
      templates: '/api/templates',
    },
  });
});

app.post('/api/send', (req, res) => {
  const { to, subject, body, template } = req.body;
  
  res.json({
    success: true,
    data: {
      message: {
        id: Date.now(),
        to,
        subject,
        status: 'queued',
        createdAt: new Date().toISOString(),
      },
      message: 'Email queued for sending',
    },
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'active',
      queue: {
        pending: 0,
        sent: 0,
        failed: 0,
      },
    },
  });
});

app.get('/api/templates', (req, res) => {
  res.json({
    success: true,
    data: {
      templates: [],
      message: 'Email templates endpoint',
    },
  });
});

startSubdomainServer('mail.mifistix.com', app, config.servers.mail.port, config.servers.mail.host);

