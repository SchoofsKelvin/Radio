
const restify = require('restify');

const http = require('http');
const fs = require('fs');
const youtubedl = require('youtube-dl');

const leKey = 'Le GG';

let storedData = {
  currentSong: null,
  remoteQueue: [],
  queue: [],
  id: 0,
};

function saveData(f) {
  if (f) f(storedData);
  fs.writeFile('data.json', JSON.stringify(storedData, null, 2), e => e && console.error(e));
}

function loadEntry(entry) {
  if (entry.status == 'downloaded') return;
  const out = fs.createWriteStream(`videocache/${entry.id}`);
  const request = http.get(entry.url, res => res.pipe(out));
  console.log('Downloading', entry.id, entry.name);
  // console.log(entry.title, entry.id, entry.url, "Le ' thingy");
  request.on('error', (e) => {
    console.log('Download error', e);
    entry.status = 'download error';
    fs.unlink(entry.id, () => {});
    saveData();
  });
  request.on('finish', () => {
    console.log('Download finished', entry.id);
    entry.status = 'downloaded';
    saveData();
  });
}

function nextSong() {
  const id = storedData.currentSong;
  song = storedData.queue.find(s => s.id > id && s.status == 'downloaded');
  song = song || storedData.queue.find(s => s.status == 'downloaded');
  storedData.currentSong = song ? song.id : null;
  console.log('nextSong', id, song, storedData.currentSong);
  saveData();
}

setInterval(() => {
  if (!storedData.currentSong) nextSong();
  let current = storedData.currentSong;
  const song = storedData.queue.filter(s => s.id == current);
  if (!song) nextSong();
  current = storedData.currentSong;
  if (!current) return;
  const old = storedData.queue.filter(s => s.id < current);
  for (let i = 0; i < old.length - 10; i += 1) {
    storedData.queue.shift();
  }
  if (old.length > 10) saveData();
}, 5000);

function loadData(data) {
  storedData = data;
  data.queue.forEach(loadEntry);
  fs.readdir('videocache', (err, items) => items.forEach((f) => {
    if (storedData.queue.find(e => e.id == f)) return;
    fs.unlink(f, () => {});
  }));
  let song = storedData.queue.find(s => s.id == storedData.currentSong);
  song = song || storedData.queue.find(s => s.status == 'downloaded');
  if (song) {
    console.log('currentSong', song.id);
    storedData.currentSong = song.id;
    saveData();
  } else {
    nextSong();
  }
}

fs.readFile('data.json', 'utf8', (err, data) => !err && data && loadData(JSON.parse(data)));

function addQueue(url, name) {
  const entry = {
    status: 'downloading',
    url,
    name,
    id: storedData.id += 1,
  };
  loadEntry(entry);
  storedData.queue.push(entry);
  saveData();
}
function addUrl(url, cb) {
  if (url.match(/^url=/)) url = url.substr(4);
  youtubedl.getInfo(url, [], (err, info) => {
    if (err) {
      if (cb) cb(false, err);
      return;
    }
    addQueue(info.url, info.title);
    if (cb) cb(true, info.title);
  });
}

const server = restify.createServer();

server.pre(restify.plugins.queryParser());

server.pre((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const getData = () => ({ queue: storedData.queue, currentSong: storedData.currentSong });

server.get('/queue/get', (req, res, next) => ((res.send(getData()) || 1) && next()));

class ForbiddenError extends Error {
  constructor() {
    super('Wrong or no key found');
    this.statusCode = 403;
  }
}

server.use((req, res, next) => {
  if (!req.url.match(/^\/data\/(!get).*/)) return next();
  try {
    if (!req.query) throw new ForbiddenError();
    if (req.query.key != leKey) throw new ForbiddenError();
    return next();
  } catch (e) {
    console.log('/data/ pre-error:', e);
    const sc = (e instanceof Error && e.statusCode) || 500;
    res.send(sc, `${e}`);
    return next(false);
  }
});

const addUrlHandler = (req, res, next) => {
  addUrl(req.query.url, (suc, tit) => {
    res.send(suc ? `Video ${tit} added!` : `Error: ${tit}`);
  });
};
const play = id => saveData(d => d.currentSong = id);
const dele = id => saveData(d => d.queue = d.queue.filter(s => s.id != id));
const handler = (res, next) => (res.send(getData()) || 1) && next();

server.get('/data/get', (req, res, next) => handler(res, next));
// server.get(/^\/data\/.*/, (req, res, next) => handler(res, next));
server.get('/data/next', (req, res, next) => ((nextSong() || 1) && handler(res, next)));
server.get('/data/add', (req, res, next) => addUrlHandler(req, res, next));
server.get('/data/play', (req, res, next) => ((play(req.query.id) || 1) && handler(res, next)));
server.get('/data/dele', (req, res, next) => ((dele(req.query.id) || 1) && handler(res, next)));

server.post('/queue/add', (req, res, next) => {
  let url = req.body;
  if (url.match(/^url=/)) url = url.substr(4);
  youtubedl.getInfo(url, [], (err, info) => {
    if (err) {
      res.send(`Error: ${err}`);
      return next(false);
    }
    res.send(`Video '${info.title}' added!`);
    addQueue(info.url, info.title);
    return next();
  });
});

server.get('/', (req, res, next) => {
  fs.readFile('index.html', 'utf8', (err, data) => {
    if (err) return next(new Error(err));
    res.sendRaw(200, data);
    return next();
  });
});
server.get('/videocache/:id', (req, res) => fs.exists(`videocache/${req.query.id}`, b => b && fs.createReadStream(`videocache/${req.query.id}`).pipe(res)));

server.listen(8123);

const base = 'http://projectweek.uclllabs.be/radio/';

function handleData(list) {
  list.forEach((entry) => {
    if (storedData.remoteQueue.indexOf(entry.id) != -1) return;
    if (!entry.path) return;
    storedData.remoteQueue.push(entry.id);
    addQueue(base + entry.path, entry.title);
  });
}

const listUrl = `${base}/list.php`;
function fetchList() {
  http.get(listUrl, (res) => {
    const { statusCode } = res;
    if (statusCode !== 200) {
      res.resume();
      throw new Error(`Request failed: ${statusCode}`);
    }
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
      try {
        handleData(JSON.parse(rawData));
      } catch (e) {
        console.error(`Got error while fetching list.php: ${e.message}`);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error while fetching list.php: ${e.message}`);
  });
}
fetchList();
setInterval(fetchList, 5000);
