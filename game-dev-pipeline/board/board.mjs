#!/usr/bin/env node
// Game board: a local, zero-dependency canvas for moodboard/, story/ and art/.
// Shows images, videos, audio, colour palettes and editable Markdown story files.
// Usage: node board.mjs [projectDir] [--port 4777] [--open]
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--port'));
const ROOT = path.resolve(positional[0] ?? process.cwd());
const PORT = Number(flag('--port') ?? process.env.BOARD_PORT ?? 4777);
const DIRS = ['moodboard', 'story', 'art'];
const BOARD_DIR = path.join(ROOT, 'moodboard', '_board');
const LAYOUT = path.join(BOARD_DIR, 'layout.json');
const SKIP = new Set(['_board', 'frames', '.git', 'node_modules', '.DS_Store']);

const TYPES = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.svg'],
  video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'],
  text: ['.md', '.txt', '.markdown'],
  palette: ['.gpl', '.hex'],
};
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.ogv': 'video/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.opus': 'audio/opus',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
  '.pdf': 'application/pdf',
};

function typeOf(rel) {
  const ext = path.extname(rel).toLowerCase();
  const base = path.basename(rel).toLowerCase();
  if (base.startsWith('colors') && ext === '.txt') return 'palette';
  if (base === 'palette.json') return 'palette';
  for (const [t, exts] of Object.entries(TYPES)) if (exts.includes(ext)) return t;
  return 'other';
}

// Resolve a client path inside ROOT/DIRS only; rejects traversal.
function safe(rel) {
  const abs = path.resolve(ROOT, rel);
  const top = path.relative(ROOT, abs).split(path.sep)[0];
  if (!abs.startsWith(ROOT + path.sep) || !DIRS.includes(top)) throw new Error('forbidden path');
  return abs;
}

async function walk(dir, out) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walk(abs, out);
    else out.push(abs);
  }
}

async function listItems() {
  const files = [];
  for (const d of DIRS) await walk(path.join(ROOT, d), files);
  const items = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    // Claude-owned digest: show the text digest and palette, skip generated sheets.
    if (rel.startsWith('moodboard/_digest/') && !/\.(md|json)$/i.test(rel)) continue;
    const type = typeOf(rel);
    if (rel.endsWith('.json') && type !== 'palette') continue;
    const st = await fsp.stat(abs);
    const lane = rel.startsWith('story/') ? 'story' : rel.startsWith('art/target/') ? 'target' : type;
    items.push({ path: rel, type, lane, size: st.size, mtime: st.mtimeMs });
  }
  items.sort((a, b) => a.path.localeCompare(b.path));
  return items;
}

function parsePalette(rel, text) {
  const colors = [];
  if (rel.endsWith('.json')) {
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : j.colors ?? Object.entries(j).map(([role, hex]) => ({ role, hex }));
      for (const c of arr) {
        const hex = typeof c === 'string' ? c : c.hex;
        if (hex) colors.push({ hex: norm(hex), name: typeof c === 'string' ? '' : (c.role ?? c.name ?? '') });
      }
    } catch { /* malformed palette: show nothing */ }
    return colors;
  }
  for (const line of text.split('\n')) {
    const hex = line.match(/#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    const rgb = line.match(/(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
    if (line.trim().startsWith('GIMP') || line.trim().startsWith('Name:') || line.trim().startsWith('#Palette')) continue;
    let h = null;
    if (hex && (line.includes('#') || rel.endsWith('.hex') || rel.includes('colors'))) h = norm(hex[1]);
    else if (rgb) h = '#' + [rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, '0')).join('');
    if (h) colors.push({ hex: h, name: line.replace(hex?.[0] ?? rgb?.[0] ?? '', '').replace(/[#:\-–|,\t]+/g, ' ').trim() });
  }
  return colors;
}
const norm = (h) => {
  h = String(h).replace('#', '').toLowerCase();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(h)) return '#000000';
  return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h);
};

async function readBody(req, limit = 512 * 1024 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new Error('too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function serveFile(req, res, abs) {
  const st = await fsp.stat(abs);
  const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) { // needed for seeking in video/audio
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    fs.createReadStream(abs, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(abs).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    if (p === '/' && req.method === 'GET') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (p === '/api/items') return send(res, 200, { root: ROOT, items: await listItems() });
    if (p === '/api/palette') {
      const rel = url.searchParams.get('path');
      return send(res, 200, parsePalette(rel, await fsp.readFile(safe(rel), 'utf8')));
    }
    if (p === '/api/layout') {
      if (req.method === 'PUT') {
        await fsp.mkdir(BOARD_DIR, { recursive: true });
        await fsp.writeFile(LAYOUT, (await readBody(req)).toString('utf8'));
        return send(res, 200, { ok: true });
      }
      try { return send(res, 200, await fsp.readFile(LAYOUT, 'utf8')); } catch { return send(res, 200, '{}'); }
    }
    if (p.startsWith('/api/text/')) {
      const rel = p.slice('/api/text/'.length);
      if (!/\.(md|markdown|txt)$/i.test(rel)) return send(res, 400, { error: 'only .md/.txt are editable' });
      const abs = safe(rel);
      if (req.method === 'PUT') {
        await fsp.mkdir(path.dirname(abs), { recursive: true });
        await fsp.writeFile(abs, await readBody(req, 5 * 1024 * 1024));
        return send(res, 200, { ok: true, mtime: (await fsp.stat(abs)).mtimeMs });
      }
    }
    if (p.startsWith('/api/upload/') && req.method === 'PUT') {
      const rel = p.slice('/api/upload/'.length);
      const abs = safe(rel);
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      let target = abs; let i = 1;
      while (fs.existsSync(target)) target = abs.replace(/(\.[^.]+)?$/, (e) => `-${i++}${e}`);
      await fsp.writeFile(target, await readBody(req));
      return send(res, 200, { ok: true, path: path.relative(ROOT, target).split(path.sep).join('/') });
    }
    if (p.startsWith('/file/')) return await serveFile(req, res, safe(p.slice('/file/'.length)));
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, e.message === 'forbidden path' ? 403 : 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  for (const d of ['moodboard', 'story']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  const link = `http://127.0.0.1:${PORT}/`;
  console.log(`Game board for ${ROOT}\n→ ${link}  (Ctrl+C to stop)`);
  if (args.includes('--open')) {
    const [cmd, ...pre] = process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', '""'] : ['xdg-open'];
    spawn(cmd, [...pre, link], { stdio: 'ignore', detached: true }).unref();
  }
});

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Game Board</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#16171b;--grid:#22242a;--card:#23252c;--card2:#2c2f38;--text:#e6e6ea;--muted:#8a8d99;--accent:#e0a458;--line:#3a3d48}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:var(--text);font:13px/1.45 system-ui,-apple-system,sans-serif}
#bar{position:fixed;top:0;left:0;right:0;height:44px;display:flex;gap:8px;align-items:center;padding:0 12px;background:#111216ee;border-bottom:1px solid var(--line);z-index:10}
#bar b{margin-right:8px}#bar .sp{flex:1}#bar input{background:var(--card);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:5px 8px;width:180px}
button{white-space:nowrap;background:var(--card2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit}button:hover{border-color:var(--accent)}
#view{position:absolute;inset:44px 0 0 0;overflow:hidden;cursor:grab;background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:24px 24px}
#view.panning{cursor:grabbing}#world{position:absolute;left:0;top:0;transform-origin:0 0}
.lane{position:absolute;color:var(--muted);font-size:22px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;pointer-events:none}
.card{position:absolute;background:var(--card);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;box-shadow:0 6px 20px #0006;overflow:hidden}
.card.sel{border-color:var(--accent)}.card.dim{opacity:.18}
.card header{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--card2);cursor:move;font-size:11px;color:var(--muted);white-space:nowrap}
.card header span{overflow:hidden;text-overflow:ellipsis;flex:1}.card header button{padding:1px 7px;font-size:11px}
.card .body{flex:1;min-height:0;overflow:auto;position:relative}
.card img,.card video{width:100%;height:100%;object-fit:contain;display:block;background:#0c0c0e}
.card audio{width:100%;margin-top:8px}.card .audio{padding:10px}.card .audio .name{font-size:14px;font-weight:600;word-break:break-all}
.grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--muted) 50%);opacity:.5}
.md{padding:10px 14px}.md h1,.md h2,.md h3{margin:.6em 0 .3em;line-height:1.2}.md h1{font-size:20px}.md h2{font-size:16px}.md h3{font-size:14px}
.md p{margin:.4em 0}.md code{background:#0004;padding:1px 4px;border-radius:4px}.md pre{background:#0005;padding:8px;border-radius:6px;overflow:auto}
.md blockquote{border-left:3px solid var(--accent);margin:.4em 0;padding-left:10px;color:var(--muted)}.md a{color:var(--accent)}.md ul,.md ol{padding-left:20px;margin:.3em 0}
.md table{border-collapse:collapse}.md td,.md th{border:1px solid var(--line);padding:2px 6px}
textarea{width:100%;height:100%;border:0;resize:none;background:#1a1b20;color:var(--text);padding:10px 14px;font:12.5px/1.5 ui-monospace,Menlo,monospace;outline:none}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;padding:8px}
.sw div{border-radius:6px;height:64px;display:flex;align-items:flex-end;padding:4px;font-size:10px;cursor:pointer;border:1px solid #0003}
.sw div span{background:#000a;color:#fff;border-radius:3px;padding:0 4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.other{padding:12px}.other a{color:var(--accent)}
#lb{position:fixed;inset:0;background:#000d;display:none;align-items:center;justify-content:center;z-index:20}#lb img{max-width:95vw;max-height:95vh}
#toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--card2);border:1px solid var(--line);padding:6px 12px;border-radius:6px;display:none;z-index:30}
#drop{position:fixed;inset:44px 0 0 0;border:3px dashed var(--accent);display:none;z-index:15;pointer-events:none;align-items:center;justify-content:center;font-size:20px;background:#0006}
</style></head><body>
<div id="bar"><b>🎮 Game Board</b><button id="newStory">+ Story</button><button id="newNote">+ Note</button>
<button id="addColor">+ Colour</button><input id="filter" placeholder="filter… (name / type)"><span class="sp"></span>
<button id="fit">Fit</button><button id="relayout" title="Reset positions of all cards">Auto-layout</button><span id="root" style="color:var(--muted)"></span></div>
<div id="view"><div id="world"></div></div><div id="lb"><img></div><div id="toast"></div><div id="drop">Drop files → moodboard/ (.md → story/)</div>
<script>
const $=s=>document.querySelector(s), view=$('#view'), world=$('#world');
const LANES=[['story','Story',1,460,520],['target','Target shots',2,420,260],['palette','Colours',1,300,220],['image','Images',4,260,220],
  ['video','Videos',2,400,260],['audio','Audio',1,320,110],['text','Notes',1,380,360],['other','Other',1,260,120]];
let layout={view:{x:40,y:40,z:.6},cards:{}}, items=[], cards=new Map(), editing=new Set();
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',1800)}
const api=(u,o)=>fetch(u,o).then(r=>r.ok?r:r.json().then(j=>{throw new Error(j.error)}));
const fileUrl=p=>'/file/'+p.split('/').map(encodeURIComponent).join('/');

// --- tiny markdown renderer (escaped first, so file content can't inject HTML)
function md(src){
  const lines=esc(src).split('\n'); let out='', list=null, code=false, para=[];
  const safeUrl=u=>/^(https?:|mailto:|\/|\.|#|[\w-]+\/|[\w-]+\.\w+$)/i.test(u)&&!/^\s*javascript:/i.test(u)?u:'#';
  const inline=t=>t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(_,a,u)=>'<img alt="'+a+'" src="'+safeUrl(u)+'" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,a,u)=>'<a href="'+safeUrl(u)+'" target="_blank" rel="noopener">'+a+'</a>').replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<i>$2</i>').replace(/~~([^~]+)~~/g,'<s>$1</s>');
  const flush=()=>{if(para.length){out+='<p>'+inline(para.join(' '))+'</p>';para=[]} if(list){out+='</'+list+'>';list=null}};
  for(const l of lines){
    if(l.startsWith('\x60\x60\x60')){flush();out+=code?'</pre>':'<pre>';code=!code;continue}
    if(code){out+=l+'\n';continue}
    let m;
    if(m=l.match(/^(#{1,6})\s+(.*)/)){flush();out+='<h'+m[1].length+'>'+inline(m[2])+'</h'+m[1].length+'>'}
    else if(m=l.match(/^\s*([-*+]|\d+\.)\s+(.*)/)){if(para.length)flush();const t=/\d/.test(m[1])?'ol':'ul';if(list!==t){if(list)out+='</'+list+'>';out+='<'+t+'>';list=t}
      out+='<li>'+inline(m[2].replace(/^\[ \]/,'☐').replace(/^\[x\]/i,'☑'))+'</li>'}
    else if(m=l.match(/^&gt;\s?(.*)/)){flush();out+='<blockquote>'+inline(m[1])+'</blockquote>'}
    else if(/^\|.*\|$/.test(l.trim())){flush();if(/^\|[\s:|-]+\|$/.test(l.trim()))continue;out+='<table><tr>'+l.trim().slice(1,-1).split('|').map(c=>'<td>'+inline(c.trim())+'</td>').join('')+'</tr></table>'}
    else if(/^(-{3,}|\*{3,})$/.test(l.trim())){flush();out+='<hr>'}
    else if(!l.trim())flush(); else {if(list)flush();para.push(l)}
  }
  flush(); return out.replace(/<\/table><table>/g,'');
}

// --- view transform (pan + zoom)
function applyView(){const v=layout.view;world.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.z+')';view.style.backgroundPosition=v.x+'px '+v.y+'px';view.style.backgroundSize=24*v.z+'px '+24*v.z+'px'}
let saveT; function saveLayout(){clearTimeout(saveT);saveT=setTimeout(()=>api('/api/layout',{method:'PUT',body:JSON.stringify(layout)}),400)}
view.addEventListener('wheel',e=>{e.preventDefault();const v=layout.view,r=view.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  // pinch / ctrl / cmd / alt + wheel, or a mouse wheel notch = zoom; two-finger trackpad scroll = pan
  if(e.ctrlKey||e.metaKey||e.altKey||(!e.shiftKey&&Math.abs(e.deltaX)<1&&Math.abs(e.deltaY)>=50)){const z=Math.min(3,Math.max(.08,v.z*Math.exp(-e.deltaY*.0015)));v.x=mx-(mx-v.x)*z/v.z;v.y=my-(my-v.y)*z/v.z;v.z=z}
  else{v.x-=e.deltaX;v.y-=e.deltaY} applyView();saveLayout()},{passive:false});
view.addEventListener('pointerdown',e=>{if(e.target!==view&&e.target!==world&&!e.target.classList.contains('lane'))return;
  const s={x:e.clientX,y:e.clientY,vx:layout.view.x,vy:layout.view.y};view.classList.add('panning');view.setPointerCapture(e.pointerId);
  const mv=ev=>{layout.view.x=s.vx+ev.clientX-s.x;layout.view.y=s.vy+ev.clientY-s.y;applyView()};
  const up=()=>{view.classList.remove('panning');view.removeEventListener('pointermove',mv);view.removeEventListener('pointerup',up);saveLayout()};
  view.addEventListener('pointermove',mv);view.addEventListener('pointerup',up)});
const toWorld=(cx,cy)=>{const r=view.getBoundingClientRect(),v=layout.view;return{x:(cx-r.left-v.x)/v.z,y:(cy-r.top-v.y)/v.z}};

// --- auto placement per lane
function laneOf(it){return LANES.find(l=>l[0]===it.lane)||LANES.find(l=>l[0]==='other')}
// lanes that currently hold items are packed left to right; empty lanes take no space
function laneX(id){const used=new Set(items.map(i=>laneOf(i)[0]));let x=0;for(const l of LANES){if(l[0]===id)return x;if(used.has(l[0]))x+=l[2]*(l[3]+20)+80}return x}
function place(it){const [id,,cols,w,h]=laneOf(it);const taken=Object.entries(layout.cards).filter(([p,c])=>c.lane===id).length;
  const c={lane:id,x:laneX(id)+(taken%cols)*(w+20),y:60+Math.floor(taken/cols)*(h+20),w,h};layout.cards[it.path]=c;return c}
function drawLanes(){world.querySelectorAll('.lane').forEach(e=>e.remove());const used=new Set(items.map(i=>laneOf(i)[0]));
  for(const [id,label] of LANES){if(!used.has(id))continue;const d=document.createElement('div');d.className='lane';d.textContent=label;d.style.left=laneX(id)+'px';d.style.top='0px';world.appendChild(d)}}

// --- cards
function drag(el,c,mode){return e=>{if(e.button!==0||e.target.tagName==='BUTTON')return;e.stopPropagation();e.preventDefault();
  const s={x:e.clientX,y:e.clientY,cx:c.x,cy:c.y,w:c.w,h:c.h},z=layout.view.z;document.querySelectorAll('.card.sel').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');el.style.zIndex=++zTop;
  const mv=ev=>{const dx=(ev.clientX-s.x)/z,dy=(ev.clientY-s.y)/z;if(mode==='move'){c.x=Math.round(s.cx+dx);c.y=Math.round(s.cy+dy)}else{c.w=Math.max(140,Math.round(s.w+dx));c.h=Math.max(60,Math.round(s.h+dy))}pos(el,c)};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);saveLayout()};addEventListener('pointermove',mv);addEventListener('pointerup',up)}}
let zTop=1; const pos=(el,c)=>Object.assign(el.style,{left:c.x+'px',top:c.y+'px',width:c.w+'px',height:c.h+'px'});
function makeCard(it){
  const c=layout.cards[it.path]||place(it), el=document.createElement('div'); el.className='card'; el.dataset.path=it.path;
  const name=it.path.split('/').slice(1).join('/'); el.innerHTML='<header><span title="'+esc(it.path)+'">'+esc(name)+'</span></header><div class="body"></div><div class="grip"></div>';
  const head=el.querySelector('header'), body=el.querySelector('.body'), url=fileUrl(it.path)+'?v='+it.mtime;
  if(it.type==='image'){body.innerHTML='<img loading="lazy" draggable="false" src="'+url+'">';body.firstChild.ondblclick=()=>{$('#lb img').src=url;$('#lb').style.display='flex'}}
  else if(it.type==='video')body.innerHTML='<video controls preload="metadata" src="'+url+'"></video>';
  else if(it.type==='audio')body.innerHTML='<div class="audio"><div class="name">🎵 '+esc(name.split('/').pop())+'</div><audio controls preload="none" src="'+url+'"></audio></div>';
  else if(it.type==='palette')api('/api/palette?path='+encodeURIComponent(it.path)).then(r=>r.json()).then(cs=>{body.innerHTML='<div class="sw">'+cs.map(k=>'<div style="background:'+k.hex+'" title="'+esc(k.name||k.hex)+'"><span>'+k.hex+(k.name?' '+esc(k.name):'')+'</span></div>').join('')+'</div>';
    body.querySelectorAll('.sw div').forEach((d,i)=>d.onclick=()=>{navigator.clipboard?.writeText(cs[i].hex);toast('copied '+cs[i].hex)})});
  else if(it.type==='text')textCard(it,head,body);
  else body.innerHTML='<div class="other">📄 <a target="_blank" href="'+url+'">'+esc(name)+'</a><br><small>'+(it.size/1024).toFixed(0)+' KB</small></div>';
  head.addEventListener('pointerdown',drag(el,c,'move'));el.querySelector('.grip').addEventListener('pointerdown',drag(el,c,'size'));
  pos(el,c); world.appendChild(el); cards.set(it.path,{el,it}); return el;
}
function textCard(it,head,body){
  let text='', ed=false; const b=document.createElement('button'); b.textContent='Edit'; head.appendChild(b);
  const load=()=>fetch(fileUrl(it.path)+'?t='+Date.now()).then(r=>r.text()).then(t=>{text=t;if(!ed)body.innerHTML='<div class="md">'+md(t)+'</div>'});
  const save=()=>{const ta=body.querySelector('textarea');text=ta.value;return api('/api/text/'+it.path,{method:'PUT',body:text}).then(r=>r.json()).then(j=>{it.mtime=j.mtime;toast('saved '+it.path)})};
  b.onclick=()=>{if(!ed){ed=true;editing.add(it.path);b.textContent='Save';body.innerHTML='<textarea spellcheck="false"></textarea>';const ta=body.firstChild;ta.value=text;ta.focus();
      ta.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();save()}if(e.key==='Escape'){b.click()}}}
    else save().then(()=>{ed=false;editing.delete(it.path);b.textContent='Edit';body.innerHTML='<div class="md">'+md(text)+'</div>'})};
  body.ondblclick=()=>{if(!ed)b.click()}; load();
}

// --- sync with disk (Claude and the user add files while the board is open)
async function refresh(){
  const r=await api('/api/items').then(r=>r.json()); $('#root').textContent=r.root.split('/').pop();$('#root').title=r.root; const next=new Map(r.items.map(i=>[i.path,i]));
  for(const [p,{el,it}] of cards){const n=next.get(p);if(!n){el.remove();cards.delete(p);continue}
    if(n.mtime!==it.mtime&&!editing.has(p)){el.remove();cards.delete(p)}}
  items=r.items; let added=false;
  for(const it of items)if(!cards.has(it.path)){makeCard(it);added=true}
  if(added)saveLayout(); drawLanes(); applyFilter();
}
function applyFilter(){const q=$('#filter').value.toLowerCase().trim();for(const {el,it} of cards.values())el.classList.toggle('dim',!!q&&!(it.path.toLowerCase().includes(q)||it.type.includes(q)||it.lane.includes(q)))}
$('#filter').oninput=applyFilter;

// --- toolbar
async function newText(dir,stub){const n=prompt('File name ('+dir+'/…):',stub);if(!n)return;const p=dir+'/'+(n.match(/\.(md|txt)$/)?n:n+'.md');
  await api('/api/text/'+p,{method:'PUT',body:'# '+n.replace(/\.(md|txt)$/,'').replace(/[-_]/g,' ')+'\n\n'});await refresh();cards.get(p)?.el.querySelector('header button')?.click()}
$('#newStory').onclick=()=>newText('story','chapter-01');$('#newNote').onclick=()=>newText('moodboard','note');
$('#addColor').onclick=async()=>{const v=prompt('Colour hex + optional name (e.g. #c8553d rust accent):');if(!v)return;
  const cur=await fetch(fileUrl('moodboard/colors.txt')).then(r=>r.ok?r.text():'');await api('/api/text/moodboard/colors.txt',{method:'PUT',body:(cur&&!cur.endsWith('\n')?cur+'\n':cur)+v.trim()+'\n'});refresh()};
$('#fit').onclick=()=>{const cs=Object.values(layout.cards);if(!cs.length)return;const r=view.getBoundingClientRect();
  const x0=Math.min(...cs.map(c=>c.x)),y0=Math.min(0,...cs.map(c=>c.y)),x1=Math.max(...cs.map(c=>c.x+c.w)),y1=Math.max(...cs.map(c=>c.y+c.h));
  const z=Math.min(1.5,(r.width-60)/(x1-x0),(r.height-60)/(y1-y0));layout.view={z,x:30-x0*z,y:30-y0*z};applyView();saveLayout()};
$('#relayout').onclick=()=>{if(!confirm('Reset all card positions?'))return;layout.cards={};for(const {el} of cards.values())el.remove();cards.clear();refresh()};
$('#lb').onclick=()=>$('#lb').style.display='none';

// --- drop files from the desktop
let dc=0;addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){dc++;$('#drop').style.display='flex'}});
addEventListener('dragleave',()=>{if(--dc<=0){dc=0;$('#drop').style.display='none'}});addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',async e=>{e.preventDefault();dc=0;$('#drop').style.display='none';const at=toWorld(e.clientX,e.clientY);let i=0;
  for(const f of e.dataTransfer.files){const dir=/\.(md|markdown)$/i.test(f.name)?'story':'moodboard';
    const j=await api('/api/upload/'+dir+'/'+encodeURIComponent(f.name),{method:'PUT',body:f}).then(r=>r.json());
    const it={path:j.path,lane:'other'};const [, ,,w,h]=LANES.find(l=>l[0]===(dir==='story'?'story':/^image/.test(f.type)?'image':/^video/.test(f.type)?'video':/^audio/.test(f.type)?'audio':'other'));
    layout.cards[j.path]={lane:'dropped',x:Math.round(at.x+i*30),y:Math.round(at.y+i*30),w,h};i++}
  toast(i+' file(s) added');saveLayout();refresh()});

(async()=>{let saved=false;try{const l=await api('/api/layout').then(r=>r.json());if(l.view){layout=Object.assign({cards:{}},l);saved=true}}catch{}
  applyView();await refresh();if(!saved)$('#fit').click();setInterval(refresh,3000)})();
</script></body></html>`;
