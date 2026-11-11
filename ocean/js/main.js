// King of the Ocean — app shell: screens, input, game loop, host/client glue.
import { C, COLORS, createGame, step, pack, unpack, lerpState, movePlayer, tryDash, makeRocks } from './sim.js';
import { createRenderer } from './render.js';
import { initAudio, sfx, setMuted, startMusic, setIntense } from './audio.js';
import { hostRoom, joinRoom } from './net.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const R = createRenderer(canvas);

// ------------------------------------------------------------------ save data
const RANKS = [
  ['Tide Pool Tadpole', 'Sleepy rivals. Learn the ropes.'],
  ['Reef Rookie', 'They are starting to notice the crown.'],
  ['Kelp Cruiser', 'Rivals dash a little more often.'],
  ['Lagoon Lancer', 'Their aim is getting sharper.'],
  ['Current Rider', 'Faster swimmers. Keep moving.'],
  ['Reef Raider', 'They hunt the king as a pack.'],
  ['Deep Duelist', 'Quick reflexes, quicker saws.'],
  ['Trench Tyrant', 'Ruthless. Use every power-up.'],
  ['Abyss Lord', 'Nearly flawless hunters.'],
  ['King of the Ocean', 'Defend your throne against the best.'],
];
const BOT_NAMES = ['Sir Sawsalot', 'Finley', 'Bubbles', 'Cap’n Chomp', 'Rostra', 'Snaggle', 'Duchess Fin', 'Razor Ray', 'Serrata', 'Gill Bates', 'Moby Nick', 'Marlin'];
const DEFAULT_NAMES = ['Sawyer', 'Finn', 'Marina', 'Coral', 'Reef', 'Splash', 'Skipper', 'Pearl', 'Brook', 'Wade'];
let save = { name: '', rank: 1, wins: 0, games: 0, streak: 0, best: 0, crowns: 0, mute: false };
try { Object.assign(save, JSON.parse(localStorage.getItem('kingocean.save') || '{}')); } catch (_) {}
if (!save.name) save.name = DEFAULT_NAMES[(Math.random() * DEFAULT_NAMES.length) | 0];
const persist = () => { try { localStorage.setItem('kingocean.save', JSON.stringify(save)); } catch (_) {} };
setMuted(save.mute);

// ------------------------------------------------------------------ state
let mode = 'attract';      // attract | solo | host | client
let st = null;             // authoritative sim (attract/solo/host)
let view = null;           // what we render
let me = -1;
let acc = 0, last = performance.now();
let resultsShown = false, resultsTimer = 0;
const party = { room: null, members: [], inGame: false, fill: true, slots: new Map(), remote: [], pending: [], n: 0, tick: 0 };
const client = { conn: null, meta: null, A: null, B: null, recv: 0, interval: 1 / 30, lastN: -1, pred: null, dashSeq: 0, sendT: 0, names: [] };

// ------------------------------------------------------------------ input
const input = { joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, mx: 0, my: 0, dashQueued: false, dashHeld: false, dashId: null, keys: {} };
const layout = { touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0, jx: 0, jy: 0, bx: 0, by: 0, br: 46 };
function safe() {
  const cs = getComputedStyle($('safe'));
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}
function doLayout() {
  R.resize();
  const { sw, sh } = R.size, s = safe();
  layout.br = Math.min(50, Math.max(40, sh * 0.12));
  layout.bx = sw - s.r - layout.br - 38; layout.by = sh - s.b - layout.br - 44;
  layout.jx = s.l + 96; layout.jy = sh - s.b - 100;
}
window.addEventListener('resize', doLayout);
window.addEventListener('orientationchange', () => setTimeout(doLayout, 250));
doLayout();

const playing = () => (mode === 'solo' || mode === 'host' || mode === 'client') && !resultsShown;
const JR = 54;
function tStart(e) {
  if (!playing()) return;
  e.preventDefault(); wake(); initAudio();
  const { sw } = R.size;
  for (const t of e.changedTouches) {
    const nearBtn = Math.hypot(t.clientX - layout.bx, t.clientY - layout.by) < layout.br + 40;
    if ((t.clientX > sw * 0.56 || nearBtn) || input.joy.active) {
      if (input.dashId === null) { input.dashId = t.identifier; input.dashHeld = true; input.dashQueued = true; }
    } else {
      const j = input.joy; j.active = true; j.id = t.identifier; j.ox = j.x = t.clientX; j.oy = j.y = t.clientY; input.mx = input.my = 0;
    }
  }
}
function tMove(e) {
  if (!playing()) return;
  e.preventDefault();
  const j = input.joy;
  for (const t of e.changedTouches) {
    if (j.active && t.identifier === j.id) {
      let dx = t.clientX - j.ox, dy = t.clientY - j.oy; const d = Math.hypot(dx, dy);
      if (d > JR) { j.ox += (dx / d) * (d - JR); j.oy += (dy / d) * (d - JR); dx = t.clientX - j.ox; dy = t.clientY - j.oy; }
      j.x = t.clientX; j.y = t.clientY;
      const m = Math.min(1, d / JR), dz = m < 0.14 ? 0 : m;
      input.mx = d ? (dx / (d > JR ? JR : d)) * dz : 0; input.my = d ? (dy / (d > JR ? JR : d)) * dz : 0;
      const l = Math.hypot(input.mx, input.my); if (l > 1) { input.mx /= l; input.my /= l; }
    }
  }
}
function tEnd(e) {
  for (const t of e.changedTouches) {
    if (input.joy.active && t.identifier === input.joy.id) { input.joy.active = false; input.joy.id = null; input.mx = input.my = 0; }
    if (t.identifier === input.dashId) { input.dashId = null; input.dashHeld = false; }
  }
}
canvas.addEventListener('touchstart', tStart, { passive: false });
canvas.addEventListener('touchmove', tMove, { passive: false });
canvas.addEventListener('touchend', tEnd, { passive: false });
canvas.addEventListener('touchcancel', tEnd, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (!input.keys[e.code] && (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyJ')) input.dashQueued = true;
  input.keys[e.code] = true;
  if (playing() && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
canvas.addEventListener('mousedown', () => { if (playing()) input.dashQueued = true; });

function readInput() {
  const k = input.keys;
  let kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  let mx = input.mx, my = input.my;
  if (kx || ky) { const l = Math.hypot(kx, ky); mx = kx / l; my = ky / l; }
  const dash = input.dashQueued; input.dashQueued = false;
  return { mx, my, dash };
}

let wakeLock = null;
async function wake() {
  try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (_) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && playing()) wake(); last = performance.now(); });

// ------------------------------------------------------------------ UI helpers
const screens = ['menu', 'solo', 'join', 'lobby', 'how', 'over'];
let curScreen = 'menu';
function show(name) {
  curScreen = name;
  for (const s of screens) $('scr-' + s).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', !(mode !== 'attract' && (name === null || name === 'over')));
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
let toastT = 0;
function toast(msg, ms = 3200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
let bannerT = 0;
function banner(msg, col = '#ffd84a', ms = 2200) {
  const b = $('banner'); b.textContent = msg; b.style.setProperty('--c', col); b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms);
}
function count(txt) {
  const c = $('count'); c.textContent = txt; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function tap(id, fn) { $(id).addEventListener('click', (e) => { initAudio(); startMusic(); sfx.click(); fn(e); }); }

// ------------------------------------------------------------------ HUD
let chipEls = [];
function buildHud(players) {
  $('chips').innerHTML = players.map((p, i) => {
    const c = COLORS[p.color];
    return `<div class="chip${i === me ? ' me' : ''}" style="--c:${c.main};--l:${c.light}"><div class="top"><svg><use href="#crown"/></svg><span class="nm">${esc(i === me ? 'You' : p.name)}</span><span class="sec">0</span></div><div class="bar"><i></i></div></div>`;
  }).join('');
  chipEls = [...$('chips').children].map((el) => ({ el, bar: el.querySelector('.bar i'), sec: el.querySelector('.sec'), w: -1, s: -1, k: null, d: null }));
}
function updateHud() {
  if (!view || mode === 'attract') return;
  view.players.forEach((p, i) => {
    const c = chipEls[i]; if (!c) return;
    const w = Math.round((p.reign / C.WIN) * 100), s = Math.floor(p.reign), k = view.crown.holder === i, d = p.reign >= C.WIN - 10 && view.phase === 'play';
    if (w !== c.w) { c.w = w; c.bar.style.width = w + '%'; }
    if (s !== c.s) { c.s = s; c.sec.textContent = s; }
    if (k !== c.k) { c.k = k; c.el.classList.toggle('king', k); }
    if (d !== c.d) { c.d = d; c.el.classList.toggle('danger', d); }
  });
}

// ------------------------------------------------------------------ events -> fx / audio / banners
function handleEvent(e, s) {
  R.onEvent(e, s, mode === 'attract' ? -1 : me);
  if (mode === 'attract') return;
  const mine = e.p === me || e.a === me;
  let v = 1;
  if (!mine && e.x !== undefined) {
    const d = Math.hypot(e.x - R.cam.x, e.y - R.cam.y);
    v = Math.max(0.12, Math.min(0.7, 1 - d / 1000));
  }
  const P = s.players;
  const nm = (i) => (i === me ? 'You' : P[i].name);
  switch (e.t) {
    case 'count': count(e.n); sfx.count(); break;
    case 'go': count('GO!'); sfx.go(); banner('Grab the crown — hold it for ' + C.WIN + ' seconds!', '#ffd84a', 3200); break;
    case 'dash': if (!(mode === 'client' && e.p === me)) sfx.dash(v); break;
    case 'hit': sfx.hit(v);
      if (e.k && e.p === me) { sfx.lost(); banner('You dropped the crown!', '#ff8f8f'); }
      else if (e.k && e.a === me) banner('Crown knocked loose — grab it!', '#ffd84a', 1600);
      break;
    case 'zap': sfx.zap(v); if (e.k && e.p === me) { sfx.lost(); banner('You dropped the crown!', '#ff8f8f'); } break;
    case 'sting': sfx.sting(v); if (e.k && e.p === me) { sfx.lost(); banner('Stung! You dropped the crown!', '#ff9be6'); } break;
    case 'clash': sfx.clash(v); break;
    case 'shieldpop': sfx.shield(v); break;
    case 'eat': if (e.p === me) { e.g ? sfx.gold() : sfx.eat(); } break;
    case 'frenzy': if (e.p === me) sfx.frenzy(); break;
    case 'gold': banner('A golden fish appeared!', '#ffe27a', 1800); break;
    case 'pop': sfx.pop(v); break;
    case 'power': sfx.power(v); break;
    case 'crown':
      sfx.crown(e.p === me ? 1 : 0.6);
      banner(e.p === me ? 'You wear the crown! Swim!' : nm(e.p) + ' took the crown!', COLORS[P[e.p].color].main);
      break;
    case 'final':
      sfx.final(); setIntense(true);
      banner(e.p === me ? '10 seconds to victory — hold on!' : 'Stop ' + nm(e.p) + '! 10 seconds left!', '#ff6b6b', 3000);
      break;
    case 'win':
      setIntense(false);
      e.p === me ? sfx.win() : sfx.lose();
      clearTimeout(resultsTimer);
      resultsTimer = setTimeout(showResults, 2200);
      break;
  }
}

// ------------------------------------------------------------------ game start / end
function startAttract() {
  mode = 'attract'; me = -1; resultsShown = false; setIntense(false);
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  st = createGame({ seed: (Math.random() * 1e6) | 0, players: [0, 1, 2, 3].map((i) => ({ name: names[i], color: i, bot: true, skill: 0.5 + Math.random() * 0.4 })) });
  st.cd = 0.01;
  R.setWorld(st.seed, st.rocks);
  view = st; acc = 0;
}
function beginLocal(players, myIdx, m) {
  mode = m; me = myIdx; resultsShown = false; clearTimeout(resultsTimer); setIntense(false);
  st = createGame({ seed: (Math.random() * 1e6) | 0, players });
  R.setWorld(st.seed, st.rocks);
  view = st; acc = 0;
  buildHud(st.players); show(null); wake();
}
function startSolo() {
  const sk = 0.08 + (save.rank - 1) * 0.095;
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const players = [{ name: save.name, color: 0 }];
  for (let i = 1; i < 4; i++) players.push({ name: names[i], color: i, bot: true, skill: Math.max(0.03, Math.min(1, sk + (Math.random() - 0.5) * 0.14)) });
  beginLocal(players, 0, 'solo');
}

function showResults() {
  if (mode === 'attract' || !view || resultsShown) return;
  resultsShown = true;
  const P = [...view.players].sort((a, b) => b.reign - a.reign);
  const w = view.players[view.winner] || P[0];
  const iWon = w.id === me;
  $('overTitle').textContent = iWon ? 'You are King of the Ocean!' : w.name + ' rules the ocean!';
  let sub = '';
  if (mode === 'solo') {
    save.games++;
    if (iWon) {
      save.wins++; save.streak++; save.best = Math.max(save.best, save.streak);
      if (save.rank < 10) { save.rank++; sub = 'Rank up! You are now a ' + RANKS[save.rank - 1][0] + '.'; }
      else { save.crowns++; sub = 'Throne defended ' + save.crowns + (save.crowns === 1 ? ' time' : ' times') + '. All hail!'; }
    } else { save.streak = 0; sub = 'So close! Steal it back next round.'; }
    persist();
  } else sub = iWon ? 'Your rivals bow before your mighty saw.' : 'Revenge is a dish best served wet.';
  $('overSub').textContent = sub;
  $('overTable').innerHTML = P.map((p) => `<div class="row${p.id === w.id ? ' win' : ''}" style="--c:${COLORS[p.color].main}"><i></i><span class="nm">${esc(p.id === me ? p.name + ' (you)' : p.name)}</span><span class="st">${p.hits} hits · ${p.eaten} fish</span><span class="sc">${Math.floor(p.reign)}s</span></div>`).join('');
  const isClient = mode === 'client';
  $('btnAgain').classList.toggle('hidden', isClient);
  $('overWait').classList.toggle('hidden', !isClient);
  $('btnAgain').querySelector('b').textContent = mode === 'solo' ? (iWon && save.rank <= 10 ? 'Next match' : 'Try again') : 'Rematch';
  $('btnOverMenu').querySelector('b').textContent = mode === 'solo' ? 'Menu' : mode === 'host' ? 'Lobby' : 'Leave';
  show('over');
}

function toMenu() {
  if (party.room) { party.room.close(); party.room = null; }
  if (client.conn) { client.conn.close(); client.conn = null; }
  party.members = []; party.inGame = false;
  startAttract(); refreshMenu(); show('menu');
  history.replaceState(null, '', location.pathname);
}

// ------------------------------------------------------------------ host
function lobbyNames() { return [save.name, ...party.members.map((m) => m.name)]; }
function sendLobby() {
  if (!party.room) return;
  party.room.broadcast({ t: 'lobby', names: lobbyNames(), code: party.room.code, ingame: party.inGame });
  renderLobby(lobbyNames(), true);
}
function renderLobby(names, isHost) {
  const fill = isHost && party.fill;
  let html = '';
  for (let i = 0; i < 4; i++) {
    const c = COLORS[i].main;
    if (names[i]) html += `<div class="slot" style="--c:${c}"><i></i><span>${esc(names[i])}${i === 0 ? ' ★' : ''}</span></div>`;
    else html += `<div class="slot empty" style="--c:${c}"><i></i><span>${fill ? 'Bot' : 'Open'}</span></div>`;
  }
  $('slots').innerHTML = html;
  $('fillRow').classList.toggle('hidden', !isHost);
  $('btnStart').classList.toggle('hidden', !isHost);
  $('lobbyWait').classList.toggle('hidden', isHost);
  $('qr').classList.toggle('hidden', !isHost);
  $('lobbyHint').classList.toggle('hidden', !isHost);
  if (isHost) $('btnStart').disabled = names.length < 2 && !party.fill;
}
function drawQR(code) {
  const url = location.origin + location.pathname + '?join=' + code;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch (_) { $('qr').textContent = ''; }
}
function openHost() {
  if (!window.Peer) { toast('Multiplayer needs an internet connection to load. Try reloading.'); return; }
  $('lobbyTitle').textContent = 'Party Lobby'; $('lobbyCode').textContent = '····'; $('qr').innerHTML = '';
  party.members = []; party.inGame = false;
  renderLobby([save.name], true); show('lobby');
  party.room = hostRoom({
    onOpen(code) { $('lobbyCode').textContent = code; drawQR(code); },
    onJoin(id, name) {
      if (party.members.some((m) => m.id === id)) return;
      if (party.members.length >= 3) { party.room.send(id, { t: 'full' }); return; }
      party.members.push({ id, name, lastT: performance.now() }); sfx.pop(); sendLobby();
    },
    onLeave: memberLeft,
    onMsg(id, m) {
      const mem = party.members.find((x) => x.id === id);
      if (mem) mem.lastT = performance.now();
      if (m.t === 'in' && party.slots.has(id)) {
        const r = party.remote[party.slots.get(id)];
        if (r) { r.mx = +m.x || 0; r.my = +m.y || 0; r.seq = m.d | 0; r.lastT = performance.now(); }
      }
    },
    onError(text) { toast(text, 5000); toMenu(); },
  });
}
function memberLeft(id) {
  const m = party.members.find((x) => x.id === id);
  if (!m) return;
  party.members = party.members.filter((x) => x.id !== id);
  if (party.inGame && st && party.slots.has(id)) {
    const idx = party.slots.get(id);
    const p = st.players[idx]; p.bot = true; p.skill = 0.5; party.slots.delete(id); party.remote[idx] = null;
    toast(m.name + ' left — a bot took over.');
  }
  sendLobby();
}
// drop members that went silent (closed tab, lost Wi-Fi) — WebRTC can take a long time to notice
setInterval(() => {
  if (!party.room) return;
  const now = performance.now();
  for (const m of [...party.members]) if (now - m.lastT > 12000) { party.room.kick(m.id); memberLeft(m.id); }
}, 2000);
setInterval(() => { if (client.conn && mode !== 'client') client.conn.send({ t: 'ping' }); }, 1500);
window.addEventListener('pagehide', () => { if (client.conn) client.conn.close(); if (party.room) party.room.close(); });

function hostStart() {
  const players = [{ name: save.name, color: 0 }];
  party.slots = new Map(); party.remote = [null];
  party.members.forEach((m, i) => { party.slots.set(m.id, i + 1); players.push({ name: m.name, color: i + 1 }); party.remote.push({ mx: 0, my: 0, seq: 0, used: 0, lastT: performance.now() }); });
  if (party.fill || players.length < 2) {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const target = party.fill ? 4 : 2;
    while (players.length < target) { players.push({ name: names[players.length], color: players.length, bot: true, skill: 0.4 + Math.random() * 0.3 }); party.remote.push(null); }
  }
  party.inGame = true; party.pending = []; party.n = 0; party.tick = 0;
  beginLocal(players, 0, 'host');
  const meta = st.players.map((p) => ({ name: p.name, color: p.color, bot: p.bot }));
  for (const [id, idx] of party.slots) party.room.send(id, { t: 'start', seed: st.seed, players: meta, you: idx });
}

// ------------------------------------------------------------------ client
function openJoin(code) {
  if (!window.Peer) { toast('Multiplayer needs an internet connection to load. Try reloading.'); return; }
  code = code.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { toast('Enter the 4-letter party code.'); return; }
  toast('Connecting…', 8000);
  $('btnJoinGo').disabled = true;
  client.conn = joinRoom(code, save.name, {
    onOpen() { $('btnJoinGo').disabled = false; toast('Connected!', 1200); $('lobbyTitle').textContent = 'Party Lobby'; $('lobbyCode').textContent = code; renderLobby([], false); show('lobby'); },
    onMsg(m) {
      if (m.t === 'lobby') {
        client.names = m.names;
        if (mode !== 'client' || resultsShown || m.ingame === false) {
          if (mode === 'client' && !m.ingame) { startAttract(); }
          if (mode !== 'client') { renderLobby(m.names, false); $('lobbyWait').textContent = m.ingame ? 'Game in progress — you’ll join the next round.' : 'Waiting for the host to start…'; show('lobby'); }
        }
      } else if (m.t === 'start') {
        client.meta = { seed: m.seed, players: m.players, rocks: makeRocks(m.seed) };
        client.A = client.B = null; client.lastN = -1; client.pred = null;
        mode = 'client'; me = m.you; resultsShown = false; clearTimeout(resultsTimer); setIntense(false);
        R.setWorld(m.seed, client.meta.rocks);
        view = null; buildHud(m.players); show(null); wake();
      } else if (m.t === 's' && client.meta && mode === 'client') {
        const s = unpack(m.s, client.meta);
        if (m.e) for (const e of m.e) handleEvent(e, s);
        if (m.n > client.lastN) {
          client.lastN = m.n;
          client.A = client.B || s; client.B = s;
          const now = performance.now();
          client.interval = Math.max(0.02, Math.min(0.1, client.B.time - client.A.time || 1 / 30));
          client.recv = now;
        }
      } else if (m.t === 'full') { toast('That party is full.'); }
    },
    onClose(text) { $('btnJoinGo').disabled = false; client.conn = null; toast(text, 4500); if (mode === 'client' || curScreen === 'lobby') toMenu(); },
  });
}

function clientFrame(dt, now) {
  const { A, B } = client;
  if (!B) return;
  if (now - client.recv > 9000 && client.conn) { toast('Lost connection to the host.', 4500); toMenu(); return; }
  const al = Math.max(0, Math.min(1, (now - client.recv) / 1000 / client.interval));
  const v = lerpState(A, B, al);
  const sp = B.players[me];
  const inp = readInput();
  if (sp) {
    let pr = client.pred;
    if (!pr) pr = client.pred = { ...sp, spin: 0 };
    for (const f of ['charges', 'stun', 'inv', 'reign', 'frenzy', 'frenzyT', 'speedT', 'shield', 'zapT']) pr[f] = sp[f];
    if (inp.dash) { client.dashSeq++; if (v.phase === 'play' && tryDash(pr, inp)) sfx.dash(1); client.sendT = 0; }
    if (sp.stun > 0 || v.phase !== 'play') {
      const k = Math.min(1, dt * 14);
      pr.x += (sp.x - pr.x) * k; pr.y += (sp.y - pr.y) * k; pr.ang = v.players[me].ang; pr.vx = sp.vx; pr.vy = sp.vy; pr.dashT = 0;
    } else {
      pr.stun = 0;
      pr.dashT = Math.max(0, pr.dashT - dt);
      movePlayer(pr, inp, dt, v, v.crown.holder === me);
      const ex = sp.x - pr.x, ey = sp.y - pr.y, d = Math.hypot(ex, ey);
      if (d > 240) { pr.x = sp.x; pr.y = sp.y; }
      else { const k = Math.min(1, dt * (d > 90 ? 9 : 3.5)); pr.x += ex * k; pr.y += ey * k; }
    }
    v.players[me] = { ...v.players[me], x: pr.x, y: pr.y, ang: pr.ang, vx: pr.vx, vy: pr.vy, dashT: Math.max(pr.dashT, sp.dashT), charges: Math.min(sp.charges, pr.dashT > 0 && sp.dashT <= 0 ? sp.charges - 1 : sp.charges) };
    if (v.crown.holder === me) { v.crown = { ...v.crown, x: pr.x, y: pr.y }; }
  }
  client.sendT -= dt;
  if (client.sendT <= 0 && client.conn) {
    client.sendT = 1 / 30;
    client.conn.send({ t: 'in', x: Math.round(inp.mx * 100) / 100, y: Math.round(inp.my * 100) / 100, d: client.dashSeq });
  }
  view = v;
}

// ------------------------------------------------------------------ local sim frame
function localFrame(dt) {
  acc += dt;
  let first = true;
  const my = mode === 'attract' ? null : readInput();
  while (acc >= C.TICK) {
    acc -= C.TICK;
    const inputs = [];
    if (my) { inputs[me] = { mx: my.mx, my: my.my, dash: first && my.dash }; }
    if (mode === 'host') {
      const now = performance.now();
      party.remote.forEach((r, i) => {
        if (!r) return;
        inputs[i] = { mx: r.mx, my: r.my, dash: r.seq !== r.used }; r.used = r.seq;
        const away = now - r.lastT > 2500; // autopilot while a phone is asleep / reconnecting
        if (st.players[i].bot !== away) { st.players[i].bot = away; st.players[i].skill = 0.5; }
      });
    }
    step(st, inputs, C.TICK);
    first = false;
    if (st.events.length) {
      for (const e of st.events) { handleEvent(e, st); if (mode === 'host') party.pending.push(e); }
      st.events.length = 0;
    }
    if (mode === 'host' && ++party.tick % 2 === 0) {
      party.room.broadcast({ t: 's', n: party.n++, s: pack(st), e: party.pending.length ? party.pending : undefined });
      party.pending = [];
    }
  }
  if (mode === 'attract' && st.phase === 'over' && st.overT > 4) startAttract();
  view = st;
}

// ------------------------------------------------------------------ main loop
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'client') clientFrame(dt, now); else localFrame(dt);
  if (!view) return;
  let fx, fy, camRate = 7;
  if (mode === 'attract') { fx = view.crown.x; fy = view.crown.y; camRate = 1.6; }
  else {
    const p = view.players[me];
    if (view.phase === 'over' && view.winner >= 0) { const w = view.players[view.winner]; fx = w.x; fy = w.y; camRate = 3; }
    else { fx = p.x + (p.vx || 0) * 0.22; fy = p.y + (p.vy || 0) * 0.22; }
  }
  R.draw(view, { dt, fx, fy, me, camRate, pointer: mode !== 'attract', names: true });
  if (playing() && view.phase !== 'over') R.drawControls(input, view.players[me], layout);
  updateHud();
}

// ------------------------------------------------------------------ menu wiring
function refreshMenu() {
  $('inName').value = save.name;
  $('soloSub').textContent = 'Rank ' + save.rank + ' · ' + RANKS[save.rank - 1][0];
  $('btnSound').textContent = 'Sound: ' + (save.mute ? 'off' : 'on');
}
function refreshSolo() {
  $('rankNum').textContent = 'Rank ' + save.rank + ' of 10';
  $('rankName').textContent = RANKS[save.rank - 1][0];
  $('rankDesc').textContent = RANKS[save.rank - 1][1] + ' Hold the crown for ' + C.WIN + ' seconds to win.';
  $('rankPips').innerHTML = RANKS.map((_, i) => `<i class="${i < save.rank ? 'on' : ''}${i === save.rank - 1 ? ' cur' : ''}"></i>`).join('');
  $('soloStats').textContent = save.games ? `${save.wins} wins · ${save.games} matches · best streak ${save.best}` : 'Win a match to rank up!';
}
$('inName').addEventListener('input', () => { save.name = $('inName').value.trim().slice(0, 12) || save.name; persist(); });
$('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('inName').addEventListener('blur', () => { $('inName').value = save.name; window.scrollTo(0, 0); });
tap('btnSolo', () => { refreshSolo(); show('solo'); });
tap('btnSoloGo', startSolo);
tap('btnHost', openHost);
tap('btnJoin', () => { show('join'); setTimeout(() => $('inCode').focus(), 50); });
tap('btnJoinGo', () => openJoin($('inCode').value));
$('inCode').addEventListener('input', () => { $('inCode').value = $('inCode').value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('inCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); initAudio(); openJoin($('inCode').value); } });
$('inCode').addEventListener('blur', () => window.scrollTo(0, 0));
tap('btnHow', () => show('how'));
tap('btnSound', () => { save.mute = !save.mute; setMuted(save.mute); persist(); refreshMenu(); });
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { initAudio(); sfx.click(); refreshMenu(); show('menu'); });
tap('btnStart', hostStart);
$('chkFill').addEventListener('change', () => { party.fill = $('chkFill').checked; renderLobby(lobbyNames(), true); });
tap('btnLeaveLobby', toMenu);
tap('btnAgain', () => { if (mode === 'solo') startSolo(); else if (mode === 'host') hostStart(); });
tap('btnOverMenu', () => {
  if (mode === 'host') {
    party.inGame = false; startAttract(); mode = 'attract';
    $('lobbyCode').textContent = party.room.code; sendLobby(); show('lobby');
  } else toMenu();
});
let quitArm = 0;
$('btnQuit').addEventListener('click', () => {
  const b = $('btnQuit');
  if (Date.now() - quitArm < 2500) { b.classList.remove('arm'); quitArm = 0; toMenu(); return; }
  quitArm = Date.now(); b.classList.add('arm'); toast('Tap ✕ again to leave the game', 2300);
  setTimeout(() => b.classList.remove('arm'), 2500);
});

// ------------------------------------------------------------------ boot
startAttract(); refreshMenu();
const joinCode = new URLSearchParams(location.search).get('join');
if (joinCode) { $('inCode').value = joinCode.toUpperCase().slice(0, 4); show('join'); } else show('menu');
requestAnimationFrame(frame);
window.__game = { get st() { return st; }, get view() { return view; }, get mode() { return mode; }, input, save, R };
