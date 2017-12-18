
const restify = require('restify');
const http = require('http');

function getQueue(req, res, next) {
  res.send('abc');
  next();
}

const server = restify.createServer();

server.pre((req, res, next) => {
  const cookie = req.header('Cookie');
  if (cookie) {
    console.log('Cookies:', cookie);
  } else {
    console.log('No cookie!');
  }
  next();
});

server.get('/queue', getQueue);

server.listen(8123, () => {
  console.log('%s listening at %s', server.name, server.url);
});

const listUrl = 'http://projectweek.uclllabs.be/radio/list.php';
setInterval(() => {
  http.get(listUrl, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];
    if (statusCode !== 200) {
      res.resume();
      throw new Error(`Request failed: ${statusCode}`);
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        console.log(parsedData);
      } catch (e) {
        console.error(`Got error while fetching list.php: ${e.message}`);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error while fetching list.php: ${e.message}`);
  });
}, 5000);
