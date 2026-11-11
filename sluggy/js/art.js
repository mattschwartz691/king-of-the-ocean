// Sluggy's Business — procedural cartoon art (canvas 2D).
const TAU = Math.PI * 2;
export const OUT = '#3b2414';
export const PAL = [
  { main: '#ffd83d', dark: '#dba400', light: '#fff4b0', deep: '#a87400' },   // Sluggy (banana slug)
  { main: '#45dcc3', dark: '#12a08c', light: '#c8fff5', deep: '#0b6f62' },   // rival slug
  { main: '#ff8fab', dark: '#d6336c', light: '#ffd3df', deep: '#a01d4c' },   // worms
];
export const LOT_COL = ['#ff922b', '#4c8dff', '#b267f5', '#e03131'];

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fs(g, fill, lw = 3) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); }
export { rr };

// ---------------------------------------------------------------- shops (local box ~ -50..50, ground at y=40)
export function drawShop(g, type, t = 0) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = 'rgba(40,20,5,0.25)'; g.beginPath(); g.ellipse(2, 40, 40, 7, 0, 0, TAU); g.fill();
  if (type === 0) {            // Slime-onade stand
    g.fillStyle = '#8a5a2b'; g.strokeStyle = OUT; g.lineWidth = 3;
    for (const x of [-33, 27]) { g.beginPath(); g.rect(x, -16, 6, 54); g.fill(); g.stroke(); }
    rr(g, -38, 8, 76, 31, 5); fs(g, '#fff0b8');
    g.fillStyle = '#ffd43b'; for (let i = 0; i < 4; i++) g.fillRect(-32 + i * 19, 11, 9, 25);
    rr(g, -38, 8, 76, 31, 5); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    // awning
    g.save(); g.beginPath(); g.moveTo(-44, -14); g.lineTo(-36, -38); g.lineTo(36, -38); g.lineTo(44, -14);
    for (let i = 5; i >= 0; i--) g.arc(-36.7 + i * 14.7, -14, 7.35, 0, Math.PI);
    g.closePath(); fs(g, '#fff'); g.clip();
    g.fillStyle = '#ffc928'; for (let i = 0; i < 3; i++) g.fillRect(-44 + i * 29.4, -40, 14.7, 36);
    g.restore();
    // pitcher + lemon
    rr(g, -14, -10, 16, 19, 3); fs(g, '#bdf0ff', 2.5); g.fillStyle = '#ffe14d'; g.fillRect(-12, -3, 12, 10);
    g.beginPath(); g.arc(14, 0, 8, 0, TAU); fs(g, '#ffe14d', 2.5);
    g.beginPath(); g.arc(14, 0, 4, 0, TAU); g.strokeStyle = '#fff7b0'; g.lineWidth = 1.5; g.stroke();
  } else if (type === 1 || type === 4) {   // Shroom burger / Golden toadstool
    const gold = type === 4;
    rr(g, -21, -2, 42, 41, 9); fs(g, gold ? '#fff3c4' : '#fff1dc');
    g.beginPath(); g.moveTo(-9, 39); g.lineTo(-9, 20); g.arc(0, 20, 9, Math.PI, 0); g.lineTo(9, 39); g.closePath(); fs(g, gold ? '#b8860b' : '#8a5a2b', 2.5);
    g.beginPath(); g.moveTo(-46, 4); g.bezierCurveTo(-46, -50, 46, -50, 46, 4); g.quadraticCurveTo(0, 14, -46, 4); g.closePath();
    if (gold) { const gr = g.createLinearGradient(0, -40, 0, 8); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ffc928'); gr.addColorStop(1, '#e08a00'); fs(g, gr); }
    else fs(g, '#f0554d');
    g.fillStyle = gold ? '#fffbe0' : '#fff';
    for (const [x, y, r] of [[-22, -14, 8], [6, -24, 9.5], [26, -6, 6.5], [-4, -2, 5]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill(); }
    if (gold) {
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1, x = Math.cos(a) * 36, y = -22 + Math.sin(a * 1.3) * 16, s = 4 + Math.sin(t * 6 + i) * 2;
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s, y); g.lineTo(x + s * 0.3, y + s * 0.3); g.lineTo(x, y + s); g.lineTo(x - s * 0.3, y + s * 0.3); g.lineTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.3); g.closePath(); g.fill();
      }
    } else { rr(g, 8, 14, 9, 9, 2); fs(g, '#bdf0ff', 2); }
  } else if (type === 2) {     // Petal boutique
    rr(g, -24, 4, 48, 35, 7); fs(g, '#ffe3f1');
    g.beginPath(); g.moveTo(-8, 39); g.lineTo(-8, 22); g.arc(0, 22, 8, Math.PI, 0); g.lineTo(8, 39); g.closePath(); fs(g, '#c2559a', 2.5);
    rr(g, -30, 0, 60, 9, 4); fs(g, '#f06bb4', 2.5);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10); g.stroke();
    g.save(); g.translate(0, -24); g.rotate(Math.sin(t * 1.5) * 0.12);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 10, 7.5, a, 0, TAU); fs(g, i % 2 ? '#ff8fc7' : '#f06bb4', 2.5); }
    g.beginPath(); g.arc(0, 0, 8, 0, TAU); fs(g, '#ffd43b', 2.5);
    g.restore();
  } else if (type === 3) {     // Leaf bank
    rr(g, -40, 31, 80, 8, 2); fs(g, '#dfe7d6');
    g.beginPath(); g.rect(-34, -6, 68, 37); fs(g, '#f4f9ee');
    for (const x of [-28, -11, 6, 23]) { rr(g, x, -4, 7, 35, 2); fs(g, '#fff', 2.2); }
    g.beginPath(); g.moveTo(-42, -6); g.quadraticCurveTo(-4, -22, 0, -40); g.quadraticCurveTo(4, -22, 42, -6); g.closePath(); fs(g, '#37b24d');
    g.strokeStyle = '#2b8a3e'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -36); g.lineTo(0, -8); g.stroke();
    g.beginPath(); g.arc(0, -17, 8, 0, TAU); fs(g, '#ffd43b', 2.2);
    g.fillStyle = OUT; g.font = '900 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, -16.5);
  } else {                     // Billboard
    g.fillStyle = '#8a5a2b'; g.strokeStyle = OUT; g.lineWidth = 3;
    for (const x of [-26, 20]) { g.beginPath(); g.rect(x, 4, 6, 35); g.fill(); g.stroke(); }
    g.save(); g.rotate(Math.sin(t * 2) * 0.02);
    rr(g, -42, -38, 84, 46, 6); fs(g, '#fff');
    rr(g, -37, -33, 74, 36, 4); g.fillStyle = '#4c8dff'; g.fill();
    g.fillStyle = '#fff'; g.font = '900 19px ui-rounded, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BUY!', 0, -14);
    g.fillStyle = '#ffd43b'; for (const [x, y] of [[-31, -28], [31, -28], [-31, -2], [31, -2]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ---------------------------------------------------------------- characters
export function drawSlug(g, pal, o = {}) {
  const t = o.t || 0, mood = o.mood || 'happy', w = Math.sin(t * 3) * 1.6;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (o.shadow !== false) {
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-72, 25, 24, 3.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,20,5,0.2)'; g.beginPath(); g.ellipse(0, 27, 62, 6, 0, 0, TAU); g.fill();
  }
  if (o.under) o.under(g); // e.g. a hat that sits behind the eye stalks
  const droop = mood === 'sad' ? 12 : mood === 'shock' ? -5 : 0;
  // eye stalks
  for (const [bx, tx, ty] of [[38, 33, -60], [52, 62, -56]]) {
    const ex = tx + w * 1.4 + (mood === 'sad' ? (tx < 50 ? -8 : 8) : 0), ey = ty + droop + Math.cos(t * 3 + tx) * 1.2;
    g.beginPath(); g.moveTo(bx, -26); g.quadraticCurveTo(bx - 2, (ey - 26) / 2 - 8, ex, ey);
    g.strokeStyle = OUT; g.lineWidth = 10; g.stroke(); g.strokeStyle = pal.main; g.lineWidth = 5.5; g.stroke();
    g.beginPath(); g.arc(ex, ey, 9.5, 0, TAU); fs(g, '#fff', 3);
    if (mood === 'smug') { g.fillStyle = '#2b8a3e'; g.font = '900 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', ex, ey + 0.5); }
    else {
      g.beginPath(); g.arc(ex + 2.5, ey + (mood === 'sad' ? 2.5 : 0.5), mood === 'shock' ? 2.8 : 4.4, 0, TAU); g.fillStyle = OUT; g.fill();
      g.beginPath(); g.arc(ex + 4, ey - 1.2, 1.4, 0, TAU); g.fillStyle = '#fff'; g.fill();
      if (mood === 'sad') { g.beginPath(); g.arc(ex, ey, 9.5, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fillStyle = pal.dark; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
    }
  }
  // body
  g.beginPath(); g.moveTo(-68, 23);
  g.bezierCurveTo(-52, 2, -30, -15, 0, -15 + w * 0.5);
  g.bezierCurveTo(18, -15, 24, -31, 44, -33);
  g.bezierCurveTo(66, -34, 70, -12, 59, -1);
  g.bezierCurveTo(53, 6, 46, 12, 42, 25);
  g.quadraticCurveTo(20, 29 + w * 0.5, 0, 25); g.quadraticCurveTo(-30, 29 - w * 0.5, -68, 23); g.closePath();
  const gr = g.createLinearGradient(0, -34, 0, 28);
  gr.addColorStop(0, pal.light); gr.addColorStop(0.45, pal.main); gr.addColorStop(1, pal.dark);
  fs(g, gr, 3.5);
  // mantle + spots
  g.beginPath(); g.ellipse(0, -1, 24, 9, -0.05, 0, TAU); g.fillStyle = pal.dark; g.globalAlpha *= 0.5; g.fill(); g.globalAlpha /= 0.5;
  g.fillStyle = pal.deep; g.globalAlpha *= 0.45;
  for (const [x, y, r] of [[-38, 10, 4], [-24, 2, 3], [-48, 16, 2.5], [22, 8, 3]]) { g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, TAU); g.fill(); }
  g.globalAlpha /= 0.45;
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-40, 2); g.quadraticCurveTo(-22, -9, -4, -10); g.stroke();
  // face
  g.fillStyle = 'rgba(255,120,120,0.45)'; g.beginPath(); g.ellipse(47, -9, 6, 4, 0, 0, TAU); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 2.8; g.beginPath();
  if (mood === 'sad') g.arc(57, -3, 6, Math.PI * 1.1, Math.PI * 1.75);
  else if (mood === 'shock') { g.ellipse(58, -9, 3.5, 5, 0, 0, TAU); g.fillStyle = OUT; g.fill(); }
  else g.arc(55, -14, 8, Math.PI * 0.05, Math.PI * 0.6);
  g.stroke();
  // necktie
  if (o.tie !== false) {
    g.beginPath(); g.moveTo(40, 8); g.lineTo(48, 6); g.lineTo(47, 13); g.closePath(); fs(g, '#e03131', 2);
    g.beginPath(); g.moveTo(43, 12); g.lineTo(49, 11); g.lineTo(52, 27); g.lineTo(45, 31); g.lineTo(40, 26); g.closePath(); fs(g, '#e03131', 2);
  }
}

function wormPath(n, t, fn) { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(i / n, t)); return pts; }
function chain(g, pts, r0, r1, pal) {
  const n = pts.length - 1;
  g.fillStyle = OUT; for (let i = 0; i <= n; i++) { const r = r0 + (r1 - r0) * (i / n); g.beginPath(); g.arc(pts[i][0], pts[i][1], r + 2.6, 0, TAU); g.fill(); }
  for (let i = 0; i <= n; i++) { const r = r0 + (r1 - r0) * (i / n); g.fillStyle = i % 2 ? pal.main : pal.light; g.beginPath(); g.arc(pts[i][0], pts[i][1], r, 0, TAU); g.fill(); }
}
// The big bad boss of WormCo
export function drawWormBoss(g, o = {}) {
  const t = o.t || 0, mood = o.mood || 'happy', pal = PAL[2];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = 'rgba(40,20,5,0.3)'; g.beginPath(); g.ellipse(-8, 30, 40, 7, 0, 0, TAU); g.fill();
  g.fillStyle = '#5a3a1c'; g.beginPath(); g.ellipse(-8, 28, 30, 6, 0, 0, TAU); g.fill();
  const pts = wormPath(11, t, (u, tt) => [-8 + Math.sin(u * 3.2 + tt * 2) * 15 * (1 - u * 0.4) + u * 22, 26 - u * 58]);
  chain(g, pts, 14, 15, pal);
  const [hx, hy] = pts[pts.length - 1];
  g.beginPath(); g.arc(hx, hy, 18, 0, TAU); fs(g, pal.main, 3);
  // top hat
  g.save(); g.translate(hx, hy - 15); g.rotate(-0.12);
  rr(g, -20, -4, 40, 6, 3); fs(g, '#2a2a33', 2.5); rr(g, -13, -27, 26, 24, 3); fs(g, '#2a2a33', 2.5);
  g.fillStyle = '#e03131'; g.fillRect(-13, -10, 26, 5);
  g.restore();
  // eyes + brows
  for (const s of [-1, 1]) {
    const ex = hx + s * 7 + 2, ey = hy - 2;
    g.beginPath(); g.arc(ex, ey, 5.5, 0, TAU); fs(g, '#fff', 2);
    g.beginPath(); g.arc(ex + 1.5, ey + 0.5, 2.4, 0, TAU); g.fillStyle = OUT; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath();
    if (mood === 'sad') { g.moveTo(ex - s * 6, ey - 6); g.lineTo(ex + s * 5, ey - 10); }
    else { g.moveTo(ex - s * 6, ey - 10); g.lineTo(ex + s * 5, ey - 6); }
    g.stroke();
  }
  g.strokeStyle = '#ffd43b'; g.lineWidth = 2; g.beginPath(); g.arc(hx + 9, hy - 2, 7.5, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(hx + 14, hy + 4); g.quadraticCurveTo(hx + 20, hy + 16, hx + 12, hy + 22); g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath();
  if (mood === 'sad') g.arc(hx + 2, hy + 13, 6, Math.PI * 1.15, Math.PI * 1.85); else { g.moveTo(hx - 6, hy + 8); g.quadraticCurveTo(hx + 4, hy + 15, hx + 10, hy + 7); }
  g.stroke();
}
// little pest worm poking out of a hole (local ~ -40..40)
export function drawWormHole(g, t = 0, seed = 0) {
  g.fillStyle = '#5a3a1c'; g.beginPath(); g.ellipse(0, 22, 36, 14, 0, 0, TAU); g.fill();
  g.fillStyle = '#2a1708'; g.beginPath(); g.ellipse(0, 20, 26, 9, 0, 0, TAU); g.fill();
  const up = 0.75 + 0.25 * Math.sin(t * 1.7 + seed);
  const pts = wormPath(7, t, (u, tt) => [Math.sin(u * 3 + tt * 3 + seed) * 9 * u, 20 - u * 46 * up]);
  chain(g, pts, 8, 9, PAL[2]);
  const [hx, hy] = pts[pts.length - 1];
  for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * 3.6, hy - 1, 2.8, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(hx + s * 3.6 + 0.6, hy - 0.6, 1.4, 0, TAU); g.fillStyle = OUT; g.fill(); }
  g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.moveTo(hx - 6, hy - 6); g.lineTo(hx - 1, hy - 4); g.moveTo(hx + 6, hy - 6); g.lineTo(hx + 1, hy - 4); g.stroke();
  g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(0, 27, 30, 6, 0, 0, Math.PI); g.fill();
}
export function drawInfest(g, t = 0) {
  const pts = wormPath(12, t, (u, tt) => [-34 + u * 68, 6 + Math.sin(u * 9 + tt * 5) * 9 - Math.sin(u * Math.PI) * 14]);
  chain(g, pts, 6.5, 7.5, PAL[2]);
  const [hx, hy] = pts[pts.length - 1];
  g.beginPath(); g.arc(hx - 2, hy - 2, 2.4, 0, TAU); g.arc(hx + 3, hy - 2, 2.4, 0, TAU); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.arc(hx - 1.5, hy - 1.6, 1.2, 0, TAU); g.arc(hx + 3.5, hy - 1.6, 1.2, 0, TAU); g.fillStyle = OUT; g.fill();
}
export function drawBird(g, t = 0) {
  g.lineJoin = 'round';
  const fl = Math.sin(t * 16) * 0.6;
  g.save(); g.rotate(-0.1);
  g.beginPath(); g.moveTo(-22, 0); g.lineTo(-40, -8); g.lineTo(-38, 6); g.closePath(); fs(g, '#7a5230', 2.5);
  g.beginPath(); g.ellipse(0, 0, 25, 20, 0, 0, TAU); fs(g, '#8d6238', 3);
  g.beginPath(); g.ellipse(6, 6, 16, 12, 0, 0, TAU); g.fillStyle = '#ff7b3d'; g.fill();
  g.save(); g.translate(-6, -6); g.rotate(fl); g.beginPath(); g.ellipse(-6, -8, 15, 8, -0.5, 0, TAU); fs(g, '#6b4423', 2.5); g.restore();
  g.beginPath(); g.moveTo(22, -6); g.lineTo(37, -1); g.lineTo(22, 4); g.closePath(); fs(g, '#ffc928', 2.5);
  g.beginPath(); g.arc(13, -8, 4.5, 0, TAU); fs(g, '#fff', 2); g.beginPath(); g.arc(14.5, -8, 2.2, 0, TAU); g.fillStyle = OUT; g.fill();
  g.restore();
}
export function drawCoin(g, x, y, r, spin = 0) {
  const sx = Math.abs(Math.cos(spin)) * 0.85 + 0.15;
  g.save(); g.translate(x, y); g.scale(sx, 1);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = '#ffc928'; g.fill(); g.lineWidth = r * 0.22; g.strokeStyle = '#a86400'; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.strokeStyle = '#ffe98a'; g.lineWidth = r * 0.16; g.stroke();
  g.fillStyle = '#a86400'; g.font = `900 ${r * 1.15}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, r * 0.06);
  g.restore();
}
export function drawFountain(g, t = 0) {
  g.fillStyle = 'rgba(40,20,5,0.25)'; g.beginPath(); g.ellipse(2, 30, 44, 12, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, 16, 42, 22, 0, 0, TAU); fs(g, '#c9ced6', 3);
  g.beginPath(); g.ellipse(0, 13, 34, 16, 0, 0, TAU); fs(g, '#5fc8ff', 2.5);
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const k = (t * 0.6 + i * 0.5) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(0, 13, 8 + k * 24, 4 + k * 11, 0, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  rr(g, -6, -16, 12, 30, 4); fs(g, '#dfe3e8', 2.5);
  g.beginPath(); g.ellipse(0, -16, 14, 6, 0, 0, TAU); fs(g, '#c9ced6', 2.5);
  g.strokeStyle = '#bfeaff'; g.lineWidth = 3; g.lineCap = 'round';
  for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(s * 14, -44 - Math.sin(t * 5 + s) * 3, s * 24, -8); g.stroke(); }
}
export function drawCrownIcon(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-10, 6); g.lineTo(-12, -5); g.lineTo(-5, 0); g.lineTo(0, -8); g.lineTo(5, 0); g.lineTo(12, -5); g.lineTo(10, 6); g.closePath();
  g.fillStyle = '#ffc928'; g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- garden background
export function makeBackground(w, h, dpr, seed = 7) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gr = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, '#9be36a'); gr.addColorStop(0.6, '#62c34a'); gr.addColorStop(1, '#2f8f3a');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // mowing stripes
  g.save(); g.rotate(-0.35); g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = -h; x < w + h; x += 90) g.fillRect(x, -h, 45, h * 3);
  g.restore();
  const n = Math.round((w * h) / 2600);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(30,110,40,0.35)' : 'rgba(190,255,150,0.3)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 7); g.moveTo(x, y); g.lineTo(x + 3, y - 8); g.stroke();
  }
  const cols = ['#fff', '#ffe066', '#ffa8d0', '#c5b3ff'];
  for (let i = 0; i < n / 6; i++) {
    const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 2.5, col = cols[(rnd() * cols.length) | 0];
    g.fillStyle = col;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, TAU); g.fill(); }
    g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc(x, y, r * 0.6, 0, TAU); g.fill();
  }
  return c;
}
// the planter box the plots sit in
export function drawPlanter(g, x, y, s) {
  const p = s * 0.035;
  g.fillStyle = 'rgba(20,50,10,0.3)'; rr(g, x - p + 4, y - p + 8, s + p * 2, s + p * 2, s * 0.05); g.fill();
  rr(g, x - p, y - p, s + p * 2, s + p * 2, s * 0.05); g.fillStyle = '#b07a43'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
  rr(g, x - p * 0.3, y - p * 0.3, s + p * 0.6, s + p * 0.6, s * 0.035); g.fillStyle = '#7dcf5a'; g.fill(); g.strokeStyle = 'rgba(59,36,20,0.5)'; g.lineWidth = 2; g.stroke();
}
export function drawPlot(g, x, y, s, variant = 0) {
  const m = s * 0.06, r = s * 0.16;
  rr(g, x + m, y + m + 2, s - m * 2, s - m * 2, r); g.fillStyle = '#5e3a1b'; g.fill();
  rr(g, x + m, y + m, s - m * 2, s - m * 2 - 3, r); g.fillStyle = variant ? '#a87245' : '#b27a4b'; g.fill();
  g.fillStyle = 'rgba(70,40,15,0.22)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x + s * (0.28 + i * 0.22), y + s * (0.3 + ((i + variant) % 2) * 0.4), s * 0.07, s * 0.025, 0, 0, TAU); g.fill(); }
}
