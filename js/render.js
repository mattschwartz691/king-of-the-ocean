// King of the Ocean — canvas renderer (all art is procedural).
import { C, COLORS, mulberry32 } from './sim.js';

const TAU = Math.PI * 2;
const FONT = '900 {s}px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif';
const font = (s) => FONT.replace('{s}', s);
const PAD = 520;         // floor padding beyond world bounds
const FS = 0.5;          // floor texture scale
const POWER = [
  { name: 'SPEED!', col: '#5dffb0', glow: '80,255,170' },
  { name: 'SHIELD!', col: '#7cc8ff', glow: '110,190,255' },
  { name: 'ZAP!', col: '#ffe95a', glow: '255,230,80' },
];
const FISH_COL = [['#ff9a3c', '#ffe0b0'], ['#bfe6ff', '#ffffff'], ['#ff86b4', '#ffd6e6']];

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

function glowSprite(rgb, r, inner = 0.0, a = 1) {
  const c = mkCanvas(r * 2, r * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, r * inner, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(0.4, `rgba(${rgb},${a * 0.35})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

function makeCaustics(size) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data;
  const t = 2.3, inten = 0.005;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x / size) * TAU - 250, py = (y / size) * TAU - 250;
    let ix = px, iy = py, cc = 1;
    for (let n = 0; n < 5; n++) {
      const tt = t * (1 - 3.5 / (n + 1));
      const nx = px + Math.cos(tt - ix) + Math.sin(tt + iy);
      const ny = py + Math.sin(tt - iy) + Math.cos(tt + ix);
      ix = nx; iy = ny;
      cc += 1 / Math.hypot(px / (Math.sin(ix + tt) / inten), py / (Math.cos(iy + tt) / inten));
    }
    cc /= 5; cc = 1.17 - Math.pow(cc, 1.4);
    const v = Math.min(1, Math.pow(Math.abs(cc), 8));
    const o = (y * size + x) * 4;
    d[o] = 200; d[o + 1] = 255; d[o + 2] = 245; d[o + 3] = v * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function blobPath(g, x, y, r, rnd, n = 11, rough = 0.22) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (1 - rough + rnd() * rough * 2);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) g.moveTo(mx, my);
    const q2 = pts[(i + 2) % n];
    g.quadraticCurveTo(q[0], q[1], (q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2);
  }
  g.closePath();
}

function drawStar(g, x, y, r, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, rr = i % 2 ? r * 0.42 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = col; g.fill();
  g.restore();
}

function makeFloor(seed) {
  const w = (C.W + PAD * 2) * FS, h = (C.H + PAD * 2) * FS;
  const c = mkCanvas(w, h), g = c.getContext('2d');
  const rnd = mulberry32(seed * 31 + 5);
  g.scale(FS, FS); g.translate(PAD, PAD);
  g.fillStyle = '#04233f'; g.fillRect(-PAD, -PAD, C.W + PAD * 2, C.H + PAD * 2);
  let gr = g.createRadialGradient(C.W / 2, C.H / 2, 100, C.W / 2, C.H / 2, C.W * 0.72);
  gr.addColorStop(0, '#1c9cc0'); gr.addColorStop(0.5, '#1479a6'); gr.addColorStop(1, '#0c5482');
  g.fillStyle = gr; g.fillRect(0, 0, C.W, C.H);
  // sand & depth patches
  for (let i = 0; i < 46; i++) {
    const x = rnd() * C.W, y = rnd() * C.H, r = 120 + rnd() * 260;
    const sand = rnd() < 0.55;
    gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, sand ? 'rgba(255,236,170,0.13)' : 'rgba(0,30,70,0.16)');
    gr.addColorStop(1, sand ? 'rgba(255,236,170,0)' : 'rgba(0,30,70,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // sand ripples
  g.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const x = rnd() * C.W, y = rnd() * C.H, l = 50 + rnd() * 120;
    g.strokeStyle = `rgba(255,255,255,${0.025 + rnd() * 0.035})`; g.lineWidth = 3 + rnd() * 3;
    g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + l * 0.3, y - 10, x + l * 0.6, y + 10, x + l, y + (rnd() - 0.5) * 12);
    g.stroke();
  }
  // pebbles
  for (let i = 0; i < 260; i++) {
    const x = rnd() * C.W, y = rnd() * C.H, r = 2 + rnd() * 5;
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,25,55,0.25)' : 'rgba(210,235,255,0.14)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.8, rnd() * 3, 0, TAU); g.fill();
  }
  // starfish, shells
  const sc = ['#ff8a5c', '#ff6f91', '#ffc75f', '#c780ff'];
  for (let i = 0; i < 16; i++) {
    const x = 60 + rnd() * (C.W - 120), y = 60 + rnd() * (C.H - 120);
    g.globalAlpha = 0.25; drawStar(g, x + 3, y + 4, 15, rnd() * 6, '#001830');
    g.globalAlpha = 0.8; drawStar(g, x, y, 14 + rnd() * 5, rnd() * 6, sc[(rnd() * sc.length) | 0]);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 14; i++) {
    const x = rnd() * C.W, y = rnd() * C.H, a = rnd() * TAU;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(255,240,225,0.75)';
    g.beginPath(); g.moveTo(0, 8); g.arc(0, 0, 10, Math.PI * 0.15, Math.PI * 0.85, true); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(190,140,120,0.6)'; g.lineWidth = 1.2;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 8); g.lineTo(k * 4, -8 + Math.abs(k) * 2); g.stroke(); }
    g.restore();
  }
  // sea-grass tufts
  for (let i = 0; i < 70; i++) {
    const x = rnd() * C.W, y = rnd() * C.H;
    for (let k = 0; k < 5; k++) {
      const a = rnd() * TAU, l = 10 + rnd() * 16;
      g.strokeStyle = `rgba(${40 + rnd() * 40},${170 + rnd() * 60},${120 + rnd() * 40},0.45)`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6 - 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }
  // abyss frame bleeding inward
  g.save();
  g.shadowColor = '#021a30'; g.shadowBlur = 150 * FS;
  g.fillStyle = '#031e37';
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    g.rect(-PAD, -PAD, C.W + PAD * 2, C.H + PAD * 2);
    g.rect(-30, -30, C.W + 60, C.H + 60);
    g.fill('evenodd');
  }
  g.restore();
  return c;
}

function makeRockSprite(r, seed) {
  const S = 2, pad = 26, size = (r + pad) * 2;
  const c = mkCanvas(size * S, size * S), g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.scale(S, S); g.translate(size / 2, size / 2);
  // shadow
  g.save(); g.translate(9, 13); blobPath(g, 0, 0, r * 1.04, mulberry32(seed), 12, 0.14);
  g.fillStyle = 'rgba(0,16,40,0.38)'; g.filter = 'blur(5px)'; g.fill(); g.restore();
  blobPath(g, 0, 0, r, mulberry32(seed), 12, 0.14);
  let gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
  gr.addColorStop(0, '#8fa3bd'); gr.addColorStop(0.5, '#566a88'); gr.addColorStop(1, '#2a3855');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(12,22,45,0.75)'; g.lineWidth = 3; g.stroke();
  g.save(); g.clip();
  // facets
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU, d = rnd() * r * 0.6;
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,10,40,0.12)';
    blobPath(g, Math.cos(a) * d, Math.sin(a) * d, r * (0.25 + rnd() * 0.3), rnd, 7, 0.3); g.fill();
  }
  // moss
  for (let i = 0; i < 4; i++) {
    const a = rnd() * TAU, d = r * (0.5 + rnd() * 0.4);
    g.fillStyle = 'rgba(70,200,150,0.22)';
    blobPath(g, Math.cos(a) * d, Math.sin(a) * d, r * 0.3, rnd, 8, 0.3); g.fill();
  }
  g.restore();
  // coral tufts
  const cc = [['#ff7096', '#ffc2d1'], ['#ff9e4a', '#ffe0a8'], ['#c08bff', '#ead7ff'], ['#4be0d0', '#c8fff6']];
  const n = 2 + ((rnd() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = r * (0.2 + rnd() * 0.55);
    const x = Math.cos(a) * d, y = Math.sin(a) * d, col = cc[(rnd() * cc.length) | 0];
    const k = 6 + ((rnd() * 5) | 0), cr = 7 + rnd() * 6;
    for (let j = 0; j < k; j++) {
      const b = (j / k) * TAU + rnd(), dd = cr * (0.7 + rnd() * 0.8);
      g.strokeStyle = 'rgba(20,10,40,0.5)'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * dd, y + Math.sin(b) * dd); g.stroke();
      g.strokeStyle = col[0]; g.lineWidth = 4.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * dd, y + Math.sin(b) * dd); g.stroke();
      g.fillStyle = col[1]; g.beginPath(); g.arc(x + Math.cos(b) * dd, y + Math.sin(b) * dd, 2.2, 0, TAU); g.fill();
    }
  }
  return { c, size };
}

export function drawCrown(g, x, y, s, t = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-17, 10); g.lineTo(-20, -7); g.lineTo(-9, 1); g.lineTo(0, -14); g.lineTo(9, 1); g.lineTo(20, -7); g.lineTo(17, 10);
  g.closePath();
  const gr = g.createLinearGradient(0, -14, 0, 11);
  gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.45, '#ffcb2e'); gr.addColorStop(1, '#f08c00');
  g.fillStyle = gr; g.strokeStyle = '#7a4300'; g.lineWidth = 2.4; g.stroke(); g.fill();
  g.fillStyle = '#e88a00'; g.fillRect(-16.5, 4.5, 33, 5);
  g.fillStyle = '#fff3a8';
  for (const [bx, by] of [[-20, -7], [0, -14], [20, -7]]) { g.beginPath(); g.arc(bx, by, 3.1, 0, TAU); g.fill(); g.stroke(); g.fill(); }
  g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, 6.5, 2.6, 0, TAU); g.fill();
  g.fillStyle = '#4dc9ff'; g.beginPath(); g.arc(-9.5, 6.5, 2, 0, TAU); g.arc(9.5, 6.5, 2, 0, TAU); g.fill();
  // glint
  const gl = (Math.sin(t * 3) + 1) / 2;
  g.fillStyle = `rgba(255,255,255,${0.35 + gl * 0.5})`;
  g.beginPath(); g.ellipse(-6, -2, 1.6, 4, 0.5, 0, TAU); g.fill();
  g.restore();
}

// width profile of the sawfish body (half-widths along spine, head -> tail)
const WPROF = [8.5, 12.5, 15.5, 16.5, 15.5, 13.5, 11, 8.5, 6.2, 4.3, 3];
const NSP = WPROF.length - 1;

function spine(swim, amp) {
  const pts = [];
  for (let i = 0; i <= NSP; i++) {
    const u = i / NSP;
    pts.push([36 - u * 98, Math.sin(swim - u * 3.6) * amp * u * u]);
  }
  return pts;
}

export function drawSawfish(g, col, o) {
  // o: swim, amp, shadow, dash(0..1), stun, frenzy, t, scale
  const pts = spine(o.swim, o.amp);
  const shadow = o.shadow;
  const outline = 'rgba(6,18,44,0.8)';
  g.lineJoin = 'round'; g.lineCap = 'round';
  const flap = 1 + Math.sin(o.swim * 0.5) * 0.06;

  // normals
  const L = [], R = [];
  for (let i = 0; i <= NSP; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(NSP, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = WPROF[i];
    L.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
    R.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
  }
  const tail = pts[NSP], tprev = pts[NSP - 2];
  const ta = Math.atan2(tail[1] - tprev[1], tail[0] - tprev[0]);

  const fill = (c) => { if (shadow) { g.fill(); } else { g.fillStyle = c; g.fill(); g.strokeStyle = outline; g.lineWidth = 2.2; g.stroke(); } };

  // ---- rostrum (the saw)
  const sx0 = 40, sx1 = C.SAW1 + 2;
  if (!shadow) {
    // teeth
    g.beginPath();
    const nt = 9;
    for (let i = 0; i < nt; i++) {
      const x = sx0 + 6 + (i / (nt - 1)) * (sx1 - sx0 - 12);
      const hw = 5.4 - (i / nt) * 1.4;
      for (const s of [-1, 1]) {
        g.moveTo(x - 2.4, s * (hw - 0.5)); g.lineTo(x + 0.6, s * (hw + 6.4)); g.lineTo(x + 2.6, s * (hw - 0.5));
      }
    }
    g.fillStyle = o.frenzy ? '#fff1c4' : '#f4fbff'; g.strokeStyle = outline; g.lineWidth = 1.6; g.stroke(); g.fill();
  }
  g.beginPath();
  g.moveTo(sx0 - 6, -6.4); g.lineTo(sx1 - 4, -3.8); g.quadraticCurveTo(sx1 + 2, 0, sx1 - 4, 3.8); g.lineTo(sx0 - 6, 6.4); g.closePath();
  if (shadow) g.fill();
  else {
    const gr = g.createLinearGradient(sx0, 0, sx1, 0);
    gr.addColorStop(0, col.main); gr.addColorStop(0.35, col.light); gr.addColorStop(1, '#fdfdf2');
    g.fillStyle = gr; g.fill(); g.strokeStyle = outline; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(0,20,50,0.18)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(sx0, 0); g.lineTo(sx1 - 6, 0); g.stroke();
    if (o.dash > 0 || o.frenzy) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = o.frenzy ? `rgba(255,150,40,${0.55 + 0.3 * Math.sin(o.t * 18)})` : `rgba(255,255,255,${0.8 * o.dash})`;
      g.lineWidth = 9; g.beginPath(); g.moveTo(sx0, 0); g.lineTo(sx1, 0); g.stroke();
      g.restore();
    }
  }

  // ---- pectoral fins
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(24, s * 11);
    g.quadraticCurveTo(14, s * 30 * flap, -6, s * 41 * flap);
    g.quadraticCurveTo(-13, s * 30, -18, s * 13);
    g.closePath();
    fill(col.main);
    if (!shadow) {
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(12, s * 16); g.quadraticCurveTo(6, s * 28, -5, s * 36 * flap); g.stroke();
    }
  }
  // pelvic fins
  {
    const p = pts[6];
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(p[0] + 6, p[1] + s * 9); g.lineTo(p[0] - 9, p[1] + s * 21); g.lineTo(p[0] - 11, p[1] + s * 8); g.closePath();
      fill(col.main);
    }
  }
  // tail fin
  g.save(); g.translate(tail[0], tail[1]); g.rotate(ta);
  g.beginPath();
  g.moveTo(4, 0); g.quadraticCurveTo(-8, -6, -24, -17); g.quadraticCurveTo(-16, -3, -15, 0); g.quadraticCurveTo(-16, 3, -24, 17); g.quadraticCurveTo(-8, 6, 4, 0);
  g.closePath(); fill(col.dark);
  g.restore();

  // ---- body
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= NSP; i++) {
    const p = L[i - 1], q = L[i];
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.lineTo(L[NSP][0], L[NSP][1]); g.lineTo(R[NSP][0], R[NSP][1]);
  for (let i = NSP - 1; i >= 0; i--) {
    const p = R[i + 1], q = R[i];
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.lineTo(R[0][0], R[0][1]);
  g.bezierCurveTo(44, 8, 44, -8, L[0][0], L[0][1]);
  g.closePath();
  if (shadow) { g.fill(); return; }
  const bg = g.createLinearGradient(0, -17, 0, 17);
  bg.addColorStop(0, col.light); bg.addColorStop(0.3, col.main); bg.addColorStop(0.7, col.main); bg.addColorStop(1, col.dark);
  g.fillStyle = bg; g.fill(); g.strokeStyle = outline; g.lineWidth = 2.4; g.stroke();

  // back stripe
  g.beginPath();
  g.moveTo(pts[0][0] + 2, pts[0][1]);
  for (let i = 1; i <= NSP; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokeStyle = col.dark; g.globalAlpha *= 0.55; g.lineWidth = 9; g.stroke();
  g.globalAlpha /= 0.55;
  // spots
  g.fillStyle = 'rgba(255,255,255,0.3)';
  for (const [i, s, r] of [[2, -1, 2.4], [3, 1, 2], [4, -1, 1.7], [5, 1, 1.6], [3, -1, 1.5]]) {
    const p = pts[i]; g.beginPath(); g.arc(p[0] - (r > 2 ? 0 : 5), p[1] + s * WPROF[i] * 0.55, r, 0, TAU); g.fill();
  }
  // dorsal fins
  for (const [i, len] of [[4, 15], [7, 11]]) {
    const p = pts[i], q = pts[i + 1];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    g.save(); g.translate(p[0], p[1]); g.rotate(a);
    g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(len * 0.5, -5, len, 0); g.quadraticCurveTo(len * 0.5, 5, -2, 0);
    g.fillStyle = col.dark; g.fill(); g.strokeStyle = 'rgba(6,18,44,0.5)'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }
  // eyes
  for (const s of [-1, 1]) {
    const ex = 27, ey = s * 9.2;
    g.beginPath(); g.arc(ex, ey, 4.6, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = outline; g.lineWidth = 1.5; g.stroke();
    if (o.stun > 0) {
      g.strokeStyle = '#1a2340'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(ex - 2.2, ey - 2.2); g.lineTo(ex + 2.2, ey + 2.2); g.moveTo(ex + 2.2, ey - 2.2); g.lineTo(ex - 2.2, ey + 2.2); g.stroke();
    } else {
      g.beginPath(); g.arc(ex + 1.3, ey, 2.5, 0, TAU); g.fillStyle = '#101830'; g.fill();
      g.beginPath(); g.arc(ex + 2.1, ey - 0.9, 0.9, 0, TAU); g.fillStyle = '#fff'; g.fill();
    }
  }
}

function drawFish(g, f, t) {
  const gold = f.type === 1;
  const s = gold ? 1.5 : 1;
  const wig = Math.sin(t * 14 + f.id * 1.3) * 0.5;
  const col = gold ? ['#ffd43b', '#fff6c2'] : FISH_COL[f.hue % 3];
  g.save(); g.translate(f.x, f.y); g.rotate(f.ang); g.scale(s, s);
  g.beginPath(); g.moveTo(-7, 0); g.lineTo(-15, -6 + wig * 3); g.lineTo(-13, wig * 4); g.lineTo(-15, 6 + wig * 3); g.closePath();
  g.fillStyle = col[0]; g.strokeStyle = 'rgba(6,18,44,0.7)'; g.lineWidth = 1.4; g.stroke(); g.fill();
  g.beginPath(); g.ellipse(0, 0, 10, 5.6, 0, 0, TAU);
  g.fillStyle = col[0]; g.stroke(); g.fill();
  g.beginPath(); g.ellipse(1, -1.5, 6, 2.2, 0, 0, TAU); g.fillStyle = col[1]; g.globalAlpha = 0.7; g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.arc(6, -1.6, 1.3, 0, TAU); g.arc(6, 1.6, 1.3, 0, TAU); g.fillStyle = '#0c1530'; g.fill();
  g.restore();
}

function bolt(g, x0, y0, x1, y1, jag, seg = 5) {
  g.moveTo(x0, y0);
  for (let i = 1; i < seg; i++) {
    const u = i / seg;
    g.lineTo(x0 + (x1 - x0) * u + (Math.random() - 0.5) * jag, y0 + (y1 - y0) * u + (Math.random() - 0.5) * jag);
  }
  g.lineTo(x1, y1);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1, sw = 1, sh = 1, zoom = 1;
  let floor = null, floorSeed = -1, rockSprites = [], kelp = [], wall = [];
  const caust = makeCaustics(256);
  const causticPat = ctx.createPattern(caust, 'repeat');
  const sprites = {
    jelly: glowSprite('255,120,220', 64, 0.1, 0.55),
    gold: glowSprite('255,215,80', 64, 0.05, 0.8),
    white: glowSprite('255,255,255', 48, 0, 0.9),
    orange: glowSprite('255,130,40', 64, 0.1, 0.7),
    cyan: glowSprite('110,240,255', 64, 0.1, 0.7),
    pw: POWER.map((p) => glowSprite(p.glow, 56, 0.1, 0.6)),
  };
  let vignette = null;
  const cam = { x: C.W / 2, y: C.H / 2, init: false };
  const parts = [];
  const anim = new Map();
  const plankton = [];
  for (let i = 0; i < 46; i++) plankton.push({ x: Math.random(), y: Math.random(), z: 0.6 + Math.random() * 0.9, r: 0.8 + Math.random() * 1.8, p: Math.random() * TAU });
  let shake = 0, flash = 0, time = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    sw = window.innerWidth; sh = window.innerHeight;
    canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
    canvas.style.width = sw + 'px'; canvas.style.height = sh + 'px';
    zoom = Math.sqrt((sw * sh) / (940 * 540));
    zoom = Math.max(zoom, sw / 1500, sh / 1100);
    vignette = mkCanvas(256, 256);
    const g = vignette.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,12,40,0)'); gr.addColorStop(0.6, 'rgba(0,12,40,0.12)'); gr.addColorStop(1, 'rgba(0,8,30,0.62)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }

  function setWorld(seed, rocks) {
    if (seed === floorSeed) return;
    floorSeed = seed;
    floor = makeFloor(seed);
    rockSprites = rocks.map((r, i) => makeRockSprite(r.r, seed * 17 + i * 101));
    const rnd = mulberry32(seed * 3 + 77);
    kelp = [];
    for (let i = 0; i < 17; i++) {
      let x, y;
      if (i < rocks.length) { const r = rocks[i], a = rnd() * TAU; x = r.x + Math.cos(a) * (r.r + 20); y = r.y + Math.sin(a) * (r.r + 20); }
      else { x = 100 + rnd() * (C.W - 200); y = 100 + rnd() * (C.H - 200); if (Math.hypot(x - C.W / 2, y - C.H / 2) < 300) continue; }
      const fr = [];
      const n = 5 + ((rnd() * 4) | 0);
      for (let k = 0; k < n; k++) fr.push({ a: (k / n) * TAU + rnd() * 0.6, l: 32 + rnd() * 40, p: rnd() * TAU, c: rnd() });
      kelp.push({ x, y, fr });
    }
    wall = [];
    const add = (x, y) => wall.push({ x, y, r: 62 + rnd() * 50, s: rnd() });
    for (let x = -40; x <= C.W + 40; x += 78) { add(x, -58 - rnd() * 30); add(x, C.H + 58 + rnd() * 30); }
    for (let y = -40; y <= C.H + 40; y += 78) { add(-58 - rnd() * 30, y); add(C.W + 58 + rnd() * 30, y); }
    parts.length = 0; anim.clear(); cam.init = false;
  }

  // ------------------------------------------------------------ particles
  function P(o) { if (parts.length < 500) parts.push(o); }
  function burst(x, y, n, col, spd, life, size, kind = 's') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7);
      P({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.8), col });
    }
  }
  function ring(x, y, col, r1, life = 0.45, w = 6) { P({ k: 'r', x, y, vx: 0, vy: 0, life, max: life, size: r1, col, w }); }
  function text(x, y, str, col, size = 26) { P({ k: 't', x, y: y - 30, vx: 0, vy: -46, life: 1.15, max: 1.15, size, col, str }); }
  function bubbles(x, y, n, spread = 14) {
    for (let i = 0; i < n; i++) P({ k: 'b', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, vx: (Math.random() - 0.5) * 30, vy: -14 - Math.random() * 30, life: 0.7 + Math.random() * 0.8, max: 1.5, size: 2 + Math.random() * 4.5 });
  }
  function confetti(x, y, n) {
    const cols = ['#ff5d62', '#ffc83a', '#2fe3a6', '#b98aff', '#5ac8ff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 80 + Math.random() * 420;
      P({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.6 + Math.random() * 1.4, max: 3, size: 5 + Math.random() * 6, col: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  }

  function onEvent(e, st, me) {
    const mine = e.p === me || e.a === me;
    const pcol = (i) => COLORS[st.players[i]?.color ?? 0];
    switch (e.t) {
      case 'dash': bubbles(e.x, e.y, 8, 30); break;
      case 'hit':
        ring(e.x, e.y, '#ffffff', 90, 0.35, 8); burst(e.x, e.y, 16, '#ffffff', 420, 0.45, 4);
        burst(e.x, e.y, 10, pcol(e.p).main, 300, 0.6, 5);
        text(e.x, e.y, e.k ? 'CROWN DROPPED!' : 'SLASH!', e.k ? '#ffd43b' : '#ffffff', e.k ? 30 : 26);
        shake = Math.max(shake, mine ? 16 : 6); if (e.p === me) flash = 0.5;
        bubbles(e.x, e.y, 10, 40);
        break;
      case 'zap':
        ring(e.x, e.y, '#ffe95a', 110, 0.4, 7); burst(e.x, e.y, 18, '#fff7a0', 460, 0.4, 4);
        text(e.x, e.y, e.k ? 'CROWN DROPPED!' : 'ZAPPED!', '#ffe95a', 28); shake = Math.max(shake, mine ? 14 : 5); if (e.p === me) flash = 0.5;
        break;
      case 'sting':
        ring(e.x, e.y, '#ff8ae0', 80, 0.4, 6); burst(e.x, e.y, 14, '#ffb3ec', 320, 0.5, 4);
        text(e.x, e.y, 'STUNG!', '#ff9be6', 26); if (e.p === me) { shake = Math.max(shake, 12); flash = 0.4; }
        break;
      case 'clash':
        ring(e.x, e.y, '#ffffff', 120, 0.4, 10); burst(e.x, e.y, 26, '#fff3b0', 560, 0.5, 4.5);
        text(e.x, e.y, 'CLASH!', '#fff3b0', 32); shake = Math.max(shake, 10);
        break;
      case 'shieldpop':
        ring(e.x, e.y, '#9fd8ff', 80, 0.4, 6); bubbles(e.x, e.y, 18, 60); text(e.x, e.y, 'BLOCKED!', '#9fd8ff', 26);
        break;
      case 'eat':
        if (e.g) { ring(e.x, e.y, '#ffd43b', 90, 0.5, 8); burst(e.x, e.y, 20, '#ffe680', 340, 0.7, 5); }
        else { burst(e.x, e.y, 5, FISH_COL[(Math.random() * 3) | 0][0], 150, 0.35, 3.2); bubbles(e.x, e.y, 3); }
        break;
      case 'frenzy':
        ring(e.x, e.y, '#ff9b3d', 130, 0.6, 10); burst(e.x, e.y, 22, '#ffb347', 380, 0.7, 5);
        text(e.x, e.y, 'FEEDING FRENZY!', '#ffa94d', 30);
        break;
      case 'crown':
        ring(e.x, e.y, '#ffd43b', 120, 0.6, 9); ring(e.x, e.y, '#fff3b0', 70, 0.4, 5); burst(e.x, e.y, 22, '#ffe680', 360, 0.8, 5);
        break;
      case 'pop':
        ring(e.x, e.y, '#ff8ae0', 60, 0.35, 5); burst(e.x, e.y, 12, '#ffb3ec', 260, 0.5, 5, 'b');
        break;
      case 'power':
        ring(e.x, e.y, POWER[e.k].col, 80, 0.45, 7); bubbles(e.x, e.y, 10, 40); text(e.x, e.y, POWER[e.k].name, POWER[e.k].col, 26);
        break;
      case 'win': confetti(e.x, e.y, 160); shake = 14; break;
    }
  }

  // ------------------------------------------------------------ draw
  function draw(st, o) {
    const dt = Math.min(0.05, o.dt || 0.016);
    time += dt;
    const t = time;
    const me = o.me ?? -1;

    // camera
    let fx = o.fx ?? C.W / 2, fy = o.fy ?? C.H / 2;
    const vw = sw / zoom, vh = sh / zoom;
    const over = 150;
    const cl = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    fx = cl(fx, vw / 2 - over, C.W - vw / 2 + over); fy = cl(fy, vh / 2 - over, C.H - vh / 2 + over);
    if (!cam.init) { cam.x = fx; cam.y = fy; cam.init = true; }
    const ck = 1 - Math.exp(-(o.camRate ?? 7) * dt);
    cam.x += (fx - cam.x) * ck; cam.y += (fy - cam.y) * ck;
    shake *= Math.exp(-9 * dt); flash = Math.max(0, flash - dt * 1.6);
    const shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
    const cx = cam.x + shx, cy = cam.y + shy;
    const vl = cx - vw / 2, vt = cy - vh / 2;
    const vis = (x, y, m) => x > vl - m && x < vl + vw + m && y > vt - m && y < vt + vh + m;

    const world = () => ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -vl * dpr * zoom, -vt * dpr * zoom);
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    screen(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#031e37'; ctx.fillRect(0, 0, sw, sh);
    world();
    if (floor) {
      // draw only the visible slice of the floor texture
      const sx = Math.max(0, (vl + PAD) * FS), sy = Math.max(0, (vt + PAD) * FS);
      const sx2 = Math.min(floor.width, (vl + vw + PAD) * FS), sy2 = Math.min(floor.height, (vt + vh + PAD) * FS);
      if (sx2 > sx && sy2 > sy) ctx.drawImage(floor, sx, sy, sx2 - sx, sy2 - sy, sx / FS - PAD, sy / FS - PAD, (sx2 - sx) / FS, (sy2 - sy) / FS);
    }

    // caustics (two drifting layers)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const sc = i ? 2.3 : 1.55;
      const ox = (t * (i ? 13 : -9)) % (256 * sc), oy = (t * (i ? 7 : 11)) % (256 * sc);
      ctx.save();
      ctx.translate(ox, oy); ctx.scale(sc, sc);
      ctx.globalAlpha = i ? 0.10 : 0.16;
      ctx.fillStyle = causticPat;
      ctx.fillRect((vl - ox) / sc - 2, (vt - oy) / sc - 2, vw / sc + 4, vh / sc + 4);
      ctx.restore();
    }
    ctx.restore();

    // reef wall
    for (const w of wall) {
      if (!vis(w.x, w.y, w.r + 20)) continue;
      ctx.fillStyle = '#062a49';
      ctx.beginPath(); ctx.arc(w.x + 5, w.y + 8, w.r + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = w.s < 0.5 ? '#0c3a5f' : '#0e4268';
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.fill();
      ctx.fillStyle = w.s < 0.5 ? '#0f466f' : '#114d78';
      ctx.beginPath(); ctx.ellipse(w.x - w.r * 0.14, w.y - w.r * 0.16, w.r * 0.72, w.r * 0.62, w.s * 6, 0, TAU); ctx.fill();
      ctx.fillStyle = w.s > 0.66 ? 'rgba(255,120,160,0.5)' : w.s > 0.33 ? 'rgba(80,220,190,0.45)' : 'rgba(255,190,90,0.45)';
      for (let k = 0; k < 4; k++) {
        const a = w.s * 40 + k * 1.9, d = w.r * (0.25 + ((k * 37) % 10) / 22);
        ctx.beginPath(); ctx.arc(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 5 + (k % 2) * 3, 0, TAU); ctx.fill();
      }
    }

    // rocks
    st.rocks.forEach((r, i) => {
      const sp = rockSprites[i];
      if (!sp || !vis(r.x, r.y, r.r + 40)) return;
      ctx.drawImage(sp.c, r.x - sp.size / 2, r.y - sp.size / 2, sp.size, sp.size);
    });

    // ---- shadows
    ctx.fillStyle = 'rgba(0,18,48,0.26)';
    for (const p of st.players) {
      if (!vis(p.x, p.y, 160)) continue;
      const a = getAnim(p, dt);
      ctx.save(); ctx.translate(p.x + 10, p.y + 16); ctx.rotate(p.ang); ctx.scale(1.02, 1.02);
      drawSawfish(ctx, COLORS[0], { swim: a.swim, amp: a.amp, shadow: true });
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,18,48,0.2)';
    for (const f of st.fish) { if (vis(f.x, f.y, 30)) { ctx.beginPath(); ctx.ellipse(f.x + 6, f.y + 10, 9, 5, f.ang, 0, TAU); ctx.fill(); } }
    for (const j of st.jelly) { if (!j.dead && vis(j.x, j.y, 60)) { ctx.beginPath(); ctx.arc(j.x + 9, j.y + 14, 23, 0, TAU); ctx.fill(); } }
    for (const b of st.bubbles) { if (vis(b.x, b.y, 60)) { ctx.beginPath(); ctx.ellipse(b.x + 9, b.y + 18, 20, 14, 0, 0, TAU); ctx.fill(); } }

    // ---- power-up bubbles
    for (const b of st.bubbles) {
      if (!vis(b.x, b.y, 80)) continue;
      const bob = Math.sin(t * 2.4 + b.id) * 3, pu = POWER[b.type], R = 25 + Math.sin(t * 3 + b.id) * 1.2;
      const y = b.y + bob;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprites.pw[b.type], b.x - 62, y - 62, 124, 124);
      ctx.globalCompositeOperation = 'source-over';
      const gr = ctx.createRadialGradient(b.x - 8, y - 9, 2, b.x, y, R);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, `rgba(${pu.glow},0.22)`); gr.addColorStop(1, `rgba(${pu.glow},0.5)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(b.x, y, R - 6, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
      // icon
      ctx.save(); ctx.translate(b.x, y);
      ctx.fillStyle = pu.col; ctx.strokeStyle = 'rgba(6,18,44,0.85)'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (b.type === 0) {
        for (const dx of [-8, 2]) { ctx.moveTo(dx - 3, -9); ctx.lineTo(dx + 7, 0); ctx.lineTo(dx - 3, 9); ctx.lineTo(dx, 0); ctx.closePath(); }
      } else if (b.type === 1) {
        ctx.moveTo(0, -12); ctx.lineTo(10, -8); ctx.quadraticCurveTo(10, 6, 0, 12); ctx.quadraticCurveTo(-10, 6, -10, -8); ctx.closePath();
      } else {
        ctx.moveTo(3, -13); ctx.lineTo(-8, 2); ctx.lineTo(-1, 2); ctx.lineTo(-4, 13); ctx.lineTo(8, -3); ctx.lineTo(1, -3); ctx.closePath();
      }
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }

    // ---- fish
    for (const f of st.fish) {
      if (!vis(f.x, f.y, 50)) continue;
      if (f.type === 1) {
        ctx.globalCompositeOperation = 'lighter';
        const s = 90 + Math.sin(t * 6) * 10;
        ctx.drawImage(sprites.gold, f.x - s / 2, f.y - s / 2, s, s);
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.3) P({ k: 's', x: f.x, y: f.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.5, max: 0.5, size: 3, col: '#ffe680' });
      }
      drawFish(ctx, f, t);
    }

    // ---- jellyfish
    st.jelly.forEach((j, i) => {
      if (j.dead || !vis(j.x, j.y, 80)) return;
      const pulse = Math.sin(t * 2.6 + i * 1.7), R = 24 + pulse * 2.2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprites.jelly, j.x - 70, j.y - 70, 140, 140);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,190,240,0.55)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + i, l = 20 - pulse * 5;
        const wx = Math.sin(t * 3 + k * 2 + i) * 6;
        const x0 = j.x + Math.cos(a) * (R - 3), y0 = j.y + Math.sin(a) * (R - 3);
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(j.x + Math.cos(a) * (R + l * 0.5) + wx, j.y + Math.sin(a) * (R + l * 0.5) + wx, j.x + Math.cos(a + 0.15) * (R + l), j.y + Math.sin(a + 0.15) * (R + l));
      }
      ctx.stroke();
      const gr = ctx.createRadialGradient(j.x - 6, j.y - 7, 2, j.x, j.y, R);
      gr.addColorStop(0, 'rgba(255,235,255,0.95)'); gr.addColorStop(0.55, 'rgba(255,140,225,0.8)'); gr.addColorStop(1, 'rgba(170,90,255,0.72)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(j.x, j.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,255,0.9)'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.8;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + i + Math.PI / 4;
        ctx.beginPath(); ctx.ellipse(j.x + Math.cos(a) * 7.5, j.y + Math.sin(a) * 7.5, 5.5, 4, a, 0, TAU); ctx.stroke();
      }
    });

    // ---- free crown
    const cr = st.crown;
    if (cr.holder < 0 && vis(cr.x, cr.y, 120)) {
      const bob = Math.sin(t * 3) * 4;
      ctx.fillStyle = 'rgba(0,18,48,0.25)'; ctx.beginPath(); ctx.ellipse(cr.x + 8, cr.y + 22, 20, 9, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const s = 150 + Math.sin(t * 4) * 16;
      ctx.drawImage(sprites.gold, cr.x - s / 2, cr.y - s / 2 + bob, s, s);
      ctx.save(); ctx.translate(cr.x, cr.y + bob); ctx.rotate(t * 0.6);
      ctx.fillStyle = 'rgba(255,225,120,0.16)';
      for (let k = 0; k < 8; k++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70, -9); ctx.lineTo(70, 9); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      drawCrown(ctx, cr.x, cr.y + bob, 1.45, t);
      if (Math.random() < 0.25) P({ k: 's', x: cr.x + (Math.random() - 0.5) * 50, y: cr.y + (Math.random() - 0.5) * 40, vx: 0, vy: -30, life: 0.6, max: 0.6, size: 3, col: '#fff3b0' });
    }

    // ---- players
    for (const p of st.players) {
      const a = getAnim(p, 0);
      // dash trail
      if (a.trail.length > 1) {
        ctx.lineCap = 'round';
        const col = COLORS[p.color];
        for (let i = 1; i < a.trail.length; i++) {
          const q0 = a.trail[i - 1], q1 = a.trail[i];
          const k = q1.life / 0.35;
          if (k <= 0) continue;
          ctx.strokeStyle = col.light; ctx.globalAlpha = 0.5 * k; ctx.lineWidth = 30 * k;
          ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5 * k; ctx.lineWidth = 10 * k;
          ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (!vis(p.x, p.y, 180)) continue;
      const col = COLORS[p.color];
      const isKing = cr.holder === p.id;
      // auras
      ctx.globalCompositeOperation = 'lighter';
      if (isKing) { const s = 210 + Math.sin(t * 5) * 14; ctx.globalAlpha = 0.75; ctx.drawImage(sprites.gold, p.x - s / 2, p.y - s / 2, s, s); }
      if (p.frenzyT > 0) { const s = 190 + Math.sin(t * 12) * 18; ctx.globalAlpha = Math.min(1, p.frenzyT); ctx.drawImage(sprites.orange, p.x - s / 2, p.y - s / 2, s, s); }
      if (p.zapT > 0) { const s = 200; ctx.globalAlpha = Math.min(1, p.zapT) * 0.8; ctx.drawImage(sprites.cyan, p.x - s / 2, p.y - s / 2, s, s); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      if (p.inv > 0 && p.stun <= 0 && Math.sin(t * 40) > 0) ctx.globalAlpha = 0.45;
      const sq = p.dashT > 0 ? 1.1 : 1;
      ctx.scale(sq, 1 / sq);
      drawSawfish(ctx, col, { swim: a.swim, amp: a.amp, dash: Math.min(1, p.dashT / 0.15), stun: p.stun, frenzy: p.frenzyT > 0, t });
      ctx.restore(); ctx.globalAlpha = 1;

      if (p.speedT > 0) {
        ctx.strokeStyle = 'rgba(140,255,200,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const bx = -Math.cos(p.ang), by = -Math.sin(p.ang);
        for (let k = -1; k <= 1; k++) {
          const ox = -by * k * 16, oy = bx * k * 16, ph = (t * 4 + k * 0.37 + 1) % 1;
          ctx.globalAlpha = (1 - ph) * Math.min(1, p.speedT);
          ctx.beginPath(); ctx.moveTo(p.x + ox + bx * (50 + ph * 40), p.y + oy + by * (50 + ph * 40)); ctx.lineTo(p.x + ox + bx * (72 + ph * 40), p.y + oy + by * (72 + ph * 40)); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (p.zapT > 0) {
        ctx.strokeStyle = 'rgba(255,255,170,0.95)'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a0 = Math.random() * TAU, a1 = a0 + 0.8 + Math.random();
          bolt(ctx, p.x + Math.cos(a0) * 34, p.y + Math.sin(a0) * 34, p.x + Math.cos(a1) * 64, p.y + Math.sin(a1) * 64, 20);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(120,240,255,${0.35 + 0.2 * Math.sin(t * 20)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, C.PR * 2 + 20, 0, TAU); ctx.stroke();
      }
      if (p.shield > 0) {
        const R = 62 + Math.sin(t * 4) * 2;
        const blink = p.shield < 2.5 && Math.sin(t * 16) > 0 ? 0.4 : 1;
        const gr = ctx.createRadialGradient(p.x - 16, p.y - 20, 6, p.x, p.y, R);
        gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.7, 'rgba(120,200,255,0.10)'); gr.addColorStop(1, 'rgba(120,200,255,0.42)');
        ctx.globalAlpha = blink; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,235,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(p.x, p.y, R - 9, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (p.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const a0 = t * 7 + (k / 3) * TAU;
          drawStar(ctx, p.x + Math.cos(a0) * 30, p.y - 34 + Math.sin(a0) * 9, 7, t * 4, '#ffe95a');
        }
      }
      // trail emitters
      if (p.dashT > 0 && Math.random() < 0.9) bubbles(p.x - Math.cos(p.ang) * 40, p.y - Math.sin(p.ang) * 40, 1, 26);
      else if (Math.hypot(p.vx, p.vy) > 120 && Math.random() < 0.12) bubbles(p.x - Math.cos(p.ang) * 55, p.y - Math.sin(p.ang) * 55, 1, 10);
      if (p.frenzyT > 0 && Math.random() < 0.5) P({ k: 's', x: p.x + (Math.random() - 0.5) * 50, y: p.y + (Math.random() - 0.5) * 50, vx: 0, vy: -70, life: 0.5, max: 0.5, size: 4, col: '#ffb347' });
    }

    // ---- kelp (above players)
    ctx.lineCap = 'round';
    for (const kp of kelp) {
      if (!vis(kp.x, kp.y, 130)) continue;
      for (const f of kp.fr) {
        const sway = Math.sin(t * 1.3 + f.p) * 0.28;
        const a1 = f.a + sway * 0.5, a2 = f.a + sway;
        const mx = kp.x + Math.cos(a1) * f.l * 0.55, my = kp.y + Math.sin(a1) * f.l * 0.55;
        const ex = kp.x + Math.cos(a2) * f.l, ey = kp.y + Math.sin(a2) * f.l;
        ctx.strokeStyle = 'rgba(4,50,50,0.45)'; ctx.lineWidth = 9.5;
        ctx.beginPath(); ctx.moveTo(kp.x, kp.y); ctx.quadraticCurveTo(mx + 6, my + 6, ex, ey); ctx.stroke();
        ctx.strokeStyle = f.c < 0.5 ? 'rgba(46,170,110,0.88)' : 'rgba(70,196,120,0.88)'; ctx.lineWidth = 6.5;
        ctx.beginPath(); ctx.moveTo(kp.x, kp.y); ctx.quadraticCurveTo(mx + 6, my + 6, ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(190,255,190,0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(kp.x, kp.y); ctx.quadraticCurveTo(mx + 6, my + 6, ex, ey); ctx.stroke();
      }
      ctx.fillStyle = '#1d7a5a'; ctx.beginPath(); ctx.arc(kp.x, kp.y, 7, 0, TAU); ctx.fill();
    }

    // ---- crowns + name tags on top
    for (const p of st.players) {
      if (!vis(p.x, p.y, 120)) continue;
      const isKing = cr.holder === p.id;
      if (isKing) drawCrown(ctx, p.x + Math.cos(p.ang) * 6, p.y + Math.sin(p.ang) * 6 - 30 + Math.sin(t * 5) * 2, 1.2, t);
      if (o.names !== false) {
        const col = COLORS[p.color];
        ctx.font = font(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const y = p.y + 58;
        const label = p.id === me ? 'YOU' : p.name;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(4,16,40,0.75)'; ctx.strokeText(label, p.x, y);
        ctx.fillStyle = col.light; ctx.fillText(label, p.x, y);
      }
    }

    // ---- particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      const k = q.life / q.max;
      if (q.k === 's') {
        q.vx *= 1 - 3 * dt; q.vy *= 1 - 3 * dt;
        ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = q.col;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + k * 0.6), 0, TAU); ctx.fill();
      } else if (q.k === 'b') {
        q.vx *= 1 - 2 * dt;
        ctx.globalAlpha = Math.min(0.75, k * 1.5);
        ctx.strokeStyle = 'rgba(225,250,255,0.95)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.3 - k * 0.4), 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      } else if (q.k === 'r') {
        const e = 1 - k, r = q.size * (1 - Math.pow(1 - e, 3));
        ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = q.w * k + 0.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
      } else if (q.k === 'c') {
        q.vx *= 1 - 2.2 * dt; q.vy = q.vy * (1 - 2.2 * dt) + 60 * dt; q.rot += q.vr * dt;
        ctx.globalAlpha = Math.min(1, k * 3); ctx.fillStyle = q.col;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.rot * 1.7));
        ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore();
      } else if (q.k === 't') {
        q.vy *= 1 - 2.5 * dt;
        const e = 1 - k, pop = e < 0.12 ? 0.5 + (e / 0.12) * 0.7 : 1.2 - Math.min(0.2, (e - 0.12) * 2);
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.font = font(q.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(pop, pop);
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(4,16,40,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(q.str, 0, 0);
        ctx.fillStyle = q.col; ctx.fillText(q.str, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // ---- screen-space atmosphere
    screen();
    // plankton with parallax
    ctx.fillStyle = 'rgba(210,245,255,0.5)';
    for (const pl of plankton) {
      const x = (((pl.x * sw * 1.3 - cx * zoom * pl.z * 0.6 + Math.sin(t * 0.4 + pl.p) * 14) % sw) + sw) % sw;
      const y = (((pl.y * sh * 1.3 - cy * zoom * pl.z * 0.6 - t * 6 * pl.z) % sh) + sh) % sh;
      ctx.globalAlpha = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.2 + pl.p));
      ctx.beginPath(); ctx.arc(x, y, pl.r * pl.z, 0, TAU); ctx.fill();
    }
    // light shafts
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = ((i + 0.5) / 4) * sw * 1.3 - sw * 0.25 + Math.sin(t * 0.25 + i * 2.1) * sw * 0.07 - (cx * zoom * 0.12) % (sw * 0.3);
      const w = sw * (0.07 + 0.035 * Math.sin(t * 0.4 + i * 1.3));
      const gr = ctx.createLinearGradient(bx - w, 0, bx + w, 0);
      gr.addColorStop(0, 'rgba(160,240,255,0)'); gr.addColorStop(0.5, 'rgba(160,240,255,0.075)'); gr.addColorStop(1, 'rgba(160,240,255,0)');
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.6 + i);
      ctx.fillStyle = gr;
      ctx.save(); ctx.transform(1, 0, -0.35, 1, sh * 0.2, 0); ctx.fillRect(bx - w, 0, w * 2, sh); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vignette, 0, 0, sw, sh);
    if (flash > 0) { ctx.fillStyle = `rgba(255,70,90,${flash * 0.45})`; ctx.fillRect(0, 0, sw, sh); }

    // ---- crown pointer
    if (o.pointer !== false && me >= 0 && cr.holder !== me) {
      const sx = (cr.x - vl) * zoom, sy = (cr.y - vt) * zoom;
      const m = 54;
      if (sx < 0 || sx > sw || sy < 0 || sy > sh) {
        const ccx = sw / 2, ccy = sh / 2;
        const dx = sx - ccx, dy = sy - ccy;
        const k = Math.min((ccx - m) / Math.abs(dx || 1e-6), (ccy - m) / Math.abs(dy || 1e-6));
        const px = ccx + dx * k, py = ccy + dy * k, a = Math.atan2(dy, dx);
        const col = cr.holder >= 0 ? COLORS[st.players[cr.holder].color].main : '#ffd43b';
        const pul = 1 + Math.sin(t * 6) * 0.08;
        ctx.save(); ctx.translate(px, py); ctx.scale(pul, pul);
        ctx.fillStyle = 'rgba(4,20,48,0.72)'; ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 39, Math.sin(a) * 39); ctx.lineTo(Math.cos(a + 0.42) * 28, Math.sin(a + 0.42) * 28); ctx.lineTo(Math.cos(a - 0.42) * 28, Math.sin(a - 0.42) * 28); ctx.closePath(); ctx.fill();
        drawCrown(ctx, 0, 1, 0.82, t);
        ctx.restore();
      }
    }
  }

  function getAnim(p, dt) {
    let a = anim.get(p.id);
    if (!a) { a = { swim: Math.random() * 6, amp: 6, trail: [] }; anim.set(p.id, a); }
    if (dt > 0) {
      const spd = Math.hypot(p.vx || 0, p.vy || 0);
      a.swim += dt * (3.5 + Math.min(spd, 700) * 0.035);
      const target = p.stun > 0 ? 3 : 5.5 + Math.min(1, spd / 300) * 6;
      a.amp += (target - a.amp) * Math.min(1, dt * 6);
      for (const q of a.trail) q.life -= dt;
      while (a.trail.length && a.trail[0].life <= 0) a.trail.shift();
      if (p.dashT > 0) a.trail.push({ x: p.x, y: p.y, life: 0.35 });
    }
    return a;
  }

  // on-screen controls
  function drawControls(inp, p, layout) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = time;
    if (inp.joy.active) {
      const j = inp.joy;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(j.ox, j.oy, 56, 0, TAU); ctx.fill(); ctx.stroke();
      const gr = ctx.createRadialGradient(j.x - 6, j.y - 8, 2, j.x, j.y, 28);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(150,220,255,0.6)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(j.x, j.y, 27, 0, TAU); ctx.fill();
    } else if (layout.touch) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(layout.jx, layout.jy, 50, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!layout.touch) return;
    // dash button
    const bx = layout.bx, by = layout.by, R = layout.br;
    const ready = p && p.charges >= 1 && p.stun <= 0;
    const press = inp.dashHeld ? 0.92 : 1;
    ctx.save(); ctx.translate(bx, by); ctx.scale(press, press);
    const frenzy = p && p.frenzyT > 0;
    const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.4, 4, 0, 0, R);
    if (ready) { gr.addColorStop(0, frenzy ? 'rgba(255,200,120,0.95)' : 'rgba(140,235,255,0.92)'); gr.addColorStop(1, frenzy ? 'rgba(255,110,40,0.85)' : 'rgba(20,130,220,0.82)'); }
    else { gr.addColorStop(0, 'rgba(120,150,180,0.5)'); gr.addColorStop(1, 'rgba(40,70,110,0.5)'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke();
    // saw icon
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(6,30,70,0.7)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    const l = R * 0.62;
    ctx.moveTo(-l, -5); ctx.lineTo(l, -3); ctx.lineTo(l + 5, 0); ctx.lineTo(l, 3); ctx.lineTo(-l, 5); ctx.closePath();
    for (let i = 0; i < 5; i++) {
      const x = -l + 8 + i * ((l * 2 - 14) / 4);
      ctx.moveTo(x - 4, -4); ctx.lineTo(x, -13); ctx.lineTo(x + 4, -4);
      ctx.moveTo(x - 4, 4); ctx.lineTo(x, 13); ctx.lineTo(x + 4, 4);
    }
    ctx.stroke(); ctx.fill();
    ctx.restore();
    // charge pips
    if (p) {
      for (let i = 0; i < C.DASH_MAX; i++) {
        const a0 = -Math.PI * 0.5 - 0.95 + i * 0.66, a1 = a0 + 0.56;
        const fillK = Math.max(0, Math.min(1, p.charges - i));
        ctx.lineCap = 'round'; ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(4,20,48,0.6)'; ctx.beginPath(); ctx.arc(bx, by, R + 11, a0, a1); ctx.stroke();
        if (fillK > 0) {
          ctx.strokeStyle = fillK >= 1 ? (frenzy ? '#ffb347' : '#7df2ff') : 'rgba(125,242,255,0.5)';
          ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by, R + 11, a0, a0 + (a1 - a0) * fillK); ctx.stroke();
        }
      }
      // frenzy meter (fish icons)
      const n = C.FRENZY_NEED;
      const fy = by + R + 26 > sh - 8 ? by - R - 34 : by + R + 26;
      for (let i = 0; i < n; i++) {
        const x = bx + (i - (n - 1) / 2) * 13;
        const on = frenzy ? (p.frenzyT / C.FRENZY_TIME) * n > i : p.frenzy > i;
        ctx.fillStyle = on ? (frenzy ? '#ff9b3d' : '#ffc83a') : 'rgba(4,20,48,0.55)';
        ctx.beginPath(); ctx.ellipse(x, fy, 5, 3.4, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 4, fy); ctx.lineTo(x - 8, fy - 3.4); ctx.lineTo(x - 8, fy + 3.4); ctx.closePath(); ctx.fill();
      }
    }
  }

  resize();
  return { resize, setWorld, draw, drawControls, onEvent, get size() { return { sw, sh, zoom }; }, addShake(v) { shake = Math.max(shake, v); }, confetti, cam };
}
