
const restify = require('restify');

const http = require('http');
const { URL } = require('url');

const fs = require('fs');
const youtubedl = require('youtube-dl');

const isValidKey = key => key == 'Le GG' || key == '99109';

let storedData = {
  currentSong: null,
  remoteQueue: [],
  queue: [],
  note: '',
  volume: 0.5,
  id: 0,
};

function saveData(f) {
  if (f) f(storedData);
  fs.writeFile('data.json', JSON.stringify(storedData, null, 2), e => e && console.error(e));
}

function loadEntry(entry, stream) {
  if (entry.status == 'downloaded') return;
  function finished() {
    console.log('Download finished', entry.id);
    entry.status = 'downloaded';
    saveData();
  }
  console.log('Downloading', entry.id, entry.name, entry.url, !!stream);
  if (stream) {
    const out = fs.createWriteStream(`videocache/${entry.id}`);
    stream.pipe(out).on('finish', finished).on('error', (e) => {
      console.log('Download error', entry.id, e);
      entry.status = 'download error';
      fs.unlink(`videocache/${entry.id}`, () => {});
      saveData();
    });
  } else {
    entry.url = entry.url.replace(/^https:\/\//, 'http://');
    let u = entry.url;
    if (u.match(/projectweek/)) {
      u = new URL(u);
    }
    const request = http.get(u, (res) => {
      if (res.statusCode != 200) {
        console.log('Download error: Wrong status code:', res.statusCode, res.statusMessage, entry.id);
        entry.status = 'failed';
        saveData();
        return;
      }
      res.on('error', (e) => {
        console.log('Inner download error', e);
        entry.status = 'failed';
        saveData();
      });
      const out = fs.createWriteStream(`videocache/${entry.id}`);
      res.pipe(out).on('finish', finished);
    });
    request.on('error', (e) => {
      console.log('Download error', e);
      entry.status = 'download error';
      fs.unlink(`videocache/${entry.id}`, () => {});
      saveData();
    });
  }
}

let lastNext = 0;
function nextSong() {
  if (Date.now() - lastNext < 10000) return;
  lastNext = Date.now();
  const id = storedData.currentSong;
  song = storedData.queue.find(s => s.id > id && s.status == 'downloaded');
  song = song || storedData.queue.find(s => s.status == 'downloaded');
  storedData.currentSong = song ? song.id : null;
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
    fs.unlink(`videocache/${storedData.queue.shift().id}`, () => {});
  }
  if (old.length > 10) saveData();
}, 5000);

function loadData(data) {
  storedData = data;
  data.queue.forEach(e => loadEntry(e));
  fs.readdir('videocache', (err, items) => items.forEach((f) => {
    if (storedData.queue.find(e => e.id == f)) return;
    fs.unlink(`videocache/${f}`, () => {});
  }));
  let song = storedData.queue.find(s => s.id == storedData.currentSong);
  song = song || storedData.queue.find(s => s.status == 'downloaded');
  if (song) {
    storedData.currentSong = song.id;
    saveData();
  } else {
    nextSong();
  }
}

fs.readFile('data.json', 'utf8', (err, data) => !err && data && loadData(JSON.parse(data)));

function addQueue(url, name, stream) {
  const entry = {
    status: 'downloading',
    url,
    name,
    id: storedData.id += 1,
  };
  loadEntry(entry, stream);
  storedData.queue.push(entry);
  saveData();
}
function addUrl(url, cb, override, title) {
  if (url.match(/^url=/)) url = url.substr(4);
  url = url.replace(/^https:\/\//, 'http://');
  if (!url.match(/^http:\/\//)) {
    return cb && cb(false, 'Invalid url');
  }
  const vid = youtubedl(url, []);
  vid.on('info', (info) => {
    // eslint-disable-next-line
    if (!override && info._duration_raw > 600) {
      return cb && cb(false, 'Song is longer than 10 minutes');
    }
    if (cb) cb(true, info.title);
    return addQueue(null, title || info.title, vid);
  }).on('error', err => cb && cb(false, err));
  /*
  youtubedl.getInfo(url, ['--no-cache-dir'], (err, info) => {
    if (err) {
      return cb && cb(false, err);
    // eslint-disable-next-line
    } else if (!override && info._duration_raw > 600) {
      return cb && cb(false, 'Song is longer than 10 minutes');
    }
    addQueue(info.url, info.title);
    return cb && cb(true, info.title);
  });
  */
  return null;
}

const server = restify.createServer();

server.pre(restify.plugins.queryParser());

server.pre((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const getData = () => ({ currentSong: storedData.currentSong, volume: storedData.volume, note: storedData.note, queue: storedData.queue });

server.get('/queue/get', (req, res, next) => ((res.send(getData()) || 1) && next()));

class ForbiddenError extends Error {
  constructor() {
    super('Wrong or no key found');
    this.statusCode = 403;
  }
}

let sessions = [];
setInterval(() => {
  sessions = sessions.filter(s => s.lastTimestamp > Date.now() - (2 * 60 * 60 * 1000));
}, 10000);
function refreshSession(req) {
  const address = req.connection.remoteAddress;
  const key = (req.query && req.query.key) || null;
  const userAgent = req.userAgent();
  let sess = sessions.find(s => s.address == address && s.userAgent == userAgent);
  if (!sess) {
    sess = { address, userAgent, firstTimestamp: Date.now(), requests: [] };
    sessions.push(sess);
  }
  return Object.assign(sess, {
    lastTimestamp: Date.now(),
    key,
  });
}

server.pre((req, res, next) => {
  if (!req.url.match(/^\/data\/.*/)) return next();
  refreshSession(req);
  try {
    if (!req.query) throw new ForbiddenError();
    if (isValidKey(req.query.key)) {
      req.validKey = true;
    } else if (req.url.match(/^\/data\/(?!get|add).*/)) {
      console.log('Someone tried wrong key', req.query.key, req.connection.remoteAddress, req.url);
      res.send(403, 'Wrong or no key found');
      return next(false);
    }
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
    next(false);
    if (suc) {
      const session = refreshSession(req);
      if (!session) return;
      console.log(`${session.address} requested ${req.query.url} - ${tit}`);
      session.requests.push([req.query.url, tit]);
    }
  }, req.validKey);
};
const play = id => saveData(d => d.currentSong = id);
const dele = id => saveData((d) => {
  d.queue = d.queue.filter(s => s.id != id);
  fs.unlink(`videocache/${id}`, () => {});
});
const svol = vo => saveData(d => d.volume = vo);
const handler = (res, next) => (res.send(getData()) || 1) && next();

server.get('/data/get', (req, res, next) => handler(res, next));
// server.get(/^\/data\/.*/, (req, res, next) => handler(res, next));
server.get('/data/authorized', (req, res, next) => (console.log(req.validKey ? 'Yes' : 'No') || 1) && next());
server.get('/data/next', (req, res, next) => ((console.log('nextSong requested by', req.connection.remoteAddress) || (nextSong() || 1)) && handler(res, next)));
server.get('/data/add', (req, res, next) => addUrlHandler(req, res, next));
server.get('/data/play', (req, res, next) => ((play(req.query.id) || 1) && handler(res, next)));
server.get('/data/dele', (req, res, next) => ((dele(req.query.id) || 1) && handler(res, next)));
server.get('/data/setVolume', (req, res, next) => ((svol(req.query.volume) || 1) && handler(res, next)));

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
server.get('/videocache/:id', (req, res, next) => {
  const song = storedData.queue.find(s => s.id == req.params.id);
  if (!song) {
    res.send(404, 'Video not found');
    return next(false);
  } else if (song.status != 'downloaded') {
    res.send(404, 'Video not downloaded');
    return next(false);
  }
  return fs.stat(`videocache/${req.params.id}`, (err, stats) => {
    if (err || !stats.isFile()) {
      console.log(`Marked ${song.id} ${song.title} as deleted`);
      song.status = 'deleted';
      saveData();
      return next(false);
    } else if (stats.size == 0) {
      console.log(`Marked ${song.id} ${song.title} as corrupted`);
      song.status = 'corrupted';
      saveData();
      return next(false);
    }
    return fs.createReadStream(`videocache/${req.params.id}`).pipe(res)
      .on('finish', () => next(false))
      .on('error', (e) => {
        res.send(500, `${e}`);
        return next(false);
      });
  });
});

server.listen(8123);

const base = 'http://projectweek.uclllabs.be/radio/';

function handleData(list) {
  list.forEach((entry) => {
    if (storedData.remoteQueue.indexOf(entry.id) != -1) return;
    if (!entry.path) return;
    storedData.remoteQueue.push(entry.id);
    addQueue(base + entry.path, entry.title);
    console.log(`Added ${entry.title} from remote`);
  });
}

const listUrl = `${base}/list.php`;
function fetchList() {
  http.get(listUrl, (res) => {
    const { statusCode, statusMessage } = res;
    if (statusCode !== 200) {
      res.resume();
      console.error(`Request failed while fetching list.php: ${statusCode} ${statusMessage}`);
      return;
    }
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
      try {
        handleData(JSON.parse(rawData));
      } catch (e) {
        if (e.message.match(/Unexpected token N in JSON/)) return;
        if (e.message.match(/list\.forEach is not a function/)) return;
        console.error(`Got error while parsing list.php: ${e.message}`);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error while fetching list.php: ${e.message}`);
  });
}
fetchList();
setInterval(fetchList, 5000);

const formatAgo = (t) => {
  t = (Date.now() - t) / 1000;
  if (t < 60) return `${Math.floor(t)}s ago`;
  if (t < 60 * 60) return `${Math.floor(t / 60)}m ago`;
  if (t < 60 * 60 * 24) return `${Math.floor(t / 60 / 60)}h ago`;
  return `${Math.floor(t / 60 / 60 / 24) * 10} days ago`;
};

module.exports = {
  get data() {
    return storedData;
  },
  set data(value) {
    storedData = value;
  },
  get server() {
    return server;
  },
  get sessions() {
    return sessions;
  },
  sessionOverview() {
    if (console.clear) console.clear();
    console.log('===== Sessions =====');
    sessions.sort((a, b) => a.firstTimestamp - b.firstTimestamp);
    sessions.forEach((session) => {
      let key = session.key;
      if (isValidKey(key)) {
        key += ' (Valid)';
      } else if (!key) {
        key = 'No key';
      }
      console.log(`[${formatAgo(session.lastTimestamp)}] ${session.address} (${key})`);
      console.log(`\tStarted ${formatAgo(session.firstTimestamp)} ago with UA: ${session.userAgent}`);
      session.requests.forEach(([url, title]) => console.log(`\t- ${url} - ${title}`));
    });
  },
  clear() {
    fs.readdir('videocache', (err, items) => items.forEach(f => fs.unlink(`videocache/${f}`, () => {})));
    storedData.queue = [];
    storedData.id = 0;
    storedData.currentSong = null;
    saveData();
  },
  saveData,
  loadData,
  loadEntry,
  nextSong,
  addQueue,
  addUrl,
  getData,
  play,
  dele,
  fetchList,
};
