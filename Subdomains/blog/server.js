const config = require('../../shared/config');
const { createSubdomainApp, startSubdomainServer } = require('../../shared/utils/subdomainTemplate');
const logger = require('../../shared/utils/logger');

const app = createSubdomainApp('blog.mifistix.com', config.servers.blog.port);

// Blog routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'blog.mifistix.com',
    message: 'Blog & Content Server',
    endpoints: {
      health: '/health',
      posts: '/api/posts',
      categories: '/api/categories',
    },
  });
});

app.get('/api/posts', (req, res) => {
  res.json({
    success: true,
    data: {
      posts: [],
      message: 'Blog posts endpoint',
    },
  });
});

app.get('/api/posts/:id', (req, res) => {
  res.json({
    success: true,
    data: {
      post: {
        id: req.params.id,
        title: 'Sample Post',
        content: 'Blog post content',
      },
    },
  });
});

app.get('/api/categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: [],
      message: 'Blog categories endpoint',
    },
  });
});

startSubdomainServer('blog.mifistix.com', app, config.servers.blog.port, config.servers.blog.host);

