

const restify = require('restify');

function getQueue(req, res, next) {
  res.send('abc');
  next();
}

const server = restify.createServer();
server.get('/queue', getQueue);

server.listen(8123, () => {
  console.log('%s listening at %s', server.name, server.url);
});
