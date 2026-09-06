const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const PORT = process.env.PORT || 3000;
const ROOM = 'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=1727074031';
const CHAT_FILE = path.join(ROOT, 'chat-store.json');
const IP_DAILY_LIMIT = 5;
const IMGS_ROOT = path.join(ROOT, 'assets', 'imgs');
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

function dayKey(now){
  const d = new Date((now ?? Date.now()) - 4 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
let chat = { day: dayKey(), ipCount: {}, messages: [] };
try {
  chat = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
} catch (e) { chat = { day: dayKey(), ipCount: {}, messages: [] }; }
function saveChat(){ fs.writeFile(CHAT_FILE, JSON.stringify(chat), err => { if (err) console.error('save chat failed', err); }); }
function rollDay(){
  const k = dayKey();
  if (chat.day !== k) { chat.day = k; chat.ipCount = {}; chat.messages = []; saveChat(); }
}
rollDay();
function ipOf(req){ return (req.socket.remoteAddress || '').replace(/^::ffff:/, ''); }
function nickOf(ip){ return crypto.createHash('md5').update(ip).digest('hex').slice(0, 8); }

function readBody(req, cb){
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
  req.on('end', () => cb(raw));
}

function chatJson(res, status, obj){
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function apiLive(cb) {
  https.get(ROOM, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://live.bilibili.com/',
    },
  }, res => {
    let body = '';
    res.on('data', d => { body += d; });
    res.on('end', () => cb(res.statusCode || 200, body));
  }).on('error', err => cb(502, JSON.stringify({ code: -1, msg: String(err) })));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/api/live') {
    apiLive((status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    });
    return;
  }

  if (u.pathname === '/api/chat/msgs') {
    rollDay();
    const msgs = chat.messages.slice(-100).map(m => ({ nick: m.nick, text: m.text, ts: m.ts }));
    const remaining = Math.max(0, IP_DAILY_LIMIT - (chat.ipCount[ipOf(req)] || 0));
    chatJson(res, 200, { messages: msgs, remaining });
    return;
  }

  if (u.pathname === '/api/chat/msg') {
    if (req.method !== 'POST') { chatJson(res, 405, { code: 405, msg: 'Method Not Allowed' }); return; }
    rollDay();
    readBody(req, raw => {
      let data;
      try { data = JSON.parse(raw); } catch (e) { chatJson(res, 400, { code: 400, msg: '无效请求体' }); return; }
      const text = String(data.text || '').trim();
      if (!text || text.length > 500) { chatJson(res, 400, { code: 400, msg: '消息为空或过长' }); return; }
      const ip = ipOf(req);
      const nick = nickOf(ip);
      if ((chat.ipCount[ip] || 0) >= IP_DAILY_LIMIT) { chatJson(res, 429, { code: 429, msg: '今日已达上限，明天再来吧' }); return; }
      chat.ipCount[ip] = (chat.ipCount[ip] || 0) + 1;
      chat.messages.push({ nick, text, ts: Date.now() });
      saveChat();
      chatJson(res, 200, { ok: true, left: IP_DAILY_LIMIT - chat.ipCount[ip] });
    });
    return;
  }

  if (u.pathname === '/api/imgs') {
    if (req.method !== 'GET') { chatJson(res, 405, { code: 405, msg: 'Method Not Allowed' }); return; }
    const rel = (u.searchParams.get('path') || '').replace(/\\/g, '/');
    if (rel.includes('..') || path.isAbsolute(rel)) { chatJson(res, 403, { code: 403, msg: 'Forbidden' }); return; }
    const dir = path.resolve(IMGS_ROOT, rel);
    if (dir !== IMGS_ROOT && !dir.startsWith(IMGS_ROOT + path.sep)) { chatJson(res, 403, { code: 403, msg: 'Forbidden' }); return; }
    fs.readdir(dir, { withFileTypes: true }, (err, ents) => {
      if (err) { chatJson(res, 404, { code: 404, msg: 'Not Found' }); return; }
      const dirs = [], files = [];
      ents.forEach(ent => {
        if (ent.isDirectory()) dirs.push(ent.name);
        else if (ent.isFile() && IMG_EXT.includes(path.extname(ent.name).toLowerCase())) files.push(ent.name);
      });
      dirs.sort(); files.sort();
      chatJson(res, 200, { path: rel, dirs, files });
    });
    return;
  }

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('chu2u OS 运行于 http://localhost:' + PORT);
});
