const APPS = {
  about: { title:'关于本机', icon:'🗿', kind:'about' },
  notes: { title:'聊天室',    icon:'💬', kind:'chat' },
  viewer:{ title:'图片查看器', icon:'🖼️', kind:'viewer' },
  term:  { title:'终端',      icon:'⌨️', kind:'terminal' },
  finder:{ title:'访达',      icon:'📁', kind:'finder' },
  table: { title:'记录',      icon:'📊', kind:'table' },
  schedule:{ title:'日程',    icon:'📅', kind:'schedule' },
  page:  { title:'页面',      icon:'📄', kind:'page' },
};

const windowsRoot = document.getElementById('windows');
const dockRoot = document.getElementById('dock');

let zTop = 100;
const openWindows = new Map();

function tickClock(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  const wd = '日一二三四五六'[d.getDay()];
  document.getElementById('clock').textContent =
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 周${wd}`;
}
tickClock();
setInterval(tickClock, 1000);

function createWindow(appKey, opts = {}){
  const app = APPS[appKey];
  const id = appKey + '-' + Date.now() + Math.floor(Math.random()*999);

  const el = document.createElement('div');
  el.className = 'window';
  el.dataset.id = id;
  el.dataset.app = appKey;

  el.innerHTML = `
    <div class="titlebar">
      <div class="dots">
        <span class="dot red" data-act="close"></span>
        <span class="dot yellow" data-act="min"></span>
        <span class="dot green" data-act="max"></span>
      </div>
      <span class="ttl">${opts.title || app.title}</span>
    </div>
    <div class="content">${renderContent(appKey, opts)}</div>
    <div class="resizer"></div>`;

  const vw = window.innerWidth, vh = window.innerHeight;
  const dw = Math.round(vw * 0.70), dh = Math.round(vh * 0.70);
  const W = opts.x ?? Math.max(16, Math.round((vw - dw) / 2) - 24 * openWindows.size);
  const H = opts.y ?? Math.max(44, Math.round((vh - dh) / 2) + 22 * openWindows.size);
  el.style.left = W + 'px';
  el.style.top = H + 'px';
  el.style.width = (opts.w || dw) + 'px';
  el.style.height = (opts.h || dh) + 'px';
  el.style.zIndex = ++zTop;

  windowsRoot.appendChild(el);

  makeFocusable(el);
  makeDraggable(el);
  makeResizable(el);
  wireControls(el);

  if(appKey === 'term'){
    const termEl = el.querySelector('.terminal');
    if(termEl) addTermInput(termEl);
  }
  if(appKey === 'notes') initChat(el);
  if(appKey === 'finder') initFinder(el, opts.path);
  if(appKey === 'schedule') initSchedule(el);
  if(appKey === 'page') initPage(el, opts);

  el.addEventListener('mousedown', () => focus(el));

  openWindows.set(id, { el, app, minimized:false, prev:{} });
  registerDockState(appKey);
  focus(el);

  return el;
}

function renderContent(appKey, opts){
  switch(appKey){
    case 'about': return `
      <div class="about">
        <div class="logo">🐸</div>
        <h2>chu2u OS</h2>
        <p>薄荷绿电路风桌面演示</p>
      </div>`;
    case 'notes': return `
      <div class="chat">
        <div class="chat-banner">聊天记录每日4点清空，您的ip还有<span id="chatRemain">5</span>次发言机会</div>
        <div class="chat-log" id="chatLog"></div>
        <div class="chat-input">
          <input id="chatText" maxlength="500" placeholder="说点什么…">
          <button id="chatSend">发送</button>
        </div>
      </div>`;
    case 'viewer': {
      const img = opts && opts.img ? esc(opts.img) : '';
      return `
      <div class="viewer">
        <div class="stage"><img id="vs" src="${img}" alt="chu2u"${img ? '' : ' hidden'}><div class="vhint"${img ? ' hidden' : ''}>从访达点击图片进行查看</div></div>
      </div>`;
    }
    case 'term': return `
      <div class="terminal">
        <div class="line">chu2uOS [ver 1.0]</div>
        <div class="line">type a command (help)</div>
      </div>`;
    case 'finder': return `
      <div class="finder">
        <div class="finder-path" id="finderPath">imgs</div>
        <div class="finder-grid" id="finderGrid"></div>
      </div>`;
    case 'table': return `
      <div class="tbl">
        <table>
          <thead><tr><th>日期</th><th>内容</th></tr></thead>
          <tbody></tbody>
        </table>
        <p class="tbl-empty">暂无记录</p>
      </div>`;
    case 'schedule': return `
      <div class="sched">
        <div class="sched-stage"><img id="schedImg" alt="" referrerpolicy="no-referrer"><div class="sched-hint">加载日程图…</div></div>
      </div>`;
    case 'page': return `
      <div class="page"><p class="page-empty">加载中…</p></div>`;
    default: return `<div style="padding:20px;color:var(--ink-soft);">暂无内容</div>`;
  }
}

windowsRoot.addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.classList.contains('cmd')) runTerminal(e.target);
});

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtTs(ts){ const d = new Date(ts); const p = n => String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }

function initChat(el){
  const log = el.querySelector('#chatLog');
  const text = el.querySelector('#chatText');
  const send = el.querySelector('#chatSend');
  const remain = el.querySelector('#chatRemain');
  if(!log || !text || !send) return;
  function notice(msg){ log.insertAdjacentHTML('beforebegin', `<div class="nmsg">${esc(msg)}</div>`); }
  function setRemain(n){ if(remain && typeof n === 'number') remain.textContent = n; }
  function refresh(){
    fetch('/api/chat/msgs', { cache:'no-store' }).then(r => r.json()).then(j => {
      if(j && j.notice) notice(j.notice);
      const msgs = j.messages || [];
      log.innerHTML = msgs.map(m => `<div class="msg"><b>${esc(m.nick)}</b> <i>${fmtTs(m.ts)}</i><br>${esc(m.text)}</div>`).join('') || '<div class="nmsg">暂无消息</div>';
      log.scrollTop = log.scrollHeight;
      setRemain(j.remaining);
    }).catch(() => notice('加载失败'));
  }
  function sendMsg(){
    if(!text.value.trim()) return;
    fetch('/api/chat/msg', {
      method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
      body: JSON.stringify({ text: text.value.trim() }),
    }).then(r => r.json().then(j => ({ s: r.status, j })))
      .then(({ s, j }) => { if(s === 200 && j && j.ok){ text.value = ''; setRemain(j.left); refresh(); } else notice((j && j.msg) || '发送失败'); })
      .catch(() => notice('网络错误，需通过 node assets/js/server.js 访问'));
  }
  send.addEventListener('click', sendMsg);
  text.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); sendMsg(); } });
  refresh();
}

function initFinder(el, start){
  const pathEl = el.querySelector('#finderPath');
  const grid = el.querySelector('#finderGrid');
  if(!pathEl || !grid) return;
  const BASE = 'assets/imgs';
  let segs = typeof start === 'string' && start ? start.split('/') : [];
  function cur(){ return segs.join('/'); }
  function srcOf(name){ return BASE + '/' + (segs.length ? segs.join('/') + '/' : '') + name; }
  function renderPath(){
    let h = '<span class="seg" data-i="-1">imgs</span>';
    segs.forEach((s, i) => h += `<span class="sep">/</span><span class="seg" data-i="${i}">${esc(s)}</span>`);
    pathEl.innerHTML = h;
  }
  function load(){
    fetch('assets/imgs.json', { cache:'no-store' })
      .then(r => r.json())
      .then(manifest => {
        renderPath();
        const cur = segs.join('/');
        const dirs = cur ? [] : Object.keys(manifest).filter(d => d !== 'icon');
        const files = cur ? (manifest[cur] || []) : [];
        let h = '';
        dirs.forEach(d => h += `<div class="tile folder" data-dir="${esc(d)}"><span class="fic">📁</span><span class="fname">${esc(d)}</span></div>`);
        files.forEach(f => h += `<div class="tile file" data-file="${esc(f)}"><img src="${esc(srcOf(f))}" alt=""><span class="fname">${esc(f)}</span></div>`);
        grid.innerHTML = h || '<div class="fempty">空目录</div>';
      })
      .catch(() => { grid.innerHTML = '<div class="fempty">加载失败</div>'; });
  }
  pathEl.addEventListener('click', e => {
    const seg = e.target.closest('.seg');
    if(!seg) return;
    const i = Number(seg.dataset.i);
    segs = i < 0 ? [] : segs.slice(0, i + 1);
    load();
  });
  grid.addEventListener('click', e => {
    const folder = e.target.closest('.folder');
    if(folder){ segs.push(folder.dataset.dir); load(); return; }
    const file = e.target.closest('.file');
    if(file) openViewer(segs.concat([file.dataset.file]).join('/'));
  });
  el._goto = p => { segs = p ? p.split('/') : []; load(); };
  load();
}

const V_PAD = { x: 32, y: 70 };
function naturalSize(src){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res(null);
    im.src = src;
  });
}
function viewerSize(dim){
  const vw = window.innerWidth, vh = window.innerHeight;
  const iw = (dim && dim.w) || 0, ih = (dim && dim.h) || 0;
  const maxW = Math.round(vw * 0.85) - V_PAD.x;
  const maxH = Math.round(vh * 0.78) - V_PAD.y;
  let cw = iw, ch = ih;
  if(iw && ih){
    const scale = Math.min(maxW / iw, maxH / ih, 1);
    cw = Math.round(iw * scale);
    ch = Math.round(ih * scale);
  }
  return { w: Math.max(300, V_PAD.x + cw), h: Math.max(180, V_PAD.y + ch) };
}
function topViewer(){
  let top = null;
  openWindows.forEach(rec => {
    if(rec.el.dataset.app === 'viewer' && !rec.minimized){
      if(!top || +rec.el.style.zIndex > +top.el.style.zIndex) top = rec;
    }
  });
  return top;
}
function openViewer(relPath){
  const src = 'assets/imgs/' + relPath;
  const existing = topViewer();
  naturalSize(src).then(dim => {
    const s = viewerSize(dim);
    if(existing){
      const vs = existing.el.querySelector('#vs');
      const hint = existing.el.querySelector('.vhint');
      if(vs){ vs.src = src; vs.removeAttribute('hidden'); }
      if(hint) hint.setAttribute('hidden', '');
      existing.el.style.width = s.w + 'px';
      existing.el.style.height = s.h + 'px';
      focus(existing.el);
    } else {
      createWindow('viewer', { img: src, w: s.w, h: s.h });
    }
  });
}

function focus(el){
  el.style.zIndex = ++zTop;
  document.querySelectorAll('.window.active').forEach(w => w.classList.remove('active'));
  el.classList.add('active');
  const appKey = el.dataset.app;
  refreshDockActive();
}
function makeFocusable(el){ el.addEventListener('mousedown', () => focus(el)); }

function makeDraggable(el){
  const bar = el.querySelector('.titlebar');
  let sx,sy,sx0,sy0,dragging=false;
  bar.addEventListener('pointerdown', e => {
    if(e.target.closest('.dot')) return;
    dragging = true;
    const r = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; sx0 = r.left; sy0 = r.top;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', e => {
    if(!dragging) return;
    const nx = Math.min(window.innerWidth - 40, Math.max(-el.offsetWidth + 60, sx0 + e.clientX - sx));
    const ny = Math.min(window.innerHeight - 30,  Math.max(0, sy0 + e.clientY - sy));
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  });
  bar.addEventListener('pointerup', () => dragging=false);
}

function makeResizable(el){
  const rz = el.querySelector('.resizer');
  let dragging=false,sx,sy,w,h;
  rz.addEventListener('pointerdown', e => {
    dragging=true; e.stopPropagation();
    sx=e.clientX; sy=e.clientY; w=el.offsetWidth; h=el.offsetHeight;
    rz.setPointerCapture(e.pointerId);
  });
  rz.addEventListener('pointermove', e => {
    if(!dragging) return;
    el.style.width = Math.max(300, w + e.clientX - sx) + 'px';
    el.style.height = Math.max(180, h + e.clientY - sy) + 'px';
  });
  rz.addEventListener('pointerup', () => dragging=false);
}

function wireControls(el){
  el.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('mousedown', e => e.stopPropagation());
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const act = dot.dataset.act;
      if(act==='close') closeWindow(el);
      else if(act==='min') minimizeWindow(el);
      else if(act==='max') maximizeWindow(el);
    });
  });
}

function closeWindow(el){
  const id = el.dataset.id;
  openWindows.delete(id);
  el.remove();
  refreshDockActive();
}

function minimizeWindow(el){
  const appKey = el.dataset.app;
  const dockApp = dockRoot.querySelector(`.app[data-app="${appKey}"]`);
  let tx=0, ty=0;
  if(dockApp){
    const r = dockApp.getBoundingClientRect();
    tx = r.left + r.width/2; ty = r.top + r.height/2;
  }
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  el.classList.add('minimizing');
  el.style.transform = `translate(${tx-cx}px, ${ty-cy}px) scale(.08)`;
  const rec = openWindows.get(el.dataset.id);
  if(rec) rec.minimized = true;
  setTimeout(() => {
    el.style.display='none';
    el.classList.remove('minimizing');
    el.style.transform='';
  }, 330);
  refreshDockActive();
}

function restoreWindow(id){
  const rec = openWindows.get(id);
  if(!rec) return;
  const el = rec.el;
  el.style.display='';
  el.style.transform = `scale(.08) translate(0,0)`;
  el.style.opacity = '0';
  focus(el);
  requestAnimationFrame(() => {
    el.style.transition='transform .32s ease, opacity .32s ease';
    el.style.transform='';
    el.style.opacity='1';
    setTimeout(()=>{ el.style.transition=''; }, 330);
  });
  rec.minimized = false;
  refreshDockActive();
}

function maximizeWindow(el){
  const rec = openWindows.get(el.dataset.id);
  if(!rec) return;
  if(!rec.prev.hasOwnProperty('w')){
    rec.prev = { x:el.style.left, y:el.style.top, w:el.style.width, h:el.style.height };
    el.style.left='18px'; el.style.top=(document.getElementById('menubar').offsetHeight+6)+'px';
    el.style.width = (window.innerWidth-36)+'px';
    el.style.height = (window.innerHeight - document.getElementById('dock').offsetHeight - 28)+'px';
    el.dataset.green='fks';
  } else {
    el.style.left=rec.prev.x; el.style.top=rec.prev.y;
    el.style.width=rec.prev.w; el.style.height=rec.prev.h;
    rec.prev={};
  }
  focus(el);
}

let dockActiveCount = {};
const DOCK_APPS = new Set(['finder','notes','viewer','term']);
function registerDockState(appKey){
  if(!DOCK_APPS.has(appKey)) return;
  if(!dockRoot.querySelector(`.app[data-app="${appKey}"]`)){
    addDockIcon(appKey);
  }
}
function addDockIcon(appKey){
  const app = APPS[appKey];
  const d = document.createElement('div');
  d.className = 'app';
  d.dataset.app = appKey;
  d.title = app.title;
  const img = `<span>${app.icon}</span>`;
  d.innerHTML = img + `<span class="tooltip">${app.title}</span><span class="aidx"></span>`;
  if(appKey === 'notes'){
    const sep = document.createElement('div');
    sep.className='sep';
    dockRoot.appendChild(sep);
    dockRoot.appendChild(d);
  } else {
    dockRoot.insertBefore(d, dockRoot.querySelector('.sep') || null);
  }
  d.addEventListener('click', () => dockClick(appKey));
}
function dockClick(appKey){
  const entries = [...openWindows.entries()].filter(([id,rec])=>rec.app && rec.app.title === APPS[appKey].title);
  const top = entries
    .filter(([id,rec]) => rec.el.dataset.app === appKey && !rec.minimized)
    .sort((a,b)=> b[1].el.style.zIndex - a[1].el.style.zIndex)[0];
  if(top){
    if(top[1].minimized) restoreWindow(top[0]);
    else focus(top[1].el);
    return;
  }
  const minRec = entries.filter(([id,rec])=>rec.minimized)[0];
  if(minRec){ restoreWindow(minRec[0]); return; }
  if(appKey==='finder'){
    const existing = entries.filter(([id,rec])=>!rec.minimized)[0];
    if(existing){ focus(existing[1].el); return; }
  }
  createWindow(appKey);
}

function refreshDockActive(){
  const active = new Set();
  openWindows.forEach(rec => active.add(rec.el.dataset.app));
  dockRoot.querySelectorAll('.app').forEach(a =>
    a.classList.toggle('active', active.has(a.dataset.app)));
}

const FS = {
  '/': {
    home: 'drwxr-xr-x  chu2u  chu2u   4096  .',
    docs: 'drwxr-xr-x  chu2u  chu2u   4096  docs',
    notes: '-rw-r--r--  chu2u  chu2u     52  notes.txt',
    readme: '-rw-r--r--  chu2u  chu2u    120  README.md'
  },
  '/docs': {
    a: '-rw-r--r--  chu2u  chu2u     12  a.txt',
    b: '-rw-r--r--  chu2u  chu2u     18  b.txt'
  }
};
const FS_CONTENT = {
  '/readme': 'chu2uOS 演示终端\n这是一个模拟的 Linux 终端。\n支持: help ls pwd echo cat date whoami clear uname',
  '/notes': '记住: 薄荷绿电路风\n别忘了保存',
  '/docs/a.txt': 'hello world',
  '/docs/b.txt': '第二条备忘'
};
function termCwd(term){ return term._cwd || '/'; }
function setTermCwd(term, cwd){ term._cwd = cwd; }

function printLine(term, text){
  const line = document.createElement('div');
  line.className = 'line';
  line.textContent = text;
  term.appendChild(line);
}
function printLines(term, arr){ arr.forEach(t => printLine(term, t)); }

function runTerminal(input){
  const term = input.closest('.terminal');
  const raw = input.value.trim();
  input.remove();
  const echo = document.createElement('div');
  echo.innerHTML = `<span class="in">$ ${escapeHtml(raw)}</span>`;
  term.appendChild(echo);

  if(raw){
    const args = raw.split(/\s+/);
    const cmd = args[0];
    const rest = args.slice(1);
    execCommand(term, cmd, rest);
  }
  term.scrollTop = term.scrollHeight;
  addTermInput(term, true);
}

function execCommand(term, cmd, args){
  const cwd = termCwd(term);
  switch(cmd){
    case 'help': return printLines(term, [
      '可用命令:',
      '  ls       列出当前目录文件',
      '  pwd      显示当前路径',
      '  echo <s> 输出文本',
      '  cat <f>  查看文件内容',
      '  cd <dir> 切换目录(.. 返回上级)',
      '  date     当前日期时间',
      '  whoami   当前用户名',
      '  uname    系统信息',
      '  clear    清屏',
    ]);
    case 'ls': return cmdLs(term, cwd, args[0]);
    case 'pwd': return printLine(term, cwd);
    case 'echo': return printLine(term, args.join(' '));
    case 'cat': return cmdCat(term, cwd, args[0]);
    case 'cd': return cmdCd(term, cwd, args[0]);
    case 'date': return printLine(term, new Date().toString());
    case 'whoami': return printLine(term, 'chu2u');
    case 'uname': return printLine(term, 'Linux chu2u 6.6.0 x86_64 GNU/Linux');
    case 'clear': term.innerHTML=''; return;
    default:
      if(cmd) printLine(term, `command not found: ${cmd}`);
  }
}

function cmdLs(term, cwd, arg){
  let key = cwd;
  if(arg && arg !== '.'){
    if(arg.startsWith('/')) key = resolvePath(arg);
    else if(arg === '..') key = parentOf(cwd);
    else key = joinPath(cwd, arg);
  }
  const dir = FS[key];
  if(!dir){
    printLine(term, `ls: cannot access '${arg}': No such file or directory`);
    return;
  }
  const items = Object.entries(dir).map(([name, meta]) => meta);
  items.forEach(m => printLine(term, m));
}

function cmdCat(term, cwd, file){
  if(!file){ printLine(term, 'cat: missing file operand'); return; }
  let key = file.startsWith('/') ? resolvePath(file) : joinPath(cwd, file);
  const content = FS_CONTENT[key] ?? FS_CONTENT[key + '.txt'] ?? null;
  if(content === null){
    printLine(term, `cat: ${file}: No such file or directory`);
  } else {
    content.split('\n').forEach(l => printLine(term, l));
  }
}

function cmdCd(term, cwd, dir){
  if(!dir || dir === '~'){ setTermCwd(term, '/'); return; }
  if(dir === '..'){ setTermCwd(term, parentOf(cwd)); return; }
  let key = dir.startsWith('/') ? resolvePath(dir) : joinPath(cwd, dir);
  if(FS[key]){ setTermCwd(term, key); }
  else printLine(term, `cd: no such directory: ${dir}`);
}

function joinPath(cwd, rel){
  return resolvePath(cwd + '/' + rel);
}
function resolvePath(p){
  const parts = [];
  p.split('/').forEach(seg => {
    if(!seg || seg === '.') return;
    if(seg === '..') parts.pop();
    else parts.push(seg);
  });
  return '/' + parts.join('/');
}
function parentOf(p){
  const parts = p.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

function addTermInput(term, autofocus){
  const row = document.createElement('div');
  row.className='row';
  row.innerHTML = `<span class="in">$ </span><input class="cmd" autocomplete="off">`;
  term.appendChild(row);
  term.scrollTop = term.scrollHeight;
  if(autofocus) row.querySelector('input').focus();
}
function escapeHtml(s){ return s.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

(function(){
  const planets = [
    { el:document.querySelector('.planet-1'), a:64,  b:19,  L0:252.251, per:87.969  },
    { el:document.querySelector('.planet-2'), a:87,  b:26,  L0:181.980, per:224.701  },
    { el:document.querySelector('.planet-3'), a:102, b:31,  L0:100.464, per:365.256  },
    { el:document.querySelector('.planet-4'), a:126, b:38,  L0:355.433, per:686.980  },
    { el:document.querySelector('.planet-5'), a:233, b:70,  L0:34.351,  per:4332.59  },
    { el:document.querySelector('.planet-6'), a:315, b:95,  L0:50.077,  per:10759.22 },
    { el:document.querySelector('.planet-7'), a:447, b:134, L0:314.055, per:30688.5  },
    { el:document.querySelector('.planet-8'), a:560, b:168, L0:304.349, per:60182.0  },
  ].filter(p => p.el);
  const moon = document.querySelector('.moon');
  const MOON_L0 = 218.316, MOON_PER = 27.321582;

  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = Date.now();
  const baseDays = (load - J2000) / 86400000;
  const SPEED = 500000;

  function step(){
    const elapsed = reduced ? 0 : (Date.now() - load) / 86400000 * SPEED;
    planets.forEach(p => {
      const lam = (p.L0 + 360 * ((baseDays + elapsed) / p.per)) % 360;
      const ang = lam * Math.PI / 180;
      p.el.style.transform =
        `translate(${p.a * Math.cos(ang)}px, ${p.b * Math.sin(ang)}px) translate(-50%,-50%)`;
    });
    if(moon){
      const lamM = (MOON_L0 + 360 * ((baseDays + elapsed) / MOON_PER)) % 360;
      const angM = lamM * Math.PI / 180;
      const cx = 8.5, cy = 8.5;
      moon.style.transform =
        `translate(${cx + 26 * Math.cos(angM)}px, ${cy + 8 * Math.sin(angM)}px) translate(-50%,-50%)`;
    }
    if(!reduced) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  const belt = document.querySelector('.belt');
  if(belt){
    const frag = document.createDocumentFragment();
    for(let i = 0; i < 80; i++){
      const dot = document.createElement('i');
      const r = 140 + Math.random() * 60;
      const ang = Math.random() * Math.PI * 2;
      const a = r, b = r * 0.30;
      const size = 1.5 + Math.random() * 1.6;
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (a * Math.cos(ang)) + 'px';
      dot.style.top = (b * Math.sin(ang)) + 'px';
      dot.style.opacity = (0.4 + Math.random() * 0.5).toFixed(2);
      frag.appendChild(dot);
    }
    belt.appendChild(frag);
  }

  const sys = document.getElementById('solarsystem');
  let zoom = 1;
  document.addEventListener('wheel', e => {
    const t = e.target;
    if(t && t.closest && t.closest('.window, #menubar, #dock')) return;
    e.preventDefault();
    zoom = Math.min(3.5, Math.max(0.4, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    sys.style.transform = `scale(${zoom})`;
  }, { passive:false });
})();

(function(){
  const sp = document.getElementById('splash');
  if(!sp) return;
  const img = document.getElementById('splashImg');
  const FADE = 350;
  let base = [];
  let cur = '';
  function setImg(name){
    img.src = 'assets/imgs/top/' + name;
    requestAnimationFrame(() => img.classList.add('show'));
  }
  fetch('assets/imgs.json', { cache:'no-store' })
    .then(r => r.json())
    .then(manifest => {
      const ext = /\.(png|jpe?g|gif|webp|svg)$/i;
      base = (manifest.top || []).filter(f => ext.test(f));
      if(!base.length){ sp.hidden = true; return; }
      cur = base.includes('happi.webp') ? 'happi.webp' : base[0];
      sp.hidden = false;
      setImg(cur);
    })
    .catch(() => { sp.hidden = true; });
  function isEmpty(){
    for(const r of openWindows.values()) if(!r.minimized) return false;
    return true;
  }
  sp.addEventListener('click', () => {
    if(!isEmpty()) return;
    if(base.length < 2) return;
    const pool = base.filter(f => f !== cur);
    img.classList.remove('show');
    clearTimeout(sp._t);
    sp._t = setTimeout(() => {
      cur = pool[Math.floor(Math.random() * pool.length)];
      setImg(cur);
    }, FADE);
  });
})();

['finder','notes','viewer','term'].forEach(addDockIcon);

(function(){
  const el = document.getElementById('live');
  if(!el) return;
  const txt = document.getElementById('liveTxt');
  const dot = el.querySelector('.live-dot');
  const pop = document.getElementById('livePop');
  el.addEventListener('click', e => { e.stopPropagation(); el.classList.toggle('open'); });
  pop.addEventListener('click', e => { e.stopPropagation(); window.open('https://live.bilibili.com/1727074031', '_blank'); });
  document.addEventListener('click', () => el.classList.remove('open'));
  const SOURCES = ['/api/live'];
  let last = null;
  function render(kind){
    el.classList.remove('live','off','unknown');
    el.classList.add(kind);
    dot.className = 'live-dot ' + kind;
    txt.textContent = kind === 'live' ? 'LIVE' : kind === 'off' ? '未开播' : '检测中';
  }
  function parse(json){
    const ls = (json && json.data && json.data.live_status) != null ? json.data.live_status : (json && json.live_status);
    return typeof ls === 'number' ? (ls === 1 ? 'live' : 'off') : null;
  }
  async function probe(){
    for(const u of SOURCES){
      try{
        const r = await fetch(u, { cache:'no-store', signal: AbortSignal.timeout(6000) });
        if(!r.ok) continue;
        const kind = parse(await r.json());
        if(kind){ last = kind; render(kind); return; }
      }catch(e){}
    }
    if(last) render(last);
    else render('unknown');
  }
  render('unknown');
  probe();
  setInterval(probe, 30000);
})();

(function(){
  const b = document.getElementById('batt');
  if(!b) return;
  b.addEventListener('click', e => { e.stopPropagation(); b.classList.toggle('open'); });
  document.addEventListener('click', () => b.classList.remove('open'));
})();

(function(){
  const a = document.getElementById('appName');
  const pw = document.getElementById('powerPop');
  if(!a || !pw) return;
  a.addEventListener('click', e => { e.stopPropagation(); a.classList.toggle('open'); });
  pw.addEventListener('click', e => {
    e.stopPropagation();
    a.classList.remove('open');
    const t = document.getElementById('toast');
    if(t){
      t.classList.add('show');
      clearTimeout(pw._tt);
      pw._tt = setTimeout(() => t.classList.remove('show'), 1000);
    }
  });
  document.addEventListener('click', () => a.classList.remove('open'));
})();

function openFinderAt(path){
  const entries = [...openWindows.entries()].filter(([id,rec]) => rec.el.dataset.app === 'finder');
  const top = entries.filter(([id,rec]) => !rec.minimized).sort((a,b) => b[1].el.style.zIndex - a[1].el.style.zIndex)[0];
  if(top){
    focus(top[1].el);
    if(top[1].el._goto) top[1].el._goto(path); else initFinder(top[1].el, path);
    return;
  }
  const min = entries.filter(([id,rec]) => rec.minimized)[0];
  if(min){
    restoreWindow(min[0]);
    if(min[1].el._goto) min[1].el._goto(path); else initFinder(min[1].el, path);
    return;
  }
  createWindow('finder', { path });
}

(function(){
  const f = document.getElementById('fileMenu');
  if(!f) return;
  f.addEventListener('click', e => { e.stopPropagation(); f.classList.toggle('open'); });
  f.querySelectorAll('.menu-item').forEach(it => it.addEventListener('click', e => {
    e.stopPropagation();
    f.classList.remove('open');
    const act = it.dataset.act;
    if(act === 'settingimg') openFinderAt('kyaradz');
    else if(act === 'song')       createWindow('table', { title:'歌回记录' });
    else if(act === 'game')       createWindow('table', { title:'游戏回记录' });
    else if(act === 'chirp')      createWindow('table', { title:'啾言集' });
    else if(act === 'week')       openFinderAt('week');
    else if(act === 'gift')       createWindow('table', { title:'舰礼记录' });
  }));
  document.addEventListener('click', () => f.classList.remove('open'));
})();

function openPage(url, title){
  const byUrl = [...openWindows.entries()].filter(([id,rec]) => rec.el.dataset.app === 'page' && rec.el._pageUrl === url);
  const top = byUrl.filter(([id,rec]) => !rec.minimized).sort((a,b) => b[1].el.style.zIndex - a[1].el.style.zIndex)[0];
  if(top){ focus(top[1].el); return; }
  const min = byUrl.filter(([id,rec]) => rec.minimized)[0];
  if(min){ restoreWindow(min[0]); return; }
  const w = createWindow('page', { title, url });
  w._pageUrl = url;
}

(function(){
  const m = document.getElementById('aboutMenu');
  if(!m) return;
  m.addEventListener('click', e => { e.stopPropagation(); m.classList.toggle('open'); });
  m.querySelectorAll('.menu-item').forEach(it => it.addEventListener('click', e => {
    e.stopPropagation();
    m.classList.remove('open');
    const act = it.dataset.act;
    if(act === 'streamer') openPage('html/chu2u.html', '主播信息');
    else if(act === 'author') openPage('html/bingwaa.html', '本站作者');
  }));
  document.addEventListener('click', () => m.classList.remove('open'));
})();

function fitPageWindow(el){
  const content = el.querySelector('.content');
  const box = content && content.querySelector('.page');
  if(!content || !box) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const maxW = Math.round(vw * 0.86), maxH = Math.round(vh * 0.84);
  const prevFlex = content.style.flex, prevW = content.style.width;
  content.style.flex = 'none';
  content.style.width = 'max-content';
  const natW = content.scrollWidth;
  content.style.flex = prevFlex;
  content.style.width = prevW;
  const w = Math.min(natW, maxW);
  el.style.width = w + 'px';
  const h = Math.max(240, Math.min(Math.round(box.scrollHeight) + 46, maxH));
  el.style.height = h + 'px';
}
function initPage(el, opts){
  const box = el.querySelector('.page');
  if(!box) return;
  const url = opts && opts.url;
  if(!url){ box.innerHTML = '<p class="page-empty">未配置页面地址</p>'; return; }
  fetch(url, { cache:'no-store' }).then(r => {
    if(!r.ok) throw new Error(r.status);
    return r.text();
  }).then(html => { box.innerHTML = html; fitPageWindow(el); })
    .catch(() => { box.innerHTML = '<p class="page-empty">页面加载失败</p>'; });
}

function openSchedule(){ createWindow('schedule'); }
function fitScheduleWindow(el, dim){
  if(!dim || !dim.w || !dim.h) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const PAD = { x: 32, y: 70 };
  const boxW = vw * 0.86 - PAD.x, boxH = vh * 0.80 - PAD.y;
  let w = dim.w, h = dim.h;
  if(w > boxW || h > boxH){ const k = Math.min(boxW / w, boxH / h); w *= k; h *= k; }
  el.style.width = Math.max(300, Math.round(w + PAD.x)) + 'px';
  el.style.height = Math.max(180, Math.round(h + PAD.y)) + 'px';
}
function initSchedule(el){
  const img = el.querySelector('#schedImg');
  const hint = el.querySelector('.sched-hint');
  if(!img) return;
  const url = (document.getElementById('scheduleMenu') || {}).dataset?.img || '';
  if(!url){ if(hint) hint.textContent = '未配置图片链接'; return; }
  img.src = url;
  if(hint) hint.hidden = true;
  img.onload = () => fitScheduleWindow(el, { w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = () => { if(hint){ hint.hidden = false; hint.textContent = '图片加载失败'; } };
}
(function(){
  const s = document.getElementById('scheduleMenu');
  if(!s) return;
  s.addEventListener('click', e => { e.stopPropagation(); openSchedule(); });
})();
