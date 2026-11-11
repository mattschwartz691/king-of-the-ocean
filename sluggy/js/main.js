// Sluggy's Business — app shell: screens, board rendering, bidding UI, reveal/payday choreography, 1v1 netcode.
import * as G from './game.js';
import * as A from './art.js';
import { initAudio, sfx, setMuted, startMusic } from './audio.js';
import { hostRoom, joinRoom } from './net.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const FONT = (s) => `900 ${s}px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif`;
const scene = $('scene'), fx = $('fx'), sg = scene.getContext('2d', { alpha: false }), fg = fx.getContext('2d');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------------ save
const LEVELS = [
  ['Wiggles the Intern', 'Bids like he found the money on the sidewalk. Easy pickings.'],
  ['Squirmin’ Herman', 'Middle management. Starting to notice good locations.'],
  ['Baroness Von Wriggle', 'Blocks your best spots and never overpays.'],
  ['Wormy Buffett', 'A patient investor. Concentrates his cash where it hurts.'],
  ['The Night Crawler, CEO', 'Ruthless, calculating, very very bad. Good luck.'],
];
const QUIPS = {
  win: ['That’s good bidness!', 'Cha-ching!', 'Location, location, location.', 'Synergy!', 'Buy low, slime high.', 'Sold! To the handsome slug.'],
  lose: ['Bad bidness…', 'Outbid?! In THIS economy?', 'I’ll circle back on that.', 'Let’s take this offline.'],
  worm: ['WORMS! Very, very bad!', 'Ugh. Worms.', 'Who invited the worms?!'],
  pay: ['Bidness is boomin’!', 'Passive income, baby.', 'Slow and steady wins the market.', 'Stonks.'],
  safe: ['The early bird gets the worm!'],
};
let save = { name: 'Sluggy', level: 1, wins: 0, games: 0, best: 0, trophies: 0, mute: false };
try { Object.assign(save, JSON.parse(localStorage.getItem('sluggy.save') || '{}')); } catch (_) {}
const persist = () => { try { localStorage.setItem('sluggy.save', JSON.stringify(save)); } catch (_) {} };
setMuted(save.mute);

// ------------------------------------------------------------------ state
let W = 0, H = 0, dpr = 1, bg = null, time = 0, last = performance.now();
const board = { x: 0, y: 0, s: 100 };
let g = null, mode = 'menu', me = 0, names = ['Sluggy', 'WormCo'], level = 1, gid = 0;
let phase = 'idle', lots = [], raid = false, myBids = [], locked = false, timer = 0, timerMax = 25, activeLot = -1, deadline = 0;
let vis = [], shown = [10, 10], mood = ['happy', 'happy'], moodT = [0, 0], overWinner = -1;
const coins = [], floats = [], confetti = [], butterflies = [];
let birdFx = null;
const net = { room: null, conn: null, guestId: null, guestName: '', pending: {} };
for (let i = 0; i < 4; i++) butterflies.push({ x: Math.random(), y: Math.random(), a: Math.random() * TAU, c: ['#fff', '#ffe066', '#ffa8d0', '#a5d8ff'][i], p: Math.random() * 9 });

const palOf = (p) => (p === 0 ? A.PAL[0] : mode === 'solo' || mode === 'menu' ? A.PAL[2] : A.PAL[1]);
const slotOf = (p) => (p === me ? 0 : 1);
const inGame = () => mode === 'solo' || mode === 'host' || mode === 'guest';

// ------------------------------------------------------------------ layout
function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
  for (const c of [scene, fx]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  bg = A.makeBackground(W, H, dpr);
}
function computeBoard() {
  let r;
  if (inGame()) r = $('boardSlot').getBoundingClientRect();
  if (!r || r.width < 10) { const s = Math.min(W, H) * 0.86; r = { left: (W - s) / 2, top: (H - s) / 2, width: s, height: s }; }
  const s = Math.max(60, Math.min(r.width, r.height) * 0.9);
  board.s = s; board.x = r.left + (r.width - s) / 2; board.y = r.top + (r.height - s) / 2;
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));
layout();
const tile = (i) => { const ts = board.s / G.N; return { x: board.x + (i % G.N) * ts, y: board.y + ((i / G.N) | 0) * ts, ts, cx: board.x + (i % G.N + 0.5) * ts, cy: board.y + (((i / G.N) | 0) + 0.5) * ts }; };
function rectOf(id) { const r = $(id).getBoundingClientRect(); return r.width > 2 ? r : null; }
function wallet(p) { const r = rectOf('cash' + slotOf(p)); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: W / 2, y: 30 }; }

// ------------------------------------------------------------------ icons
const iconCache = {};
function icon(type) {
  if (iconCache[type]) return iconCache[type];
  const c = document.createElement('canvas'); c.width = c.height = 132; const x = c.getContext('2d');
  x.translate(66, 68); x.scale(1.22, 1.22);
  if (type === 'bird') { x.scale(1.15, 1.15); A.drawBird(x, 0.1); } else A.drawShop(x, type, 0.6);
  return (iconCache[type] = c.toDataURL());
}

// ------------------------------------------------------------------ ui helpers
const screens = ['menu', 'solo', 'join', 'lobby', 'how', 'over'];
let curScreen = 'menu';
function show(name) {
  curScreen = name;
  for (const s of screens) $('scr-' + s).classList.toggle('hidden', s !== name);
  $('app').classList.toggle('hidden', !inGame());
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
let toastT = 0;
function toast(msg, ms = 3000) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
let bannerT = 0;
function banner(html, cls = '', ms = 1500) { const b = $('banner'); b.innerHTML = html; b.className = 'show ' + cls; clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = cls; }, ms); }
let quipT = 0;
function quip(kind) {
  const list = QUIPS[kind], r = rectOf('av0'); if (!r) return;
  const q = $('quip'); q.textContent = list[(Math.random() * list.length) | 0];
  q.style.left = r.left + 6 + 'px'; q.style.top = r.bottom + 8 + 'px'; q.classList.add('show');
  clearTimeout(quipT); quipT = setTimeout(() => q.classList.remove('show'), 1900);
}
function setMood(p, m, dur = 1.8) { mood[p] = m; moodT[p] = time + dur; }
function tap(id, fn) { $(id).addEventListener('click', (e) => { initAudio(); startMusic(); sfx.click(); fn(e); }); }
function float(x, y, txt, col, size = 22, dur = 1.2, delay = 0) { floats.push({ x, y, txt, col, size, t: -delay, dur }); }
function burst(x, y, cols, n = 26) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 80 + Math.random() * 260; confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, col: cols[(Math.random() * cols.length) | 0], life: 0.9 + Math.random() * 0.6, s: 5 + Math.random() * 5 }); }
}
function flyCoins(from, to, n, p, val, delay = 0) {
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? val - Math.floor(val / n) * (n - 1) : Math.floor(val / n);
    coins.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, cx: (from.x + to.x) / 2 + (Math.random() - 0.5) * 120, cy: Math.min(from.y, to.y) - 40 - Math.random() * 70, t: -(delay + i * 0.06), dur: 0.55 + Math.random() * 0.15, val: v, p, spin: Math.random() * 6 });
  }
}
async function countUp(el, to, ms) {
  const t0 = performance.now(); let lastV = -1;
  while (true) {
    const k = Math.min(1, (performance.now() - t0) / ms), v = Math.round(to * k);
    if (v !== lastV) { el.textContent = '$' + v; if (v > 0) sfx.tick(v); lastV = v; }
    if (k >= 1) break; await sleep(30);
  }
}

// ------------------------------------------------------------------ HUD
function buildHud() {
  const opp = 1 - me;
  $('nm0').textContent = names[me]; $('nm1').textContent = names[opp];
  $('pl1').classList.toggle('slug', mode !== 'solo');
  $('dayDots').innerHTML = Array.from({ length: G.DAYS }, (_, d) => `<i class="${G.RAID_DAYS.includes(d) ? 'raid' : ''}"></i>`).join('');
}
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud() {
  if (!inGame() || !g) return;
  for (const p of [0, 1]) {
    const s = slotOf(p);
    setText('cash' + s, String(Math.max(0, Math.round(shown[p]))));
    const inc = G.income(g, p, phase === 'reveal' ? g.plots.map((q, i) => (vis[i].built ? q : { ...q, owner: -1, type: -1, hole: false })) : g.plots);
    setText('inc' + s, `+$${inc.total}/day` + (inc.crowns.length ? ' ' + '♛'.repeat(inc.crowns.length) : ''));
  }
}
function updateDay() {
  const d = Math.min(g.day, G.DAYS - 1);
  setText('dayLbl', d === G.DAYS - 1 ? 'Final Day ×2' : `Day ${d + 1} of ${G.DAYS}`);
  [...$('dayDots').children].forEach((el, i) => { el.classList.toggle('on', i < d); el.classList.toggle('cur', i === d); });
  const tr = g.trends[d], nx = d + 1 < G.DAYS ? g.trends[d + 1] : -1;
  $('trend').innerHTML = `Hot <img src="${icon(tr)}">+$2` + (nx >= 0 ? `<span>→</span><img class="nx" src="${icon(nx)}">` : '');
}

// ------------------------------------------------------------------ bidding
function buildCards() {
  lots = G.lotsForDay(g); raid = G.isRaid(g);
  myBids = lots.map(() => 0); if (raid) myBids.push(0);
  const opp = 1 - me;
  let html = lots.map((lot, k) => {
    const T = G.TYPES[lot.type], v = G.valueOf(g, me, lot), ov = G.valueOf(g, opp, lot);
    return `<div class="lot" style="--c:${A.LOT_COL[k]}" data-k="${k}"><div class="tag">${'ABC'[k]}</div><img src="${icon(lot.type)}" alt=""><div class="lnm">${T.name}</div>
      <div class="val">+$${v.mine}/day <small>rival +$${ov.mine}</small></div><div class="desc">${T.desc}</div>
      <div class="bid"><button data-d="-1">−</button><span class="amt zero">$0</span><button data-d="1">+</button></div><div class="res"></div><div class="stamp"></div></div>`;
  }).join('');
  if (raid) html += `<div class="lot birdc" style="--c:${A.LOT_COL[3]}" data-k="3"><div class="tag">!</div><img src="${icon('bird')}" alt=""><div class="lnm">Early Bird</div>
      <div class="val" style="color:#c92a2a">Worm raid!</div><div class="desc">Lower bid gets wormed for 2 days.</div>
      <div class="bid"><button data-d="-1">−</button><span class="amt zero">$0</span><button data-d="1">+</button></div><div class="res"></div><div class="stamp"></div></div>`;
  $('cards').innerHTML = html; $('cards').classList.toggle('four', raid);
  $('panel').classList.remove('reveal');
  refreshBids();
}
const cardEl = (k) => $('cards').children[k];
function refreshBids() {
  const left = g.cash[me] - myBids.reduce((a, c) => a + c, 0);
  myBids.forEach((b, k) => { const a = cardEl(k).querySelector('.amt'); a.textContent = '$' + b; a.classList.toggle('zero', b === 0); });
  $('cashLeft').textContent = '$' + left; $('leftBox').classList.toggle('broke', left === 0);
}
function changeBid(k, d) {
  if (phase !== 'bid' || locked) return false;
  const left = g.cash[me] - myBids.reduce((a, c) => a + c, 0);
  const nv = Math.max(0, Math.min(myBids[k] + left, myBids[k] + d));
  if (nv === myBids[k]) return false;
  myBids[k] = nv; sfx.bid(d > 0); refreshBids(); return true;
}
let rep = null;
$('cards').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button[data-d]'); if (!b) return;
  e.preventDefault(); initAudio(); startMusic();
  const k = +b.closest('.lot').dataset.k, d = +b.dataset.d;
  changeBid(k, d);
  clearInterval(rep); let n = 0;
  const start = setTimeout(() => { rep = setInterval(() => { changeBid(k, d * (++n > 12 ? 2 : 1)); }, 70); }, 320);
  const stop = () => { clearTimeout(start); clearInterval(rep); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
});

function lockIn() {
  if (phase !== 'bid' || locked) return;
  locked = true; sfx.lock();
  for (const c of $('cards').children) c.classList.add('lockd');
  const mine = G.clampBids(g, me, myBids);
  if (mode === 'solo') { runReveal(me === 0 ? [mine, G.aiBids(g, 1, level)] : [G.aiBids(g, 0, level), mine]); return; }
  $('lockLbl').textContent = 'Waiting for rival…'; $('btnLock').classList.add('wait');
  if (mode === 'guest') net.conn.send({ t: 'bid', day: g.day, b: mine });
  else tryHostResolve();
}
function tryHostResolve() {
  if (mode !== 'host' || !locked || phase !== 'bid') return;
  const opp = net.pending[g.day]; if (!opp) return;
  const bids = [G.clampBids(g, 0, myBids), opp];
  net.room.broadcast({ t: 'bids', day: g.day, bids });
  runReveal(bids);
}

// ------------------------------------------------------------------ game flow
function resetVis() { vis = g.plots.map(() => ({ built: false, born: 0, bump: -9, infest: false })); coins.length = floats.length = confetti.length = 0; birdFx = null; }
function startGame(seed, m, myIdx, nm, lvl = 1) {
  gid++; mode = m; me = myIdx; names = nm; level = lvl;
  g = G.newGame(seed); resetVis(); shown = [...g.cash]; mood = ['happy', 'happy']; phase = 'idle'; net.pending = {};
  buildHud(); show(null); runDay();
}
async function runDay() {
  const tok = gid;
  phase = 'intro'; locked = false; activeLot = -1;
  updateDay(); buildCards(); updateHud();
  $('lockLbl').textContent = 'Lock in bids'; $('btnLock').classList.remove('wait');
  const last = g.day === G.DAYS - 1, T = G.TYPES[g.trends[g.day]];
  sfx.day();
  banner(`${last ? 'Final Day!' : 'Day ' + (g.day + 1)}<small>${last ? 'Today’s payday counts DOUBLE' : 'Hot today: ' + T.name + ' +$2'}</small>`, last ? 'gold' : '', 1500);
  await sleep(1550); if (tok !== gid) return;
  if (raid) { sfx.warn(); banner('Worm raid tonight!<small>Bid on the Early Bird to stay safe</small>', 'bad', 1700); await sleep(1750); if (tok !== gid) return; }
  phase = 'bid'; timerMax = mode === 'solo' ? 45 : 25; timer = timerMax; deadline = performance.now() + (timerMax + 6) * 1000;
  tryHostResolve();
}

async function runReveal(bids) {
  const tok = gid; phase = 'reveal'; locked = true;
  const opp = 1 - me;
  $('panel').classList.add('reveal'); $('lockLbl').textContent = 'Sold to the highest bidder!'; $('btnLock').classList.add('wait');
  const res = G.resolve(g, bids);
  for (let k = 0; k < res.lots.length; k++) {
    const r = res.lots[k], c = cardEl(k), tl = tile(r.plot);
    activeLot = k; c.classList.add('active');
    const el = c.querySelector('.res');
    el.innerHTML = `You <b class="m">$0</b><br>${esc(names[opp].split(' ')[0])} <b class="o">$0</b>`;
    sfx.drum();
    await Promise.all([countUp(el.querySelector('.m'), r.bids[me], 520), countUp(el.querySelector('.o'), r.bids[opp], 520)]);
    await sleep(160); if (tok !== gid) return;
    const st = c.querySelector('.stamp'), v = vis[r.plot];
    v.built = true; v.born = time;
    if (r.winner < 0) {
      st.textContent = 'WORMS!'; c.classList.add('none'); sfx.worm(); setMood(0, 'shock'); setMood(1, mode === 'solo' ? 'happy' : 'shock');
      float(tl.cx, tl.cy - tl.ts * 0.4, 'Worm hole!', '#a01d4c', 22, 1.4); quip('worm');
    } else {
      const w = r.winner, mine = w === me, pal = palOf(w);
      st.textContent = mine ? 'YOURS!' : r.tie ? 'LOST TIE' : r.bids[me] > 0 ? 'OUTBID!' : 'RIVAL’S';
      c.classList.add(mine ? 'won' : 'lost'); sfx.gavel(); mine ? sfx.win() : r.bids[me] > 0 && sfx.lose();
      burst(tl.cx, tl.cy, [pal.main, pal.light, '#fff']);
      shown[w] -= r.bids[w];
      const wl = wallet(w);
      if (r.bids[w] > 0) { float(wl.x, wl.y + 26, '−$' + r.bids[w], '#c92a2a', 18, 1.1); flyCoins(wl, { x: tl.cx, y: tl.cy }, Math.min(5, r.bids[w]), w, 0); }
      if (r.tie) float(tl.cx, tl.cy - tl.ts * 0.55, 'Tie → underdog!', '#7048e8', 17, 1.5);
      setMood(w, 'smug'); setMood(1 - w, r.bids[1 - w] > 0 ? 'sad' : 'happy');
      if (mine && Math.random() < 0.7) quip('win'); else if (!mine && r.bids[me] > 0 && Math.random() < 0.6) quip('lose');
    }
    c.classList.remove('active'); c.classList.add('done'); updateHud();
    await sleep(820); if (tok !== gid) return;
  }
  if (res.raid) {
    const c = cardEl(3), r = res.raid; activeLot = 3; c.classList.add('active');
    sfx.warn(); banner('Worm raid!', 'bad', 900);
    const el = c.querySelector('.res');
    el.innerHTML = `You <b class="m">$0</b><br>${esc(names[opp].split(' ')[0])} <b class="o">$0</b>`;
    await Promise.all([countUp(el.querySelector('.m'), r.bids[me], 520), countUp(el.querySelector('.o'), r.bids[opp], 520)]);
    await sleep(200); if (tok !== gid) return;
    const st = c.querySelector('.stamp'), safeMe = r.safe === me;
    st.textContent = safeMe ? 'SAFE!' : 'WORMED!'; c.classList.add(safeMe ? 'won' : 'none');
    if (r.safe >= 0) {
      shown[r.safe] -= r.bids[r.safe]; const wl = wallet(r.safe);
      float(wl.x, wl.y + 26, '−$' + r.bids[r.safe], '#c92a2a', 18, 1.1);
      birdFx = { t: 0, y: wl.y + 40, dir: slotOf(r.safe) === 0 ? -1 : 1 }; sfx.bird(); setMood(r.safe, 'smug');
      if (safeMe) quip('safe');
    }
    for (const h of r.hit) {
      setMood(h.p, 'sad', 2.5);
      if (h.plot >= 0) { const tl = tile(h.plot); vis[h.plot].infest = true; vis[h.plot].bump = time; float(tl.cx, tl.cy - tl.ts * 0.45, 'INFESTED!', '#a01d4c', 20, 1.6); }
      else { const wl = wallet(h.p); float(wl.x, wl.y + 30, 'Nothing to eat!', '#a01d4c', 15, 1.4); }
    }
    if (r.hit.length) { sfx.worm(); if (r.hit.some((h) => h.p === me)) quip('worm'); }
    c.classList.remove('active'); c.classList.add('done');
    await sleep(1300); if (tok !== gid) return;
  }
  activeLot = -1;
  await runPayday(tok);
}

async function runPayday(tok) {
  phase = 'pay';
  const final = g.day === G.DAYS - 1;
  const pd = G.payday(g);
  sfx.payday(); banner(final ? 'DOUBLE PAYDAY!' : 'Payday!', 'gold', 900);
  $('lockLbl').textContent = 'Counting the money…';
  await sleep(500); if (tok !== gid) return;
  let longest = 0;
  for (const p of [0, 1]) {
    const pal = palOf(p), wl = wallet(p);
    let d = 0;
    for (const it of pd[p].items) {
      const tl = tile(it.plot), delay = d;
      setTimeout(() => {
        if (tok !== gid) return;
        vis[it.plot].bump = time;
        if (it.amt > 0) { float(tl.cx, tl.cy - tl.ts * 0.35, '+$' + it.amt, pal.deep, 17 + Math.min(12, it.amt * 1.3), 1.0); flyCoins({ x: tl.cx, y: tl.cy }, wallet(p), Math.min(4, Math.ceil(it.amt / 2)), p, it.amt); }
        else float(tl.cx, tl.cy - tl.ts * 0.35, '$0', '#868e96', 16, 0.9);
      }, delay);
      d += 110;
    }
    const extras = [[pd[p].stipend, 'pocket money']].concat(pd[p].crowns.map((t) => [2 * pd[p].mult, '♛ ' + G.TYPES[t].name]));
    extras.forEach(([amt, label], i) => {
      setTimeout(() => {
        if (tok !== gid) return;
        shown[p] += amt; sfx.coin(); bumpWallet(p);
        float(wl.x, wl.y + 30 + (i % 3) * 4, `+$${amt} ${label}`, label[0] === '♛' ? '#e67700' : '#2b8a3e', 14, 1.25);
      }, d + 350 + i * 330);
    });
    longest = Math.max(longest, d + 350 + extras.length * 330);
  }
  await sleep(longest + 900); if (tok !== gid) return;
  shown = [...g.cash];
  g.plots.forEach((s, i) => { if (s.infest <= 0) vis[i].infest = false; });
  const lead = g.cash[me] - g.cash[1 - me];
  if (lead > 0 && Math.random() < 0.5) quip('pay');
  setMood(me, lead >= 0 ? 'happy' : 'sad', 1.5);
  updateHud();
  if (g.day >= G.DAYS) return gameOver(tok);
  await sleep(350); if (tok !== gid) return;
  runDay();
}
function bumpWallet(p) { const el = $('pl' + slotOf(p)); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 120); }

async function gameOver(tok) {
  phase = 'over';
  const opp = 1 - me, mine = g.cash[me], theirs = g.cash[opp];
  const won = mine > theirs, tie = mine === theirs;
  overWinner = tie ? me : won ? me : opp;
  await sleep(500); if (tok !== gid) return;
  let sub = '';
  if (mode === 'solo') {
    save.games++; save.best = Math.max(save.best, mine);
    if (won) {
      save.wins++;
      if (level >= LEVELS.length) { save.trophies++; sub = 'WormCo is bankrupt! The garden is safe… for now.'; }
      else { if (save.level === level) save.level = level + 1; sub = `${LEVELS[level - 1][0]} is out of bidness. Next up: ${LEVELS[level][0]}.`; }
    } else sub = tie ? 'A tie?! The worms live to wriggle another day.' : 'The worms won this round. Very, very bad.';
    persist();
  } else sub = tie ? 'Dead even. Run it back!' : won ? `${names[opp]} got out-bidnessed.` : `${names[opp]} cornered the market.`;
  $('overTitle').textContent = tie ? 'It’s a tie!' : won ? 'That’s good bidness!' : 'Bad bidness…';
  $('overSub').textContent = sub;
  const f0 = $('fin0'), f1 = $('fin1');
  f0.querySelector('span').textContent = names[me] + ' (you)'; f1.querySelector('span').textContent = names[opp];
  f0.classList.toggle('win', won); f1.classList.toggle('win', !won && !tie);
  const rank = mine < 120 ? 'Lemonade Intern' : mine < 170 ? 'Middle Manager' : mine < 220 ? 'Slime-preneur' : mine < 280 ? 'Captain of Industry' : 'Slug of Wall Street';
  $('overRank').textContent = `Your title: ${rank}`;
  $('btnAgain').classList.toggle('hidden', mode === 'guest'); $('overWait').classList.toggle('hidden', mode !== 'guest');
  $('btnAgain').querySelector('b').textContent = mode === 'solo' ? (won && level < LEVELS.length ? 'Next rival' : 'Play again') : 'Rematch';
  show('over');
  won ? sfx.fanfare() : tie ? sfx.day() : sfx.sad();
  if (won) for (let i = 0; i < 5; i++) setTimeout(() => burst(W * (0.15 + Math.random() * 0.7), H * (0.2 + Math.random() * 0.3), ['#ffd83d', '#ff6b6b', '#51cf3f', '#4c8dff', '#fff'], 40), i * 260);
  countUp(f0.querySelector('b'), mine, 1100); countUp(f1.querySelector('b'), theirs, 1100);
}

function demoBoard() {
  mode = 'menu'; g = G.newGame((Math.random() * 1e6) | 0); resetVis(); phase = 'idle'; lots = [];
  g.plots.forEach((s, i) => { if (!s.fountain && Math.random() < 0.6) { s.type = (Math.random() * 6) | 0; s.owner = Math.random() < 0.6 ? 0 : 1; vis[i].built = true; vis[i].born = -5; } });
}
function toMenu() {
  gid++;
  if (net.room) { net.room.close(); net.room = null; } if (net.conn) { net.conn.close(); net.conn = null; }
  net.guestId = null; demoBoard(); refreshMenu(); show('menu');
  $('banner').className = ''; $('quip').classList.remove('show');
  history.replaceState(null, '', location.pathname);
}

// ------------------------------------------------------------------ 1v1 networking
function drawQR(code) {
  try { const qr = window.qrcode(0, 'M'); qr.addData(location.origin + location.pathname + '?join=' + code); qr.make(); $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) { $('qr').textContent = ''; }
}
function renderLobby(host, guest, isHost) {
  $('ls0').textContent = host || '…'; $('ls1').textContent = guest || 'Waiting…';
  $('ls1').classList.toggle('empty', !guest);
  $('btnStart').classList.toggle('hidden', !isHost); $('btnStart').disabled = !guest;
  $('qr').classList.toggle('hidden', !isHost);
  $('lobbyHint').textContent = isHost ? 'Your rival scans the code with their camera, or opens this page and taps Join 1v1.' : 'Waiting for the host to start…';
}
function openHost() {
  if (!window.Peer) { toast('1v1 needs an internet connection. Try reloading.'); return; }
  $('lobbyCode').textContent = '····'; $('qr').innerHTML = ''; net.guestId = null; net.guestName = '';
  renderLobby(save.name, '', true); show('lobby');
  net.room = hostRoom({
    onOpen(code) { $('lobbyCode').textContent = code; drawQR(code); },
    onJoin(id, name) {
      if (net.guestId && net.guestId !== id) { net.room.send(id, { t: 'full' }); return; }
      net.guestId = id; net.guestName = name; net.lastT = performance.now(); sfx.pop();
      net.room.send(id, { t: 'lobby', host: save.name, guest: name });
      if (!inGame()) renderLobby(save.name, name, true);
    },
    onLeave(id) { if (id === net.guestId) guestGone(); },
    onMsg(id, m) {
      if (id !== net.guestId) return;
      net.lastT = performance.now();
      if (m.t === 'bid') { net.pending[m.day | 0] = Array.isArray(m.b) ? m.b : []; tryHostResolve(); }
    },
    onError(text) { toast(text, 5000); toMenu(); },
  });
}
function guestGone() {
  if (!net.guestId) return;
  net.guestId = null;
  if (mode === 'host') { toast(net.guestName + ' left the game.', 4000); const room = net.room; gid++; mode = 'menu'; demoBoard(); net.room = room; }
  renderLobby(save.name, '', true); show('lobby');
}
function hostStart() {
  if (!net.guestId) return;
  const seed = (Math.random() * 1e9) | 0, nm = [save.name, net.guestName === save.name ? (save.name === 'Sluggy' ? 'Sluggo' : save.name + ' 2') : net.guestName];
  net.room.send(net.guestId, { t: 'start', seed, names: nm });
  startGame(seed, 'host', 0, nm);
}
function openJoin(code) {
  if (!window.Peer) { toast('1v1 needs an internet connection. Try reloading.'); return; }
  code = code.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { toast('Enter the 4-letter code.'); return; }
  toast('Connecting…', 8000); $('btnJoinGo').disabled = true;
  net.conn = joinRoom(code, save.name, {
    onOpen() { $('btnJoinGo').disabled = false; toast('Connected!', 1200); $('lobbyCode').textContent = code; renderLobby('', save.name, false); show('lobby'); },
    onMsg(m) {
      if (m.t === 'lobby') { if (inGame()) { gid++; mode = 'menu'; demoBoard(); } renderLobby(m.host, m.guest, false); show('lobby'); }
      else if (m.t === 'start') startGame(m.seed, 'guest', 1, m.names);
      else if (m.t === 'bids' && mode === 'guest' && g && m.day === g.day && phase === 'bid') { locked = true; runReveal(m.bids); }
      else if (m.t === 'full') toast('That game is full.');
    },
    onClose(text) { $('btnJoinGo').disabled = false; net.conn = null; toast(text.replace('party', 'game'), 4500); if (mode === 'guest' || curScreen === 'lobby') toMenu(); },
  });
}
setInterval(() => {
  if (net.conn) net.conn.send({ t: 'ping' });
  if (net.room && net.guestId && performance.now() - net.lastT > 12000) { net.room.kick(net.guestId); guestGone(); }
}, 2000);
window.addEventListener('pagehide', () => { if (net.conn) net.conn.close(); if (net.room) net.room.close(); });

// ------------------------------------------------------------------ rendering
function drawChar(c, p, rect, o = {}) {
  const worm = p === 1 && (mode === 'solo' || o.worm);
  c.save();
  if (o.clip) { A.rr(c, rect.left, rect.top, rect.width, rect.height, 10); c.clip(); }
  if (worm) {
    const s = o.clip ? rect.width / 62 : rect.height / 100;
    c.translate(rect.left + rect.width / 2 - (o.clip ? 4 * s : 0), rect.top + rect.height * (o.clip ? 0.98 : 0.62)); c.scale(s, s);
    A.drawWormBoss(c, { t: time, mood: o.mood });
  } else {
    const pal = p === 0 ? A.PAL[0] : A.PAL[1];
    if (o.clip) { const s = rect.width / 74; c.translate(rect.left + rect.width / 2, rect.top + rect.height * 0.72); c.scale(o.flip ? -s : s, s); c.translate(-46, 6); }
    else { const s = rect.width / 160; c.translate(rect.left + rect.width / 2, rect.top + rect.height * 0.72); c.scale(o.flip ? -s : s, s); }
    A.drawSlug(c, pal, { t: time, mood: o.mood });
  }
  c.restore();
}

function drawScene(dt) {
  const t = time;
  sg.setTransform(dpr, 0, 0, dpr, 0, 0);
  sg.drawImage(bg, 0, 0, W, H);
  // butterflies
  for (const b of butterflies) {
    b.a += (Math.random() - 0.5) * 2 * dt; b.x += Math.cos(b.a) * 0.03 * dt; b.y += Math.sin(b.a) * 0.03 * dt;
    if (b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1) { b.a += Math.PI; b.x = Math.max(0, Math.min(1, b.x)); b.y = Math.max(0, Math.min(1, b.y)); }
    const fl = Math.abs(Math.sin(t * 12 + b.p)), x = b.x * W, y = b.y * H;
    sg.fillStyle = b.c; sg.globalAlpha = 0.9;
    for (const s of [-1, 1]) { sg.beginPath(); sg.ellipse(x + s * 5 * fl, y, 6 * fl + 1, 7, s * 0.4, 0, TAU); sg.fill(); }
    sg.globalAlpha = 1; sg.fillStyle = A.OUT; sg.fillRect(x - 1, y - 5, 2, 10);
  }
  if (!g) return;
  A.drawPlanter(sg, board.x, board.y, board.s);
  const ts = board.s / G.N, k = ts / 112;
  for (let i = 0; i < G.N * G.N; i++) { const tl = tile(i); A.drawPlot(sg, tl.x, tl.y, ts, (i + ((i / G.N) | 0)) % 2); }
  // ownership plates
  g.plots.forEach((s, i) => {
    if (!vis[i].built || s.owner < 0) return;
    const tl = tile(i), pal = palOf(s.owner), m = ts * 0.07;
    A.rr(sg, tl.x + m, tl.y + m, ts - m * 2, ts - m * 2 - 3, ts * 0.15);
    sg.fillStyle = pal.main; sg.globalAlpha = 0.5; sg.fill(); sg.globalAlpha = 1;
    sg.strokeStyle = pal.dark; sg.lineWidth = Math.max(2.5, ts * 0.05); sg.stroke();
  });
  // lots on offer
  if (phase === 'bid' || phase === 'reveal' || phase === 'intro') lots.forEach((lot, kk) => {
    if (vis[lot.plot].built) return;
    const tl = tile(lot.plot), act = activeLot === kk, pul = 0.5 + 0.5 * Math.sin(t * (act ? 12 : 4) + kk), m = ts * 0.05;
    A.rr(sg, tl.x + m, tl.y + m, ts - m * 2, ts - m * 2 - 3, ts * 0.15);
    sg.fillStyle = 'rgba(255,255,255,' + (0.25 + pul * 0.2) + ')'; sg.fill();
    sg.strokeStyle = A.LOT_COL[kk]; sg.lineWidth = Math.max(3, ts * (act ? 0.09 : 0.06)); sg.setLineDash([ts * 0.14, ts * 0.08]); sg.lineDashOffset = -t * 20; sg.stroke(); sg.setLineDash([]);
    sg.save(); sg.translate(tl.cx, tl.cy + ts * 0.06 + Math.sin(t * 3 + kk) * ts * 0.02); sg.scale(k * 0.82, k * 0.82); sg.globalAlpha = 0.78; A.drawShop(sg, lot.type, t); sg.restore();
    const r = ts * 0.17, bx = tl.x + r + 2, by = tl.y + r + 2;
    sg.beginPath(); sg.arc(bx, by, r, 0, TAU); sg.fillStyle = A.LOT_COL[kk]; sg.fill(); sg.strokeStyle = '#fff'; sg.lineWidth = 2; sg.stroke();
    sg.fillStyle = '#fff'; sg.font = FONT(r * 1.25); sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('ABC'[kk], bx, by + 1);
  });
  // buildings (row order)
  g.plots.forEach((s, i) => {
    const tl = tile(i), v = vis[i];
    if (s.fountain) { sg.save(); sg.translate(tl.cx, tl.cy); sg.scale(k, k); A.drawFountain(sg, t); sg.restore(); return; }
    if (!v.built) return;
    const e = t - v.born, pop = e > 3 ? 1 : 1 - Math.exp(-7 * e) * Math.cos(11 * e);
    const be = t - v.bump, bump = be < 1.2 ? 1 + 0.2 * Math.exp(-6 * be) * Math.cos(17 * be) : 1;
    sg.save(); sg.translate(tl.cx, tl.cy + ts * 0.36); sg.scale(k * pop * (2 - bump), k * pop * bump); sg.translate(0, -40);
    if (s.hole) { sg.translate(0, 14); A.drawWormHole(sg, t, i); }
    else {
      if (v.infest) sg.globalAlpha = 0.5;
      A.drawShop(sg, s.type, t + i);
      sg.globalAlpha = 1;
      if (v.infest) A.drawInfest(sg, t + i);
    }
    sg.restore();
  });
}

function drawFx(dt) {
  const t = time;
  fg.setTransform(dpr, 0, 0, dpr, 0, 0); fg.clearRect(0, 0, W, H);
  // characters in their DOM slots
  let r;
  if (inGame()) {
    for (const p of [0, 1]) { if (moodT[p] < t) mood[p] = 'happy'; r = rectOf('av' + slotOf(p)); if (r) drawChar(fg, p, r, { clip: true, mood: mood[p], flip: slotOf(p) === 1 }); }
  }
  if (curScreen === 'menu' && (r = rectOf('menuSlug'))) drawChar(fg, 0, r, { mood: Math.sin(t * 0.7) > 0.9 ? 'smug' : 'happy' });
  if (curScreen === 'solo' && (r = rectOf('bossSlot'))) drawChar(fg, 1, r, { worm: true });
  if (curScreen === 'over' && (r = rectOf('overSlot'))) {
    if (overWinner === 1 && mode === 'solo') drawChar(fg, 1, { left: r.left + r.width * 0.25, top: r.top - r.height * 0.1, width: r.width * 0.5, height: r.height * 1.1 }, { worm: true });
    else drawChar(fg, overWinner === me ? me : 1 - me, r, { mood: overWinner === me ? 'smug' : 'happy' });
  }
  // coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]; c.t += dt; if (c.t < 0) continue;
    const u = Math.min(1, c.t / c.dur), e = u * u * (3 - 2 * u), a = 1 - e;
    const x = a * a * c.x0 + 2 * a * e * c.cx + e * e * c.x1, y = a * a * c.y0 + 2 * a * e * c.cy + e * e * c.y1;
    A.drawCoin(fg, x, y, 9 + Math.sin(u * Math.PI) * 4, c.spin + c.t * 14);
    if (u >= 1) { if (c.val) { shown[c.p] += c.val; sfx.coin(); bumpWallet(c.p); } coins.splice(i, 1); }
  }
  // confetti
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i]; c.life -= dt; if (c.life <= 0) { confetti.splice(i, 1); continue; }
    c.vy += 620 * dt; c.vx *= 1 - 1.5 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
    fg.save(); fg.translate(c.x, c.y); fg.rotate(c.rot); fg.scale(1, Math.cos(c.rot * 1.6)); fg.globalAlpha = Math.min(1, c.life * 3); fg.fillStyle = c.col; fg.fillRect(-c.s / 2, -c.s / 3, c.s, c.s * 0.66); fg.restore();
  }
  // bird fly-by
  if (birdFx) {
    birdFx.t += dt; const u = birdFx.t / 1.3;
    if (u >= 1) birdFx = null;
    else { const x = birdFx.dir < 0 ? W + 40 - u * (W + 80) : -40 + u * (W + 80); fg.save(); fg.translate(x, birdFx.y + Math.sin(u * 9) * 14); fg.scale(birdFx.dir < 0 ? -1.3 : 1.3, 1.3); A.drawBird(fg, t); fg.restore(); }
  }
  // floating numbers
  fg.textAlign = 'center'; fg.textBaseline = 'middle'; fg.lineJoin = 'round';
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; if (f.t < 0) continue;
    const u = f.t / f.dur; if (u >= 1) { floats.splice(i, 1); continue; }
    const pop = u < 0.15 ? 0.4 + (u / 0.15) * 0.8 : 1.2 - Math.min(0.2, (u - 0.15) * 1.5);
    fg.font = FONT(f.size); const hw = fg.measureText(f.txt).width * 0.62 + 6;
    fg.save(); fg.translate(Math.max(hw, Math.min(W - hw, f.x)), f.y - u * 34); fg.scale(pop, pop); fg.globalAlpha = Math.min(1, (1 - u) * 3);
    fg.font = FONT(f.size); fg.lineWidth = Math.max(4, f.size * 0.26); fg.strokeStyle = '#fff'; fg.strokeText(f.txt, 0, 0); fg.fillStyle = f.col; fg.fillText(f.txt, 0, 0); fg.restore();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
  computeBoard();
  if (phase === 'bid' && inGame()) {
    if (!locked) { timer -= dt; if (timer <= 0) { timer = 0; lockIn(); } }
    $('timerBar').style.transform = `scaleX(${Math.max(0, timer / timerMax)})`;
    if (!locked) $('lockLbl').textContent = timer < 10 ? `Lock in bids · ${Math.ceil(timer)}` : 'Lock in bids';
    if (mode === 'host' && locked && !net.pending[g.day] && performance.now() > deadline) { net.pending[g.day] = []; tryHostResolve(); }
  }
  drawScene(dt); drawFx(dt); updateHud();
}

// ------------------------------------------------------------------ menu wiring
function refreshMenu() {
  $('inName').value = save.name;
  $('soloSub').textContent = save.trophies ? `WormCo bankrupted ×${save.trophies}` : `vs ${LEVELS[save.level - 1][0]}`;
  $('btnSound').textContent = 'Sound: ' + (save.mute ? 'off' : 'on');
}
function refreshSolo() {
  const L = save.level;
  $('lvlNum').textContent = `WORMCO · LEVEL ${L} OF ${LEVELS.length}`; $('lvlName').textContent = LEVELS[L - 1][0]; $('lvlDesc').textContent = LEVELS[L - 1][1];
  $('lvlPips').innerHTML = LEVELS.map((_, i) => `<i class="${i < L - 1 ? 'on' : i === L - 1 ? 'cur' : ''}"></i>`).join('');
  $('soloStats').textContent = save.games ? `${save.wins} WINS · ${save.games} GAMES · BEST $${save.best}` : 'RICHEST AFTER 8 DAYS WINS';
}
const startSolo = () => startGame((Math.random() * 1e9) | 0, 'solo', 0, [save.name, LEVELS[save.level - 1][0]], save.level);
$('inName').addEventListener('input', () => { save.name = $('inName').value.trim().slice(0, 12) || save.name; persist(); });
$('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('inName').addEventListener('blur', () => { $('inName').value = save.name; window.scrollTo(0, 0); });
tap('btnSolo', () => { if (!save.seenHow) { save.seenHow = true; persist(); show('how'); return; } refreshSolo(); show('solo'); });
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
tap('btnLeaveLobby', toMenu);
tap('btnLock', lockIn);
tap('btnAgain', () => { if (mode === 'solo') startSolo(); else if (mode === 'host') hostStart(); });
tap('btnOverMenu', toMenu);
let quitArm = 0;
$('btnQuit').addEventListener('click', () => {
  const b = $('btnQuit');
  if (Date.now() - quitArm < 2500) { b.classList.remove('arm'); quitArm = 0; toMenu(); return; }
  quitArm = Date.now(); b.classList.add('arm'); toast('Tap ✕ again to leave', 2200); setTimeout(() => b.classList.remove('arm'), 2500);
});
for (const ev of ['gesturestart', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ boot
demoBoard(); refreshMenu();
const joinCode = new URLSearchParams(location.search).get('join');
if (joinCode) { $('inCode').value = joinCode.toUpperCase().slice(0, 4); show('join'); } else show('menu');
requestAnimationFrame(frame);
window.__sluggy = { get g() { return g; }, get phase() { return phase; }, get mode() { return mode; }, get bids() { return myBids; }, changeBid, lockIn, G };
