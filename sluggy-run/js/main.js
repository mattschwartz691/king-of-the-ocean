// Sluggy Run — endless runner starring Sluggy the banana slug.
import { drawSlug, drawCoin, PAL, OUT } from '../../sluggy/js/art.js';
import { ZONES, TW, TH, buildLayer, drawSkyFx, drawGround, drawObstacle, drawSalt, drawPlatform, drawWorm, drawPower, drawHat, HATS, POWERS } from './zones.js';
import { initAudio, sfx, startMusic, setMuted, setHot, setTempo, setTrack, suspendAudio } from './audio.js';
import { createRun3D } from './run3d.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
const TAU = Math.PI * 2, rnd = Math.random, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NZ = ZONES.length, ZLEN = 7500, M = 25;           // world units per zone / per metre
const GRAV = 2400, JV = 830, JV2 = 700, BOUNCE = 640;
const PAR = [0.1, 0.3, 0.6];
const BOT = new URLSearchParams(location.search).has('bot');

// ------------------------------------------------------------------ save
const SAVE_KEY = 'sluggyrun.save';
const save = { mode: '2d', best3: 0, bestDist3: 0, runs3: 0, best: 0, bestDist: 0, bank: 0, hats: ['none'], hat: 'none', muted: false, runs: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* private mode */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

// ------------------------------------------------------------------ view
let W = 0, H = 0, DPR = 1, S = 1, VW = 600, VH = 460, GY = 340, PX = 130, SAT = 0;
const tiles = new Map();
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  S = Math.min(W / 600, H / 460); VW = W / S; VH = H / S;
  GY = Math.round(VH - Math.max(112, VH * 0.27)); PX = Math.min(150, VW * 0.22);
  SAT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  tiles.clear();
}
function tile(zi, li) {
  const key = zi * 3 + li; let c = tiles.get(key);
  if (!c) {
    c = document.createElement('canvas'); const k = S * DPR * (li === 0 ? 0.6 : 1);
    c.width = Math.ceil(TW * k); c.height = Math.ceil(TH * k);
    const t = c.getContext('2d'); t.scale(c.width / TW, c.height / TH); buildLayer(t, zi, li); tiles.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------ game state
let G = null;
const zoneAt = (x) => Math.floor(x / ZLEN);
const baseSpeed = (x) => Math.min(545, 285 + x * 0.0048);
function reset(state) {
  G = {
    state, t: 0, camX: 0, speed: 0, bonus: 0, coins: 0, stomps: 0, combo: 0, zi: 0, prevZ: -1, fade: 1, shake: 0, inv: 0, deadT: 0, shown: false, cause: '',
    p: { y: 0, vy: 0, on: true, plat: null, jumps: 1, coy: 0, buf: 0, duckHeld: false, duckT: 0, slam: false, rot: 0, held: false, sq: 0 },
    pw: { magnet: 0, rush: 0, x2: 0, shield: false },
    ents: [], parts: [], floats: [], trail: [], nextX: 0, nextPow: 0, last: '', record: false, mile: 1,
  };
  G.nextX = VW + 500; G.nextPow = G.nextX + 285 * (7 + rnd() * 4);
}
const score = () => Math.floor(G.camX / M) + G.bonus;

// ------------------------------------------------------------------ level generator (offsets are in seconds of running)
function add(k, x, o) { const e = { k, x, y: 0, w: 50, h: 46, v: (rnd() * 2) | 0, z: ((zoneAt(x) % NZ) + NZ) % NZ, dead: false, ...o }; G.ents.push(e); return e; }
const low = (x) => add('low', x - 25, { w: 50, h: 46 });
const tall = (x) => add('tall', x - 28, { w: 56, h: 146 });
const high = (x) => add('high', x - 36, { w: 72, y: 38, h: 4000 });
const salt = (x, w) => add('salt', x, { w, h: 10 });
const worm = (x) => add('worm', x - 25, { w: 50, h: 30 });
const fly = (x, y = 92) => add('fly', x - 25, { w: 50, y, h: 34, y0: y, ph: rnd() * 6 });
const coin = (x, y) => add('coin', x, { y });
function line(x, T, n, y = 26, gap = 0.13) { for (let i = 0; i < n; i++) coin(x + i * gap * T, y); }
function arc(cx, T, hgt = 100, n = 5, span = 0.5) { for (let i = 0; i < n; i++) { const u = (i / (n - 1)) * 2 - 1; coin(cx + (u * span * T) / 2, 34 + hgt * (1 - u * u)); } }
const PAT = {
  line(x, T) { line(x + 0.1 * T, T, 6); return 0.9; },
  hop(x, T, m) { low(x + 0.4 * T); arc(x + 0.4 * T, T, 100 * m); return 0.95; },
  salt(x, T, m) { const w = 0.26 * T; salt(x + 0.35 * T, w); arc(x + 0.35 * T + w / 2, T, 96 * m); return 1.05; },
  duck(x, T) { high(x + 0.5 * T); line(x + 0.2 * T, T, 6, 14, 0.12); return 1.05; },
  worm(x, T, m) { worm(x + 0.7 * T); arc(x + 1.0 * T, T, 110 * m, 4, 0.36); return 1.2; },
  plat(x, T) {
    const w = 1.1 * T; add('plat', x + 0.45 * T, { w, y: 96, h: 16 }); line(x + 0.55 * T, T, 7, 96 + 26, 0.14);
    if (rnd() < 0.6) salt(x + 0.7 * T, 0.6 * T); else { worm(x + 0.9 * T); worm(x + 1.35 * T); }
    return 1.9;
  },
  fly(x, T, m) { fly(x + 0.55 * T); arc(x + 0.55 * T, T, 150 * m, 3, 0.2); line(x + 0.2 * T, T, 3, 20); return 1.0; },
  hop2(x, T, m, sp) { low(x + 0.35 * T); low(x + (0.35 + 0.92 * sp) * T); arc(x + 0.35 * T, T, 100 * m); arc(x + (0.35 + 0.92 * sp) * T, T, 100 * m); return 0.9 + 0.92 * sp; },
  tall(x, T, m) { tall(x + 0.55 * T); arc(x + 0.5 * T, T, 190 * m, 5, 0.6); return 1.35; },
  chain(x, T, m, sp, v, mb) { const tb = (2 * BOUNCE) / GRAV * mb, s = (v + 55) * tb * 0.97, n = 3 + (rnd() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) { worm(x + 0.75 * T + i * s); coin(x + 0.75 * T + (i + 0.5) * s - 0.1 * T, 104 * m); } return 0.9 + (n * s) / T; },
  duckhop(x, T, m, sp) { high(x + 0.45 * T); low(x + (0.45 + 0.72 * sp) * T); arc(x + (0.45 + 0.72 * sp) * T, T, 100 * m); return 1.0 + 0.72 * sp; },
  hopduck(x, T, m, sp) { low(x + 0.35 * T); arc(x + 0.35 * T, T, 100 * m); high(x + (0.35 + 0.95 * sp) * T); return 1.0 + 0.95 * sp; },
  saltwide(x, T, m) { const w = 0.42 * T; salt(x + 0.35 * T, w); arc(x + 0.35 * T + w / 2, T, 120 * m, 6, 0.6); return 1.25; },
  wormduck(x, T, m, sp) { worm(x + 0.7 * T); high(x + (0.7 + 0.8 * sp) * T); return 1.3 + 0.8 * sp; },
  stairs(x, T, m, sp, v, mb) { const tb = (2 * BOUNCE) / GRAV * mb, s = (v + 55) * tb * 0.9; worm(x + 0.75 * T); fly(x + 0.75 * T + s, 78); line(x + 0.75 * T + s * 1.5, T, 4, 190 * m, 0.1); return 1.5 + s / T; },
};
const PATS = [['line', 0, 2], ['hop', 0, 4], ['salt', 0, 3], ['duck', 0.03, 3], ['worm', 0.05, 3], ['plat', 0.1, 2], ['fly', 0.12, 2], ['hop2', 0.15, 3], ['tall', 0.2, 3], ['chain', 0.22, 3],
  ['duckhop', 0.33, 3], ['hopduck', 0.33, 3], ['stairs', 0.36, 2], ['saltwide', 0.42, 2], ['wormduck', 0.48, 2]];
function gen() {
  while (G.nextX < G.camX + VW + 500) {
    const x = G.nextX, moon = ((zoneAt(x) % NZ) + NZ) % NZ === 6, v = baseSpeed(x), sp = 1, T = v * (moon ? 1.3 : 1), mb = moon ? 0.85 / 0.6 : 1; // low gravity: stretch everything out
    const d = Math.min(1, x / (ZLEN * 3.5)), m = moon ? 1.2 : 1;
    let len;
    if (x > G.nextPow) {
      const kinds = Object.keys(POWERS).filter((k) => !(k === 'shield' && G.pw.shield)), kind = kinds[(rnd() * kinds.length) | 0];
      line(x + 0.1 * T, T, 3); add('pow', x + 0.62 * T, { y: 92, kind }); line(x + 0.8 * T, T, 3); len = 1.2; G.nextPow = x + v * (12 + rnd() * 8);
    } else {
      const ok = PATS.filter((p) => p[1] <= d && p[0] !== G.last); let tot = 0; for (const p of ok) tot += p[2];
      let r = rnd() * tot, pick = ok[0]; for (const p of ok) { r -= p[2]; if (r <= 0) { pick = p; break; } }
      G.last = pick[0]; len = PAT[pick[0]](x, T, m, sp, v, mb);
    }
    G.nextX += (len + lerp(0.6, 0.26, d) * sp) * T;
  }
}

// ------------------------------------------------------------------ fx helpers
function puff(x, y, n, c, o = {}) { for (let i = 0; i < n; i++) { const a = o.up ? -Math.PI * rnd() : rnd() * TAU, s = (o.sp || 160) * (0.4 + rnd() * 0.8); G.parts.push({ x, y, vx: Math.cos(a) * s + (o.vx || 0), vy: -Math.sin(a) * s, g: o.g ?? 900, life: 0, max: (o.life || 0.5) * (0.6 + rnd() * 0.7), r: (o.r || 5) * (0.6 + rnd() * 0.8), c: Array.isArray(c) ? c[(rnd() * c.length) | 0] : c }); } }
function float(x, y, txt, c = '#fff', s = 24) { G.floats.push({ x, y, txt, c, s, life: 0 }); }
const CONF = ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc', '#f06595', '#fff'];
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function banner(a, b) { const el = $('banner'); el.firstElementChild.textContent = a; el.lastElementChild.textContent = b; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

// ------------------------------------------------------------------ player actions
const moonNow = () => G.zi % NZ === 6;
function jump() {
  if (G.state !== 'run') return; const p = G.p, k = moonNow() ? 0.85 : 1;
  if (p.on || p.coy > 0) { p.vy = JV * k; p.on = false; p.plat = null; p.coy = 0; p.jumps = 1; p.held = true; p.sq = 1; sfx.jump(); puff(G.camX + PX - 10, p.y + 4, 5, 'rgba(255,255,255,.7)', { up: true, sp: 90, r: 5, life: 0.35 }); }
  else if (p.jumps > 0) { p.jumps--; p.vy = JV2 * k; p.held = true; p.sq = 1; p.slam = false; sfx.jump2(); puff(G.camX + PX, p.y + 6, 9, ['#fff4b0', '#ffd83d', '#fff'], { sp: 150, r: 4.5, life: 0.4, g: 300 }); }
  else p.buf = 0.14;
}
function release() { const p = G.p; if (p.held && p.vy > 640) p.vy = 640; p.held = false; /* a quick tap still clears small obstacles */ }
function duck(on) {
  const p = G.p; p.duckHeld = on; if (!on || G.state !== 'run') return;
  p.duckT = 0.4; if (!p.on) { p.vy = Math.min(p.vy, -1050); p.slam = true; } else sfx.slide();
}
function land(plat) {
  const p = G.p; p.on = true; p.plat = plat; p.vy = 0; p.jumps = 1; p.coy = 0; G.combo = 0; p.sq = -1;
  puff(G.camX + PX, p.y + 3, p.slam ? 12 : 5, 'rgba(255,255,255,.75)', { up: true, sp: p.slam ? 220 : 110, r: 5, life: 0.4 });
  if (p.slam) { G.shake = 0.18; p.slam = false; } sfx.land();
  if (p.buf > 0) { p.buf = 0; jump(); }
}
function smash(e, pts) {
  e.dead = true; const cx = e.x + e.w / 2, cy = Math.min(e.y + 40, e.y + e.h / 2);
  puff(cx, cy, 14, e.k === 'worm' || e.k === 'fly' ? [PAL[2].main, PAL[2].light, '#fff'] : e.k === 'salt' ? ['#fff', '#e7f5ff'] : ['#c98d4f', '#fff', '#ffd43b', '#868e96'], { sp: 330, r: 6, life: 0.6, vx: G.speed * 0.4 });
  if (pts) { G.bonus += pts; float(cx, cy + 50, '+' + pts, '#ffe45c'); }
}
function die(e) {
  G.state = 'dead'; G.cause = e.k; G.deadT = 0; G.p.vy = 640; G.p.on = false; G.shake = 0.45; sfx.hit(); setHot(false);
  puff(G.camX + PX, G.p.y + 24, 16, ['#fff', '#ffd83d', '#ff6b6b'], { sp: 300, r: 6, life: 0.6 }); $('hint').classList.add('hidden');
}
function givePower(kind, x, y) {
  sfx.power(); float(x, y + 40, POWERS[kind].name + '!', POWERS[kind].col, 26); puff(x, y, 16, [POWERS[kind].col, '#fff'], { sp: 260, r: 5, life: 0.6, g: 200 });
  if (kind === 'shield') G.pw.shield = true; else if (kind === 'magnet') G.pw.magnet = 9; else if (kind === 'x2') G.pw.x2 = 10; else { G.pw.rush = 4.5; setHot(true); }
}

// ------------------------------------------------------------------ simulation
function step(dt) {
  G.t += dt; const p = G.p;
  for (const q of G.parts) { q.life += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y -= q.vy * dt; }
  G.parts = G.parts.filter((q) => q.life < q.max && q.y > -40);
  for (const f of G.floats) { f.life += dt; f.y += 70 * dt; }
  G.floats = G.floats.filter((f) => f.life < 1);
  G.shake = Math.max(0, G.shake - dt); G.fade = Math.min(1, G.fade + dt / 1.1); p.sq *= Math.pow(0.002, dt);
  if (G.state === 'title') { G.speed = 70; G.camX += G.speed * dt; return; }
  if (G.state === 'dead') {
    G.deadT += dt; G.speed *= Math.pow(0.03, dt); G.camX += G.speed * dt; p.vy -= GRAV * dt; p.y += p.vy * dt; p.rot -= dt * 7;
    if (G.deadT > 1.15 && !G.shown) { G.shown = true; showOver(); }
    return;
  }
  // ---- running
  const rush = G.pw.rush > 0;
  G.speed = baseSpeed(G.camX) * (rush ? 1.55 : 1); G.camX += G.speed * dt;
  const px = G.camX + PX, zi = zoneAt(px);
  if (zi !== G.zi) {
    G.prevZ = G.zi % NZ; G.zi = zi; G.fade = 0; const z = ZONES[zi % NZ]; sfx.zone();
    const lap = Math.floor(zi / NZ); banner(z.name, zi % NZ === 0 ? `Lap ${lap + 1} — faster!` : z.sub);
    G.bonus += 50 * zi; float(px + 60, 150, 'ZONE BONUS +' + 50 * zi, '#69db7c', 22);
    for (const k of [...tiles.keys()]) { const kz = Math.floor(k / 3); if (kz !== zi % NZ && kz !== G.prevZ) tiles.delete(k); }
    setTempo(148 + Math.min(24, zi * 3));
  }
  if (score() >= G.mile * 500) { float(px + 80, 190, G.mile * 500 + '!', '#fff', 30); G.mile++; bump($('score')); }
  if (!G.record && save.bestDist > 20 && G.camX / M > save.bestDist) { G.record = true; float(px + 40, 170, 'NEW RECORD!', '#ff6b6b', 30); puff(px, 120, 30, CONF, { sp: 380, r: 6, life: 1.1, g: 500 }); sfx.best(); }
  gen();
  if ((px % ZLEN) / ZLEN > 0.7) { const nz = (zi + 1) % NZ; for (let li = 0; li < 3; li++) if (!tiles.has(nz * 3 + li)) { tile(nz, li); break; } } // warm up the next zone's art, one layer per frame
  // ---- player physics
  const grav = GRAV * (moonNow() ? 0.6 : 1), prevY = p.y;
  p.coy -= dt; p.buf -= dt; p.duckT -= dt;
  if (!p.on) {
    p.vy = Math.max(-1700, p.vy - grav * dt); p.y += p.vy * dt;
    if (p.vy <= 0) {
      for (const e of G.ents) if (e.k === 'plat' && !e.dead && px > e.x - 14 && px < e.x + e.w + 14 && prevY >= e.y - 2 && p.y <= e.y) { p.y = e.y; land(e); break; }
      if (!p.on && p.y <= 0) { p.y = 0; land(null); }
    }
  } else if (p.plat && px > p.plat.x + p.plat.w + 14) { p.on = false; p.plat = null; p.coy = 0.1; p.jumps = 1; }
  const ducking = p.on && (p.duckHeld || p.duckT > 0);
  // slime trail
  const tr = G.trail, lastT = tr[tr.length - 1];
  if (p.on && !p.plat) { if (lastT && lastT.open) lastT.b = px - 30; else tr.push({ a: px - 30, b: px - 30, open: true }); } else if (lastT) lastT.open = false;
  while (tr.length && tr[0].b < G.camX - 60) tr.shift();
  if (rush && rnd() < 0.8) puff(px - 34, p.y + 14 + rnd() * 20, 1, ['#ffd43b', '#ff922b', '#fff'], { sp: 60, vx: -260, r: 6, life: 0.35, g: 0 });
  // ---- entities
  const ph = ducking ? 22 : 42, bx0 = px - 22, bx1 = px + 24, by0 = p.y, by1 = p.y + ph, cy = p.y + ph / 2;
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.x + e.w < G.camX - 260) { e.dead = true; continue; }
    if (e.k === 'coin' || e.k === 'pow') {
      const dx = e.x - px, dy = e.y - cy;
      if (e.k === 'coin' && (G.pw.magnet > 0 || rush) && Math.abs(dx) < 270 && Math.abs(dy) < 260) { const d = Math.hypot(dx, dy) || 1, s = Math.min(d, 760 * dt); e.x += G.speed * dt - (dx / d) * s; e.y -= (dy / d) * s; }
      if (Math.abs(e.x - px) < (e.k === 'pow' ? 46 : 36) && Math.abs(e.y - cy) < (e.k === 'pow' ? 50 : 40)) {
        e.dead = true;
        if (e.k === 'pow') givePower(e.kind, e.x, e.y);
        else { const n = G.pw.x2 > 0 ? 2 : 1; G.coins += n; G.bonus += 5 * n; sfx.coin(); puff(e.x, e.y, 4, ['#ffd43b', '#fff6b8'], { sp: 120, r: 3.5, life: 0.3, g: 0 }); if (n === 2) float(e.x, e.y + 20, 'x2', '#ffd43b', 16); $('coins').textContent = G.coins; bump($('coinBox')); }
      }
      continue;
    }
    if (e.k === 'plat') continue;
    if (e.k === 'worm') e.x -= 55 * dt; else if (e.k === 'fly') e.y = e.y0 + Math.sin(G.t * 3 + e.ph) * 7;
    const ex0 = e.x + 6, ex1 = e.x + e.w - 6, ey0 = e.y, ey1 = e.y + e.h - 5;
    if (bx1 < ex0 || bx0 > ex1 || by1 < ey0 || by0 > ey1) continue;
    const enemy = e.k === 'worm' || e.k === 'fly';
    if (rush) { smash(e, 15); sfx.smash(); G.shake = Math.max(G.shake, 0.12); }
    else if (enemy && p.vy < 0 && prevY >= e.y + e.h - 22) {
      e.dead = true; G.combo++; G.stomps++; const pts = 20 * G.combo; G.bonus += pts;
      p.vy = BOUNCE * (moonNow() ? 0.85 : 1); p.jumps = 1; p.slam = false; p.held = false; p.sq = 1; sfx.stomp(G.combo); G.shake = Math.max(G.shake, 0.1);
      float(e.x + 25, e.y + 70, G.combo > 1 ? `+${pts}  x${G.combo} COMBO!` : '+' + pts, G.combo > 1 ? '#ff8fab' : '#fff', 22 + Math.min(12, G.combo * 3));
      puff(e.x + 25, e.y + 14, 12, [PAL[2].main, PAL[2].light, '#fff'], { sp: 260, r: 6, life: 0.5 }); bump($('score'));
    } else if (G.inv > 0) { /* still flashing from the last hit */ }
    else if (G.pw.shield) { G.pw.shield = false; G.inv = 1.3; smash(e, 0); sfx.shieldPop(); G.shake = 0.25; float(px, p.y + 90, 'Shield popped!', '#69db7c', 22); puff(px, p.y + 24, 18, ['#69db7c', '#d3f9d8'], { sp: 300, r: 5, life: 0.5 }); }
    else { die(e); return; }
  }
  if (G.ents.length > 260) G.ents = G.ents.filter((e) => !e.dead);
  // ---- timers
  G.inv = Math.max(0, G.inv - dt); G.pw.magnet = Math.max(0, G.pw.magnet - dt); G.pw.x2 = Math.max(0, G.pw.x2 - dt);
  if (rush) { G.pw.rush -= dt; if (G.pw.rush <= 0) { G.pw.rush = 0; G.inv = 1.4; setHot(false); } }
  if (BOT) bot(px, ducking);
}

// test autopilot (?bot=1)
function bot(px, ducking) {
  const p = G.p, v = G.speed; let wantDuck = false;
  for (const e of G.ents) {
    if (e.dead || e.k === 'coin' || e.k === 'pow' || e.k === 'plat' || e.k === 'fly') continue;
    const front = (e.x - (px + 24)) / (v + (e.k === 'worm' ? 55 : 0)), back = (e.x + e.w - (px - 22)) / v;
    if (back < 0 || front > 0.6) continue;
    if (e.k === 'high') { if (front < 0.22) wantDuck = true; if (!p.on && front < 0.3) { p.vy = Math.min(p.vy, -1050); } }
    else if (e.k === 'tall') { if (p.on && front < 0.4) { jump(); } else if (!p.on && p.jumps > 0 && p.vy < 150) jump(); }
    else if (p.on && front < (e.k === 'salt' ? 0.05 : 0.1)) jump();
    else if (!p.on && p.jumps > 0 && p.vy < -200 && p.y < 60 && front < 0.12 && back > 0) jump();
  }
  p.duckHeld = wantDuck; p.held = true;
}

// ------------------------------------------------------------------ render
function drawBG(zi, a) {
  const z = ZONES[zi]; g.globalAlpha = a;
  const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, z.sky[0]); gr.addColorStop(0.55, z.sky[1]); gr.addColorStop(1, z.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, VW, GY + 2);
  drawSkyFx(g, zi, VW, GY, G.t, G.camX); g.globalAlpha = a;
  for (let li = 0; li < 3; li++) {
    const c = tile(zi, li), ox = -((G.camX * PAR[li]) % TW);
    for (let x = ox; x < VW; x += TW) { g.drawImage(c, x, GY - TH, TW + 1, TH); if (GY > TH) g.drawImage(c, 0, 0, c.width, 1, x, 0, TW + 1, GY - TH + 1); }
  }
  drawGround(g, zi, G.camX, VW, GY, VH); g.globalAlpha = 1;
}
function strokeText(txt, x, y, px, col) {
  g.font = `900 ${px}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = px * 0.24; g.strokeStyle = OUT; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
}
function drawPlayer() {
  const p = G.p, dead = G.state === 'dead', rush = G.pw.rush > 0, ducking = !dead && p.on && (p.duckHeld || p.duckT > 0) && G.state === 'run';
  const base = p.plat ? p.plat.y : 0, hgt = Math.max(0, p.y - base);
  if (!dead) { g.fillStyle = `rgba(20,10,0,${0.26 / (1 + hgt / 120)})`; g.beginPath(); g.ellipse(PX, GY - base + 3, 40 / (1 + hgt / 260), 6, 0, 0, TAU); g.fill(); }
  g.save(); g.translate(PX, GY - p.y);
  if (G.inv > 0 && !rush && Math.sin(G.t * 40) > 0) g.globalAlpha = 0.45;
  g.scale(0.62, 0.62);
  if (dead) { g.translate(0, -30); g.rotate(p.rot); g.translate(0, 30); }
  else if (ducking) g.scale(1.2, 0.56);
  else if (!p.on) { const s = clamp(p.vy / 2600, -0.22, 0.25); g.translate(0, -26); g.rotate(-s * 1.1); g.translate(0, 26); g.scale(1 - Math.abs(s) * 0.35, 1 + Math.abs(s) * 0.5); }
  else g.scale(1 - p.sq * 0.12, 1 + p.sq * 0.14);
  if (!dead && p.on && !ducking) g.rotate(-0.04);
  g.translate(0, -27);
  const mood = dead ? 'shock' : rush || G.pw.x2 > 0 ? 'smug' : 'happy';
  drawSlug(g, PAL[0], { t: G.t * (2 + G.speed / 90), mood, shadow: false, under: (c) => drawHat(c, save.hat, G.t) });
  if (G.pw.magnet > 0) { g.save(); g.translate(-6, -92 + Math.sin(G.t * 5) * 4); g.scale(0.8, 0.8); drawPower(g, 'magnet', G.t); g.restore(); }
  if (G.pw.shield) { g.beginPath(); g.ellipse(-2, -8, 86, 62 + Math.sin(G.t * 6) * 2, 0, 0, TAU); g.fillStyle = 'rgba(105,219,124,.22)'; g.fill(); g.strokeStyle = 'rgba(211,249,216,.9)'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.ellipse(-36, -40, 16, 7, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); }
  g.restore();
}
function drawPills(pw = G.pw) {
  const items = []; if (pw.rush > 0) items.push(['rush', pw.rush / 4.5]); if (pw.magnet > 0) items.push(['magnet', pw.magnet / 9]); if (pw.x2 > 0) items.push(['x2', pw.x2 / 10]); if (pw.shield) items.push(['shield', 1]);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); let y = SAT + 84;
  for (const [k, f] of items) {
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect ? g.roundRect(12, y, 128, 30, 15) : g.rect(12, y, 128, 30); g.fill();
    g.fillStyle = POWERS[k].col; g.beginPath(); g.roundRect ? g.roundRect(44, y + 10, 88 * f, 10, 5) : g.rect(44, y + 10, 88 * f, 10); g.fill();
    g.save(); g.translate(28, y + 15); g.scale(0.56, 0.56); drawPower(g, k, 0); g.restore(); y += 36;
  }
}
function draw() {
  const k = DPR * S; g.setTransform(k, 0, 0, k, 0, 0);
  if (G.shake > 0) g.translate((rnd() - 0.5) * G.shake * 30, (rnd() - 0.5) * G.shake * 30);
  const zi = G.zi % NZ;
  if (G.fade < 1 && G.prevZ >= 0) { drawBG(G.prevZ, 1); drawBG(zi, G.fade); } else drawBG(zi, 1);
  const cam = G.camX, t = G.t;
  // slime trail
  for (const s of G.trail) { const a = Math.max(s.a, cam - 60) - cam, b = s.b - cam; if (b > a) { const gr = g.createLinearGradient(a, 0, b, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.5)'); g.fillStyle = gr; g.fillRect(a, GY - 2, b - a, 5); } }
  // best-distance signpost
  if (save.bestDist > 20 && G.state !== 'title') { const sx = save.bestDist * M + PX - cam; if (sx > -80 && sx < VW + 80) { g.fillStyle = OUT; g.fillRect(sx - 3, GY - 130, 6, 130); g.beginPath(); g.moveTo(sx + 3, GY - 130); g.lineTo(sx + 78, GY - 112); g.lineTo(sx + 3, GY - 92); g.closePath(); g.fillStyle = '#e03131'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); strokeText('BEST', sx + 30, GY - 111, 15, '#fff'); } }
  for (const pass of [0, 1]) for (const e of G.ents) {
    if (e.dead) continue; const sx = e.x - cam; if (sx > VW + 120 || sx + e.w < -120) continue;
    const solid = e.k !== 'coin' && e.k !== 'pow'; if ((pass === 0) !== solid) continue;
    g.save();
    if (e.k === 'plat') { g.translate(sx, GY - e.y); drawPlatform(g, e.w, e.z); }
    else if (e.k === 'salt') { g.translate(sx, GY); drawSalt(g, e.w, t + e.x); }
    else if (e.k === 'worm') { g.translate(sx + 25, GY - e.y); drawWorm(g, t + e.x * 0.01, e.z, false); }
    else if (e.k === 'fly') { g.translate(sx + 25, GY - e.y - 12); drawWorm(g, t + e.x * 0.01, e.z, true); }
    else if (e.k === 'coin') drawCoin(g, sx, GY - e.y, 13, t * 5 + e.x * 0.02);
    else if (e.k === 'pow') { g.translate(sx, GY - e.y + Math.sin(t * 4) * 5); drawPower(g, e.kind, t); }
    else { g.translate(sx + e.w / 2, GY); drawObstacle(g, e.k, e.z, e.v, t); }
    g.restore();
  }
  drawPlayer();
  for (const q of G.parts) { g.globalAlpha = 1 - q.life / q.max; g.fillStyle = q.c; g.beginPath(); g.arc(q.x - cam, GY - q.y, q.r, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  if (G.pw.rush > 0) { g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 9; i++) { const y = ((i * 97 + t * 900) % (GY + 60)), x = (VW * 1.3 - ((t * 1900 + i * 331) % (VW * 1.5))); g.fillRect(x, y, 90, 3); } }
  for (const f of G.floats) { g.globalAlpha = f.life > 0.7 ? (1 - f.life) / 0.3 : 1; const pop = f.life < 0.12 ? 0.6 + (f.life / 0.12) * 0.5 : 1.1 - Math.min(0.1, (f.life - 0.12) * 0.5); strokeText(f.txt, clamp(f.x - cam, 70, VW - 70), GY - f.y, f.s * pop, f.c); }
  g.globalAlpha = 1;
  if (G.state === 'run') { drawPills(); const s = score(); if (s !== draw.s) { draw.s = s; $('score').textContent = s; } const d = Math.floor(G.camX / M); if (d !== draw.d) { draw.d = d; $('dist').textContent = d + ' m · ' + ZONES[zi].name; } }
}

// ------------------------------------------------------------------ screens
const screens = ['title', 'over', 'shop', 'pause'];
function show(name) { for (const s of screens) $('scr-' + s).classList.toggle('hidden', s !== name); $('hud').classList.toggle('hidden', !!name && name !== 'pause'); }
let paused = false, shopFrom = 'title', active3 = false, overId = 0;
const R3 = createRun3D({ g, save, sfx, bot: BOT, tile, banner, bump, setHot, setTempo, drawPills, view: () => ({ W, H, DPR }), onOver: (res) => showOver(res) });
function setMode(m) { save.mode = m; persist(); sfx.click(); refreshTitle(); }
function refreshTitle() {
  const is3 = save.mode === '3d', b = is3 ? save.best3 : save.best, d = is3 ? save.bestDist3 : save.bestDist;
  $('titleBest').textContent = b ? `Best: ${b}  ·  ${d} m` : ''; $('titleBank').textContent = save.bank; $('btnMute').textContent = save.muted ? '🔇' : '🔊'; $('btnMute2').textContent = (save.muted ? '🔇' : '🔊') + ' Sound';
  $('mode2d').classList.toggle('on', !is3); $('mode3d').classList.toggle('on', is3); $('tips2d').classList.toggle('hidden', is3); $('tips3d').classList.toggle('hidden', !is3);
}
function startRun() {
  const is3 = save.mode === '3d';
  initAudio(); setMuted(save.muted); setHot(false); setTrack(is3 ? 'chase' : 'bounce'); setTempo(is3 ? 172 : 148); startMusic(); sfx.click();
  paused = false; overId++; show(null); $('coins').textContent = '0'; draw.s = draw.d = -1;
  const z = ZONES[0]; banner(z.name, z.sub);
  const key = is3 ? 'runs3' : 'runs', h = $(is3 ? 'hint3' : 'hint'); $('hint').classList.add('hidden'); $('hint3').classList.add('hidden');
  if (save[key] < 3) { h.classList.remove('hidden'); h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; }
  if (is3) { reset('title'); R3.start(); active3 = true; } else { active3 = false; reset('run'); }
  save[key]++; persist();
}
const QUIPS = {
  salt: ['Salt?! In THIS economy?', 'Too salty. Bad for bidness.', 'A seasoned professional… too seasoned.'],
  worm: ['Hostile takeover by WormCo!', 'Wormed out of the deal.', 'The worms win this round.'], fly: ['Air-dropped by WormCo!', 'Drone strike on the bidness.'],
  high: ['Should have ducked that meeting.', 'Heads up! …too late.'], tall: ['That was a tall order.', 'Hit a wall in negotiations.'], low: ['Tripped over the fine print.', 'A small setback. Literally.', "That's bad bidness."],
};
function showOver(res) {
  if (!res) res = { mode: '2d', sc: score(), dist: Math.floor(G.camX / M), coins: G.coins, stomps: G.stomps, cause: G.cause, zone: ZONES[G.zi % NZ].name, lap: Math.floor(G.zi / NZ) };
  const bk = res.mode === '3d' ? 'best3' : 'best', dk = res.mode === '3d' ? 'bestDist3' : 'bestDist', sc = res.sc, isBest = sc > save[bk] && sc > 0;
  save.bank += res.coins; if (isBest) save[bk] = sc; if (res.dist > save[dk]) save[dk] = res.dist; persist();
  const q = QUIPS[res.cause] || QUIPS.low; $('overQuip').textContent = q[(rnd() * q.length) | 0]; $('hint').classList.add('hidden'); $('hint3').classList.add('hidden');
  $('overBest').classList.toggle('hidden', !isBest); $('stDist').textContent = res.dist + ' m'; $('stCoins').textContent = '+' + res.coins; $('stStomps').textContent = res.stomps;
  $('stZone').textContent = `${res.mode === '3d' ? '3D Chase' : 'Side View'} · made it to ${res.zone}${res.lap ? ' (lap ' + (res.lap + 1) + ')' : ''} · best ${save[bk]}`;
  $('overBank').textContent = save.bank; show('over');
  const el = $('overScore'), t0 = performance.now(), dur = Math.min(1200, 400 + sc), id = ++overId; let lastTick = 0;
  (function tick(now) { const u = clamp((now - t0) / dur, 0, 1), v = Math.round(sc * (1 - Math.pow(1 - u, 3))); el.textContent = v; if (now - lastTick > 60 && u < 1) { lastTick = now; sfx.tick(u * 20); } if (u < 1 && id === overId) requestAnimationFrame(tick); else if (isBest && id === overId) sfx.best(); })(t0);
}
function toTitle() { active3 = false; overId++; reset('title'); show('title'); refreshTitle(); setHot(false); }
function openShop(from) { shopFrom = from; sfx.click(); show('shop'); renderShop(); }
function renderShop() {
  $('shopBank').textContent = save.bank; const box = $('hats'); box.innerHTML = '';
  for (const h of HATS) {
    const owned = save.hats.includes(h.id), on = save.hat === h.id, b = document.createElement('button');
    b.className = 'hat' + (on ? ' on' : '') + (owned ? '' : ' locked');
    const c = document.createElement('canvas'); c.width = 192; c.height = 140; const x = c.getContext('2d'); x.translate(92, 104); x.scale(1.15, 1.15); drawSlug(x, PAL[0], { t: 0.5, mood: owned ? 'happy' : 'smug', under: (q) => drawHat(q, h.id, 0.05) });
    const lbl = document.createElement('div'); lbl.textContent = h.name; const tag = document.createElement('span');
    if (on) tag.textContent = 'Wearing'; else if (owned) tag.textContent = 'Wear'; else { tag.innerHTML = '<i class="coin"></i>'; tag.append(String(h.cost)); }
    b.append(c, lbl, tag);
    b.onclick = () => {
      if (owned) { save.hat = h.id; sfx.click(); }
      else if (save.bank >= h.cost) { save.bank -= h.cost; save.hats.push(h.id); save.hat = h.id; initAudio(); sfx.buy(); }
      else { initAudio(); sfx.nope(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
      persist(); renderShop();
    };
    box.append(b);
  }
}
function setPause(on) { if (!(active3 ? R3.running() : G.state === 'run')) return; paused = on; show(on ? 'pause' : null); suspendAudio(on); }
function toggleMute() { save.muted = !save.muted; persist(); initAudio(); setMuted(save.muted); refreshTitle(); }

$('mode2d').onclick = () => { initAudio(); setMode('2d'); }; $('mode3d').onclick = () => { initAudio(); setMode('3d'); };
$('btnPlay').onclick = startRun; $('btnAgain').onclick = startRun;
$('btnShop').onclick = () => openShop('title'); $('btnShop2').onclick = () => openShop('over');
$('btnShopBack').onclick = () => { sfx.click(); if (shopFrom === 'over') { $('overBank').textContent = save.bank; show('over'); } else { show('title'); refreshTitle(); } };
$('btnHome').onclick = () => { sfx.click(); toTitle(); };
$('btnPause').onclick = () => setPause(true); $('btnResume').onclick = () => setPause(false);
$('btnQuit').onclick = () => { suspendAudio(false); paused = false; toTitle(); };
$('btnMute').onclick = toggleMute; $('btnMute2').onclick = toggleMute;
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

// ------------------------------------------------------------------ input
const touches = new Map();
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (active3) { if (!paused) R3.pointer('down', e); return; }
  if (G.state !== 'run' || paused) return;
  const isDuck = e.clientX < W * 0.38; touches.set(e.pointerId, { duck: isDuck, y: e.clientY, sw: false });
  if (isDuck) duck(true); else jump();
});
cv.addEventListener('pointermove', (e) => { if (active3) { if (!paused) R3.pointer('move', e); return; } const t = touches.get(e.pointerId); if (t && !t.duck && !t.sw && e.clientY - t.y > 42) { t.sw = true; duck(true); G.p.duckHeld = false; } });
const up = (e) => { if (active3) { R3.pointer(e.type === 'pointerup' && !paused ? 'up' : 'cancel', e); return; } const t = touches.get(e.pointerId); if (!t) return; touches.delete(e.pointerId); if (t.duck) { if (![...touches.values()].some((q) => q.duck)) duck(false); } else release(); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (active3 && R3.running()) { e.preventDefault(); if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused); else if (!paused) R3.key(e.code); return; }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (G.state === 'run') jump(); else if (!$('scr-title').classList.contains('hidden') || (!$('scr-over').classList.contains('hidden'))) startRun(); }
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); duck(true); }
  else if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused);
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release(); else if (e.code === 'ArrowDown' || e.code === 'KeyS') duck(false); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest('#hats')) e.preventDefault(); }, { passive: false });

// ------------------------------------------------------------------ boot
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });
resize(); reset('title'); refreshTitle();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.034, (now - last) / 1000); last = now;
  if (active3) { if (!paused) { R3.step(dt / 2); R3.step(dt / 2); } R3.draw(); }
  else { if (!paused) { if (dt > 0.02 && G.state === 'run') { step(dt / 2); if (G.state === 'run') step(dt / 2); } else step(dt); } draw(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__run = { R3, setMode(m) { save.mode = m; refreshTitle(); }, get G() { return G; }, save, ZLEN, startRun, warp(zi, frac = 0.05) { G.camX = (zi + frac) * ZLEN; G.nextX = G.camX + VW + 300; G.ents = []; G.trail = []; }, jump, duck,
  sim(sec) { const t0 = G.camX; for (let i = 0; i < sec * 60 && G.state === 'run'; i++) step(1 / 60); return { state: G.state, m: Math.round(G.camX / M), cause: G.cause, last: G.last, score: score(), coins: G.coins, stomps: G.stomps, zi: G.zi }; } };
