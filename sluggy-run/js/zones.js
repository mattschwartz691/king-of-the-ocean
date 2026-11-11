// Sluggy Run — environments, obstacles and props (procedural canvas art).
import { OUT, PAL } from '../../sluggy/js/art.js';
const TAU = Math.PI * 2;
export const TW = 1200, TH = 640; // background tile size in world units (ground line = bottom edge)

export function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function R(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fs(g, fill, lw = 3) { g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); } }
const box = (g, x, y, w, h, r, fill, lw = 3) => { R(g, x, y, w, h, r); fs(g, fill, lw); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const circ = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const ell = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
const poly = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
const text = (g, s, x, y, px, c, al = 'center') => { g.font = `900 ${px}px ui-rounded, system-ui, sans-serif`; g.textAlign = al; g.textBaseline = 'middle'; g.fillStyle = c; g.fillText(s, x, y); };
// draw at tile x (and wrapped copies); origin on the ground line, y negative = up
// (buildLayer paints every layer three times, shifted by a tile width, so things wrap across the seam)
function at(g, x, fn) { g.save(); g.translate(x, TH); fn(); g.restore(); }
function spread(r, n, fn, jit = 0.6) { for (let i = 0; i < n; i++) fn((i + 0.5 + (r() - 0.5) * jit) * TW / n, i); }

// ------------------------------------------------------------------ forest
function fern(g, s, col) {
  g.strokeStyle = col; g.lineWidth = 5 * s; g.lineCap = 'round';
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(i * 10 * s, -36 * s, i * 24 * s, -22 * s + Math.abs(i) * 5 * s); g.stroke(); }
}
function trunk(g, w, c1, c2, bark, r) {
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, c2); gr.addColorStop(0.35, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.beginPath(); g.moveTo(-w * 0.72, 0); g.quadraticCurveTo(-w / 2, -40, -w / 2, -110); g.lineTo(-w / 2, -TH - 2); g.lineTo(w / 2, -TH - 2); g.lineTo(w / 2, -110); g.quadraticCurveTo(w / 2, -40, w * 0.72, 0); g.fill();
  if (!bark) return;
  g.strokeStyle = bark; g.lineWidth = Math.max(1.5, w * 0.03); g.lineCap = 'round';
  for (let i = 1; i < 6; i++) { const x = -w / 2 + (w * i) / 6; g.beginPath(); for (let y = -10; y > -TH; y -= 62) { const o = (r() - 0.5) * 8; g.moveTo(x + o, y - r() * 20); g.lineTo(x + o + (r() - 0.5) * 5, y - 36 - r() * 18); } g.stroke(); }
}
const forest = [
  (g, r) => {
    spread(r, 16, (x) => at(g, x, () => trunk(g, 16 + r() * 22, '#9cc7a0', '#86b690')));
    for (let x = 0; x < TW; x += 46) at(g, x, () => ell(g, 0, 0, 40, 30 + r() * 26, '#7fb089'));
  },
  (g, r) => {
    spread(r, 6, (x) => at(g, x, () => trunk(g, 48 + r() * 30, '#7a5038', '#573623', '#4a2c1b', r)));
    g.save(); g.globalAlpha = 0.09; g.fillStyle = '#fffbd0';
    for (let i = 0; i < 5; i++) { const x = r() * TW, w = 40 + r() * 70; poly(g, [[x, 0], [x + w, 0], [x + w - 300, TH], [x - 300 - w * 0.5, TH]]); g.fill(); }
    g.restore();
    spread(r, 10, (x) => at(g, x, () => fern(g, 0.9 + r() * 0.7, r() < 0.5 ? '#3f8a45' : '#2f7340')));
  },
  (g, r) => {
    spread(r, 3, (x) => at(g, x, () => {
      const w = 120 + r() * 40; trunk(g, w, '#a85a30', '#6a3318', '#4f2410', r);
      ell(g, 0, 0, w * 0.8, 16, '#4f9a3a'); ell(g, -w * 0.3, -6, w * 0.3, 12, '#6dbb48');
    }), 0.5);
    spread(r, 7, (x) => at(g, x, () => { fern(g, 1.3 + r() * 0.6, '#3c9a3c'); g.translate(26, 0); fern(g, 0.9, '#57b548'); }));
    spread(r, 5, (x) => at(g, x, () => { rect(g, -4, -18, 8, 18, '#f3e9d2'); g.fillStyle = '#e8590c'; g.beginPath(); g.ellipse(0, -18, 15, 11, 0, Math.PI, 0); g.fill(); }));
  },
];
// ------------------------------------------------------------------ downtown
const city = [
  (g, r) => spread(r, 12, (x) => at(g, x, () => { const w = 70 + r() * 60, h = 190 + r() * 250; rect(g, -w / 2, -h, w, h, '#b7c6ea'); if (r() < 0.4) rect(g, -2, -h - 40, 4, 40, '#b7c6ea'); if (r() < 0.4) rect(g, -w / 4, -h - 16, w / 2, 16, '#b7c6ea'); })),
  (g, r) => spread(r, 7, (x) => at(g, x, () => {
    const w = 120 + r() * 60, h = 230 + r() * 240, c = ['#7f8fd0', '#9a86c9', '#6f9bc8', '#8a7fbf'][(r() * 4) | 0];
    rect(g, -w / 2, -h, w, h, c); rect(g, -w / 2, -h, w, 10, 'rgba(255,255,255,.25)'); rect(g, w / 2 - 14, -h, 14, h, 'rgba(0,0,30,.12)');
    for (let y = -h + 26; y < -40; y += 34) for (let xx = -w / 2 + 14; xx < w / 2 - 26; xx += 28) rect(g, xx, y, 16, 20, r() < 0.3 ? '#ffe9a8' : 'rgba(20,30,90,.35)');
  }), 0.4),
  (g, r) => {
    const names = ['BANK', 'CAFE', 'SLIME-ONADE', 'TIES', 'BAGELS'], cols = ['#e8590c', '#1c7ed6', '#f5b800', '#d6336c', '#2f9e44'];
    for (let i = 0; i < 5; i++) at(g, i * 240 + 30, () => {
      rect(g, 0, -150, 190, 150, ['#f1dcc0', '#e6ecf5', '#f6e7b8', '#f3d9e3', '#dff0d8'][i]); rect(g, 0, -158, 190, 10, '#7a6a5a');
      rect(g, 16, -86, 96, 62, '#9fd3f2'); rect(g, 16, -86, 96, 14, 'rgba(255,255,255,.5)'); rect(g, 130, -86, 40, 86, '#6a4a34'); circ(g, 162, -44, 3, '#ffd43b');
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#fff' : cols[i]; poly(g, [[k * 23.75, -112], [k * 23.75 + 23.75, -112], [k * 23.75 + 20, -92], [k * 23.75 - 3.75 + 3.75, -92]]); g.fill(); }
      rect(g, 30, -146, 130, 26, cols[i]); text(g, names[i], 95, -132, 17, '#fff');
    });
    for (let i = 0; i < 5; i++) at(g, i * 240 + 5, () => { rect(g, -3, -170, 6, 170, '#3d4354'); rect(g, -3, -172, 26, 6, '#3d4354'); circ(g, 24, -164, 9, '#fff3b0'); });
    for (let i = 0; i < 3; i++) at(g, i * 400 + 228, () => { rect(g, -5, -70, 10, 70, '#7a5a3c'); circ(g, 0, -92, 34, '#4fae5a'); circ(g, -16, -78, 22, '#63c26b'); circ(g, 18, -80, 20, '#3f9a4d'); });
  },
];
// ------------------------------------------------------------------ office
const office = [
  (g, r) => {
    for (let i = 0; i < 4; i++) at(g, i * 300 + 40, () => {
      rect(g, -8, -508, 236, 336, '#fff'); const gr = g.createLinearGradient(0, -500, 0, -180); gr.addColorStop(0, '#6db9f2'); gr.addColorStop(1, '#d3ecff'); rect(g, 0, -500, 220, 320, gr);
      for (let k = 0; k < 6; k++) rect(g, 6 + k * 36, -180 - 60 - r() * 120, 30, 200, 'rgba(90,120,190,.5)');
      rect(g, 0, -182, 220, 4, '#fff'); rect(g, 106, -500, 8, 320, '#fff'); rect(g, 0, -344, 220, 8, '#fff'); ell(g, 60, -440, 40, 12, 'rgba(255,255,255,.7)');
    });
    rect(g, 0, TH - 24, TW, 24, '#b9a67f'); rect(g, 0, TH - 150, TW, 5, '#d8c9a6');
  },
  (g, r) => {
    const words = ['SYNERGY', 'HUSTLE', 'TEAMWORK', 'BIDNESS'];
    for (let i = 0; i < 4; i++) at(g, i * 300 + 150, () => {
      rect(g, -150, -120, 270, 120, '#8fa3c4'); rect(g, -150, -126, 270, 10, '#6c7fa3'); rect(g, -20, -120, 6, 120, '#6c7fa3');
      rect(g, -120, -160, 64, 44, '#2b3350'); rect(g, -114, -154, 52, 32, i % 2 ? '#74c0fc' : '#8ce99a'); rect(g, -92, -118, 8, 8, '#2b3350');
      rect(g, 40, -156, 50, 40, '#2b3350'); rect(g, 45, -151, 40, 30, '#ffd8a8');
      rect(g, -70, -330, 110, 80, '#fff'); rect(g, -64, -324, 98, 68, ['#ffe066', '#ffc9c9', '#b2f2bb', '#a5d8ff'][i]); text(g, words[i], -15, -290, 17, '#3b2414');
    });
    at(g, 560, () => { circ(g, 0, -400, 34, '#fff'); circ(g, 0, -400, 29, '#f8f1e4'); g.strokeStyle = '#3b2414'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -400); g.lineTo(0, -420); g.moveTo(0, -400); g.lineTo(14, -394); g.stroke(); });
  },
  (g, r) => {
    for (let i = 0; i < 3; i++) at(g, i * 400 + 90, () => {
      poly(g, [[-18, 0], [18, 0], [24, -38], [-24, -38]]); g.fillStyle = '#c2703d'; g.fill();
      g.strokeStyle = '#5a3d2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -38); g.lineTo(0, -120); g.stroke();
      for (const [x, y, s] of [[0, -150, 34], [-28, -112, 24], [28, -118, 26], [-10, -86, 20], [16, -170, 22]]) ell(g, x, y, s, s * 0.8, s > 25 ? '#2f9e44' : '#51cf66');
    });
    for (let i = 0; i < 2; i++) at(g, i * 600 + 330, () => { rect(g, -22, -84, 44, 84, '#e9ecef'); rect(g, -22, -40, 44, 4, '#adb5bd'); rect(g, -8, -58, 16, 10, '#868e96'); R(g, -18, -132, 36, 50, 9); g.fillStyle = 'rgba(116,192,252,.8)'; g.fill(); });
  },
];
// ------------------------------------------------------------------ boardwalk
function palm(g, h, c) {
  g.strokeStyle = c; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(18, -h * 0.6, 6, -h); g.stroke();
  g.lineWidth = 9; for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.5 + (i - 3) * 0.5; g.beginPath(); g.moveTo(6, -h); g.quadraticCurveTo(6 + Math.cos(a) * 46, -h + Math.sin(a) * 46 - 16, 6 + Math.cos(a) * 82, -h + Math.sin(a) * 60 + 26); g.stroke(); }
}
const board = [
  (g, r) => {
    const gr = g.createLinearGradient(0, TH - 170, 0, TH); gr.addColorStop(0, '#ffb37a'); gr.addColorStop(0.25, '#c77fa5'); gr.addColorStop(1, '#3f4f9c'); rect(g, 0, TH - 170, TW, 170, gr);
    for (let i = 0; i < 60; i++) rect(g, r() * TW, TH - 160 + r() * 150, 20 + r() * 50, 2.5, 'rgba(255,240,200,.45)');
    at(g, 250, () => ell(g, 0, -168, 150, 26, '#8c5a8f')); at(g, 860, () => ell(g, 0, -168, 100, 18, '#9a6795'));
  },
  (g, r) => {
    const c = '#5d3b7c';
    at(g, 330, () => {
      g.strokeStyle = c; g.lineWidth = 7; g.beginPath(); g.arc(0, -210, 160, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, -210, 110, 0, TAU); g.lineWidth = 3; g.stroke();
      g.lineWidth = 4; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(0, -210); g.lineTo(Math.cos(a) * 160, -210 + Math.sin(a) * 160); g.stroke(); box(g, Math.cos(a) * 160 - 12, -210 + Math.sin(a) * 160, 24, 20, 6, ['#ff8787', '#ffd43b', '#63e6be', '#74c0fc'][i % 4], 0); }
      g.lineWidth = 10; g.beginPath(); g.moveTo(-70, 0); g.lineTo(0, -210); g.lineTo(70, 0); g.stroke();
    });
    at(g, 880, () => { g.strokeStyle = c; g.lineWidth = 8; g.beginPath(); g.moveTo(-220, 0); g.bezierCurveTo(-150, -330, -70, -330, -10, -110); g.bezierCurveTo(30, -10, 90, -240, 150, -200); g.bezierCurveTo(200, -170, 210, -60, 240, 0); g.stroke(); g.lineWidth = 3; for (let x = -200; x < 240; x += 34) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -60 - 150 * Math.abs(Math.sin(x * 0.012))); g.stroke(); } });
    for (const x of [60, 610, 1120]) at(g, x, () => palm(g, 190 + r() * 80, c));
  },
  (g, r) => {
    for (let i = 0; i < 4; i++) at(g, i * 300 + 40, () => {
      const c = ['#ff6b6b', '#22b8cf', '#fcc419', '#f06595'][i];
      rect(g, 0, -110, 150, 110, '#fff4e0'); rect(g, 12, -74, 126, 44, '#7a4a2a'); rect(g, 6, -34, 138, 8, '#d9a066');
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff' : c; poly(g, [[k * 27 - 6, -112], [k * 27 + 21, -112], [k * 27 + 17, -150 + 0], [k * 27 + 4, -150]]); g.fill(); }
      rect(g, -6, -116, 162, 8, c);
    });
    g.strokeStyle = '#4a3555'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) at(g, i * 200, () => { rect(g, -3, -200, 6, 200, '#6a4a6f'); g.beginPath(); g.moveTo(0, -198); g.quadraticCurveTo(100, -150, 200, -198); g.stroke(); for (let k = 1; k < 8; k++) { const u = k / 8; circ(g, u * 200, -198 + 96 * u * (1 - u) * 2, 6, ['#fff3b0', '#ffa8a8', '#99e9f2'][k % 3]); } });
    rect(g, 0, TH - 44, TW, 6, '#7a4a2a'); for (let x = 0; x < TW; x += 50) rect(g, x, TH - 44, 6, 44, '#7a4a2a');
  },
];
// ------------------------------------------------------------------ stock market
const stock = [
  (g, r) => {
    g.strokeStyle = 'rgba(120,160,255,.13)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= TW; x += 60) { g.moveTo(x, 0); g.lineTo(x, TH); } for (let y = 20; y < TH; y += 60) { g.moveTo(0, y); g.lineTo(TW, y); } g.stroke();
    let y = 400; const pts = []; for (let x = 0; x <= TW; x += 40) { pts.push([x, y]); y += (r() - 0.5) * 120; y = Math.max(120, Math.min(520, y)); } pts[pts.length - 1][1] = pts[0][1];
    g.lineJoin = 'round'; for (const [lw, c] of [[16, 'rgba(60,255,160,.15)'], [5, '#3df5a0']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    for (let x = 20; x < TW; x += 40) { const up = r() < 0.55, h = 20 + r() * 70, yy = 60 + r() * 200; rect(g, x + 8, yy - 14, 2, h + 28, up ? '#2fbf7a' : '#ff5c7a'); rect(g, x, yy, 18, h, up ? '#2fbf7a' : '#ff5c7a'); }
  },
  (g, r) => {
    const tick = [['SLUG', 1], ['WRM', 0], ['BNNA', 1], ['SLME', 1], ['DIRT', 0], ['FERN', 1], ['SALT', 0], ['TIE', 1]];
    for (let i = 0; i < 3; i++) at(g, i * 400 + 60, () => {
      rect(g, -10, -470, 300, 250, '#060a1c'); rect(g, 0, -460, 280, 230, '#0e1533');
      for (let k = 0; k < 5; k++) { const [n, up] = tick[(i * 3 + k) % 8]; text(g, n, 16, -432 + k * 44, 26, '#e7ecff', 'left'); text(g, (up ? '▲ ' : '▼ ') + (1 + r() * 9).toFixed(2), 264, -432 + k * 44, 24, up ? '#3df5a0' : '#ff5c7a', 'right'); }
      rect(g, 120, -220, 40, 220, '#1b2450');
    });
    for (let i = 0; i < 3; i++) at(g, i * 400 + 20, () => { rect(g, -18, -TH - 2, 36, TH + 2, '#232d5e'); rect(g, -18, -TH - 2, 8, TH + 2, '#2f3b78'); rect(g, -26, -20, 52, 20, '#2f3b78'); });
  },
  (g, r) => {
    for (let i = 0; i < 4; i++) at(g, i * 300 + 80, () => {
      rect(g, -70, -52, 170, 10, '#3b4680'); rect(g, -60, -42, 10, 42, '#2b3566'); rect(g, 80, -42, 10, 42, '#2b3566');
      for (const x of [-50, 20]) { rect(g, x, -110, 60, 44, '#0a0f24'); rect(g, x + 4, -106, 52, 36, '#10204a'); g.strokeStyle = r() < 0.5 ? '#3df5a0' : '#ff5c7a'; g.lineWidth = 3; g.beginPath(); let y = -88; g.moveTo(x + 6, y); for (let k = 1; k <= 6; k++) { y = Math.max(-102, Math.min(-74, y + (r() - 0.5) * 22)); g.lineTo(x + 6 + k * 8, y); } g.stroke(); rect(g, x + 26, -66, 8, 14, '#0a0f24'); }
    });
  },
];
// ------------------------------------------------------------------ worm tunnels
const tunnel = [
  (g, r) => {
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 10; for (let y = 60; y < TH; y += 110) { g.beginPath(); for (let x = 0; x <= TW; x += 100) g.lineTo(x, y + Math.sin((x / TW) * TAU * 3 + y) * 18); g.stroke(); }
    spread(r, 6, (x) => at(g, x, () => { ell(g, 0, -150 - r() * 260, 70 + r() * 40, 50 + r() * 30, '#1c0f07'); }));
    spread(r, 26, (x) => at(g, x, () => ell(g, 0, -r() * TH, 6 + r() * 12, 5 + r() * 8, 'rgba(255,220,170,.12)')));
  },
  (g, r) => {
    spread(r, 9, (x) => { g.strokeStyle = '#6b4526'; g.lineCap = 'round'; let y = -2, xx = x; g.lineWidth = 9 + r() * 8; g.beginPath(); g.moveTo(xx, y); const len = 120 + r() * 260; for (let k = 0; k < 5; k++) { y += len / 5; xx += (r() - 0.5) * 50; g.lineTo(xx, y); } g.stroke(); });
    spread(r, 6, (x) => at(g, x, () => {
      const c = r() < 0.5 ? '120,255,230' : '190,140,255', gl = g.createRadialGradient(0, -30, 4, 0, -30, 90); gl.addColorStop(0, `rgba(${c},.5)`); gl.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gl; g.fillRect(-90, -120, 180, 120);
      for (const [dx, h, s] of [[-16, 26, 12], [4, 44, 17], [24, 20, 10]]) { rect(g, dx - 3, -h, 6, h, '#e9f7f3'); g.fillStyle = `rgb(${c})`; g.beginPath(); g.ellipse(dx, -h, s, s * 0.7, 0, Math.PI, 0); g.fill(); }
    }));
    at(g, 500, () => { rect(g, -6, -150, 12, 150, '#5a3a1c'); rect(g, -80, -190, 160, 56, '#8a5a30'); rect(g, -74, -184, 148, 44, '#a36d3c'); text(g, 'WORMCO HQ ➜', 0, -162, 19, '#3b1d0a'); });
    at(g, 1050, () => { rect(g, -6, -130, 12, 130, '#5a3a1c'); rect(g, -70, -170, 140, 50, '#8a5a30'); text(g, 'NO SLUGS!', 0, -145, 20, '#ffd3df'); });
  },
  (g, r) => {
    for (let i = 0; i < 3; i++) at(g, i * 400 + 120, () => {
      rect(g, -110, -TH - 2, 22, TH + 2, '#6e4520'); rect(g, 88, -TH - 2, 22, TH + 2, '#6e4520'); rect(g, -124, -300, 248, 24, '#8a5a30'); rect(g, -124, -300, 248, 6, '#a36d3c');
      const gl = g.createRadialGradient(0, -246, 4, 0, -246, 130); gl.addColorStop(0, 'rgba(255,214,102,.55)'); gl.addColorStop(1, 'rgba(255,214,102,0)'); g.fillStyle = gl; g.fillRect(-130, -376, 260, 260);
      rect(g, -2, -276, 4, 18, '#3b2414'); rect(g, -10, -260, 20, 26, '#ffd43b'); rect(g, -12, -262, 24, 5, '#3b2414'); rect(g, -12, -236, 24, 5, '#3b2414');
    });
    spread(r, 5, (x) => at(g, x, () => ell(g, 0, 0, 30 + r() * 30, 14 + r() * 12, '#4a2c14')));
  },
];
// ------------------------------------------------------------------ the moon
const moon = [
  (g, r) => spread(r, 7, (x) => at(g, x, () => ell(g, 0, 0, 150 + r() * 120, 60 + r() * 70, '#3d425c'))),
  (g, r) => {
    spread(r, 5, (x) => at(g, x, () => { const w = 130 + r() * 90, h = 30 + r() * 40; ell(g, 0, 0, w, h, '#6d728d'); ell(g, -w * 0.3, -h * 0.5, w * 0.16, h * 0.14, '#555a75'); ell(g, w * 0.25, -h * 0.3, w * 0.1, h * 0.1, '#555a75'); }));
    at(g, 330, () => {
      poly(g, [[-26, -40], [-48, -10], [-26, -70]]); g.fillStyle = '#e03131'; g.fill(); poly(g, [[26, -40], [48, -10], [26, -70]]); g.fill();
      g.fillStyle = '#f1f3f5'; g.beginPath(); g.moveTo(-26, -34); g.lineTo(-26, -150); g.quadraticCurveTo(-24, -210, 0, -236); g.quadraticCurveTo(24, -210, 26, -150); g.lineTo(26, -34); g.closePath(); g.fill();
      g.fillStyle = '#e03131'; g.beginPath(); g.moveTo(-18, -196); g.quadraticCurveTo(-10, -222, 0, -236); g.quadraticCurveTo(10, -222, 18, -196); g.closePath(); g.fill();
      circ(g, 0, -150, 15, '#495057'); circ(g, 0, -150, 10, '#74c0fc'); text(g, '$', 0, -90, 30, '#2f9e44'); rect(g, -16, -34, 32, 10, '#495057');
    });
    at(g, 850, () => { rect(g, -2, -150, 5, 150, '#dee2e6'); rect(g, 3, -150, 80, 50, '#ffd43b'); text(g, 'BIDNESS', 43, -125, 15, '#3b2414'); });
  },
  (g, r) => {
    spread(r, 6, (x) => at(g, x, () => { const s = 18 + r() * 26; poly(g, [[-s, 0], [-s * 0.7, -s * 0.8], [0, -s * 1.1], [s * 0.8, -s * 0.7], [s, 0]]); g.fillStyle = '#9a9fb6'; g.fill(); poly(g, [[0, -s * 1.1], [s * 0.8, -s * 0.7], [s, 0], [s * 0.2, 0]]); g.fillStyle = '#7b8099'; g.fill(); }));
    at(g, 620, () => { rect(g, -4, -70, 8, 70, '#adb5bd'); g.fillStyle = '#dee2e6'; g.beginPath(); g.ellipse(0, -84, 44, 22, -0.5, 0, Math.PI); g.fill(); g.strokeStyle = '#adb5bd'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -84); g.lineTo(-22, -122); g.stroke(); circ(g, -22, -122, 6, '#ff6b6b'); });
  },
];

export const ZONES = [
  { name: 'Redwood Forest', sub: 'Home sweet home', sky: ['#0d3a3c', '#2f7d5e', '#d2ecae'], layers: forest, gk: 'forest', haze: '#b8e0b0', hang: '#3f6a2c', par: '#ffe9a0' },
  { name: 'Downtown', sub: 'The morning commute', sky: ['#4aa3f0', '#9fd0ff', '#ffe3c4'], layers: city, gk: 'city', haze: '#dbe9ff', hang: '#3d4354', par: '#ffffff' },
  { name: 'The Office', sub: 'Late for the big meeting!', sky: ['#efe4cc', '#f4ead6', '#e6d8bb'], layers: office, gk: 'office', haze: '#f1e7d3', hang: '#868e96', par: '#ffffff' },
  { name: 'The Boardwalk', sub: 'Bidness trip', sky: ['#472a7a', '#e8638c', '#ffc27a'], layers: board, gk: 'board', haze: '#ffb38a', hang: '#7a4a2a', par: '#fff3b0' },
  { name: 'Stock Market', sub: 'Buy low, slime high', sky: ['#070b1e', '#0e1533', '#17214d'], layers: stock, gk: 'stock', haze: '#0e1533', hang: '#55608f', par: '#3df5a0' },
  { name: 'Worm Tunnels', sub: 'Deep in WormCo territory', sky: ['#2a180c', '#3d2413', '#4a2c16'], layers: tunnel, gk: 'tunnel', haze: '#3a2212', hang: '#6b4526', par: '#ffd8a8' },
  { name: 'The Moon', sub: 'Bidness is going TO THE MOON', sky: ['#02030c', '#0a0d24', '#1b2147'], layers: moon, gk: 'moon', haze: '#1b2147', hang: null, par: '#ffffff' },
];
const FADE = [0.5, 0.26, 0.08];
export function buildLayer(g, zi, li) {
  const z = ZONES[zi];
  for (const d of [-TW, 0, TW]) { g.save(); g.translate(d, 0); z.layers[li](g, rng(zi * 31 + li * 7 + 3)); g.restore(); }
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = FADE[li]; g.fillStyle = z.haze; g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

// live sky details (screen units)
export function drawSkyFx(g, zi, VW, GY, t, camX) {
  if (zi === 0) { for (let i = 0; i < 16; i++) { const x = (((i * 173 - camX * 0.3 + t * 9 * ((i % 3) + 1)) % (VW + 40)) + VW + 40) % (VW + 40) - 20, y = GY - 50 - ((i * 97) % Math.max(200, GY * 0.6)) + Math.sin(t * 1.3 + i) * 14; g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i * 1.7); circ(g, x, y, 3.2, '#f4ffb0'); } g.globalAlpha = 1; }
  else if (zi === 1) { for (let i = 0; i < 4; i++) { const x = (((i * 330 - camX * 0.04 + t * 7) % (VW + 320)) + VW + 320) % (VW + 320) - 160, y = GY * (0.1 + 0.11 * i); ell(g, x, y, 70, 22, 'rgba(255,255,255,.85)'); ell(g, x - 40, y + 8, 46, 17, 'rgba(255,255,255,.85)'); ell(g, x + 44, y + 9, 50, 16, 'rgba(255,255,255,.85)'); } }
  else if (zi === 3) { const x = VW * 0.68, y = GY - 190; const gl = g.createRadialGradient(x, y, 20, x, y, 260); gl.addColorStop(0, 'rgba(255,240,170,.75)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gl; g.fillRect(x - 260, y - 260, 520, 520); circ(g, x, y, 74, '#fff3b0'); }
  else if (zi === 6) {
    for (let i = 0; i < 70; i++) { g.globalAlpha = 0.45 + 0.45 * Math.sin(t * 1.5 + i * 2.3); circ(g, (i * 197.3) % VW, (i * 113.7) % GY, i % 7 === 0 ? 2.4 : 1.4, '#fff'); } g.globalAlpha = 1;
    const x = VW * 0.72, y = Math.max(90, GY * 0.3); circ(g, x, y, 70, 'rgba(120,180,255,.18)'); circ(g, x, y, 60, '#3b8eea');
    g.save(); g.beginPath(); g.arc(x, y, 60, 0, TAU); g.clip(); ell(g, x - 20, y - 14, 28, 20, '#4fbf6a'); ell(g, x + 28, y + 22, 22, 15, '#4fbf6a'); ell(g, x + 10, y - 40, 16, 8, '#fff'); circ(g, x + 34, y + 10, 66, 'rgba(0,0,30,.28)'); g.restore();
  }
}

export function drawGround(g, zi, camX, VW, GY, VH) {
  const k = ZONES[zi].gk, D = VH - GY, m = (p) => -(((camX % p) + p) % p);
  const grad = (a, b) => { const gr = g.createLinearGradient(0, GY, 0, GY + Math.min(D, 320)); gr.addColorStop(0, a); gr.addColorStop(1, b); rect(g, 0, GY, VW, D, gr); };
  if (k === 'forest') {
    grad('#7a4c2a', '#3a2210'); for (let x = m(140); x < VW; x += 140) { ell(g, x + 30, GY + 48, 12, 7, 'rgba(0,0,0,.18)'); ell(g, x + 100, GY + 92, 16, 9, 'rgba(0,0,0,.15)'); ell(g, x + 64, GY + 150, 10, 6, 'rgba(255,255,255,.07)'); }
    rect(g, 0, GY, VW, 14, '#4f9a3a'); rect(g, 0, GY, VW, 4, '#7cc653'); for (let x = m(36); x < VW; x += 36) ell(g, x + 10, GY + 14, 12, 6, '#4f9a3a');
  } else if (k === 'city') {
    grad('#555868', '#2c2e3b'); rect(g, 0, GY, VW, 28, '#cfd3dd'); rect(g, 0, GY, VW, 4, '#eceff4'); rect(g, 0, GY + 28, VW, 8, '#8d93a3');
    for (let x = m(90); x < VW; x += 90) rect(g, x, GY, 3, 28, '#a9afbd'); for (let x = m(180); x < VW; x += 180) rect(g, x, GY + 84, 90, 9, '#ffd43b');
  } else if (k === 'office') {
    grad('#4a6498', '#2a3a66'); for (let x = m(120); x < VW; x += 120) for (let y = 0; y < D; y += 60) rect(g, x + ((y / 60) % 2) * 60, GY + y, 60, 60, 'rgba(255,255,255,.05)');
    rect(g, 0, GY, VW, 10, '#6f8fc8'); rect(g, 0, GY, VW, 3, '#9db6e3');
  } else if (k === 'board') {
    grad('#3f4f9c', '#1f2a5e'); for (let x = m(220); x < VW; x += 220) { rect(g, x + 40, GY + 30, 22, D, '#5a3518'); rect(g, x + 40, GY + 30, 7, D, '#7a4a24'); }
    for (let x = m(260); x < VW; x += 260) { rect(g, x, GY + 90, 70, 3, 'rgba(255,255,255,.25)'); rect(g, x + 130, GY + 140, 50, 3, 'rgba(255,255,255,.18)'); }
    rect(g, 0, GY, VW, 34, '#d9a066'); rect(g, 0, GY, VW, 4, '#f0c08a'); rect(g, 0, GY + 34, VW, 10, '#7a4a24');
    for (let x = m(52); x < VW; x += 52) { rect(g, x, GY, 3, 34, '#a8703c'); circ(g, x + 10, GY + 10, 2, '#8a5a30'); }
  } else if (k === 'stock') {
    grad('#1b2450', '#070b1e'); for (let x = m(110); x < VW; x += 110) { rect(g, x, GY, 2, D, 'rgba(120,160,255,.18)'); rect(g, x + 20, GY + 16, 50, 5, 'rgba(61,245,160,.12)'); }
    for (let y = 46; y < D; y += 60) rect(g, 0, GY + y, VW, 2, 'rgba(120,160,255,.14)'); rect(g, 0, GY, VW, 5, '#3df5a0'); rect(g, 0, GY + 5, VW, 10, 'rgba(61,245,160,.2)');
  } else if (k === 'tunnel') {
    grad('#6a4020', '#241206'); for (let x = m(150); x < VW; x += 150) { ell(g, x + 40, GY + 44, 14, 9, '#8a6a4a'); ell(g, x + 110, GY + 100, 10, 7, '#4a2c14'); ell(g, x + 70, GY + 170, 18, 10, '#4a2c14'); }
    rect(g, 0, GY, VW, 12, '#9a6a3a'); rect(g, 0, GY, VW, 4, '#b98a52');
  } else {
    grad('#8d92a8', '#3d4158'); for (let x = m(190); x < VW; x += 190) { ell(g, x + 50, GY + 50, 30, 10, '#6d728d'); ell(g, x + 50, GY + 53, 24, 6, '#7d8299'); ell(g, x + 140, GY + 120, 20, 7, '#6d728d'); }
    rect(g, 0, GY, VW, 12, '#c9cddd'); rect(g, 0, GY, VW, 4, '#eef0f7');
  }
}

// ------------------------------------------------------------------ obstacles (origin bottom-centre, y up = negative)
const LOW = [
  [(g) => { box(g, -27, -42, 54, 42, 16, '#a8683a'); g.beginPath(); g.ellipse(-17, -21, 9, 19, 0, 0, TAU); fs(g, '#e8c48a', 2.5); g.beginPath(); g.ellipse(-17, -21, 4, 9, 0, 0, TAU); g.strokeStyle = '#a8683a'; g.lineWidth = 2; g.stroke(); ell(g, 8, -42, 14, 5, '#5fb347'); },
   (g) => { box(g, -9, -28, 18, 28, 6, '#f8f0dc'); g.beginPath(); g.ellipse(0, -26, 27, 24, 0, Math.PI, 0); g.closePath(); fs(g, '#f03e3e'); circ(g, -11, -36, 5, '#fff'); circ(g, 9, -40, 4, '#fff'); circ(g, 2, -31, 3, '#fff'); }],
  [(g) => { box(g, -19, -8, 38, 8, 3, '#c92a2a'); box(g, -13, -40, 26, 34, 5, '#f03e3e'); box(g, -23, -31, 10, 12, 3, '#f03e3e'); box(g, 13, -31, 10, 12, 3, '#f03e3e'); g.beginPath(); g.ellipse(0, -40, 13, 10, 0, Math.PI, 0); g.closePath(); fs(g, '#f03e3e'); box(g, -4, -56, 8, 8, 2, '#c92a2a'); },
   (g) => { box(g, -24, -8, 48, 8, 3, '#e8590c'); poly(g, [[-16, -8], [16, -8], [5, -54], [-5, -54]]); fs(g, '#ff922b'); poly(g, [[-11.5, -26], [11.5, -26], [9, -36], [-9, -36]]); g.fillStyle = '#fff'; g.fill(); }],
  [(g) => { box(g, -23, -50, 46, 50, 4, '#a5b1c8'); for (const y of [-44, -22]) { box(g, -18, y, 36, 17, 2, '#c8d1e2', 2); box(g, -7, y + 5, 14, 5, 2, '#5c677d', 0); } },
   (g) => { box(g, -26, -34, 52, 34, 6, '#e9ecef'); box(g, -18, -44, 36, 12, 3, '#ced4da'); box(g, -13, -54, 26, 14, 1, '#fff', 2); rect(g, -9, -49, 18, 2, '#adb5bd'); circ(g, 16, -22, 3.5, '#51cf66'); box(g, -18, -16, 36, 5, 2, '#495057', 0); }],
  [(g) => { box(g, -26, -22, 52, 22, 3, '#f2cf8d'); box(g, -18, -40, 14, 20, 2, '#f2cf8d'); box(g, 4, -40, 14, 20, 2, '#f2cf8d'); box(g, -7, -50, 14, 30, 2, '#f7dba3'); rect(g, -1, -64, 2.5, 14, OUT); poly(g, [[1, -64], [14, -59], [1, -54]]); fs(g, '#f03e3e', 2); rect(g, -5, -12, 10, 12, '#b98a52'); },
   (g) => { g.save(); g.beginPath(); g.arc(0, -25, 25, 0, TAU); g.clip(); for (let i = 0; i < 6; i++) { g.fillStyle = ['#ff6b6b', '#fff', '#339af0', '#fff', '#fcc419', '#fff'][i]; g.beginPath(); g.moveTo(0, -25); g.arc(0, -25, 30, (i / 6) * TAU + 0.4, ((i + 1) / 6) * TAU + 0.4); g.fill(); } g.restore(); g.beginPath(); g.arc(0, -25, 25, 0, TAU); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); circ(g, -8, -34, 5, 'rgba(255,255,255,.7)'); }],
  [(g) => { g.beginPath(); g.arc(0, -40, 9, Math.PI, 0); g.strokeStyle = OUT; g.lineWidth = 8; g.stroke(); g.strokeStyle = '#5c3d1e'; g.lineWidth = 3.5; g.stroke(); box(g, -27, -40, 54, 40, 6, '#9c5b2a'); rect(g, -26, -24, 52, 4, '#6f3d17'); box(g, -6, -28, 12, 11, 2, '#ffd43b', 2); text(g, '$', 0, -9, 13, '#ffd43b'); },
   (g) => { box(g, -8, -10, 16, 6, 2, '#343a55'); box(g, -18, -4, 36, 5, 2, '#343a55'); box(g, -27, -52, 54, 42, 5, '#1b2140'); rect(g, -22, -47, 44, 32, '#0c1230'); g.strokeStyle = '#ff5c7a'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-19, -42); g.lineTo(-8, -36); g.lineTo(-2, -40); g.lineTo(8, -26); g.lineTo(18, -20); g.stroke(); }],
  [(g) => { box(g, -22, -50, 44, 50, 9, '#a8683a'); for (const y of [-40, -14]) box(g, -24, y, 48, 6, 2, '#5c677d', 2); text(g, 'W', 0, -24, 17, '#ffd3df'); },
   (g) => { poly(g, [[-27, 0], [-22, -26], [-6, -44], [14, -40], [27, -16], [25, 0]]); fs(g, '#8a7a6a'); poly(g, [[-6, -44], [14, -40], [27, -16], [8, -22]]); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(); }],
  [(g) => { poly(g, [[-27, 0], [-24, -24], [-8, -44], [12, -46], [26, -22], [27, 0]]); fs(g, '#aab0c6'); ell(g, -6, -22, 8, 5, '#868ca6'); ell(g, 12, -32, 5, 3, '#868ca6'); ell(g, 10, -10, 6, 3.5, '#868ca6'); },
   (g) => { for (const [x, y] of [[-27, -17], [1, -17], [-13, -34]]) { poly(g, [[x + 3, y], [x + 23, y], [x + 26, y + 17], [x, y + 17]]); fs(g, '#ffd43b', 2.5); rect(g, x + 5, y + 2, 16, 3, '#fff3b0'); } g.translate(0, 0); }],
];
const TALL = [
  (g) => { g.beginPath(); g.moveTo(-34, 0); g.quadraticCurveTo(-27, -30, -27, -60); g.lineTo(-27, -140); g.lineTo(27, -140); g.lineTo(27, -60); g.quadraticCurveTo(27, -30, 34, 0); g.closePath(); fs(g, '#a85a30'); g.beginPath(); g.ellipse(0, -140, 27, 10, 0, 0, TAU); fs(g, '#e8c48a'); g.beginPath(); g.ellipse(0, -140, 14, 5, 0, 0, TAU); g.strokeStyle = '#b98a52'; g.lineWidth = 2; g.stroke(); for (const [x, y, s] of [[-27, -90, -1], [27, -60, 1], [27, -110, 1]]) { g.beginPath(); g.ellipse(x, y, 15, 7, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5); g.closePath(); fs(g, '#ffa94d', 2.5); } ell(g, -12, 0, 16, 5, '#5fb347'); },
  (g) => { box(g, -28, -150, 56, 150, 6, '#e03131'); box(g, -22, -128, 44, 78, 3, '#a5d8ff', 2.5); rect(g, -1.5, -128, 3, 78, OUT); rect(g, -22, -91, 44, 3, OUT); box(g, -24, -148, 48, 16, 3, '#fff', 2); text(g, 'PHONE', 0, -139, 11, '#e03131'); box(g, -22, -40, 44, 30, 3, '#c92a2a', 2); },
  (g) => { box(g, -26, -118, 52, 118, 4, '#a5b1c8'); for (let i = 0; i < 4; i++) { box(g, -21, -112 + i * 28, 42, 23, 2, '#c8d1e2', 2); box(g, -8, -104 + i * 28, 16, 5, 2, '#5c677d', 0); } poly(g, [[-13, -118], [13, -118], [10, -134], [-10, -134]]); fs(g, '#c2703d', 2.5); for (const [x, y] of [[0, -150], [-12, -142], [12, -143]]) { g.beginPath(); g.ellipse(x, y, 9, 12, x * 0.05, 0, TAU); fs(g, '#40c057', 2.5); } },
  (g) => { for (const [x, c, r] of [[-17, '#22b8cf', -0.06], [0, '#ff6b6b', 0.02], [17, '#fcc419', 0.08]]) { g.save(); g.translate(x, 0); g.rotate(r); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-16, -40, -14, -120, 0, -152); g.bezierCurveTo(14, -120, 16, -40, 0, 0); g.closePath(); fs(g, c); rect(g, -1.5, -138, 3, 124, 'rgba(255,255,255,.75)'); g.restore(); } },
  (g, t) => { box(g, -28, -150, 56, 150, 5, '#232a4d'); for (let i = 0; i < 6; i++) { box(g, -22, -142 + i * 23, 44, 18, 2, '#0c1230', 2); for (let k = 0; k < 4; k++) circ(g, -15 + k * 10, -133 + i * 23, 2.6, Math.sin(t * 7 + i * 2.1 + k * 1.3) > 0 ? '#3df5a0' : k === 3 ? '#ff5c7a' : '#1f6b4c'); } },
  (g) => { for (let i = 0; i < 3; i++) { const x = [-2, 3, -3][i]; box(g, x - 26, -50 * (i + 1), 52, 50, 3, '#c98d4f'); g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 22, -50 * i - 4); g.lineTo(x + 22, -50 * (i + 1) + 4); g.stroke(); box(g, x - 22, -50 * i - 33, 44, 16, 2, '#f6e3c0', 2); text(g, 'WORMCO', x, -50 * i - 25, 9, '#a01d4c'); } },
  (g) => { poly(g, [[-18, -24], [-34, 0], [-18, -64]]); fs(g, '#e03131'); poly(g, [[18, -24], [34, 0], [18, -64]]); fs(g, '#e03131'); g.beginPath(); g.moveTo(-19, -10); g.lineTo(-19, -100); g.quadraticCurveTo(-17, -134, 0, -152); g.quadraticCurveTo(17, -134, 19, -100); g.lineTo(19, -10); g.closePath(); fs(g, '#f1f3f5'); g.beginPath(); g.moveTo(-14, -122); g.quadraticCurveTo(-8, -140, 0, -152); g.quadraticCurveTo(8, -140, 14, -122); g.closePath(); fs(g, '#e03131', 2.5); g.beginPath(); g.arc(0, -92, 10, 0, TAU); fs(g, '#74c0fc'); text(g, '$', 0, -50, 22, '#2f9e44'); box(g, -12, -10, 24, 10, 2, '#495057'); },
];
// hanging things you slide under: block spans y -100..-38
const HIGH = [
  (g) => { box(g, -46, -96, 92, 50, 22, '#a8683a'); g.beginPath(); g.ellipse(-34, -71, 9, 21, 0, 0, TAU); fs(g, '#e8c48a', 2.5); g.strokeStyle = '#4f9a3a'; g.lineWidth = 6; g.lineCap = 'round'; for (const [x, l] of [[-12, 12], [6, 9], [24, 13]]) { g.beginPath(); g.moveTo(x, -46); g.lineTo(x, -46 + l - 4); g.stroke(); } ell(g, 8, -96, 30, 7, '#5fb347'); },
  (g) => { box(g, -44, -98, 88, 58, 10, '#343a40'); for (const [x, c] of [[-26, '#ff6b6b'], [0, '#ffd43b'], [26, '#51cf66']]) { g.beginPath(); g.arc(x, -69, 11, 0, TAU); fs(g, c, 2.5); circ(g, x - 3, -73, 3, 'rgba(255,255,255,.6)'); } },
  (g) => { const gl = g.createLinearGradient(0, -40, 0, 0); gl.addColorStop(0, 'rgba(255,245,180,.5)'); gl.addColorStop(1, 'rgba(255,245,180,0)'); g.fillStyle = gl; poly(g, [[-36, -40], [36, -40], [56, 0], [-56, 0]]); g.fill(); poly(g, [[-22, -98], [22, -98], [42, -46], [-42, -46]]); fs(g, '#2f9e44'); box(g, -30, -48, 60, 9, 4, '#fff3b0', 2.5); box(g, -8, -106, 16, 10, 2, '#868e96', 2.5); },
  (g) => { box(g, -48, -98, 96, 58, 8, '#d9a066'); box(g, -42, -92, 84, 46, 5, '#f7dba3', 2); text(g, 'SURF', 0, -79, 17, '#1c7ed6'); text(g, 'SHOP', 0, -60, 17, '#e8590c'); },
  (g, t) => { box(g, -48, -98, 96, 58, 6, '#1b2140'); rect(g, -42, -92, 84, 46, '#0c1230'); text(g, 'SELL!', 0, -76, 22, Math.sin(t * 8) > 0 ? '#ff5c7a' : '#ff9db0'); text(g, '▼▼▼', 0, -55, 13, '#ff5c7a'); },
  (g) => { g.lineCap = 'round'; for (const [x, w, y] of [[-26, 16, -52], [0, 24, -38], [26, 15, -48], [-12, 12, -44], [14, 12, -56]]) { g.beginPath(); g.moveTo(x, -900); g.lineTo(x, y); g.strokeStyle = OUT; g.lineWidth = w + 6; g.stroke(); g.strokeStyle = '#8a5a30'; g.lineWidth = w; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = w * 0.3; g.beginPath(); g.moveTo(x - w * 0.2, -900); g.lineTo(x - w * 0.2, y); g.stroke(); } },
  (g, t) => { g.translate(0, Math.sin(t * 2) * 3); for (const s of [-1, 1]) { box(g, s * 26 - (s < 0 ? 44 : 0), -84, 44, 28, 3, '#1c7ed6'); g.strokeStyle = '#a5d8ff'; g.lineWidth = 1.5; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(s * 26 + s * k * 11, -84); g.lineTo(s * 26 + s * k * 11, -56); } g.stroke(); } box(g, -22, -98, 44, 58, 8, '#dee2e6'); box(g, -10, -84, 20, 20, 10, '#ffd43b', 2.5); g.beginPath(); g.moveTo(0, -98); g.lineTo(0, -116); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); circ(g, 0, -118, 5, Math.sin(t * 6) > 0 ? '#ff6b6b' : '#c92a2a'); },
];
export function drawObstacle(g, k, zi, v, t) {
  g.lineJoin = 'round';
  if (k === 'low') LOW[zi][v % 2](g, t);
  else if (k === 'tall') TALL[zi](g, t);
  else if (k === 'high') {
    const c = ZONES[zi].hang;
    if (c && zi !== 5) for (const x of zi === 1 || zi === 2 ? [0] : [-30, 30]) { rect(g, x - 4.5, -1200, 9, 1105, OUT); rect(g, x - 2, -1200, 4, 1105, c); }
    HIGH[zi](g, t);
  }
}
export function drawSalt(g, w, t) {
  g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w * 0.1, -12, w * 0.25, -11); g.quadraticCurveTo(w * 0.4, -18, w * 0.55, -12); g.quadraticCurveTo(w * 0.8, -15, w, 0); g.closePath(); fs(g, '#fff');
  g.fillStyle = '#cfd8e6'; for (let i = 0; i < w / 14; i++) g.fillRect(8 + i * 14, -3 - ((i * 7) % 6), 3, 3);
  for (let i = 0; i < 3; i++) { const x = w * (0.2 + i * 0.3), a = 0.5 + 0.5 * Math.sin(t * 5 + i * 2); g.globalAlpha = a; g.fillStyle = '#fff'; poly(g, [[x, -26 - i * 3], [x + 2.5, -20 - i * 3], [x + 8, -18 - i * 3], [x + 2.5, -16 - i * 3], [x, -10 - i * 3], [x - 2.5, -16 - i * 3], [x - 8, -18 - i * 3], [x - 2.5, -20 - i * 3]]); g.fill(); g.strokeStyle = '#74c0fc'; g.lineWidth = 1; g.stroke(); }
  g.globalAlpha = 1;
  g.save(); g.translate(w - 12, -14); g.rotate(-1.1); box(g, -9, -14, 18, 26, 4, '#e7f5ff'); box(g, -10, -22, 20, 10, 3, '#adb5bd'); text(g, 'S', 0, 0, 13, '#1c7ed6'); g.restore();
}
export function drawPlatform(g, w, zi) {
  const c = [['#a8683a', '#5fb347'], ['#8d93a3', '#eceff4'], ['#a5b1c8', '#fff'], ['#d9a066', '#f7dba3'], ['#232a4d', '#3df5a0'], ['#8a5a30', '#b98a52'], ['#aab0c6', '#eef0f7']][zi];
  if (zi !== 6) for (const x of [10, w - 10]) { rect(g, x - 3.5, -1200, 7, 1200, OUT); rect(g, x - 1.5, -1200, 3, 1200, ZONES[zi].hang); }
  else { g.fillStyle = 'rgba(120,200,255,.35)'; for (const x of [18, w - 18]) { poly(g, [[x - 8, 16], [x + 8, 16], [x, 40]]); g.fill(); } }
  box(g, 0, 0, w, 16, 6, c[0]); R(g, 2, 1, w - 4, 6, 3); g.fillStyle = c[1]; g.fill();
}

// ------------------------------------------------------------------ worms
export function drawWorm(g, t, zi, fly) {
  const pal = PAL[2], n = 7, pts = []; g.lineJoin = 'round'; g.lineCap = 'round';
  const hump = fly ? 0.3 : 0.5 + 0.5 * Math.sin(t * 9);
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([26 - u * 50 + (1 - hump) * (u - 0.5) * -8, -10 - Math.sin(u * Math.PI) * 15 * hump - (i === n ? 6 : 0)]); }
  if (fly) { // little drone it rides on
    box(g, -26, -4, 52, 10, 5, '#5c677d'); for (const s of [-1, 1]) { rect(g, s * 22 - 1.5, 4, 3, 8, OUT); g.fillStyle = 'rgba(200,220,255,.7)'; g.beginPath(); g.ellipse(s * 22, 13, 15 * Math.abs(Math.sin(t * 40 + s)) + 3, 3, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(); } circ(g, 0, 1, 2.5, '#ff6b6b');
  }
  g.fillStyle = OUT; for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 12.2, 0, TAU); g.fill(); }
  pts.forEach(([x, y], i) => circ(g, x, y, 9.6, i % 2 ? pal.main : pal.light));
  const [hx, hy] = pts[n]; g.beginPath(); g.arc(hx, hy, 12.5, 0, TAU); fs(g, pal.main, 2.6);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * 4.6 - 2, hy - 2, 4, 0, TAU); fs(g, '#fff', 1.6); circ(g, hx + s * 4.6 - 3.4, hy - 1.6, 1.8, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(hx - 11, hy - 6); g.lineTo(hx - 4, hy - 8.5); g.moveTo(hx + 7, hy - 6); g.lineTo(hx, hy - 8.5); g.stroke();
  g.beginPath(); g.arc(hx - 2, hy + 9, 4.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  // little hats: hard hat in most places, top hat at HQ
  if (zi === 5 || zi === 4) { box(g, hx - 12, hy - 14, 24, 4, 2, '#2a2a33', 2); box(g, hx - 8, hy - 27, 16, 14, 2, '#2a2a33', 2); rect(g, hx - 8, hy - 18, 16, 3, '#e03131'); }
  else if (zi === 6) { g.beginPath(); g.arc(hx, hy - 1, 17, 0, TAU); g.fillStyle = 'rgba(200,230,255,.28)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke(); }
  else { g.beginPath(); g.arc(hx, hy - 9, 10, Math.PI, 0); g.closePath(); fs(g, '#ffd43b', 2); box(g, hx - 14, hy - 11, 20, 4, 2, '#ffd43b', 2); }
}

// ------------------------------------------------------------------ power-ups + hats
export const POWERS = { magnet: { name: 'Coin Magnet', col: '#ff6b6b' }, shield: { name: 'Slime Shield', col: '#69db7c' }, rush: { name: 'Espresso Rush', col: '#c0834a' }, x2: { name: 'Double Bidness', col: '#ffd43b' } };
export function drawPower(g, kind, t) {
  const c = POWERS[kind].col, p = 1 + Math.sin(t * 6) * 0.06; g.save(); g.scale(p, p); g.lineJoin = 'round'; g.lineCap = 'round';
  const gl = g.createRadialGradient(0, 0, 8, 0, 0, 44); gl.addColorStop(0, c); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = 0.55; g.fillStyle = gl; g.fillRect(-44, -44, 88, 88); g.globalAlpha = 1;
  g.beginPath(); g.arc(0, 0, 24, 0, TAU); fs(g, '#fff'); g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.strokeStyle = c; g.lineWidth = 3; g.stroke();
  if (kind === 'magnet') { g.beginPath(); g.arc(0, -1, 9, Math.PI, 0); g.lineTo(9, 9); g.moveTo(-9, -1); g.lineTo(-9, 9); g.strokeStyle = OUT; g.lineWidth = 10; g.stroke(); g.strokeStyle = '#f03e3e'; g.lineWidth = 6; g.stroke(); rect(g, -12, 6, 6, 5, '#dee2e6'); rect(g, 6, 6, 6, 5, '#dee2e6'); }
  else if (kind === 'shield') { g.beginPath(); g.moveTo(0, -14); g.bezierCurveTo(14, 0, 12, 13, 0, 13); g.bezierCurveTo(-12, 13, -14, 0, 0, -14); g.closePath(); fs(g, '#69db7c', 2.5); ell(g, -4, 4, 2.5, 4, 'rgba(255,255,255,.8)'); }
  else if (kind === 'rush') { box(g, -10, -7, 18, 18, 4, '#fff', 2.5); g.beginPath(); g.arc(9, 1, 5.5, -Math.PI / 2, Math.PI / 2); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke(); rect(g, -8, -5, 14, 5, '#7a4a24'); g.strokeStyle = '#adb5bd'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -11); g.quadraticCurveTo(-8, -15, -4, -18); g.moveTo(3, -11); g.quadraticCurveTo(0, -15, 4, -18); g.stroke(); }
  else { g.font = '900 20px ui-rounded, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = OUT; g.strokeText('x2', 0, 1); g.fillStyle = '#f59f00'; g.fillText('x2', 0, 1); }
  g.restore();
}
export const HATS = [
  { id: 'none', name: 'No Hat', cost: 0 }, { id: 'hard', name: 'Hard Hat', cost: 50 }, { id: 'party', name: 'Party Hat', cost: 120 },
  { id: 'cowboy', name: 'Rancher', cost: 250 }, { id: 'top', name: 'Top Hat', cost: 400 }, { id: 'prop', name: 'Propeller', cost: 650 }, { id: 'crown', name: 'CEO Crown', cost: 1000 },
];
// slug-local coords: head top is around (45, -33)
export function drawHat(g, id, t = 0) {
  if (!id || id === 'none') return; g.save(); g.translate(45, -30); g.rotate(-0.1); g.scale(1.25, 1.25); g.lineJoin = 'round';
  if (id === 'hard') { g.beginPath(); g.arc(0, -2, 19, Math.PI, 0); g.closePath(); fs(g, '#ffd43b'); box(g, -24, -5, 52, 7, 3, '#ffd43b'); rect(g, -3, -20, 6, 15, '#f59f00'); }
  else if (id === 'party') { poly(g, [[-15, 0], [15, 0], [2, -40]]); fs(g, '#f06595'); g.save(); poly(g, [[-15, 0], [15, 0], [2, -40]]); g.clip(); g.fillStyle = '#ffd43b'; for (let y = -6; y > -40; y -= 13) g.fillRect(-20, y - 4, 40, 5); g.restore(); g.beginPath(); g.arc(2, -41, 6, 0, TAU); fs(g, '#74c0fc', 2.5); }
  else if (id === 'cowboy') { g.beginPath(); g.ellipse(0, -2, 34, 7, 0, 0, TAU); fs(g, '#a8683a'); g.beginPath(); g.moveTo(-17, -4); g.quadraticCurveTo(-17, -30, -5, -26); g.quadraticCurveTo(0, -22, 5, -26); g.quadraticCurveTo(17, -30, 17, -4); g.closePath(); fs(g, '#a8683a'); rect(g, -16, -10, 32, 5, '#5c3d1e'); }
  else if (id === 'top') { box(g, -24, -6, 48, 7, 3, '#2a2a33'); box(g, -15, -36, 30, 32, 3, '#2a2a33'); rect(g, -15, -15, 30, 6, '#e03131'); }
  else if (id === 'prop') { g.beginPath(); g.arc(0, -2, 17, Math.PI, 0); g.closePath(); fs(g, '#339af0'); g.save(); g.beginPath(); g.arc(0, -2, 17, Math.PI, 0); g.clip(); rect(g, -6, -22, 12, 22, '#ff6b6b'); g.restore(); rect(g, -1.5, -27, 3, 9, OUT); g.beginPath(); g.ellipse(0, -28, 20 * Math.abs(Math.cos(t * 18)) + 3, 4, 0, 0, TAU); fs(g, '#ffd43b', 2.5); }
  else if (id === 'crown') { poly(g, [[-18, 0], [-21, -24], [-9, -12], [0, -29], [9, -12], [21, -24], [18, 0]]); fs(g, '#ffd43b'); circ(g, 0, -8, 3.5, '#e03131'); circ(g, -11, -6, 2.5, '#339af0'); circ(g, 11, -6, 2.5, '#339af0'); }
  g.restore();
}

// ------------------------------------------------------------------ 3D mode: roadside scenery + head-on worm (origin on the ground)
export function drawProp(g, zi, v, seed) {
  const r = rng(seed);
  if (zi === 0) {
    if (v < 0.55) { const w = 70 + v * 90; trunk(g, w, '#a85a30', '#6a3318', '#4f2410', r); ell(g, 0, 0, w * 0.8, 14, '#4f9a3a'); }
    else if (v < 0.82) { fern(g, 2.3, '#3c9a3c'); g.translate(44, 0); fern(g, 1.5, '#57b548'); }
    else { rect(g, -7, -36, 14, 36, '#f3e9d2'); g.fillStyle = '#e8590c'; g.beginPath(); g.ellipse(0, -36, 32, 23, 0, Math.PI, 0); g.fill(); circ(g, -10, -46, 5, '#fff'); circ(g, 10, -50, 4, '#fff'); }
  } else if (zi === 1) {
    if (v < 0.7) {
      const w = 190, h = 280 + v * 520, c = ['#7f8fd0', '#9a86c9', '#6f9bc8', '#c98fa8'][(r() * 4) | 0];
      rect(g, -w / 2, -h, w, h, c); rect(g, -w / 2, -h, w, 12, 'rgba(255,255,255,.3)'); rect(g, w / 2 - 22, -h, 22, h, 'rgba(0,0,40,.14)');
      for (let y = -h + 34; y < -110; y += 62) for (let x = -w / 2 + 20; x < w / 2 - 50; x += 46) rect(g, x, y, 28, 38, r() < 0.35 ? '#ffe9a8' : 'rgba(20,30,90,.4)');
      rect(g, -w / 2, -92, w, 92, '#f1dcc0'); rect(g, -w / 2 + 16, -70, w - 80, 50, '#9fd3f2'); rect(g, w / 2 - 54, -74, 36, 74, '#6a4a34'); rect(g, -w / 2 - 6, -104, w + 12, 16, ['#e8590c', '#1c7ed6', '#d6336c', '#2f9e44'][(r() * 4) | 0]);
    } else if (v < 0.86) { rect(g, -4, -230, 8, 230, '#3d4354'); rect(g, -4, -232, 44, 8, '#3d4354'); circ(g, 40, -220, 13, '#fff3b0'); }
    else { rect(g, -7, -90, 14, 90, '#7a5a3c'); circ(g, 0, -124, 46, '#4fae5a'); circ(g, -24, -104, 30, '#63c26b'); circ(g, 26, -106, 28, '#3f9a4d'); }
  } else if (zi === 2) {
    if (v < 0.45) { rect(g, -100, -120, 200, 120, '#8fa3c4'); rect(g, -100, -128, 200, 12, '#6c7fa3'); rect(g, -60, -172, 76, 52, '#2b3350'); rect(g, -53, -165, 62, 38, v < 0.2 ? '#74c0fc' : '#8ce99a'); rect(g, 36, -160, 44, 34, '#fff'); rect(g, 40, -156, 36, 26, '#ffe066'); }
    else if (v < 0.75) { poly(g, [[-22, 0], [22, 0], [28, -46], [-28, -46]]); g.fillStyle = '#c2703d'; g.fill(); rect(g, -4, -150, 8, 106, '#5a3d2a'); for (const [x, y, s] of [[0, -186, 42], [-34, -140, 30], [34, -146, 32], [-12, -108, 24], [20, -210, 26]]) ell(g, x, y, s, s * 0.8, s > 30 ? '#2f9e44' : '#51cf66'); }
    else { rect(g, -90, -420, 180, 420, '#efe4cc'); rect(g, -78, -400, 156, 250, '#fff'); const gr = g.createLinearGradient(0, -394, 0, -156); gr.addColorStop(0, '#6db9f2'); gr.addColorStop(1, '#d3ecff'); rect(g, -72, -394, 144, 238, gr); rect(g, -3, -394, 6, 238, '#fff'); rect(g, -72, -280, 144, 6, '#fff'); }
  } else if (zi === 3) {
    if (v < 0.4) palm(g, 240 + v * 200, '#5d3b7c');
    else if (v < 0.78) { const c = ['#ff6b6b', '#22b8cf', '#fcc419', '#f06595'][(r() * 4) | 0]; rect(g, -90, -130, 180, 130, '#fff4e0'); rect(g, -74, -88, 148, 52, '#7a4a2a'); for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff' : c; poly(g, [[-96 + k * 32, -132], [-64 + k * 32, -132], [-68 + k * 32, -178], [-86 + k * 32, -178]]); g.fill(); } rect(g, -98, -138, 196, 10, c); }
    else { rect(g, -4, -240, 8, 240, '#6a4a6f'); for (let k = 0; k < 4; k++) circ(g, -30 + k * 20, -228 + Math.abs(k - 1.5) * -6, 8, ['#fff3b0', '#ffa8a8', '#99e9f2'][k % 3]); }
  } else if (zi === 4) {
    if (v < 0.5) { rect(g, -24, -TH, 48, TH, '#232d5e'); rect(g, -24, -TH, 10, TH, '#2f3b78'); rect(g, 8, -TH, 4, TH, v < 0.25 ? '#3df5a0' : '#ff5c7a'); rect(g, -34, -24, 68, 24, '#2f3b78'); }
    else { rect(g, -6, -150, 12, 150, '#1b2450'); rect(g, -110, -330, 220, 190, '#060a1c'); rect(g, -100, -320, 200, 170, '#0e1533'); const tk = ['SLUG', 'WRM', 'BNNA', 'SLME']; for (let k = 0; k < 4; k++) { const up = k !== 1 && r() < 0.8; text(g, tk[k], -88, -296 + k * 40, 26, '#e7ecff', 'left'); text(g, up ? '▲' : '▼', 78, -296 + k * 40, 26, up ? '#3df5a0' : '#ff5c7a'); } }
  } else if (zi === 5) {
    if (v < 0.5) { rect(g, -14, -TH, 28, TH, '#6e4520'); rect(g, -14, -TH, 8, TH, '#8a5a30'); const gl = g.createRadialGradient(34, -250, 4, 34, -250, 120); gl.addColorStop(0, 'rgba(255,214,102,.6)'); gl.addColorStop(1, 'rgba(255,214,102,0)'); g.fillStyle = gl; g.fillRect(-90, -370, 250, 240); rect(g, 14, -290, 30, 6, '#3b2414'); rect(g, 24, -270, 20, 28, '#ffd43b'); }
    else { const c = v < 0.75 ? '120,255,230' : '190,140,255', gl = g.createRadialGradient(0, -40, 4, 0, -40, 130); gl.addColorStop(0, `rgba(${c},.5)`); gl.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gl; g.fillRect(-130, -170, 260, 170); for (const [dx, h, s] of [[-26, 40, 20], [8, 70, 28], [40, 30, 16]]) { rect(g, dx - 5, -h, 10, h, '#e9f7f3'); g.fillStyle = `rgb(${c})`; g.beginPath(); g.ellipse(dx, -h, s, s * 0.7, 0, Math.PI, 0); g.fill(); } }
  } else {
    if (v < 0.6) { const s = 40 + v * 90; poly(g, [[-s, 0], [-s * 0.7, -s * 0.8], [0, -s * 1.1], [s * 0.8, -s * 0.7], [s, 0]]); g.fillStyle = '#9a9fb6'; g.fill(); poly(g, [[0, -s * 1.1], [s * 0.8, -s * 0.7], [s, 0], [s * 0.2, 0]]); g.fillStyle = '#7b8099'; g.fill(); }
    else if (v < 0.85) { ell(g, 0, 0, 120, 20, '#7d8299'); ell(g, 0, -4, 90, 12, '#5d627d'); }
    else { rect(g, -3, -190, 6, 190, '#dee2e6'); rect(g, 3, -190, 100, 62, '#ffd43b'); text(g, 'BIDNESS', 53, -159, 18, '#3b2414'); }
  }
}
export function drawWormFront(g, t, zi) {
  const pal = PAL[2]; g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 3; i >= 1; i--) { const x = Math.sin(t * 9 + i) * 3 * i, y = -13 - i * 5, rr = 15 - i * 1.5; g.beginPath(); g.arc(x, y, rr, 0, TAU); fs(g, i % 2 ? pal.light : pal.main, 2.6); }
  g.beginPath(); g.arc(0, -17, 17, 0, TAU); fs(g, pal.main, 3);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 7, -20, 5.5, 0, TAU); fs(g, '#fff', 1.8); circ(g, s * 7, -18.5, 2.5, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -28); g.lineTo(-3, -24); g.moveTo(14, -28); g.lineTo(3, -24); g.stroke();
  g.beginPath(); g.arc(0, -4, 6, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 2.6; g.stroke();
  if (zi === 4 || zi === 5) { box(g, -17, -36, 34, 5, 2, '#2a2a33', 2); box(g, -11, -54, 22, 19, 2, '#2a2a33', 2); rect(g, -11, -41, 22, 4, '#e03131'); }
  else if (zi === 6) { g.beginPath(); g.arc(0, -17, 23, 0, TAU); g.fillStyle = 'rgba(200,230,255,.25)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke(); }
  else { g.beginPath(); g.arc(0, -29, 14, Math.PI, 0); g.closePath(); fs(g, '#ffd43b', 2.2); box(g, -18, -31, 36, 5, 2, '#ffd43b', 2.2); }
}

// ------------------------------------------------------------------ slime ledge (Side View): sticky underside, walkable top. Origin = underside, left end.
export function drawLedge(g, w, zi, t, hint) {
  const c = [['#a8683a', '#5fb347'], ['#8d93a3', '#eceff4'], ['#a5b1c8', '#fff'], ['#d9a066', '#f7dba3'], ['#232a4d', '#3df5a0'], ['#8a5a30', '#b98a52'], ['#aab0c6', '#eef0f7']][zi];
  g.lineJoin = 'round';
  if (zi !== 6) for (const x of [12, w - 12]) { rect(g, x - 3.5, -1216, 7, 1200, OUT); rect(g, x - 1.5, -1216, 3, 1200, ZONES[zi].hang || '#868e96'); }
  else { g.fillStyle = 'rgba(120,200,255,.4)'; for (const x of [20, w - 20]) { poly(g, [[x - 8, 0], [x + 8, 0], [x, 22 + Math.sin(t * 20 + x) * 4]]); g.fill(); } }
  box(g, 0, -16, w, 16, 6, c[0]); R(g, 2, -15, w - 4, 6, 3); g.fillStyle = c[1]; g.fill();
  const n = Math.max(3, Math.round(w / 22)), st = (w - 8) / n; g.beginPath(); g.moveTo(4, -5);
  for (let i = 0; i < n; i++) { const d = 5 + ((i * 7) % 3) * 4 + Math.sin(t * 2.2 + i * 1.7) * 2; g.quadraticCurveTo(4 + (i + 0.5) * st, d * 2 - 5, 4 + (i + 1) * st, -5 + (i === n - 1 ? 0 : 3)); }
  g.closePath(); fs(g, '#e6f56e', 2.5);
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < n; i += 2) { g.beginPath(); g.ellipse(4 + (i + 0.5) * st - 3, 1, 2.6, 1.5, 0, 0, TAU); g.fill(); }
  for (let i = 1; i < n; i += 3) { const u = (t * 0.6 + i * 0.37) % 1; g.globalAlpha = 1 - u; g.fillStyle = '#e6f56e'; g.beginPath(); g.ellipse(4 + (i + 0.5) * st, 8 + u * 46, 2.4, 4, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  if (hint) { const bob = Math.sin(t * 6) * 4, x = Math.min(w / 2, 150); g.font = '900 17px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = OUT; g.strokeText('▲ BOING UP TO STICK ▲', x, -38 + bob); g.fillStyle = '#e6f56e'; g.fillText('▲ BOING UP TO STICK ▲', x, -38 + bob); }
}
