const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');
const cron = require('node-cron');

const app = createSubdomainApp('cron.mifistix.com', config.servers.cron.port, {
  rateLimit: false, // Cron задачи не нуждаются в rate limiting
});

// Cron routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'cron.mifistix.com',
    message: 'Cron Jobs & Scheduled Tasks Server',
    endpoints: {
      health: '/health',
      jobs: '/api/jobs',
      status: '/api/status',
    },
  });
});

app.get('/api/jobs', (req, res) => {
  res.json({
    success: true,
    data: {
      jobs: [],
      message: 'Cron jobs endpoint',
    },
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      activeJobs: 0,
      lastRun: new Date().toISOString(),
    },
  });
});

// Пример cron задачи (каждую минуту)
cron.schedule('* * * * *', () => {
  logger.info('Cron job executed', { timestamp: new Date().toISOString() });
});

// Пример cron задачи (каждый час)
cron.schedule('0 * * * *', () => {
  logger.info('Hourly cron job executed', { timestamp: new Date().toISOString() });
});

startSubdomainServer('cron.mifistix.com', app, config.servers.cron.port, config.servers.cron.host);

