const restify = require('restify');

/**
  * Initialize server
  */
const server = restify.createServer();

/**
  * Middleware
  */
// server.use(restify.plugins.jsonp());
// server.use(restify.plugins.queryParser());

/**
  * Routes
  */
server.get('/search', (_req, res, next) => {
  res.send([]);
  next();
});

const port = 1225;
server.listen(port, () => {
  console.log('Listening on port %d', port);
});
