// Sluggy Run — endless runner starring Sluggy the banana slug.
import { drawSlug, drawCoin, PAL, OUT } from '../../sluggy/js/art.js';
import { ZONES, TW, TH, buildLayer, drawSkyFx, drawGround, drawObstacle, drawSalt, drawLedge, drawWorm, drawPower, drawHat, HATS, POWERS } from './zones.js';
import { initAudio, sfx, startMusic, setMuted, setHot, setTempo, setTrack, suspendAudio } from './audio.js';
import { createRun3D } from './run3d.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
const TAU = Math.PI * 2, rnd = Math.random, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NZ = ZONES.length, ZLEN = 7500, M = 25;           // world units per zone / per metre
const GRAV = 2400, BOUNCE = 640;
// Squish, Boing & Splat: hold to squish flat and charge, release to boing (VMIN tap hop .. VMAX full charge), stick to slime ledges
const VMIN = 640, VMAX = 1000, CHARGE = 0.55, PERFECT = 0.22, SLUGH = 42, FLATH = 20, LEDGE_Y = 140, LEDGE_H = 16;
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
const baseSpeed = (x) => Math.min(450, 270 + x * 0.004);
function reset(state) {
  G = {
    state, t: 0, camX: 0, speed: 0, bonus: 0, coins: 0, stomps: 0, combo: 0, zi: 0, prevZ: -1, fade: 1, shake: 0, inv: 0, deadT: 0, shown: false, cause: '',
    p: { y: 0, vy: 0, on: true, plat: null, ceil: null, hold: false, charge: 0, sqz: 0, tapBuf: 0, slam: false, rot: 0, sq: 0, ex: 0, ey: 0, evx: 0, evy: 0, ph: 0 },
    decals: [], ctrail: [], sticks: 0, streak: 0,
    pw: { magnet: 0, rush: 0, x2: 0, shield: false },
    ents: [], parts: [], floats: [], trail: [], nextX: 0, nextPow: 0, last: '', record: false, mile: 1,
  };
  G.nextX = VW + 500; G.nextPow = G.nextX + 270 * (7 + rnd() * 4);
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
const ledge = (x, w) => add('ledge', x, { w, y: LEDGE_Y, h: LEDGE_H });          // slime ledge: stick underneath, or land on top
function line(x, T, n, y = 26, gap = 0.13) { for (let i = 0; i < n; i++) coin(x + i * gap * T, y); }
function arc(cx, T, hgt = 70, n = 5, span = 0.5) { for (let i = 0; i < n; i++) { const u = (i / (n - 1)) * 2 - 1; coin(cx + (u * span * T) / 2, 34 + hgt * (1 - u * u)); } }
const under = (x, T, n) => line(x, T, n, LEDGE_Y - 28, 0.14);                       // coins hanging under a ledge
const PAT = {
  line(x, T) { line(x + 0.1 * T, T, 6); return 0.9; },
  hop(x, T, m) { low(x + 0.45 * T); arc(x + 0.45 * T, T, 66 * m); return 1.0; },
  salt(x, T, m) { const w = 0.26 * T; salt(x + 0.4 * T, w); arc(x + 0.4 * T + w / 2, T, 66 * m); return 1.1; },
  duck(x, T, m) { high(x + 0.6 * T); line(x + 0.25 * T, T, 6, 12, 0.12); arc(x + 1.08 * T, T, 140 * m, 5, 0.5); return 1.6; },
  worm(x, T, m) { worm(x + 0.75 * T); arc(x + 1.05 * T, T, 80 * m, 4, 0.36); return 1.25; },
  fly(x, T) { fly(x + 0.65 * T); line(x + 0.3 * T, T, 6, 20, 0.12); return 1.15; },
  hop2(x, T, m) { low(x + 0.45 * T); low(x + 1.4 * T); arc(x + 0.45 * T, T, 66 * m); arc(x + 1.4 * T, T, 66 * m); return 1.9; },
  tall(x, T, m) { line(x + 0.1 * T, T, 5, 20, 0.12); tall(x + 1.05 * T); arc(x + 1.05 * T, T, 178 * m, 5, 0.62); return 1.85; },
  chain(x, T, m, sp, v, mb) { const tb = (2 * BOUNCE) / GRAV * mb, s = (v + 55) * tb * 0.97, n = 3 + (rnd() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) { worm(x + 0.8 * T + i * s); coin(x + 0.8 * T + (i + 0.5) * s - 0.1 * T, 104 * m); } return 0.95 + (n * s) / T; },
  squishrun(x, T, m) { const n = 2 + (rnd() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) high(x + (0.6 + i * 0.5) * T); line(x + 0.3 * T, T, 3 + n * 4, 12, 0.12); arc(x + (0.6 + (n - 1) * 0.5 + 0.5) * T, T, 185 * m, 5, 0.6); return 1.7 + n * 0.5; },
  duckhop(x, T, m) { high(x + 0.55 * T); low(x + 1.1 * T); arc(x + 1.1 * T, T, 150 * m, 5, 0.5); return 1.9; },   // squeeze under, then the release boing carries you over
  hopduck(x, T, m) { low(x + 0.45 * T); arc(x + 0.45 * T, T, 66 * m); high(x + 1.5 * T); arc(x + 1.98 * T, T, 140 * m, 5, 0.5); return 2.5; },
  saltwide(x, T, m) { const w = 0.42 * T; salt(x + 0.55 * T, w); arc(x + 0.55 * T + w / 2, T, 105 * m, 6, 0.6); return 1.45; },
  wormduck(x, T, m) { worm(x + 0.8 * T); high(x + 1.7 * T); return 2.25; },
  stairs(x, T, m, sp, v, mb) { const tb = (2 * BOUNCE) / GRAV * mb, s = (v + 55) * tb * 0.9; worm(x + 0.8 * T); fly(x + 0.8 * T + s, 78); line(x + 0.8 * T + s * 1.5, T, 4, 190 * m, 0.1); return 1.6 + s / T; },
  // --- sticky routes: boing up into the ledge, crawl along it upside down
  ceilsalt(x, T) { const a = x + 0.6 * T; ledge(a, 1.6 * T); salt(a + 0.34 * T, 1.0 * T); under(a + 0.2 * T, T, 9); return 2.6; },
  ceilworms(x, T, m, sp, v, mb) { const a = x + 0.6 * T, tb = (2 * BOUNCE) / GRAV * mb, s = (v + 55) * tb * 0.97; ledge(a, 1.6 * T); for (let i = 0; i < 4; i++) worm(a + 0.5 * T + i * s); under(a + 0.2 * T, T, 9); return 2.6; },
  ceillows(x, T, m) { const a = x + 0.55 * T; ledge(a, 1.5 * T); low(a + 0.4 * T); salt(a + 1.08 * T, 0.24 * T); under(a + 0.2 * T, T, 8); return 2.45; },
  ceiltop(x, T) { const a = x + 0.9 * T; line(x + 0.1 * T, T, 4, 20, 0.12); ledge(a, 1.3 * T); line(a + 0.15 * T, T, 8, LEDGE_Y + LEDGE_H + 26, 0.13); salt(a + 0.3 * T, 0.7 * T); under(a + 0.2 * T, T, 7); return 2.6; },
};
const PATS = [['line', 0, 2], ['hop', 0, 4], ['salt', 0, 3], ['duck', 0.02, 3], ['ceillows', 0.03, 3], ['worm', 0.05, 3], ['ceilsalt', 0.09, 3], ['tall', 0.12, 3], ['fly', 0.12, 2], ['hop2', 0.15, 2],
  ['ceilworms', 0.18, 3], ['chain', 0.22, 2], ['squishrun', 0.24, 3], ['ceiltop', 0.26, 2], ['saltwide', 0.3, 2], ['duckhop', 0.33, 3], ['hopduck', 0.33, 2], ['stairs', 0.36, 2], ['wormduck', 0.45, 2]];
function gen() {
  while (G.nextX < G.camX + VW + 500) {
    const x = G.nextX, moon = ((zoneAt(x) % NZ) + NZ) % NZ === 6, v = baseSpeed(x), sp = 1, T = v * (moon ? 1.45 : 1), mb = moon ? 0.85 / 0.6 : 1;
    const d = Math.min(1, x / (ZLEN * 3.5)), m = moon ? 1.2 : 1;
    let len;
    if (moon && zoneAt(x + 3.4 * T) !== zoneAt(x)) { line(x + 0.1 * T, T, 6); len = 0.9; G.last = 'line'; }   // gravity changes at the edge of the moon: keep that stretch clear
    else if (x > G.nextPow) {
      const kinds = Object.keys(POWERS).filter((k) => !(k === 'shield' && G.pw.shield)), kind = kinds[(rnd() * kinds.length) | 0];
      line(x + 0.1 * T, T, 3); add('pow', x + 0.62 * T, { y: 92, kind }); line(x + 0.8 * T, T, 3); len = 1.2; G.nextPow = x + v * (12 + rnd() * 8);
    } else {
      const ok = PATS.filter((p) => p[1] <= d && p[0] !== G.last); let tot = 0; for (const p of ok) tot += p[2];
      let r = rnd() * tot, pick = ok[0]; for (const p of ok) { r -= p[2]; if (r <= 0) { pick = p; break; } }
      G.last = pick[0]; len = PAT[pick[0]](x, T, m, sp, v, mb);
    }
    G.nextX += (len + lerp(0.6, 0.32, d) * sp) * T;
  }
}

// ------------------------------------------------------------------ fx helpers
function puff(x, y, n, c, o = {}) { for (let i = 0; i < n; i++) { const a = o.up ? -Math.PI * rnd() : rnd() * TAU, s = (o.sp || 160) * (0.4 + rnd() * 0.8); G.parts.push({ x, y, vx: Math.cos(a) * s + (o.vx || 0), vy: -Math.sin(a) * s, g: o.g ?? 900, life: 0, max: (o.life || 0.5) * (0.6 + rnd() * 0.7), r: (o.r || 5) * (0.6 + rnd() * 0.8), c: Array.isArray(c) ? c[(rnd() * c.length) | 0] : c }); } }
function float(x, y, txt, c = '#fff', s = 24) { G.floats.push({ x, y, txt, c, s, life: 0 }); }
const CONF = ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc', '#f06595', '#fff'];
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function banner(a, b) { const el = $('banner'); el.firstElementChild.textContent = a; el.lastElementChild.textContent = b; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

// ------------------------------------------------------------------ player actions (one finger: press / release)
const moonNow = () => G.zi % NZ === 6;
const pick = (a) => a[(rnd() * a.length) | 0];
function press() {
  if (G.state !== 'run') return; const p = G.p, px = G.camX + PX; if (p.hold) return; p.hold = true;
  if (p.ceil) { unstick(-380); sfx.swish(); float(px, p.y + 70, pick(['Bloop!', 'Unstuck!', 'Plop!']), '#fff4b0', 18); }
  else if (!p.on) { p.vy = Math.min(p.vy, -1100); p.slam = true; if (p.y < 60) p.tapBuf = 0.14; sfx.slide(); }
  else { p.charge = 0; (sfx.squish || sfx.slide)(); }
}
function release() { const p = G.p; if (!p.hold) return; p.hold = false; if (G.state === 'run' && p.on) boing(); }
function boing() {
  const p = G.p, px = G.camX + PX, c = clamp(p.charge / CHARGE, 0, 1), perfect = p.charge >= CHARGE && p.charge < CHARGE + PERFECT;
  p.vy = lerp(VMIN, VMAX, c) * (moonNow() ? 0.85 : 1) * (perfect ? 1.03 : 1); p.on = false; p.plat = null; p.charge = 0; p.sq = 0.7 + c * 1.3; p.slam = false;
  if (c > 0.55) (sfx.boing || sfx.jump2)(c); else sfx.jump();
  puff(px - 6, p.y + 4, 4 + Math.round(c * 9), c > 0.55 ? ['#fff4b0', '#ffd83d', '#fff'] : 'rgba(255,255,255,.7)', { up: true, sp: 90 + c * 170, r: 5, life: 0.4 });
  if (perfect) { G.streak++; const pts = 10 * Math.min(5, G.streak); G.bonus += pts; float(px + 20, p.y + 96, (G.streak > 1 ? `PERFECT BOING x${G.streak}  +` : 'PERFECT BOING!  +') + pts, '#69db7c', 22 + Math.min(8, G.streak * 2)); bump($('score')); }
  else { if (c >= 0.5) G.streak = 0; if (c >= 1) float(px + 10, p.y + 90, pick(['BOING!', 'BOI-OI-OING!', 'Sproing!']), '#ffe45c', 22); }
}
function land(plat) {
  const p = G.p, slam = p.slam, px = G.camX + PX; p.on = true; p.plat = plat; p.vy = 0; G.combo = 0; p.sq = slam ? -1.8 : -1; p.slam = false; p.charge = 0;
  puff(px, p.y + 3, slam ? 14 : 5, slam ? ['#fff4b0', '#fff', 'rgba(255,255,255,.75)'] : 'rgba(255,255,255,.75)', { up: true, sp: slam ? 240 : 110, r: 5, life: 0.4 });
  if (slam) { G.shake = 0.18; (sfx.splat || sfx.land)(); if (!plat) G.decals.push({ x: px, y: 0, r: 20 + rnd() * 8, s: rnd() * 6, floor: true }); } else sfx.land();
  if (!p.hold && p.tapBuf > 0) { p.tapBuf = 0; boing(); }
}
function stick(e) {
  const p = G.p, px = G.camX + PX; p.ceil = e; p.on = false; p.plat = null; p.y = e.y - SLUGH; p.vy = 0; p.slam = false; p.sq = -1.6; G.sticks++; G.shake = Math.max(G.shake, 0.1);
  G.decals.push({ x: px, y: e.y, r: 22 + rnd() * 8, s: rnd() * 6 }); G.ctrail.push({ a: px - 26, b: px - 26, y: e.y, open: true });
  puff(px, e.y - 8, 12, ['#fff4b0', '#ffe45c', '#fff'], { sp: 210, r: 5, life: 0.45 }); (sfx.splat || sfx.land)();
  G.bonus += 10; float(px + 10, e.y + 40, pick(['SPLAT!  +10', 'STUCK IT!  +10', 'Sticky bidness!  +10', 'Thwip!  +10']), '#ffe45c', 22);
}
function unstick(vy) { const p = G.p, l = G.ctrail[G.ctrail.length - 1]; if (!p.ceil) return; if (l) l.open = false; p.ceil = null; p.vy = vy; }
function smash(e, pts) {
  e.dead = true; const cx = e.x + e.w / 2, cy = Math.min(e.y + 40, e.y + e.h / 2);
  puff(cx, cy, 14, e.k === 'worm' || e.k === 'fly' ? [PAL[2].main, PAL[2].light, '#fff'] : e.k === 'salt' ? ['#fff', '#e7f5ff'] : ['#c98d4f', '#fff', '#ffd43b', '#868e96'], { sp: 330, r: 6, life: 0.6, vx: G.speed * 0.4 });
  if (pts) { G.bonus += pts; float(cx, cy + 50, '+' + pts, '#ffe45c'); }
}
function die(e) {
  G.state = 'dead'; G.cause = e.k; G.deadT = 0; unstick(0); G.p.vy = 640; G.p.on = false; G.p.hold = false; G.shake = 0.45; sfx.hit(); setHot(false);
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
  { // squish amount, inchworm phase, and eye stalks on springs (they lag behind and whip)
    const run = G.state === 'run'; p.sqz += ((run && p.on && p.hold ? 1 : 0) - p.sqz) * Math.min(1, dt * 22); p.ph += dt * (4 + G.speed / 40);
    const tx = clamp(-Math.cos(p.ph) * 5 - (G.pw.rush > 0 ? 8 : 0), -12, 12), ty = clamp(p.vy * 0.016 * (p.ceil ? -1 : 1), -16, 18);
    p.evx += ((tx - p.ex) * 260 - p.evx * 13) * dt; p.ex += p.evx * dt; p.evy += ((ty - p.ey) * 260 - p.evy * 11) * dt; p.ey += p.evy * dt;
  }
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
  p.tapBuf -= dt;
  if (p.ceil) {
    const e = p.ceil; p.y = e.y - SLUGH; p.vy = 0;
    if (px > e.x + e.w + 12 || e.dead) unstick(0);
    else { const l = G.ctrail[G.ctrail.length - 1]; if (l && l.open) l.b = px - 26; if (rnd() < dt * 6) G.parts.push({ x: px - 24 + rnd() * 36, y: e.y - 5, vx: 0, vy: 0, g: 700, life: 0, max: 0.7, r: 2.5 + rnd() * 2.5, c: 'rgba(255,244,176,.9)' }); }
  } else if (!p.on) {
    p.vy = Math.max(-1700, p.vy - grav * dt); p.y += p.vy * dt;
    for (const e of G.ents) {
      if (e.k !== 'ledge' || e.dead || px < e.x - 12 || px > e.x + e.w + 12) continue; const top = e.y + e.h;
      if (p.vy <= 0 && p.y <= top && (prevY >= top - 2 || p.y > top - 22)) { p.y = top; land(e); break; }
      if (p.y + SLUGH >= e.y && p.y < top - 22) { stick(e); break; }
    }
    if (!p.on && !p.ceil && p.y <= 0) { p.y = 0; land(null); }
  } else if (p.plat && px > p.plat.x + p.plat.w + 14) { p.on = false; p.plat = null; }
  else if (p.hold) { const was = p.charge; p.charge += dt; if (was < CHARGE && p.charge >= CHARGE) { sfx.tick(14); puff(px, p.y + 12, 8, ['#69db7c', '#d3f9d8', '#fff'], { sp: 150, r: 4, life: 0.35, g: 0 }); } }
  const squished = p.on && p.hold && p.charge > 0.05;
  // slime trail
  const tr = G.trail, lastT = tr[tr.length - 1];
  if (p.on && !p.plat) { if (lastT && lastT.open) lastT.b = px - 30; else tr.push({ a: px - 30, b: px - 30, open: true }); } else if (lastT) lastT.open = false;
  while (tr.length && tr[0].b < G.camX - 60) tr.shift();
  while (G.ctrail.length && G.ctrail[0].b < G.camX - 60 && !G.ctrail[0].open) G.ctrail.shift();
  while (G.decals.length && G.decals[0].x < G.camX - 80) G.decals.shift();
  if (rush && rnd() < 0.8) puff(px - 34, p.y + 14 + rnd() * 20, 1, ['#ffd43b', '#ff922b', '#fff'], { sp: 60, vx: -260, r: 6, life: 0.35, g: 0 });
  // ---- entities
  const ph = squished ? FLATH : SLUGH, bx0 = px - 22, bx1 = px + 24, by0 = p.y, by1 = p.y + ph, cy = p.y + ph / 2;
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
    if (e.k === 'ledge') continue;
    if (e.k === 'high' && !e.passed && e.x + e.w - 6 < bx0) { e.passed = true; if (squished && !rush) { G.bonus += 5; float(px + 10, 78, pick(['Squeezed by!  +5', 'Limbo!  +5', 'Flat out!  +5', 'Paper thin!  +5']), '#74c0fc', 18); } }
    if (e.k === 'worm') e.x -= 55 * dt; else if (e.k === 'fly') e.y = e.y0 + Math.sin(G.t * 3 + e.ph) * 7;
    const ex0 = e.x + 6, ex1 = e.x + e.w - 6, ey0 = e.y, ey1 = e.y + e.h - 5;
    if (bx1 < ex0 || bx0 > ex1 || by1 < ey0 || by0 > ey1) continue;
    const enemy = e.k === 'worm' || e.k === 'fly';
    if (rush) { smash(e, 15); sfx.smash(); G.shake = Math.max(G.shake, 0.12); }
    else if (enemy && p.vy < 0 && prevY >= e.y + e.h - 22) {
      e.dead = true; G.combo++; G.stomps++; const pts = 20 * G.combo; G.bonus += pts;
      p.vy = BOUNCE * (moonNow() ? 0.85 : 1); p.slam = false; p.sq = 1; sfx.stomp(G.combo); G.shake = Math.max(G.shake, 0.1);
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
  if (BOT) bot(px);
}

// test autopilot (?bot=1): plans each press and release the way a careful player would
function bot(px) {
  const p = G.p, v = G.speed, grav = GRAV * (moonNow() ? 0.6 : 1), kv = moonNow() ? 0.85 : 1;
  const set = (want) => { if (want && !p.hold) press(); else if (!want && p.hold) release(); };
  if (G.pw.rush > 0) { set(false); return; }
  if (p.ceil) { set(false); return; }
  const sp = (e) => v + (e.k === 'worm' ? 55 : 0), tf = (e) => (e.x + 6 - (px + 24)) / sp(e), tb = (e) => (e.x + e.w - 6 - (px - 22)) / sp(e);
  const haz = G.ents.filter((e) => !e.dead && (e.k === 'low' || e.k === 'tall' || e.k === 'high' || e.k === 'salt' || e.k === 'worm' || e.k === 'fly') && tb(e) > -0.02).sort((a, b) => tf(a) - tf(b));
  const ground = haz.filter((e) => e.k !== 'fly'), H = ground[0];
  if (!p.on) {
    const tl = (p.vy + Math.sqrt(p.vy * p.vy + 2 * grav * p.y)) / grav, ts = (-1100 + Math.sqrt(1100 * 1100 + 2 * grav * p.y)) / grav;
    const overLedge = G.ents.some((e) => e.k === 'ledge' && !e.dead && px > e.x - 30 && px < e.x + e.w + 20 && p.y >= e.y);
    let want = false;
    if (!overLedge) {
      for (const f of haz) { if (f.k !== 'fly' || tf(f) > tl) continue; const t0 = Math.max(0, tf(f)), y0 = p.y + p.vy * t0 - 0.5 * grav * t0 * t0, t1 = Math.max(0, tb(f)), y1 = p.y + p.vy * t1 - 0.5 * grav * t1 * t1; if (Math.max(y0, y1) + SLUGH > f.y - 8 && Math.min(y0, y1) < f.y + f.h - 20) want = true; }
      if (H) {
        if (H.k === 'high') { if (tl > tf(H) - 0.1) want = true; }
        else if (H.k !== 'worm' && ts < tf(H) - 0.1) { const yAt = (t) => p.y + p.vy * t - 0.5 * grav * t * t, clip = tf(H) < tl && (yAt(Math.max(0, tf(H))) < H.h + 6 || yAt(Math.max(0, tb(H))) < H.h + 6); if (clip || (tl > tf(H) - 0.07 && tl < tb(H) + 0.07)) want = true; }
      }
    }
    if (p.hold && H && H.k === 'high' && tf(H) < 0.9) want = true;
    set(want); return;
  }
  if (!H || tf(H) > 1.6) { set(false); return; }
  const t1 = tf(H);
  if (H.k === 'high') {
    const next = ground[1], more = next && next.k === 'high' && tf(next) - tb(H) < 0.7;
    set(t1 < 0.17 && (tb(H) > -0.01 || more)); return;
  }
  const span = (H.w - 12 + 46) / sp(H), plan = (c) => { const v0 = lerp(VMIN, VMAX, c) * kv; return Math.max(0.03, v0 / grav - span / 2); };   // centre the arc over the thing
  let c = 0, launch = plan(0);
  if (H.k === 'tall') { c = 1; launch = plan(1); }
  else if (H.k === 'worm') launch = (2 * VMIN * kv) / grav - 0.035;                // come down on its head
  else if (H.k === 'salt') {
    const L = G.ents.find((e) => e.k === 'ledge' && !e.dead && e.x < H.x && e.x + e.w > H.x + H.w);
    if (L && H.w / v > 0.6) { const tl2 = (L.x - px) / v; if (tl2 > 0) set(tl2 < 0.34); else { if (!p.hold) press(); if (p.charge < 0.28) p.charge = 0.28; release(); } return; }
    const air = span + 0.1; c = clamp(((air * grav) / 2 / kv - VMIN) / (VMAX - VMIN), 0, 1); launch = plan(c);
  }
  const holdT = c * CHARGE + 0.02;
  if (t1 < launch) { if (!p.hold) press(); if (p.charge >= c * CHARGE - 0.01 || t1 < launch - 0.12) release(); }
  else set(t1 < launch + holdT);
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
  const p = G.p, dead = G.state === 'dead', run = G.state === 'run', rush = G.pw.rush > 0, z = dead ? 0 : p.sqz, c = run && p.on && p.hold ? clamp(p.charge / CHARGE, 0, 1) : 0;
  const base = p.plat ? p.plat.y + p.plat.h : 0, hgt = Math.max(0, p.y - base);
  if (!dead) { g.fillStyle = `rgba(20,10,0,${0.26 / (1 + hgt / 120)})`; g.beginPath(); g.ellipse(PX, GY - base + 3, (40 + z * 18) / (1 + hgt / 260), 6, 0, 0, TAU); g.fill(); }
  const grounded = !dead && (p.on || p.ceil), inch = grounded && z < 0.5 ? Math.sin(p.ph) : 0;
  g.save(); g.translate(PX + inch * 8, GY - p.y - (p.ceil ? SLUGH : 0)); if (p.ceil) g.scale(1, -1);
  if (G.inv > 0 && !rush && Math.sin(G.t * 40) > 0) g.globalAlpha = 0.45;
  g.scale(0.62, 0.62);
  let sx = 1, sy = 1;
  if (dead) { g.translate(0, -30); g.rotate(p.rot); g.translate(0, 30); }
  else {
    if (!p.on && !p.ceil) { const s = clamp(p.vy / 2600, -0.3, 0.3); g.translate(0, -26); g.rotate(-s * 1.1 + (p.slam ? 0.5 : 0)); g.translate(0, 26); sx *= 1 - Math.abs(s) * 0.4; sy *= 1 + Math.abs(s) * 0.6; }
    else { sx *= 1 + inch * 0.19; sy *= 1 - inch * 0.2; g.rotate(-0.04 * (1 - z)); }
    sx *= 1 + z * 0.5 + c * Math.sin(G.t * 34) * 0.04; sy *= 1 - z * 0.5 + c * Math.cos(G.t * 31) * 0.035;
    sx *= clamp(1 - p.sq * 0.17, 0.6, 1.5); sy *= clamp(1 + p.sq * 0.26, 0.42, 1.7);
  }
  g.scale(sx, sy); g.translate(0, -27);
  const mood = dead || p.slam ? 'shock' : rush || G.pw.x2 > 0 || c >= 1 ? 'smug' : z > 0.5 ? 'shock' : 'happy';
  drawSlug(g, PAL[0], { t: G.t * (2 + G.speed / 90), mood, shadow: false, stalk: 1 - z * 0.6, eyeDx: p.ex, eyeDy: p.ey, eyeScale: dead ? null : [clamp(1 / sx, 0.75, 1.3), clamp(1 / sy, 0.75, 2.1)], under: (q) => drawHat(q, save.hat, G.t) });
  if (G.pw.magnet > 0) { g.save(); g.translate(-6, -92 + Math.sin(G.t * 5) * 4); g.scale(0.8, 0.8); drawPower(g, 'magnet', G.t); g.restore(); }
  if (G.pw.shield) { g.beginPath(); g.ellipse(-2, -8, 86, 62 + Math.sin(G.t * 6) * 2, 0, 0, TAU); g.fillStyle = 'rgba(105,219,124,.22)'; g.fill(); g.strokeStyle = 'rgba(211,249,216,.9)'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.ellipse(-36, -40, 16, 7, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); }
  g.restore();
  if (run && p.on && p.hold) {
    const cx = PX + 2, cy = GY - p.y - 52, r = 15, t = p.charge, perfect = t >= CHARGE && t < CHARGE + PERFECT, col = t < CHARGE ? '#ffd43b' : perfect ? '#69db7c' : '#ff922b', pulse = perfect ? 1 + Math.sin(G.t * 40) * 0.12 : 1;
    g.lineCap = 'round'; g.lineWidth = 11; g.strokeStyle = OUT; g.beginPath(); g.arc(cx, cy, r * pulse, 0, TAU); g.stroke();
    g.lineWidth = 6.5; g.strokeStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(cx, cy, r * pulse, 0, TAU); g.stroke();
    g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, r * pulse, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, c)); g.stroke();
    if (perfect) strokeText('!', cx, cy + 1, 17, '#fff');
  }
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
  for (const s of G.ctrail) { const a = s.a - cam, b = s.b - cam; if (b > a) { g.fillStyle = 'rgba(255,250,200,.6)'; g.fillRect(a, GY - s.y - 1, b - a, 5); } }
  // best-distance signpost
  if (save.bestDist > 20 && G.state !== 'title') { const sx = save.bestDist * M + PX - cam; if (sx > -80 && sx < VW + 80) { g.fillStyle = OUT; g.fillRect(sx - 3, GY - 130, 6, 130); g.beginPath(); g.moveTo(sx + 3, GY - 130); g.lineTo(sx + 78, GY - 112); g.lineTo(sx + 3, GY - 92); g.closePath(); g.fillStyle = '#e03131'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); strokeText('BEST', sx + 30, GY - 111, 15, '#fff'); } }
  for (const pass of [0, 1]) for (const e of G.ents) {
    if (e.dead) continue; const sx = e.x - cam; if (sx > VW + 120 || sx + e.w < -120) continue;
    const solid = e.k !== 'coin' && e.k !== 'pow'; if ((pass === 0) !== solid) continue;
    g.save();
    if (e.k === 'ledge') { g.translate(sx, GY - e.y); drawLedge(g, e.w, e.z, t, G.sticks < 2 && save.runs < 8); }
    else if (e.k === 'salt') { g.translate(sx, GY); drawSalt(g, e.w, t + e.x); }
    else if (e.k === 'worm') { g.translate(sx + 25, GY - e.y); drawWorm(g, t + e.x * 0.01, e.z, false); }
    else if (e.k === 'fly') { g.translate(sx + 25, GY - e.y - 12); drawWorm(g, t + e.x * 0.01, e.z, true); }
    else if (e.k === 'coin') drawCoin(g, sx, GY - e.y, 13, t * 5 + e.x * 0.02);
    else if (e.k === 'pow') { g.translate(sx, GY - e.y + Math.sin(t * 4) * 5); drawPower(g, e.kind, t); }
    else { g.translate(sx + e.w / 2, GY); drawObstacle(g, e.k, e.z, e.v, t); }
    g.restore();
  }
  for (const d of G.decals) { const x = d.x - cam, y = GY - d.y; g.fillStyle = 'rgba(255,246,170,.78)'; g.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI * (d.floor ? -1 : 1), rr = d.r * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.3 + d.s))); g.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.5); } g.closePath(); g.fill(); if (!d.floor) for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x - d.r * 0.6 + i * d.r * 0.6, y + 6 + ((i * 7 + d.s * 3) % 9), 2.6, 5 + ((i * 5 + d.s * 2) % 6), 0, 0, TAU); g.fill(); } }
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
const R3 = createRun3D({ g, save, sfx, bot: BOT, glCanvas: $('gl'), noGL: new URLSearchParams(location.search).has('flat'), tile, banner, bump, setHot, setTempo, drawPills, view: () => ({ W, H, DPR }), onOver: (res) => showOver(res) });
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
  if (is3) { reset('title'); R3.start(); active3 = true; } else { active3 = false; R3.hide(); reset('run'); }
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
function toTitle() { active3 = false; R3.hide(); overId++; reset('title'); show('title'); refreshTitle(); setHot(false); }
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
const touches = new Set();
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (active3) { if (!paused) R3.pointer('down', e); return; }
  if (G.state !== 'run' || paused) return;
  touches.add(e.pointerId); press();
});
cv.addEventListener('pointermove', (e) => { if (active3 && !paused) R3.pointer('move', e); });
const up = (e) => { if (active3) { R3.pointer(e.type === 'pointerup' && !paused ? 'up' : 'cancel', e); return; } if (!touches.delete(e.pointerId)) return; if (!touches.size) release(); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
const HOLD_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'];
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (active3 && R3.running()) { e.preventDefault(); if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused); else if (!paused) R3.key(e.code); return; }
  if (HOLD_KEYS.includes(e.code)) { e.preventDefault(); if (G.state === 'run') press(); else if (e.code === 'Space' && (!$('scr-title').classList.contains('hidden') || !$('scr-over').classList.contains('hidden'))) startRun(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused);
});
window.addEventListener('keyup', (e) => { if (!active3 && HOLD_KEYS.includes(e.code)) release(); });
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
window.__run = { R3, setMode(m) { save.mode = m; refreshTitle(); }, get G() { return G; }, save, ZLEN, startRun, warp(zi, frac = 0.05) { G.camX = (zi + frac) * ZLEN; G.nextX = G.camX + VW + 300; G.ents = []; G.trail = []; G.ctrail = []; G.decals = []; unstick(0); }, press, release, put(name) { const x = G.camX + VW + 60, v = baseSpeed(x); G.ents = G.ents.filter((e) => e.x < G.camX + VW); const len = PAT[name](x, v, 1, 1, v, 1); G.nextX = x + (len + 0.5) * v; },
  sim(sec) { const t0 = G.camX; for (let i = 0; i < sec * 60 && G.state === 'run'; i++) step(1 / 60); return { state: G.state, m: Math.round(G.camX / M), cause: G.cause, last: G.last, score: score(), coins: G.coins, stomps: G.stomps, zi: G.zi }; } };
