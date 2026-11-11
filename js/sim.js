// King of the Ocean — game simulation (pure logic, no DOM).
// Host-authoritative: the host (or solo player) runs step(); clients only render snapshots.

export const C = {
  W: 2200, H: 1400,
  TICK: 1 / 60,
  WIN: 45,            // seconds of reign needed to win
  PR: 26,             // player body radius
  SPEED: 255, KING_MUL: 0.9,
  DASH_SPEED: 720, DASH_TIME: 0.3, DASH_MAX: 3, DASH_REGEN: 2.3,
  SAW0: 28, SAW1: 96, // saw segment along facing direction
  STUN: 1.1, INVULN: 2.3,
  FRENZY_NEED: 6, FRENZY_TIME: 6,
  FISH: 38, JELLY: 7,
  SPEED_T: 6, SHIELD_T: 14, ZAP_T: 6,
  COUNTDOWN: 3.5,
};

export const COLORS = [
  { name: 'Coral', main: '#ff5d62', dark: '#b3263a', light: '#ffb0a8' },
  { name: 'Sunny', main: '#ffc83a', dark: '#b97a08', light: '#ffeaa0' },
  { name: 'Mint', main: '#2fe3a6', dark: '#0e8f6c', light: '#b2ffe0' },
  { name: 'Orchid', main: '#b98aff', dark: '#6a3fc2', light: '#e4d2ff' },
];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function rotateToward(a, b, maxStep) {
  const d = angDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function makeRocks(seed) {
  const rnd = mulberry32(seed * 7 + 13);
  const rocks = [];
  let guard = 0;
  while (rocks.length < 9 && guard++ < 500) {
    const r = 44 + rnd() * 42;
    const x = 160 + rnd() * (C.W - 320);
    const y = 160 + rnd() * (C.H - 320);
    if (Math.hypot(x - C.W / 2, y - C.H / 2) < 520) continue;
    if (rocks.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 190)) continue;
    rocks.push({ x, y, r });
  }
  return rocks;
}

function spawnPoint(i, n) {
  const a = -Math.PI / 2 + (i / Math.max(n, 2)) * TAU + Math.PI / 4;
  return { x: C.W / 2 + Math.cos(a) * 430, y: C.H / 2 + Math.sin(a) * 300, a: a + Math.PI };
}

export function createGame(opts) {
  const seed = opts.seed || 1;
  const st = {
    seed,
    time: 0,
    phase: 'countdown',
    cd: C.COUNTDOWN,
    winner: -1,
    overT: 0,
    rocks: makeRocks(seed),
    players: [],
    crown: { x: C.W / 2, y: C.H / 2, vx: 0, vy: 0, holder: -1, lock: 0 },
    fish: [],
    schools: [],
    jelly: [],
    bubbles: [],
    events: [],
    nextId: 1,
    bubbleT: 4,
    goldT: 14,
  };
  const n = opts.players.length;
  opts.players.forEach((o, i) => {
    const s = spawnPoint(i, n);
    st.players.push({
      id: i, name: o.name, color: o.color ?? i, bot: !!o.bot, skill: o.skill ?? 0.5,
      x: s.x, y: s.y, vx: 0, vy: 0, ang: s.a, spin: 0,
      dashT: 0, charges: C.DASH_MAX, stun: 0, inv: 0,
      reign: 0, frenzy: 0, frenzyT: 0, speedT: 0, shield: 0, zapT: 0,
      hits: 0, steals: 0, eaten: 0,
      ai: { dashCd: 1 + Math.random(), jit: 0, err: 0, side: Math.random() < 0.5 ? 1 : -1, sideT: 2 },
    });
  });
  for (let s = 0; s < 5; s++) {
    st.schools.push({ x: 200 + Math.random() * (C.W - 400), y: 200 + Math.random() * (C.H - 400), a: Math.random() * TAU });
  }
  for (let i = 0; i < C.FISH; i++) spawnFish(st, 0, true);
  for (let i = 0; i < C.JELLY; i++) {
    const j = { x: 0, y: 0, vx: 0, vy: 0, a: Math.random() * TAU, cd: 0, dead: 0 };
    placeJelly(st, j);
    st.jelly.push(j);
  }
  return st;
}

function farFromPlayers(st, x, y, d) {
  return st.players.every((p) => Math.hypot(p.x - x, p.y - y) > d);
}
function inRock(st, x, y, pad) {
  return st.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + pad);
}
function freeSpot(st, margin, playerDist, pad) {
  let x = C.W / 2, y = C.H / 2;
  for (let k = 0; k < 30; k++) {
    x = margin + Math.random() * (C.W - margin * 2);
    y = margin + Math.random() * (C.H - margin * 2);
    if (!inRock(st, x, y, pad) && farFromPlayers(st, x, y, playerDist)) break;
  }
  return { x, y };
}
function placeJelly(st, j) {
  let s;
  for (let k = 0; k < 20; k++) {
    s = freeSpot(st, 120, 300, 50);
    if (Math.hypot(s.x - C.W / 2, s.y - C.H / 2) > 260) break;
  }
  j.x = s.x; j.y = s.y; j.a = Math.random() * TAU;
}
function spawnFish(st, type, initial) {
  const school = (Math.random() * st.schools.length) | 0;
  const sc = st.schools[school];
  let x, y;
  if (initial) {
    x = sc.x + (Math.random() - 0.5) * 160; y = sc.y + (Math.random() - 0.5) * 160;
  } else {
    const s = freeSpot(st, 60, 420, 20); x = s.x; y = s.y;
  }
  st.fish.push({
    id: st.nextId++, x, y, vx: 0, vy: 0, ang: Math.random() * TAU, type, school,
    hue: (Math.random() * 3) | 0, w: Math.random() * TAU,
  });
}

function ev(st, e) { st.events.push(e); }

function dropCrown(st, dx, dy) {
  const cr = st.crown;
  if (cr.holder < 0) return;
  const p = st.players[cr.holder];
  cr.holder = -1;
  cr.x = p.x; cr.y = p.y;
  const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2;
  cr.vx = Math.cos(a) * 430; cr.vy = Math.sin(a) * 430;
  cr.lock = 0.45;
}

function hitPlayer(st, v, a, dx, dy, kind) {
  // returns true if the victim was actually stunned
  if (v.shield > 0) {
    v.shield = 0; v.inv = 0.9;
    if (a) { a.dashT = 0; a.vx = -dx * 380; a.vy = -dy * 380; a.stun = 0.25; a.spin = 0; }
    ev(st, { t: 'shieldpop', x: v.x, y: v.y, p: v.id });
    return false;
  }
  const wasKing = st.crown.holder === v.id;
  v.stun = kind === 'sting' ? 0.9 : C.STUN;
  v.inv = v.stun + 1.2;
  v.vx = dx * 540; v.vy = dy * 540;
  v.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
  v.dashT = 0;
  if (wasKing) dropCrown(st, dx, dy);
  if (a) { a.hits++; if (wasKing) a.steals++; }
  ev(st, { t: kind, x: v.x, y: v.y, p: v.id, a: a ? a.id : -1, k: wasKing ? 1 : 0 });
  return true;
}

export function movePlayer(p, inp, dt, st, isKing) {
  if (p.stun > 0) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.exp(-3.2 * dt);
    p.vx *= f; p.vy *= f;
    p.ang += p.spin * dt;
    p.spin *= Math.exp(-2.5 * dt);
  } else {
    let mx = inp.mx || 0, my = inp.my || 0;
    let mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
    if (mag > 0.12) {
      p.ang = rotateToward(p.ang, Math.atan2(my, mx), (p.dashT > 0 ? 2.2 : 8.5) * dt);
    } else mag = 0;
    let spd = C.SPEED * (isKing ? C.KING_MUL : 1) * (p.speedT > 0 ? 1.38 : 1) * (p.frenzyT > 0 ? 1.2 : 1);
    if (p.bot) spd *= 0.8 + 0.2 * p.skill;
    const cx = Math.cos(p.ang), cy = Math.sin(p.ang);
    let tvx, tvy, acc;
    if (p.dashT > 0) { tvx = cx * C.DASH_SPEED; tvy = cy * C.DASH_SPEED; acc = 40; }
    else { tvx = cx * spd * mag; tvy = cy * spd * mag; acc = mag > 0 ? 7 : 3; }
    const k = 1 - Math.exp(-acc * dt);
    p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  // walls
  const m = C.PR + 14;
  if (p.x < m) { p.x = m; if (p.vx < 0) p.vx *= -0.4; }
  if (p.x > C.W - m) { p.x = C.W - m; if (p.vx > 0) p.vx *= -0.4; }
  if (p.y < m) { p.y = m; if (p.vy < 0) p.vy *= -0.4; }
  if (p.y > C.H - m) { p.y = C.H - m; if (p.vy > 0) p.vy *= -0.4; }
  // rocks
  for (const r of st.rocks) {
    const dx = p.x - r.x, dy = p.y - r.y;
    const d = Math.hypot(dx, dy), min = r.r + C.PR - 4;
    if (d < min && d > 0.01) {
      const nx = dx / d, ny = dy / d;
      p.x = r.x + nx * min; p.y = r.y + ny * min;
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= vn * nx * 1.3; p.vy -= vn * ny * 1.3; }
    }
  }
}

export function tryDash(p, inp) {
  if (p.charges >= 1 && p.stun <= 0 && p.dashT <= 0) {
    p.charges -= 1;
    p.dashT = C.DASH_TIME;
    const mag = Math.hypot(inp.mx || 0, inp.my || 0);
    if (mag > 0.3) p.ang = Math.atan2(inp.my, inp.mx);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- AI
function botThink(st, p, dt) {
  const ai = p.ai, sk = p.skill;
  const out = { mx: 0, my: 0, dash: false };
  if (p.stun > 0) return out;
  ai.dashCd -= dt; ai.jit -= dt; ai.sideT -= dt;
  if (ai.jit <= 0) { ai.jit = 0.35 + Math.random() * 0.5; ai.err = (Math.random() * 2 - 1) * (0.6 - 0.5 * sk); }
  if (ai.sideT <= 0) { ai.sideT = 1.5 + Math.random() * 3; ai.side = -ai.side; }
  const cr = st.crown;
  const king = cr.holder >= 0 ? st.players[cr.holder] : null;
  let gx = 0, gy = 0;
  let chasing = false;

  if (king === p) {
    // flee from everyone, circle, stay off walls
    let nd = 1e9, ne = null;
    for (const o of st.players) {
      if (o === p || o.stun > 0) continue;
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) + 1;
      if (d < nd) { nd = d; ne = o; }
      const w = 260 / (d + 60);
      gx += (dx / d) * w; gy += (dy / d) * w;
    }
    const gl = Math.hypot(gx, gy);
    if (gl > 0.01) {
      gx /= gl; gy /= gl;
      const px = -gy * ai.side, py = gx * ai.side;
      const mix = nd < 260 ? 0.55 : 1.4;
      gx += px * mix; gy += py * mix;
    } else { gx = Math.cos(st.time * 0.7 + p.id); gy = Math.sin(st.time * 0.7 + p.id); }
    // grab fish nearby when safe
    if (nd > 420) {
      const f = nearest(st.fish, p, 260);
      if (f) { gx = f.x - p.x; gy = f.y - p.y; const l = Math.hypot(gx, gy) || 1; gx /= l; gy /= l; }
    }
    const wm = 230;
    if (p.x < wm) gx += ((wm - p.x) / wm) * 3.2;
    if (p.x > C.W - wm) gx -= ((p.x - (C.W - wm)) / wm) * 3.2;
    if (p.y < wm) gy += ((wm - p.y) / wm) * 3.2;
    if (p.y > C.H - wm) gy -= ((p.y - (C.H - wm)) / wm) * 3.2;
    if (ne && ai.dashCd <= 0 && p.charges >= 1) {
      const closing = ne.dashT > 0 && nd < 300;
      if ((closing && Math.random() < 0.25 + sk * 0.6) || (nd < 120 && Math.random() < 0.04 + sk * 0.1)) {
        out.dash = true; ai.dashCd = 0.5 + (1 - sk) * 1.6;
      }
    }
  } else {
    let tx, ty, d, tgt = null;
    if (king) {
      tgt = king;
      d = Math.hypot(king.x - p.x, king.y - p.y);
      const lead = Math.min(0.5, d / C.DASH_SPEED) * (0.3 + 0.7 * sk);
      tx = king.x + king.vx * lead; ty = king.y + king.vy * lead;
    } else { tx = cr.x + cr.vx * 0.2; ty = cr.y + cr.vy * 0.2; d = Math.hypot(tx - p.x, ty - p.y); }
    chasing = true;
    ai.aimT = Math.max(0, (ai.aimT || 0) - dt * 0.5);
    ai.roleT = (ai.roleT || 0) - dt;
    if (ai.roleT <= 0) { ai.roleT = 2.5 + Math.random() * 3; ai.hunt = Math.random() < 0.35 + 0.55 * sk; }
    if (king && !ai.hunt) {
      // forage instead of hunting: bubbles, then fish, then follow a school
      chasing = false; tgt = null;
      const b = nearest(st.bubbles, p, 520), f = b ? null : nearest(st.fish, p, 420);
      const sc = st.schools[p.id % st.schools.length];
      const g = b || f || sc;
      tx = g.x; ty = g.y; d = Math.hypot(tx - p.x, ty - p.y);
    } else if (d > 380) {
      // detours: bubbles & fish when the target is far
      const b = nearest(st.bubbles, p, 240);
      if (b) { tx = b.x; ty = b.y; chasing = false; }
      else if (d > 650) {
        const f = nearest(st.fish, p, 170);
        if (f) { tx = f.x; ty = f.y; chasing = false; }
      }
    }
    const a = Math.atan2(ty - p.y, tx - p.x) + (chasing ? ai.err * Math.min(1, d / 200) : 0);
    gx = Math.cos(a); gy = Math.sin(a);
    if (chasing && ai.dashCd <= 0 && p.charges >= 1) {
      const facing = Math.abs(angDiff(p.ang, a));
      if (tgt) {
        if (tgt.inv <= 0.15 && d < 250 && facing < 0.3) {
          ai.aimT += dt;
          if (ai.aimT > 0.5 - 0.42 * sk) { out.dash = true; ai.aimT = 0; ai.dashCd = 0.7 + (1 - sk) * 2.4 + Math.random() * 0.7; }
        } else if (d > 560 && p.charges >= 2.8 && facing < 0.3 && sk > 0.35 && Math.random() < 0.03) {
          out.dash = true; ai.dashCd = 0.8;
        }
      } else if (d > 240 && facing < 0.35 && Math.random() < 0.05 + sk * 0.1) {
        out.dash = true; ai.dashCd = 0.7 + (1 - sk) * 1.5;
      }
    }
  }
  // hazards
  for (const j of st.jelly) {
    if (j.dead > 0) continue;
    const dx = p.x - j.x, dy = p.y - j.y, d = Math.hypot(dx, dy);
    const R = 135;
    if (d < R && d > 0.1 && p.shield <= 0) {
      const w = ((R - d) / R) * (1.2 + sk * 2.2);
      gx += (dx / d) * w; gy += (dy / d) * w;
    }
  }
  for (const r of st.rocks) {
    const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy);
    const R = r.r + 90;
    if (d < R && d > 0.1) {
      const w = ((R - d) / R) * 1.6;
      const nx = dx / d, ny = dy / d;
      // slide around: add tangent in the direction we already want to go
      const tdot = -ny * gx + nx * gy;
      const s = tdot >= 0 ? 1 : -1;
      gx += nx * w + -ny * s * w; gy += ny * w + nx * s * w;
    }
  }
  const l = Math.hypot(gx, gy);
  if (l > 0.01) { out.mx = gx / l; out.my = gy / l; }
  return out;
}
function nearest(list, p, maxD) {
  let best = null, bd = maxD;
  for (const o of list) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// ---------------------------------------------------------------- step
export function step(st, inputs, dt) {
  st.time += dt;
  if (st.phase === 'countdown') {
    const before = Math.ceil(st.cd);
    st.cd -= dt;
    const after = Math.ceil(st.cd);
    if (after !== before && after > 0 && after <= 3) ev(st, { t: 'count', n: after });
    if (st.cd <= 0) { st.phase = 'play'; ev(st, { t: 'go' }); }
    stepFish(st, dt); stepJelly(st, dt, false);
    return;
  }
  if (st.phase === 'over') {
    st.overT += dt;
    // gentle slow-mo drift
    for (const p of st.players) { movePlayer(p, { mx: 0, my: 0 }, dt * 0.4, st, false); }
    stepFish(st, dt * 0.4);
    return;
  }
  const cr = st.crown;
  const P = st.players;

  for (const p of P) {
    let inp = inputs[p.id] || { mx: 0, my: 0, dash: false };
    if (p.bot) inp = botThink(st, p, dt);
    p.stun = Math.max(0, p.stun - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.dashT = Math.max(0, p.dashT - dt);
    p.speedT = Math.max(0, p.speedT - dt);
    p.shield = Math.max(0, p.shield - dt);
    p.zapT = Math.max(0, p.zapT - dt);
    if (p.frenzyT > 0) { p.frenzyT = Math.max(0, p.frenzyT - dt); }
    p.charges = Math.min(C.DASH_MAX, p.charges + (dt / C.DASH_REGEN) * (p.frenzyT > 0 ? 3 : 1));
    if (inp.dash && tryDash(p, inp)) ev(st, { t: 'dash', x: p.x, y: p.y, p: p.id });
    movePlayer(p, inp, dt, st, cr.holder === p.id);
  }

  // body separation (soft)
  for (let i = 0; i < P.length; i++) for (let k = i + 1; k < P.length; k++) {
    const a = P[i], b = P[k];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = C.PR * 1.7;
    if (d < min && d > 0.01) {
      const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }

  // saw hits
  const clashed = new Set();
  for (const a of P) {
    if (a.dashT <= 0 || a.stun > 0) continue;
    const cx = Math.cos(a.ang), cy = Math.sin(a.ang);
    const ax = a.x + cx * C.SAW0, ay = a.y + cy * C.SAW0;
    const bx = a.x + cx * C.SAW1, by = a.y + cy * C.SAW1;
    for (const v of P) {
      if (v === a || v.inv > 0) continue;
      if (segDist(v.x, v.y, ax, ay, bx, by) > C.PR + 7) continue;
      const head = Math.cos(v.ang) * cx + Math.sin(v.ang) * cy;
      if (v.dashT > 0 && head < -0.35) {
        const key = Math.min(a.id, v.id) + '-' + Math.max(a.id, v.id);
        if (!clashed.has(key)) {
          clashed.add(key);
          for (const [q, s] of [[a, -1], [v, 1]]) {
            q.dashT = 0; q.stun = 0.4; q.inv = 0.7; q.spin = s * 5;
            q.vx = s * cx * 420; q.vy = s * cy * 420;
          }
          ev(st, { t: 'clash', x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 });
        }
        continue;
      }
      if (hitPlayer(st, v, a, cx, cy, 'hit')) { a.dashT = Math.min(a.dashT, 0.08); }
    }
    for (const j of st.jelly) {
      if (j.dead > 0) continue;
      if (segDist(j.x, j.y, ax, ay, bx, by) < 30) {
        j.dead = 5 + Math.random() * 3;
        ev(st, { t: 'pop', x: j.x, y: j.y, p: a.id });
      }
    }
  }
  // zap aura
  for (const a of P) {
    if (a.zapT <= 0 || a.stun > 0) continue;
    for (const v of P) {
      if (v === a || v.inv > 0) continue;
      const dx = v.x - a.x, dy = v.y - a.y, d = Math.hypot(dx, dy);
      if (d < C.PR * 2 + 34) hitPlayer(st, v, a, dx / (d || 1), dy / (d || 1), 'zap');
    }
  }

  stepJelly(st, dt, true);
  stepFish(st, dt);

  // fish eating
  for (const p of P) {
    if (p.stun > 0) continue;
    const cx = Math.cos(p.ang), cy = Math.sin(p.ang);
    const bx = p.x + cx * C.SAW1, by = p.y + cy * C.SAW1;
    for (let i = st.fish.length - 1; i >= 0; i--) {
      const f = st.fish[i];
      if (Math.abs(f.x - p.x) > 140 || Math.abs(f.y - p.y) > 140) continue;
      if (segDist(f.x, f.y, p.x, p.y, bx, by) < (f.type ? 26 : 21)) {
        st.fish.splice(i, 1);
        p.eaten++;
        let fr = false;
        if (p.frenzyT <= 0) {
          p.frenzy += f.type ? C.FRENZY_NEED : 1;
          if (p.frenzy >= C.FRENZY_NEED) { p.frenzy = 0; p.frenzyT = C.FRENZY_TIME; fr = true; }
        }
        p.charges = Math.min(C.DASH_MAX, p.charges + 0.34);
        ev(st, { t: 'eat', x: f.x, y: f.y, p: p.id, g: f.type });
        if (fr) ev(st, { t: 'frenzy', x: p.x, y: p.y, p: p.id });
        if (!f.type) spawnFish(st, 0, false);
      }
    }
  }
  st.goldT -= dt;
  if (st.goldT <= 0) {
    st.goldT = 16 + Math.random() * 8;
    if (!st.fish.some((f) => f.type === 1)) { spawnFish(st, 1, false); ev(st, { t: 'gold' }); }
  }

  // bubbles (power-ups)
  st.bubbleT -= dt;
  if (st.bubbleT <= 0) {
    st.bubbleT = 5.5 + Math.random() * 3;
    if (st.bubbles.length < 3) {
      const s = freeSpot(st, 140, 260, 60);
      st.bubbles.push({ id: st.nextId++, x: s.x, y: s.y, type: (Math.random() * 3) | 0 });
    }
  }
  for (let i = st.bubbles.length - 1; i >= 0; i--) {
    const b = st.bubbles[i];
    for (const p of P) {
      if (p.stun > 0) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < C.PR + 28) {
        if (b.type === 0) p.speedT = C.SPEED_T;
        else if (b.type === 1) p.shield = C.SHIELD_T;
        else p.zapT = C.ZAP_T;
        ev(st, { t: 'power', x: b.x, y: b.y, p: p.id, k: b.type });
        st.bubbles.splice(i, 1);
        break;
      }
    }
  }

  // crown
  if (cr.holder >= 0) {
    const k = P[cr.holder];
    cr.x = k.x; cr.y = k.y;
    const before = k.reign;
    k.reign += dt;
    const warnAt = C.WIN - 10;
    if (before < warnAt && k.reign >= warnAt) ev(st, { t: 'final', p: k.id });
    if (k.reign >= C.WIN) {
      k.reign = C.WIN;
      st.phase = 'over'; st.winner = k.id;
      ev(st, { t: 'win', p: k.id, x: k.x, y: k.y });
    }
  } else {
    cr.lock = Math.max(0, cr.lock - dt);
    cr.x += cr.vx * dt; cr.y += cr.vy * dt;
    const f = Math.exp(-2.4 * dt);
    cr.vx *= f; cr.vy *= f;
    const m = 70;
    if (cr.x < m) { cr.x = m; cr.vx = Math.abs(cr.vx); }
    if (cr.x > C.W - m) { cr.x = C.W - m; cr.vx = -Math.abs(cr.vx); }
    if (cr.y < m) { cr.y = m; cr.vy = Math.abs(cr.vy); }
    if (cr.y > C.H - m) { cr.y = C.H - m; cr.vy = -Math.abs(cr.vy); }
    for (const r of st.rocks) {
      const dx = cr.x - r.x, dy = cr.y - r.y, d = Math.hypot(dx, dy), min = r.r + 26;
      if (d < min && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        cr.x = r.x + nx * min; cr.y = r.y + ny * min;
        const vn = cr.vx * nx + cr.vy * ny;
        if (vn < 0) { cr.vx -= 1.6 * vn * nx; cr.vy -= 1.6 * vn * ny; }
      }
    }
    if (cr.lock <= 0) {
      let best = null, bd = C.PR + 26;
      for (const p of P) {
        if (p.stun > 0) continue;
        const d = Math.hypot(p.x - cr.x, p.y - cr.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        cr.holder = best.id; cr.vx = cr.vy = 0;
        best.inv = Math.max(best.inv, 1.5); best.speedT = Math.max(best.speedT, 1.3); // coronation rush
        ev(st, { t: 'crown', x: best.x, y: best.y, p: best.id });
      }
    }
  }
}

function stepJelly(st, dt, active) {
  for (const j of st.jelly) {
    if (j.dead > 0) {
      j.dead -= dt;
      if (j.dead <= 0) { j.dead = 0; placeJelly(st, j); j.cd = 1; }
      continue;
    }
    j.cd = Math.max(0, j.cd - dt);
    j.a += (Math.random() - 0.5) * 1.2 * dt;
    const pulse = 0.6 + 0.4 * Math.sin(st.time * 2.2 + j.x * 0.01);
    j.vx = Math.cos(j.a) * 30 * pulse; j.vy = Math.sin(j.a) * 30 * pulse;
    j.x += j.vx * dt; j.y += j.vy * dt;
    const m = 90;
    if (j.x < m || j.x > C.W - m || j.y < m || j.y > C.H - m) {
      j.a = Math.atan2(C.H / 2 - j.y, C.W / 2 - j.x) + (Math.random() - 0.5);
      j.x = clamp(j.x, m, C.W - m); j.y = clamp(j.y, m, C.H - m);
    }
    for (const r of st.rocks) {
      const dx = j.x - r.x, dy = j.y - r.y, d = Math.hypot(dx, dy), min = r.r + 34;
      if (d < min && d > 0.01) { j.x = r.x + (dx / d) * min; j.y = r.y + (dy / d) * min; j.a = Math.atan2(dy, dx); }
    }
    if (!active || j.cd > 0) continue;
    for (const p of st.players) {
      if (p.inv > 0) continue;
      const dx = p.x - j.x, dy = p.y - j.y, d = Math.hypot(dx, dy);
      if (d < C.PR + 24) {
        hitPlayer(st, p, null, dx / (d || 1), dy / (d || 1), 'sting');
        j.cd = 0.8;
      }
    }
  }
}

function stepFish(st, dt) {
  for (const sc of st.schools) {
    sc.a += (Math.random() - 0.5) * 1.5 * dt;
    sc.x += Math.cos(sc.a) * 42 * dt; sc.y += Math.sin(sc.a) * 42 * dt;
    const m = 170;
    if (sc.x < m || sc.x > C.W - m || sc.y < m || sc.y > C.H - m) {
      sc.a = Math.atan2(C.H / 2 - sc.y, C.W / 2 - sc.x) + (Math.random() - 0.5) * 1.4;
      sc.x = clamp(sc.x, m, C.W - m); sc.y = clamp(sc.y, m, C.H - m);
    }
  }
  const F = st.fish;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    const sc = st.schools[f.school];
    let ax = 0, ay = 0;
    f.w += dt * (1 + (f.id % 5) * 0.2);
    // orbit school center
    const ox = sc.x + Math.cos(f.w * 0.6 + f.id) * (40 + (f.id % 7) * 11);
    const oy = sc.y + Math.sin(f.w * 0.5 + f.id * 1.7) * (40 + (f.id % 5) * 13);
    let dx = ox - f.x, dy = oy - f.y, d = Math.hypot(dx, dy) || 1;
    const base = f.type ? 150 : 78;
    ax += (dx / d) * 1; ay += (dy / d) * 1;
    let scared = 0;
    for (const p of st.players) {
      dx = f.x - p.x; dy = f.y - p.y; d = Math.hypot(dx, dy);
      const R = f.type ? 230 : 135;
      if (d < R && d > 0.1) { const w = ((R - d) / R) * 5; ax += (dx / d) * w; ay += (dy / d) * w; scared = Math.max(scared, (R - d) / R); }
    }
    // separation from neighbor (cheap: next fish only)
    const o = F[(i + 1) % F.length];
    if (o !== f) {
      dx = f.x - o.x; dy = f.y - o.y; d = Math.hypot(dx, dy);
      if (d < 26 && d > 0.1) { ax += (dx / d) * 1.5; ay += (dy / d) * 1.5; }
    }
    for (const r of st.rocks) {
      dx = f.x - r.x; dy = f.y - r.y; d = Math.hypot(dx, dy);
      if (d < r.r + 40 && d > 0.1) { ax += (dx / d) * 4; ay += (dy / d) * 4; }
    }
    const m = 50;
    if (f.x < m) ax += 4; if (f.x > C.W - m) ax -= 4;
    if (f.y < m) ay += 4; if (f.y > C.H - m) ay -= 4;
    const al = Math.hypot(ax, ay) || 1;
    const spd = base * (1 + scared * (f.type ? 1.0 : 1.5));
    const k = 1 - Math.exp(-4 * dt);
    f.vx += ((ax / al) * spd - f.vx) * k; f.vy += ((ay / al) * spd - f.vy) * k;
    f.x = clamp(f.x + f.vx * dt, 20, C.W - 20); f.y = clamp(f.y + f.vy * dt, 20, C.H - 20);
    if (Math.abs(f.vx) + Math.abs(f.vy) > 4) f.ang = Math.atan2(f.vy, f.vx);
  }
}

// ---------------------------------------------------------------- snapshots
const r1 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;

export function pack(st) {
  return {
    t: Math.round(st.time * 1000) / 1000,
    ph: st.phase === 'countdown' ? 0 : st.phase === 'play' ? 1 : 2,
    cd: r2(st.cd), w: st.winner,
    c: [r1(st.crown.x), r1(st.crown.y), st.crown.holder],
    p: st.players.map((p) => [
      r1(p.x), r1(p.y), r2(p.ang), r1(p.vx), r1(p.vy), r2(p.dashT), r2(p.charges), r2(p.stun), r2(p.inv),
      r2(p.reign), p.frenzy, r2(p.frenzyT), r2(p.speedT), r2(p.shield), r2(p.zapT), p.hits, p.steals, p.eaten,
    ]),
    f: st.fish.map((f) => [f.id, r1(f.x), r1(f.y), r2(f.ang), f.type, f.hue]),
    j: st.jelly.map((j) => [r1(j.x), r1(j.y), j.dead > 0 ? 1 : 0]),
    b: st.bubbles.map((b) => [b.id, r1(b.x), r1(b.y), b.type]),
  };
}

// Build a renderable state from a snapshot, given the static info (players meta, seed).
export function unpack(s, meta) {
  return {
    seed: meta.seed, rocks: meta.rocks, time: s.t,
    phase: ['countdown', 'play', 'over'][s.ph], cd: s.cd, winner: s.w,
    crown: { x: s.c[0], y: s.c[1], holder: s.c[2] },
    players: s.p.map((a, i) => ({
      id: i, name: meta.players[i].name, color: meta.players[i].color, bot: meta.players[i].bot,
      x: a[0], y: a[1], ang: a[2], vx: a[3], vy: a[4], dashT: a[5], charges: a[6], stun: a[7], inv: a[8],
      reign: a[9], frenzy: a[10], frenzyT: a[11], speedT: a[12], shield: a[13], zapT: a[14],
      hits: a[15], steals: a[16], eaten: a[17], spin: 0,
    })),
    fish: s.f.map((a) => ({ id: a[0], x: a[1], y: a[2], ang: a[3], type: a[4], hue: a[5] })),
    jelly: s.j.map((a) => ({ x: a[0], y: a[1], dead: a[2] })),
    bubbles: s.b.map((a) => ({ id: a[0], x: a[1], y: a[2], type: a[3] })),
    events: [],
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
export function lerpState(A, B, t) {
  // B is the newer state; returns B-shaped object with interpolated positions
  const out = { ...B };
  out.time = lerp(A.time, B.time, t);
  out.players = B.players.map((pb, i) => {
    const pa = A.players[i];
    if (!pa) return pb;
    return { ...pb, x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t), ang: pa.ang + angDiff(pa.ang, pb.ang) * t };
  });
  const fa = new Map(A.fish.map((f) => [f.id, f]));
  out.fish = B.fish.map((fb) => {
    const f = fa.get(fb.id);
    if (!f) return fb;
    return { ...fb, x: lerp(f.x, fb.x, t), y: lerp(f.y, fb.y, t), ang: f.ang + angDiff(f.ang, fb.ang) * t };
  });
  out.jelly = B.jelly.map((jb, i) => {
    const ja = A.jelly[i];
    if (!ja || ja.dead || jb.dead) return jb;
    return { ...jb, x: lerp(ja.x, jb.x, t), y: lerp(ja.y, jb.y, t) };
  });
  if (A.crown.holder === B.crown.holder && B.crown.holder < 0) {
    out.crown = { ...B.crown, x: lerp(A.crown.x, B.crown.x, t), y: lerp(A.crown.y, B.crown.y, t) };
  } else if (B.crown.holder >= 0) {
    const k = out.players[B.crown.holder];
    out.crown = { ...B.crown, x: k.x, y: k.y };
  }
  return out;
}
