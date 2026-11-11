// Sluggy's Business — rules engine (pure, deterministic given seed + bids).
export const N = 5, DAYS = 8, LOTS = 3, STIPEND = 3, START = 10, CENTER = 12;
export const RAID_DAYS = [2, 5]; // 0-based: day 3 and day 6

export const TYPES = [
  { key: 'stand', name: 'Slime-onade', base: 2, color: '#f5b800', desc: 'Earns $2.' },
  { key: 'burger', name: 'Shroom Burger', base: 3, color: '#f0554d', desc: 'Earns $3.' },
  { key: 'petal', name: 'Petal Boutique', base: 1, color: '#f06bb4', desc: 'Earns $1. Neighbor bonus counts double.' },
  { key: 'bank', name: 'Leaf Bank', base: 2, color: '#37b24d', desc: 'Earns $2, +$1 per $5 you hold (max +3).' },
  { key: 'gold', name: 'Golden Toadstool', base: 5, color: '#e8a100', desc: 'Earns a juicy $5.' },
  { key: 'bill', name: 'Billboard', base: 0, color: '#4c8dff', desc: 'Earns $0. Your neighbors +2, rival neighbors −1.' },
];
const DECK = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5, 5];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export function neighbors(i) {
  const x = i % N, y = (i / N) | 0, out = [];
  if (x > 0) out.push(i - 1); if (x < N - 1) out.push(i + 1);
  if (y > 0) out.push(i - N); if (y < N - 1) out.push(i + N);
  return out;
}

export function newGame(seed) {
  const rnd = mulberry32(seed);
  const plots = [];
  for (let i = 0; i < N * N; i++) plots.push({ type: -1, owner: -1, hole: false, infest: 0, fountain: i === CENTER });
  const order = shuffle([...Array(N * N).keys()].filter((i) => i !== CENTER), rnd);
  const deck = shuffle([...DECK], rnd);
  const trends = [];
  for (let d = 0; d < DAYS; d++) { let t; do { t = (rnd() * 4) | 0; } while (d > 0 && t === trends[d - 1]); trends.push(t); }
  return { seed, rnd, plots, order, deck, trends, cash: [START, START], day: 0, won: [0, 0] };
}
export const isRaid = (g, d = g.day) => RAID_DAYS.includes(d);
export function lotsForDay(g, d = g.day) {
  const out = [];
  for (let k = 0; k < LOTS; k++) out.push({ plot: g.order[d * LOTS + k], type: g.deck[d * LOTS + k] });
  return out;
}

// Income of player p. Returns { total, items:[{plot, amt}], crowns:[type...], stipend, mult }
export function income(g, p, plots = g.plots, cash = g.cash[p], day = Math.min(g.day, DAYS - 1)) {
  const o = 1 - p, items = [];
  const cnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (const s of plots) if (s.owner >= 0 && s.type < 4) cnt[s.owner][s.type]++;
  const mult = day === DAYS - 1 ? 2 : 1;
  let sum = 0;
  plots.forEach((s, i) => {
    if (s.owner !== p || s.type === 5) return;
    let a = TYPES[s.type].base, adj = 0;
    for (const nb of neighbors(i)) {
      const q = plots[nb];
      if (q.fountain) adj++;
      else if (q.hole) a -= 1;
      else if (q.owner === p) { adj++; if (q.type === 5) a += 1; }
      else if (q.owner === o && q.type === 5) a -= 1;
    }
    a += adj * (s.type === 2 ? 2 : 1);
    if (s.type === 3) a += Math.min(3, Math.floor(cash / 5));
    if (s.type === g.trends[day]) a += 2;
    if (s.infest > 0) a = 0;
    a = Math.max(0, a) * mult;
    sum += a; items.push({ plot: i, amt: a });
  });
  const crowns = [];
  for (let t = 0; t < 4; t++) if (cnt[p][t] > cnt[o][t]) crowns.push(t);
  const stipend = STIPEND * mult;
  return { total: sum + stipend + crowns.length * 2 * mult, items, crowns, stipend, mult };
}

// How much a lot is worth per day: { mine: my income gain, swing: gain + damage to rival }
export function valueOf(g, p, lot) {
  const copy = g.plots.map((s) => ({ ...s }));
  copy[lot.plot] = { ...copy[lot.plot], type: lot.type, owner: p };
  const o = 1 - p;
  const mine = income(g, p, copy).total - income(g, p).total;
  const hurt = income(g, o).total - income(g, o, copy).total;
  return { mine, swing: mine + hurt };
}
export function topShop(g, p) {
  let best = -1, amt = -1;
  for (const it of income(g, p).items) if (g.plots[it.plot].infest <= 0 && it.amt > amt) { amt = it.amt; best = it.plot; }
  return { plot: best, amt };
}

export function clampBids(g, p, arr) {
  let left = g.cash[p]; const out = [];
  const n = LOTS + (isRaid(g) ? 1 : 0);
  for (let k = 0; k < n; k++) { const b = Math.max(0, Math.min(left, Math.floor(+(arr && arr[k]) || 0))); out.push(b); left -= b; }
  return out;
}

// Resolve the day's auction. bids = [bidsOfP0, bidsOfP1]. Mutates g. Returns what happened (for animation).
export function resolve(g, bids) {
  const b = [clampBids(g, 0, bids[0]), clampBids(g, 1, bids[1])];
  const lots = lotsForDay(g), out = { lots: [], raid: null, bids: b };
  lots.forEach((lot, k) => {
    const a0 = b[0][k], a1 = b[1][k];
    let winner = -1, tie = false;
    if (a0 > a1) winner = 0; else if (a1 > a0) winner = 1;
    else if (a0 > 0) {
      tie = true;
      const sh = [0, 1].map((p) => g.plots.filter((s) => s.owner === p).length);
      if (sh[0] !== sh[1]) winner = sh[0] < sh[1] ? 0 : 1;
      else if (g.cash[0] !== g.cash[1]) winner = g.cash[0] < g.cash[1] ? 0 : 1;
      else winner = g.rnd() < 0.5 ? 0 : 1;
    }
    const s = g.plots[lot.plot];
    if (winner >= 0) { s.type = lot.type; s.owner = winner; g.cash[winner] -= b[winner][k]; g.won[winner]++; }
    else s.hole = true;
    out.lots.push({ ...lot, winner, tie, bids: [a0, a1] });
  });
  if (isRaid(g)) {
    const a0 = b[0][LOTS], a1 = b[1][LOTS];
    const victims = a0 > a1 ? [1] : a1 > a0 ? [0] : [0, 1];
    if (a0 > a1) g.cash[0] -= a0; else if (a1 > a0) g.cash[1] -= a1;
    const hit = victims.map((p) => { const t = topShop(g, p); if (t.plot >= 0) g.plots[t.plot].infest = 2; return { p, plot: t.plot }; });
    out.raid = { bids: [a0, a1], safe: a0 > a1 ? 0 : a1 > a0 ? 1 : -1, hit };
  }
  return out;
}

export function payday(g) {
  const d = [income(g, 0), income(g, 1)];
  g.cash[0] += d[0].total; g.cash[1] += d[1].total;
  for (const s of g.plots) if (s.infest > 0) s.infest--;
  g.day++;
  return d;
}

// ------------------------------------------------------------ AI bidder
const AI = [
  { f: 0.22, noise: 0.7, deny: 0, cap: false, focus: false },
  { f: 0.3, noise: 0.5, deny: 0.1, cap: false, focus: false },
  { f: 0.38, noise: 0.35, deny: 0.3, cap: true, focus: false },
  { f: 0.46, noise: 0.25, deny: 0.45, cap: true, focus: true },
  { f: 0.5, noise: 0.14, deny: 0.5, cap: true, focus: true },
];
export function aiBids(g, p, level, rnd = Math.random) {
  const L = AI[Math.max(0, Math.min(AI.length - 1, level - 1))], o = 1 - p;
  const cash = g.cash[p], oppCash = g.cash[o];
  const daysLeft = DAYS - g.day;            // paydays this lot will collect (today included)
  const lots = lotsForDay(g);
  let wants = lots.map((lot) => {
    const mine = valueOf(g, p, lot), theirs = valueOf(g, o, lot);
    // valueOf already doubles on the final day; otherwise count the finale as one extra payday
    const span = g.day === DAYS - 1 ? 1 : daysLeft + 1;
    const v = (mine.swing + L.deny * theirs.swing) * span;
    return Math.max(0, v * L.f * (1 + L.noise * (rnd() * 2 - 1)));
  });
  let bird = 0;
  if (isRaid(g)) {
    const t = topShop(g, p);
    bird = t.plot >= 0 ? Math.max(0, t.amt * 2 * (L.f + 0.25) * (1 + L.noise * (rnd() * 2 - 1))) : 0;
    wants.push(bird);
  }
  if (L.cap) wants = wants.map((w) => Math.min(w, oppCash + 1));
  let sum = wants.reduce((a, c) => a + c, 0);
  if (sum > cash && L.focus) {
    // can't afford everything: drop the weakest lot and concentrate
    let lo = 0; for (let i = 1; i < LOTS; i++) if (wants[i] < wants[lo]) lo = i;
    wants[lo] = Math.min(wants[lo], 1); sum = wants.reduce((a, c) => a + c, 0);
  }
  const scale = sum > cash ? cash / sum : 1;
  let out = wants.map((w) => Math.floor(w * scale + rnd() * 0.999));
  // never leave a worthwhile lot free if we have spare change
  let left = cash - out.reduce((a, c) => a + c, 0);
  while (left < 0) { let hi = 0; for (let i = 1; i < out.length; i++) if (out[i] > out[hi]) hi = i; out[hi]--; left++; }
  // smarter worms never let a lot go for free (it would become a worm hole, or a $0 bargain for the slug)
  if (level >= 2) for (let i = 0; i < LOTS && left > 0; i++) if (out[i] === 0 && (wants[i] > 0.3 || level >= 3)) { out[i] = 1; left--; }
  return clampBids(g, p, out);
}
