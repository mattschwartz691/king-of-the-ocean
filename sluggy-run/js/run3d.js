// Sluggy Run — 3D chase mode: behind-the-slug, three lanes, swipe to dodge.
import { drawCoin, PAL, OUT } from '../../sluggy/js/art.js';
import { createGL } from './gl3d.js';
import { setZone, restartSong } from './audio.js';
import { ZONES, TW, TH, drawObstacle, drawPower, drawHat, POWERS, drawProp, drawWormFront } from './zones.js';

const TAU = Math.PI * 2, rnd = Math.random, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NZ = ZONES.length, LANE = 80, ZP = 220, ZFAR = 2600, ZLEN = 15000, M = 40, BAND = 130, ROAD = 132;
const GRAV = 1900, JV = 570;
const hash = (n) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
// ground colours per zone: road stripes, roadside stripes, lane line, kerb
const GND = [
  { road: ['#8a5a34', '#80522f'], side: ['#3f8a3a', '#37803a'], line: 'rgba(255,240,200,.28)', edge: '#5fb347' },
  { road: ['#4c4f5e', '#454857'], side: ['#c9ccd6', '#bdc1cc'], line: '#ffd43b', edge: '#eceff4' },
  { road: ['#5673ad', '#4e6aa2'], side: ['#d9ccb0', '#cfc1a3'], line: 'rgba(255,255,255,.3)', edge: '#8fa3c4' },
  { road: ['#d9a066', '#cd9357'], side: ['#3f5fb0', '#3956a4'], line: '#a8703c', edge: '#7a4a24' },
  { road: ['#1b2450', '#171f46'], side: ['#0b1026', '#0e1430'], line: '#3df5a0', edge: '#3df5a0' },
  { road: ['#7a4c26', '#6f4421'], side: ['#3a2212', '#321d0e'], line: 'rgba(255,220,170,.25)', edge: '#9a6a3a' },
  { road: ['#9a9fb6', '#9095ad'], side: ['#6d728d', '#656a85'], line: 'rgba(255,255,255,.4)', edge: '#c9cddd' },
];
const zmod = (z) => ((Math.floor(z / ZLEN) % NZ) + NZ) % NZ;
const speedAt = (z) => Math.min(1060, 540 + z * 0.0042);
const laneX = (l) => (l - 1) * LANE;

// Sluggy seen from behind (origin on the ground under him)
function drawSlugBack(g, o) {
  const pal = PAL[0], t = o.t, w = Math.sin(t * 3) * 1.5; g.lineJoin = 'round'; g.lineCap = 'round';
  // necktie flapping over his shoulder
  g.beginPath(); g.moveTo(20, -36); g.quadraticCurveTo(38, -44 + Math.sin(t * 5) * 6, 54, -34 + Math.sin(t * 5 + 1) * 8); g.lineTo(50, -22 + Math.sin(t * 5 + 1) * 8); g.quadraticCurveTo(36, -30 + Math.sin(t * 5) * 5, 20, -26); g.closePath(); g.fillStyle = '#e03131'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
  // body: tail toward the camera, head away
  g.beginPath(); g.moveTo(w, 24); g.bezierCurveTo(-16, 20, -37, 8, -35, -14); g.bezierCurveTo(-34, -38, -24, -58, 0, -60); g.bezierCurveTo(24, -58, 34, -38, 35, -14); g.bezierCurveTo(37, 8, 16, 20, w, 24); g.closePath();
  const gr = g.createLinearGradient(0, -60, 0, 24); gr.addColorStop(0, pal.light); gr.addColorStop(0.4, pal.main); gr.addColorStop(1, pal.dark);
  g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  g.globalAlpha *= 0.5; g.fillStyle = pal.dark; g.beginPath(); g.ellipse(0, -30, 21, 15, 0, 0, TAU); g.fill(); g.globalAlpha /= 0.5;
  g.globalAlpha *= 0.45; g.fillStyle = pal.deep; for (const [x, y, r] of [[-16, 0, 4], [12, 6, 3.4], [-4, 12, 2.6], [20, -8, 2.6], [-22, -14, 2.4]]) { g.beginPath(); g.ellipse(x, y, r * 1.2, r, 0, 0, TAU); g.fill(); } g.globalAlpha /= 0.45;
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-22, -40); g.quadraticCurveTo(-14, -52, -2, -54); g.stroke();
  if (o.hat) { g.save(); g.translate(-45, -26); drawHat(g, o.hat, t); g.restore(); }
  // eye stalks
  for (const s of [-1, 1]) {
    const ex = s * 17 + w * 1.2, ey = -88 + Math.cos(t * 3 + s) * 1.5 + (o.shock ? -5 : 0);
    g.beginPath(); g.moveTo(s * 11, -54); g.quadraticCurveTo(s * 12, -72, ex, ey); g.strokeStyle = OUT; g.lineWidth = 10; g.stroke(); g.strokeStyle = pal.main; g.lineWidth = 5.5; g.stroke();
    g.beginPath(); g.arc(ex, ey, 9.5, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    if (o.smug) { g.fillStyle = '#2b8a3e'; g.font = '900 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', ex, ey); }
    else { g.beginPath(); g.arc(ex + o.look * 3, ey - 4, o.shock ? 2.6 : 4, 0, TAU); g.fillStyle = OUT; g.fill(); }
  }
}

export function createRun3D(env) {
  const { g, save, sfx } = env, $ = (id) => document.getElementById(id);
  let W = 0, H = 0, DPR = 1, f = 300, hor = 200, camH = 150, R = null, shownS = -1, shownD = -1, GL;
  function layout() { ({ W, H, DPR } = env.view()); f = Math.min(W * 0.7, H * 0.62); hor = H * (W > H ? 0.28 : 0.33); camH = ((H * 0.77 - hor) * ZP) / f; }
  function reset() {
    if (GL === undefined) { try { GL = env.noGL ? null : createGL(env.glCanvas, { tile: env.tile, ZLEN }); } catch (err) { console.warn('WebGL unavailable, using flat renderer', err); GL = null; } }
    if (GL) { GL.reset(); GL.show(true); }
    layout(); shownS = shownD = -1; setZone(0); restartSong();
    R = { state: 'run', t: 0, z: 0, speed: 0, camX: 0, bend: 0, bonus: 0, coins: 0, stomps: 0, combo: 0, zi: 0, prevZ: -1, fade: 1, shake: 0, inv: 0, deadT: 0, done: false, cause: '',
      p: { lane: 1, x: 0, y: 0, vy: 0, on: true, slide: 0, lean: 0, rot: 0, sq: 0, buf: 0 }, pw: { magnet: 0, rush: 0, x2: 0, shield: false },
      ents: [], parts: [], floats: [], trail: [], nextZ: 1700, nextPow: 8000 + rnd() * 3000, free: 1, mile: 1, record: false };
  }
  const score = () => Math.floor(R.z / M) + R.bonus;
  const moonNow = () => R.zi % NZ === 6;
  // world -> screen. dz = distance in front of the camera
  function P(x, y, dz) { if (GL) return GL.project(x, y, dz, ZP); const k = f / dz, u = dz / ZFAR; return [W / 2 + (x - R.camX) * k + R.bend * u * u * W * 0.85, hor + (camH - y) * k, k]; }

  // ---------------------------------------------------------------- generator
  function add(k, lane, z, o) { const e = { k, lane, x: laneX(lane), y: 0, z, v: (rnd() * 2) | 0, zi: zmod(z), dead: false, ...o }; R.ents.push(e); return e; }
  function coins(lane, z, n, gap = 70, y = 26) { for (let i = 0; i < n; i++) add('coin', lane, z + i * gap, { y }); }
  function arc(lane, z, v) { const span = v * 0.34; for (let i = 0; i < 5; i++) { const u = i / 4 * 2 - 1; add('coin', lane, z + u * span, { y: 30 + 66 * (1 - u * u) }); } }
  const KINDS = ['low', 'high', 'wall', 'salt', 'worm'];
  function row(z, d, v) {
    const r = rnd(), pick = (a) => a[(rnd() * a.length) | 0];
    // keep the safe lane within one step of the last one early on, anywhere later
    const free = clamp(R.free + ((rnd() * 3) | 0) - 1, 0, 2); R.free = free;
    if (r < 0.16) { coins(pick([0, 1, 2]), z, 6); return; }
    if (r < 0.5 - d * 0.2) { // one thing in the way
      const lane = pick([0, 1, 2]), k = pick(d < 0.12 ? ['low', 'low', 'salt', 'high'] : KINDS); add(k, lane, z);
      if (k === 'low' || k === 'salt') arc(lane, z, v); else if (k === 'high') coins(lane, z - 140, 5, 70, 14); else coins(free === lane ? (lane + 1) % 3 : free, z - 140, 5);
      return;
    }
    if (r < 0.74) { // two lanes blocked, one open
      for (let l = 0; l < 3; l++) if (l !== free) add(rnd() < 0.65 ? 'wall' : pick(['low', 'high', 'salt']), l, z);
      coins(free, z - 150, 5); return;
    }
    if (r < 0.88 && d > 0.1) { // worms marching at you
      const n = rnd() < 0.5 ? 1 : 2, ls = [0, 1, 2].sort(() => rnd() - 0.5).slice(0, n);
      for (const l of ls) for (let i = 0; i < (rnd() < 0.5 ? 2 : 1); i++) add('worm', l, z + 170 + i * 210);
      return 400; // worms lunge when you get close, so leave extra room around them
    }
    // full row: every lane needs an action, at most two walls
    const acts = ['low', 'high', 'salt']; let walls = 0;
    for (let l = 0; l < 3; l++) { let k = rnd() < 0.4 && walls < 2 && l !== free ? 'wall' : pick(acts); if (k === 'wall') walls++; add(k, l, z); if (k === 'low' && rnd() < 0.5) arc(l, z, v); }
  }
  function gen() {
    while (R.nextZ < R.z + ZFAR + 400) {
      const z = R.nextZ, v = speedAt(z), d = Math.min(1, z / (ZLEN * 3.2));
      if (z > R.nextPow) { const ks = Object.keys(POWERS).filter((k) => !(k === 'shield' && R.pw.shield)); add('pow', (rnd() * 3) | 0, z, { y: 30, kind: ks[(rnd() * ks.length) | 0] }); R.nextPow = z + v * (11 + rnd() * 8); }
      else R.nextZ += row(z, d, v) || 0;
      R.nextZ += v * lerp(0.95, 0.72, d) * (zmod(z) === 6 ? 1.25 : 1);
    }
  }

  // ---------------------------------------------------------------- fx
  function puff(sx, sy, n, c, sp = 200, r = 5, life = 0.5) { for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = sp * (0.4 + rnd() * 0.8); R.parts.push({ x: sx, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.5, life: 0, max: life * (0.6 + rnd() * 0.7), r: r * (0.6 + rnd() * 0.8), c: Array.isArray(c) ? c[(rnd() * c.length) | 0] : c }); } }
  function float(txt, c = '#fff', s = 24, dy = 0) { const [x, y] = P(R.p.x, R.p.y + 110, ZP); R.floats.push({ x, y: y - dy, txt, c, s, life: 0 }); }
  const here = (e) => P(e.x, e.y + 26, Math.max(60, e.z - R.z + ZP));

  // ---------------------------------------------------------------- actions
  function jump() {
    if (R.state !== 'run') return; const p = R.p;
    if (p.on) { p.vy = JV * (moonNow() ? 0.85 : 1); p.on = false; p.slide = 0; p.sq = 1; sfx.jump(); } else p.buf = 0.15;
  }
  function slide() { if (R.state !== 'run') return; const p = R.p; if (!p.on) p.vy = Math.min(p.vy, -900); p.slide = 0.62; sfx.slide(); }
  function move(d) { if (R.state !== 'run') return; const p = R.p, l = clamp(p.lane + d, 0, 2); if (l !== p.lane) { p.lane = l; sfx.swish(d); } }
  function die(e) { R.state = 'dead'; R.cause = e.k === 'wall' ? 'tall' : e.k; R.deadT = 0; R.p.vy = 520; R.p.on = false; R.shake = 0.5; sfx.hit(); env.setHot(false); const [x, y] = P(R.p.x, R.p.y + 30, ZP); puff(x, y, 18, ['#fff', '#ffd83d', '#ff6b6b'], 340, 6, 0.6); }
  function smash(e, pts) { e.dead = true; const [x, y] = here(e); puff(x, y, 14, e.k === 'worm' ? [PAL[2].main, PAL[2].light, '#fff'] : ['#c98d4f', '#fff', '#ffd43b', '#868e96'], 380, 6, 0.6); if (pts) { R.bonus += pts; float('+' + pts, '#ffe45c', 22); } }

  // ---------------------------------------------------------------- simulation
  function step(dt) {
    R.t += dt; const p = R.p;
    for (const q of R.parts) { q.life += dt; q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    R.parts = R.parts.filter((q) => q.life < q.max);
    for (const q of R.floats) { q.life += dt; q.y -= 70 * dt; } R.floats = R.floats.filter((q) => q.life < 1);
    R.shake = Math.max(0, R.shake - dt); R.fade = Math.min(1, R.fade + dt / 1.2); p.sq *= Math.pow(0.002, dt);
    if (R.state === 'dead') {
      R.deadT += dt; R.speed *= Math.pow(0.02, dt); R.z += R.speed * dt; p.vy -= GRAV * dt; p.y = Math.max(0, p.y + p.vy * dt); p.rot += dt * 9 * (p.y > 0 ? 1 : 0);
      if (R.deadT > 1.2 && !R.done) { R.done = true; const lap = Math.floor(R.zi / NZ); env.onOver({ mode: '3d', sc: score(), dist: Math.floor(R.z / M), coins: R.coins, stomps: R.stomps, cause: R.cause, zone: ZONES[R.zi % NZ].name, lap }); }
      return;
    }
    const rush = R.pw.rush > 0; R.speed = speedAt(R.z) * (rush ? 1.4 : 1); R.z += R.speed * dt;
    const zi = Math.floor(R.z / ZLEN);
    if (zi !== R.zi) { R.prevZ = R.zi % NZ; R.zi = zi; R.fade = 0; const z = ZONES[zi % NZ]; sfx.zone(); env.banner(z.name, zi % NZ === 0 ? `Lap ${Math.floor(zi / NZ) + 1} — faster!` : z.sub); R.bonus += 50 * zi; float('ZONE BONUS +' + 50 * zi, '#69db7c', 22, 40); env.setTempo(172 + Math.min(18, zi * 2)); setZone(zi % NZ); }
    if (score() >= R.mile * 500) { float(R.mile * 500 + '!', '#fff', 30, 70); R.mile++; env.bump($('score')); }
    const best = save.bestDist3 || 0; if (!R.record && best > 20 && R.z / M > best) { R.record = true; float('NEW RECORD!', '#ff6b6b', 30, 90); puff(W / 2, H * 0.4, 30, ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc', '#fff'], 420, 6, 1.1); sfx.best(); }
    gen();
    // player
    const tx = laneX(p.lane), dx = tx - p.x; p.x += dx * Math.min(1, dt * 15); p.lean = lerp(p.lean, clamp(dx / LANE, -1, 1) * 0.4, Math.min(1, dt * 18));
    p.buf -= dt; p.slide = Math.max(0, p.slide - dt);
    const prevY = p.y;
    if (!p.on) { p.vy -= GRAV * (moonNow() ? 0.6 : 1) * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.on = true; p.sq = -1; R.combo = 0; sfx.land(); if (p.buf > 0) { p.buf = 0; jump(); } } }
    const sliding = p.on && p.slide > 0;
    R.camX = lerp(R.camX, p.x * 0.5, Math.min(1, dt * 8));
    R.bend = Math.sin(R.z * 0.00042) * 0.34 + Math.sin(R.z * 0.00019 + 1.3) * 0.26;
    if (p.on) R.trail.push({ x: p.x, z: R.z }); else R.trail.push(null); while (R.trail.length > 40) R.trail.shift();
    // entities
    for (const e of R.ents) {
      if (e.dead) continue; if (e.k === 'worm' && e.z - R.z < 700) e.z -= 150 * dt;
      const dz = e.z - R.z; if (dz < -ZP) { e.dead = true; continue; }
      if (e.k === 'coin' && (R.pw.magnet > 0 || rush) && dz < 520 && dz > -40) { const s = Math.min(1, dt * 9); e.x = lerp(e.x, p.x, s); e.y = lerp(e.y, p.y + 26, s); e.z -= 420 * dt; }
      if (Math.abs(dz) > (e.k === 'coin' || e.k === 'pow' ? 46 : 30) || Math.abs(e.x - p.x) > 46) continue;
      if (e.k === 'coin' || e.k === 'pow') {
        if (Math.abs(e.y - (p.y + 26)) > 50) continue; e.dead = true; const [sx, sy] = here(e);
        if (e.k === 'pow') { sfx.power(); float(POWERS[e.kind].name + '!', POWERS[e.kind].col, 26, 30); puff(sx, sy, 16, [POWERS[e.kind].col, '#fff'], 300, 5, 0.6); if (e.kind === 'shield') R.pw.shield = true; else if (e.kind === 'magnet') R.pw.magnet = 9; else if (e.kind === 'x2') R.pw.x2 = 10; else { R.pw.rush = 4.5; env.setHot(true); } }
        else { const n = R.pw.x2 > 0 ? 2 : 1; R.coins += n; R.bonus += 5 * n; sfx.coin(); puff(sx, sy, 4, ['#ffd43b', '#fff6b8'], 140, 3.5, 0.3); $('coins').textContent = R.coins; env.bump($('coinBox')); }
        continue;
      }
      if (rush) { smash(e, 15); sfx.smash(); R.shake = Math.max(R.shake, 0.14); continue; }
      let hit;
      if (e.k === 'low') hit = p.y < 46; else if (e.k === 'salt') hit = p.y < 8; else if (e.k === 'high') hit = !sliding; else if (e.k === 'wall') hit = true;
      else if (p.y > 16 && p.vy < 0) { // stomp!
        e.dead = true; R.combo++; R.stomps++; const pts = 20 * R.combo; R.bonus += pts; p.vy = JV * 0.82; p.sq = 1; sfx.stomp(R.combo); R.shake = Math.max(R.shake, 0.12);
        float(R.combo > 1 ? `+${pts}  x${R.combo} COMBO!` : '+' + pts, R.combo > 1 ? '#ff8fab' : '#fff', 22 + Math.min(12, R.combo * 3)); const [sx, sy] = here(e); puff(sx, sy, 12, [PAL[2].main, PAL[2].light, '#fff'], 300, 6, 0.5); env.bump($('score')); continue;
      } else hit = p.y < 34;
      if (!hit || R.inv > 0) continue;
      if (R.pw.shield) { R.pw.shield = false; R.inv = 1.3; smash(e, 0); sfx.shieldPop(); R.shake = 0.28; float('Shield popped!', '#69db7c', 22); }
      else { die(e); return; }
    }
    if (R.ents.length > 300) R.ents = R.ents.filter((e) => !e.dead);
    R.inv = Math.max(0, R.inv - dt); R.pw.magnet = Math.max(0, R.pw.magnet - dt); R.pw.x2 = Math.max(0, R.pw.x2 - dt);
    if (rush) { R.pw.rush -= dt; if (R.pw.rush <= 0) { R.pw.rush = 0; R.inv = 1.4; env.setHot(false); } }
    if (env.bot) bot();
  }
  // test autopilot: dodge to a clear lane, otherwise jump or slide
  function bot() {
    const p = R.p, tOf = (e) => (e.z - R.z) / (R.speed + (e.k === 'worm' ? 150 : 0));
    const obs = R.ents.filter((e) => !e.dead && e.k !== 'coin' && e.k !== 'pow' && tOf(e) > -0.06 && tOf(e) < 1.0).sort((a, c) => tOf(a) - tOf(c));
    if (obs.length) { // steer for the nearest row
      const t0 = tOf(obs[0]), rowE = obs.filter((e) => tOf(e) < t0 + 0.12); let best = p.lane, bc = 1e9;
      for (const l of [0, 1, 2]) { const e = rowE.find((q) => q.lane === l), c = (e ? (e.k === 'wall' ? 1000 : 0.6) : 0) + Math.abs(l - p.lane); if (c < bc) { bc = c; best = l; } }
      p.lane = best;
    }
    for (const e of obs) { if (Math.abs(e.x - p.x) > 50) continue; const tt = tOf(e); if (e.k === 'high') { if (tt < 0.3) { if (!p.on) p.vy = Math.min(p.vy, -900); p.slide = 0.3; } } else if (e.k !== 'wall' && p.on && tt < (moonNow() ? 0.3 : 0.2)) { p.slide = 0; jump(); } }
  }

  // ---------------------------------------------------------------- render
  function quad(a, b, c, d, col) { g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }
  function backdrop(zi, a) {
    const z = ZONES[zi]; g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 0, 0, hor + 4); gr.addColorStop(0, z.sky[0]); gr.addColorStop(0.6, z.sky[1]); gr.addColorStop(1, z.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, hor + 4);
    if (zi === 3) { g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(W * 0.5 - R.bend * W * 0.5, hor - 40, Math.min(W, H) * 0.14, 0, TAU); g.fill(); }
    if (zi === 6) { g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.globalAlpha = a * (0.4 + 0.5 * Math.sin(R.t * 1.5 + i * 2.3)); g.fillRect((i * 197.3) % W, (i * 113.7) % hor, 2, 2); } g.globalAlpha = a; const x = W * 0.7 - R.bend * W * 0.4, y = hor * 0.4; g.fillStyle = '#3b8eea'; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill(); g.fillStyle = '#4fbf6a'; g.beginPath(); g.ellipse(x - 10, y - 8, 14, 10, 0, 0, TAU); g.fill(); }
    for (const [li, hh, par] of [[0, 0.95, 0.5], [1, 1.25, 0.8]]) {
      const c = env.tile(zi, li), bh = hor * hh, bw = (bh * TW) / TH; let ox = -((((R.camX * 0.06 + R.bend * W * par + li * 300) % bw) + bw) % bw);
      for (let x = ox; x < W; x += bw) g.drawImage(c, x, hor - bh, bw + 1, bh + 1);
    }
    g.globalAlpha = 1;
  }
  function ground() {
    const camZ = R.z - ZP, i0 = Math.floor((camZ + 62) / BAND), i1 = Math.floor((camZ + ZFAR) / BAND), X = 2600;
    for (let i = i1; i >= i0; i--) {
      const za = Math.max(62, i * BAND - camZ), zb = Math.min(ZFAR, (i + 1) * BAND - camZ); if (zb <= za) continue;
      const G3 = GND[zmod(i * BAND)], alt = ((i % 2) + 2) % 2;
      const a0 = P(-X, 0, za), a1 = P(X, 0, za), b0 = P(-X, 0, zb), b1 = P(X, 0, zb);
      quad(a0, a1, [b1[0], b1[1] - 0.6], [b0[0], b0[1] - 0.6], G3.side[alt]);
      const r0 = P(-ROAD, 0, za), r1 = P(ROAD, 0, za), s0 = P(-ROAD, 0, zb), s1 = P(ROAD, 0, zb);
      quad(r0, r1, [s1[0], s1[1] - 0.6], [s0[0], s0[1] - 0.6], G3.road[alt]);
      const ew = 9; quad(r0, P(-ROAD + ew, 0, za), P(-ROAD + ew, 0, zb), s0, G3.edge); quad(P(ROAD - ew, 0, za), r1, s1, P(ROAD - ew, 0, zb), G3.edge);
      if (alt) for (const lx of [-LANE / 2, LANE / 2]) quad(P(lx - 2.5, 0, za), P(lx + 2.5, 0, za), P(lx + 2.5, 0, zb), P(lx - 2.5, 0, zb), G3.line);
    }
    // haze toward the horizon
    const hz = ZONES[R.zi % NZ].haze, gr = g.createLinearGradient(0, hor, 0, hor + H * 0.16); gr.addColorStop(0, hz); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.85; g.fillStyle = gr; g.fillRect(0, hor - 1, W, H * 0.16 + 1); g.globalAlpha = 1;
  }
  function shadow(x, dz, rx, a = 0.28) { const [sx, sy, k] = P(x, 0, dz); g.fillStyle = `rgba(10,5,0,${a})`; g.beginPath(); g.ellipse(sx, sy, rx * k, rx * k * 0.3, 0, 0, TAU); g.fill(); }
  function drawEnt(e, dz) {
    const [sx, sy, k] = P(e.x, e.y, dz), t = R.t;
    if (e.k === 'coin') { shadow(e.x, dz, 10, 0.15); drawCoin(g, sx, sy - 13 * k, 13 * k, t * 5 + e.z * 0.02); return; }
    g.save(); g.translate(sx, sy);
    if (e.k === 'pow') { g.translate(0, (-30 + Math.sin(t * 4) * 4) * k * 0.3); g.scale(k * 1.15, k * 1.15); g.translate(0, -4); drawPower(g, e.kind, t); }
    else if (e.k === 'salt') {
      g.scale(k, k); g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 37, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -1, 34, 10, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-24, -2); g.quadraticCurveTo(-8, -22, 4, -8); g.quadraticCurveTo(14, -18, 24, -2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
      for (let i = 0; i < 3; i++) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + i * 2 + e.z); g.fillStyle = '#74c0fc'; g.fillRect(-22 + i * 20, -24 - (i % 2) * 8, 4, 4); } g.globalAlpha = 1;
      g.translate(26, -10); g.rotate(-1.0); g.fillStyle = '#e7f5ff'; g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.rect(-8, -12, 16, 22); g.fill(); g.stroke(); g.fillStyle = '#adb5bd'; g.beginPath(); g.rect(-9, -20, 18, 9); g.fill(); g.stroke();
    }
    else if (e.k === 'worm') { g.scale(k * 1.35, k * 1.35); drawWormFront(g, t + e.z * 0.01, e.zi); }
    else { const s = e.k === 'low' ? 1.25 : e.k === 'high' ? 0.98 : 1.12; g.scale(k * s, k * s); drawObstacle(g, e.k === 'wall' ? 'tall' : e.k, e.zi, e.v, t); }
    g.restore();
  }
  function drawPlayer() {
    const p = R.p, dead = R.state === 'dead', [sx, sy, k] = P(p.x, p.y, ZP);
    if (!dead) shadow(p.x, ZP, 34 / (1 + p.y / 200));
    g.save(); g.translate(sx, sy); if (R.inv > 0 && R.pw.rush <= 0 && Math.sin(R.t * 40) > 0) g.globalAlpha = 0.45;
    g.scale(k * 0.86, k * 0.86);
    if (dead) { g.translate(0, -30); g.rotate(p.rot); g.translate(0, 30); }
    else { g.rotate(p.lean); if (p.on && p.slide > 0) g.scale(1.25, 0.5); else if (!p.on) { const s = clamp(p.vy / 2200, -0.2, 0.25); g.scale(1 - Math.abs(s) * 0.4, 1 + Math.abs(s) * 0.6); } else g.scale(1 - p.sq * 0.12, 1 + p.sq * 0.14 + Math.sin(R.t * 16) * 0.025); }
    drawSlugBack(g, { t: R.t * 3, hat: save.hat, look: clamp(p.lean * 3, -1, 1), shock: dead, smug: R.pw.rush > 0 || R.pw.x2 > 0 });
    if (R.pw.magnet > 0) { g.save(); g.translate(0, -122 + Math.sin(R.t * 5) * 4); g.scale(0.8, 0.8); drawPower(g, 'magnet', R.t); g.restore(); }
    if (R.pw.shield) { g.beginPath(); g.ellipse(0, -30, 58, 74, 0, 0, TAU); g.fillStyle = 'rgba(105,219,124,.2)'; g.fill(); g.strokeStyle = 'rgba(211,249,216,.9)'; g.lineWidth = 4; g.stroke(); }
    g.restore();
  }
  function draw() {
    if (!R) return; ({ W, H, DPR } = env.view()); if (W !== draw.w || H !== draw.h) { draw.w = W; draw.h = H; layout(); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (GL) { GL.resize(W, H, DPR); GL.render(R, ZP, save.hat); g.clearRect(0, 0, W, H); } else drawWorld2D();
    drawOverlay();
  }
  function drawWorld2D() {
    if (R.shake > 0) g.translate((rnd() - 0.5) * R.shake * 26, (rnd() - 0.5) * R.shake * 26);
    const zi = R.zi % NZ; if (R.fade < 1 && R.prevZ >= 0) { backdrop(R.prevZ, 1); backdrop(zi, R.fade); } else backdrop(zi, 1);
    ground();
    const camZ = R.z - ZP, items = [];
    // slime trail
    g.fillStyle = 'rgba(255,255,255,.26)';
    for (let i = 1; i < R.trail.length; i++) { const a = R.trail[i - 1], b = R.trail[i]; if (!a || !b) continue; const da = a.z - camZ, db = b.z - camZ; if (da < 64) continue; const w = 9; quad(P(a.x - w, 0, da), P(a.x + w, 0, da), P(b.x + w, 0, db), P(b.x - w, 0, db), g.fillStyle); }
    // roadside scenery
    const j0 = Math.floor((camZ + 70) / 260), j1 = Math.floor((camZ + ZFAR) / 260);
    for (let j = j0; j <= j1; j++) for (let s = 0; s < 4; s++) {
      const h1 = hash(j * 4 + s), h2 = hash(j * 4 + s + 0.5), side = s % 2 ? 1 : -1, far = s > 1, wz = j * 260 + h2 * 150;
      items.push({ dz: wz - camZ, prop: true, x: side * (ROAD + (far ? 330 + h1 * 260 : 85 + h2 * 110)), v: h1, zi: zmod(wz), seed: j * 4 + s + 1 });
    }
    for (const e of R.ents) { if (e.dead) continue; const dz = e.z - camZ; if (dz > 62 && dz < ZFAR) items.push({ dz, e }); }
    items.push({ dz: ZP - 1, me: true });
    items.sort((a, b) => b.dz - a.dz);
    for (const it of items) {
      if (it.dz < 62) continue; g.globalAlpha = clamp((ZFAR - it.dz) / 450, 0, 1) * clamp((it.dz - (it.prop ? 70 : ZP - 130)) / 80, 0, 1); // fade in from the fog, fade out once passed
      if (g.globalAlpha <= 0.01) continue;
      if (it.me) { g.globalAlpha = 1; drawPlayer(); }
      else if (it.prop) { const [sx, sy, k] = P(it.x, 0, it.dz); if (sx < -500 * k - 50 || sx > W + 500 * k + 50) continue; g.save(); g.translate(sx, sy); g.scale(k, k); drawProp(g, it.zi, it.v, it.seed); g.restore(); }
      else { if (it.e.k !== 'coin' && it.e.k !== 'salt') shadow(it.e.x, it.dz, 30, 0.2); drawEnt(it.e, it.dz); }
    }
    g.globalAlpha = 1;
  }
  function drawOverlay() {
    const zi = R.zi % NZ;
    for (const q of R.parts) { g.globalAlpha = 1 - q.life / q.max; g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    if (R.pw.rush > 0 || R.speed > 1000) { // speed streaks from the vanishing point
      g.strokeStyle = `rgba(255,255,255,${R.pw.rush > 0 ? 0.5 : 0.18})`; g.lineWidth = 2.5; const cx = W / 2 + R.bend * W * 0.3, hor = H * 0.36;
      for (let i = 0; i < 16; i++) { const a = hash(i) * TAU, u = (R.t * 2.2 + hash(i + 9)) % 1, r0 = (0.15 + u * 0.9) * Math.max(W, H) * 0.7; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, hor + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r0 * 1.22, hor + Math.sin(a) * r0 * 1.22); g.stroke(); }
    }
    for (const q of R.floats) { g.globalAlpha = q.life > 0.7 ? (1 - q.life) / 0.3 : 1; const pop = q.life < 0.12 ? 0.6 + (q.life / 0.12) * 0.5 : 1.1 - Math.min(0.1, (q.life - 0.12) * 0.5), px = q.s * pop; g.font = `900 ${px}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = px * 0.24; g.strokeStyle = OUT; const x = clamp(q.x, 90, W - 90); g.strokeText(q.txt, x, q.y); g.fillStyle = q.c; g.fillText(q.txt, x, q.y); }
    g.globalAlpha = 1;
    if (R.state === 'run') { env.drawPills(R.pw); const s = score(); if (s !== shownS) { shownS = s; $('score').textContent = s; } const d = Math.floor(R.z / M); if (d !== shownD) { shownD = d; $('dist').textContent = d + ' m · ' + ZONES[zi].name; } }
  }

  // ---------------------------------------------------------------- input: swipe (or arrow keys)
  const touches = new Map();
  function pointer(type, e) {
    if (type === 'down') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY, used: false }); return; }
    const t = touches.get(e.pointerId); if (!t) return;
    if (type === 'move') {
      const dx = e.clientX - t.x, dy = e.clientY - t.y, th = 22; if (Math.abs(dx) < th && Math.abs(dy) < th) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
      t.x = e.clientX; t.y = e.clientY; t.used = true; // re-arm so one long drag can chain moves
    } else { touches.delete(e.pointerId); if (!t.used && type === 'up') jump(); }
  }
  function key(code) { if (code === 'ArrowLeft' || code === 'KeyA') move(-1); else if (code === 'ArrowRight' || code === 'KeyD') move(1); else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') jump(); else if (code === 'ArrowDown' || code === 'KeyS') slide(); }
  return { start: reset, step, draw, pointer, key, hide() { if (GL) GL.show(false); }, get gl() { return GL; }, running: () => !!R && R.state === 'run', get R() { return R; }, sim(sec) { for (let i = 0; i < sec * 60 && R.state === 'run'; i++) step(1 / 60); return { state: R.state, m: Math.round(R.z / M), cause: R.cause, score: score(), coins: R.coins, stomps: R.stomps, zi: R.zi }; } };
}
