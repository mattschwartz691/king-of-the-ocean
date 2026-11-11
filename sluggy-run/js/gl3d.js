// Sluggy Run — WebGL renderer for the 3D Chase mode (three.js). Pure presentation: reads the sim state from run3d.js.
import * as THREE from '../../vendor/three.module.min.js';
import { ZONES, drawPower, POWERS } from './zones.js';

const NZ = ZONES.length, PI = Math.PI, TAU = PI * 2, CH = 520, NCH = 8, ROAD = 132, LANE = 80;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const hash = (n) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };

// per-zone lighting / atmosphere
const LOOK = [
  { sky: ['#0b3c40', '#3d8f6a', '#c9eaa6'], fog: '#a5d6a0', fogN: 500, fogF: 2500, sun: '#fff0c0', sunI: 2.7, dir: [-0.5, 1, 0.35], hemi: ['#d8f5c8', '#3d5f2c'], hemiI: 1.7 },
  { sky: ['#2f8fe8', '#8cc8ff', '#ffe6c8'], fog: '#dcebff', fogN: 700, fogF: 2700, sun: '#ffffff', sunI: 3.0, dir: [-0.6, 1, 0.3], hemi: ['#d6e8ff', '#8a8f9c'], hemiI: 1.6 },
  { sky: ['#efe4cc', '#f4ead6', '#e6d8bb'], fog: '#efe4cc', fogN: 700, fogF: 2600, sun: '#fff4dc', sunI: 1.9, dir: [-0.3, 1, 0.4], hemi: ['#ffffff', '#b9a67f'], hemiI: 2.1 },
  { sky: ['#3a2370', '#e8638c', '#ffc27a'], fog: '#f2a58c', fogN: 500, fogF: 2600, sun: '#ffb46a', sunI: 3.1, dir: [-0.35, 0.5, -0.8], hemi: ['#ffa8c8', '#4a3a7a'], hemiI: 1.5 },
  { sky: ['#04071a', '#0b1230', '#1a2560'], fog: '#0b1230', fogN: 500, fogF: 2500, sun: '#9ab8ff', sunI: 1.4, dir: [-0.3, 1, 0.5], hemi: ['#4a5cb8', '#0a0e22'], hemiI: 1.9 },
  { sky: ['#160b05', '#2a180c', '#3d2413'], fog: '#2a180c', fogN: 350, fogF: 2000, sun: '#ffcf8a', sunI: 1.5, dir: [-0.2, 1, 0.5], hemi: ['#c89a66', '#2a1608'], hemiI: 1.7 },
  { sky: ['#01020a', '#060920', '#141a45'], fog: '#080b20', fogN: 900, fogF: 3000, sun: '#ffffff', sunI: 3.3, dir: [0.8, 0.7, 0.25], hemi: ['#6a7ab8', '#2a2d40'], hemiI: 0.9 },
];

export function createGL(canvas, env) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#a5d6a0', 500, 2500);
  const camera = new THREE.PerspectiveCamera(70, 1, 8, 9000);
  const hemi = new THREE.HemisphereLight('#fff', '#444', 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 760, bottom: -240, near: 10, far: 2200 }); sun.shadow.bias = -0.0015; scene.add(sun, sun.target);
  let W = 1, H = 1;

  // ------------------------------------------------------------ curved-world shader patch + material/geometry kit
  const uBend = { value: new THREE.Vector2(0, 0) };
  function bendy(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uBend = uBend;
      sh.vertexShader = 'uniform vec2 uBend;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.x += uBend.x * mvPosition.z * mvPosition.z; mvPosition.y += uBend.y * mvPosition.z * mvPosition.z; gl_Position = projectionMatrix * mvPosition;');
    };
    return m;
  }
  const mats = new Map();
  function mat(color, o) { const key = color + (o ? JSON.stringify(o) : ''); let m = mats.get(key); if (!m) { m = bendy(new THREE.MeshLambertMaterial({ color, ...o })); mats.set(key, m); } return m; }
  const glow = (color, k = 1) => mat(color, { emissive: color, emissiveIntensity: k });
  function phong(color, shininess = 80, o) { const key = 'p' + color + shininess + (o ? JSON.stringify(o) : ''); let m = mats.get(key); if (!m) { m = bendy(new THREE.MeshPhongMaterial({ color, shininess, specular: '#ffffff', ...o })); mats.set(key, m); } return m; }
  function texMat(tex, o) { return bendy(new THREE.MeshLambertMaterial({ map: tex, ...o })); }
  function tex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; }
  function signTex(lines, bg, fg, w = 256, h = 128, border) { return tex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); if (border) { g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); } g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach(([s, col, px], i) => { g.font = `900 ${px || 54}px ui-rounded, system-ui, sans-serif`; g.fillStyle = col || fg; g.fillText(s, w / 2, h * (i + 0.5) / lines.length + 3); }); }); }
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 20, 14), lo: new THREE.SphereGeometry(1, 10, 8), dome: new THREE.SphereGeometry(1, 18, 9, 0, TAU, 0, PI / 2),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 14), ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), plane: new THREE.PlaneGeometry(1, 1),
  };
  const taper = new Map();
  function mk(geo, m, x, y, z, sx, sy, sz, cast = true) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = cast; return o; }
  const B = (w, h, d, m, x = 0, y = 0, z = 0) => mk(GEO.box, m, x, y + h / 2, z, w, h, d);                 // box sitting on y
  const S = (m, x, y, z, sx, sy = sx, sz = sx, geo = GEO.sph) => mk(geo, m, x, y, z, sx, sy, sz);          // ellipsoid centred
  const K = (r, h, m, x = 0, y = 0, z = 0) => mk(GEO.cone, m, x, y + h / 2, z, r, h, r);                   // cone sitting on y
  function C(rt, rb, h, m, x = 0, y = 0, z = 0) {                                                           // cylinder sitting on y
    if (rt === rb) return mk(GEO.cyl, m, x, y + h / 2, z, rt, h, rt);
    const k = Math.round((rt / rb) * 20) / 20; let geo = taper.get(k); if (!geo) { geo = new THREE.CylinderGeometry(k, 1, 1, 16); taper.set(k, geo); } return mk(geo, m, x, y + h / 2, z, rb, h, rb);
  }
  const grp = (...c) => { const g = new THREE.Group(); for (const o of c) if (o) g.add(o); return g; };
  const rot = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
  const nocast = (o) => { o.traverse((c) => { c.castShadow = false; }); return o; };
  function board(t, w, h, x, y, z, emissive) { const m = bendy(new THREE.MeshLambertMaterial(emissive ? { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9 } : { map: t })); const g = grp(B(w, h, 5, mat('#3b2414'), x, y, z - 1)); const f = mk(GEO.plane, m, x, y + h / 2, z + 2, w - 5, h - 5, 1, false); g.add(f); return g; }
  const posts = (m, h = 104, x = 40) => [C(4.5, 5.5, h, m, -x, 0, 0), C(4.5, 5.5, h, m, x, 0, 0)];

  // ------------------------------------------------------------ sky + backdrop
  const skyCv = document.createElement('canvas'); skyCv.width = 4; skyCv.height = 256; const skyG = skyCv.getContext('2d');
  const skyTex = new THREE.CanvasTexture(skyCv); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 16, 12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; scene.add(sky);
  const ca = new THREE.Color(), cb = new THREE.Color(), mixHex = (a, b, t) => '#' + ca.set(a).lerp(cb.set(b), t).getHexString();
  let skyKey = '';
  function paintSky(a, b, t) {
    const key = a + '|' + b + '|' + t.toFixed(2); if (key === skyKey) return; skyKey = key;
    const A = LOOK[a].sky, Bk = LOOK[b].sky, gr = skyG.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, mixHex(A[0], Bk[0], t)); gr.addColorStop(0.3, mixHex(A[0], Bk[0], t)); gr.addColorStop(0.44, mixHex(A[1], Bk[1], t)); gr.addColorStop(0.52, mixHex(A[2], Bk[2], t)); gr.addColorStop(1, mixHex(A[2], Bk[2], t));
    skyG.fillStyle = gr; skyG.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  }
  // distant skyline ring built from the side-scroller's background art
  const ringGeo = new THREE.CylinderGeometry(4200, 4200, 2300, 40, 1, true, PI * 0.5, PI);
  const rings = [0, 1].map(() => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -9; m.rotation.y = PI; scene.add(m); return m; });
  const ringTex = new Map();
  function ringMap(zi) { let t = ringTex.get(zi); if (!t) { const a = env.tile(zi, 0), b = env.tile(zi, 1), c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'); g.globalAlpha = 0.9; g.drawImage(a, 0, 0, 1024, 512); g.globalAlpha = 1; g.drawImage(b, 0, 0, 1024, 512); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(5, 1); ringTex.set(zi, t); } return t; }
  // extras that live in the sky
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 900 }, (_, i) => { const a = hash(i) * TAU, e = hash(i + 0.5) * 1.3, r = 6000; return [Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r]; }).flat(), 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false, transparent: true })); scene.add(stars);
  const earth = grp(mk(GEO.sph, new THREE.MeshLambertMaterial({ fog: false, map: tex(256, 128, (g) => { g.fillStyle = '#2f7fe0'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#4fbf6a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(hash(i) * 256, 20 + hash(i + 3) * 90, 14 + hash(i + 5) * 22, 8 + hash(i + 7) * 14, hash(i) * 3, 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(hash(i + 20) * 256, hash(i + 23) * 128, 26, 5, 0, 0, TAU); g.fill(); } }) }), 0, 0, 0, 420, 420, 420, false)); scene.add(earth);
  const sunDisc = mk(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#fff3b0', fog: false, depthWrite: false }), 0, 0, 0, 520, 520, 1, false); sunDisc.renderOrder = -8; scene.add(sunDisc);

  // ------------------------------------------------------------ ground textures per zone
  const speck = (g, w, h, n, cols, r0 = 1, r1 = 3) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(hash(i * 3.1 + n) * w, hash(i * 5.7 + n) * h, r0 + hash(i) * r1, (r0 + hash(i + 2) * r1) * 0.7, 0, 0, TAU); g.fill(); } };
  const LX = [128 - 40 * 256 / 264, 128 + 40 * 256 / 264];
  const roadDraw = [
    (g, w, h) => { g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h); speck(g, w, h, 260, ['#7a4c2a', '#9a6a40', '#6f4424'], 2, 5); g.fillStyle = 'rgba(255,240,200,.22)'; for (const x of LX) for (let y = 0; y < h; y += 64) g.fillRect(x - 2, y, 4, 34); g.fillStyle = '#5fb347'; g.fillRect(0, 0, 9, h); g.fillRect(w - 9, 0, 9, h); },
    (g, w, h) => { g.fillStyle = '#4a4d5c'; g.fillRect(0, 0, w, h); speck(g, w, h, 300, ['#434655', '#525566'], 1, 2); g.fillStyle = '#ffd43b'; for (const x of LX) for (let y = 0; y < h; y += 128) g.fillRect(x - 3, y, 6, 70); g.fillStyle = '#eceff4'; g.fillRect(4, 0, 7, h); g.fillRect(w - 11, 0, 7, h); },
    (g, w, h) => { g.fillStyle = '#5673ad'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = ((x + y) / 64) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,40,.06)'; g.fillRect(x, y, 64, 64); } g.fillStyle = 'rgba(255,255,255,.35)'; for (const x of LX) g.fillRect(x - 2, 0, 4, h); g.fillStyle = '#c92a2a'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); },
    (g, w, h) => { g.fillStyle = '#d9a066'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = (y / 32) % 2 ? '#cf9458' : '#dfa871'; g.fillRect(0, y, w, 30); g.fillStyle = '#8a5a30'; g.fillRect(0, y + 30, w, 2); g.fillRect(14, y + 13, 3, 3); g.fillRect(w - 17, y + 13, 3, 3); g.fillRect(126, y + 13, 3, 3); } g.fillStyle = 'rgba(122,74,36,.5)'; for (const x of LX) g.fillRect(x - 2, 0, 4, h); },
    (g, w, h) => { g.fillStyle = '#141b40'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,160,255,.22)'; g.lineWidth = 2; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#3df5a0'; for (const x of LX) g.fillRect(x - 3, 0, 6, h); g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); },
    (g, w, h) => { g.fillStyle = '#7a4c26'; g.fillRect(0, 0, w, h); speck(g, w, h, 300, ['#6a4020', '#8a5a30', '#5a3519'], 2, 6); g.fillStyle = '#3b2414'; for (let y = 8; y < h; y += 40) g.fillRect(20, y, w - 40, 9); g.fillStyle = '#adb5bd'; for (const x of [LX[0] - 22, LX[0] + 22 - 44 + 44, LX[1] - 22 + 44 - 44, LX[1] + 22]) g.fillRect(x - 3, 0, 6, h); },
    (g, w, h) => { g.fillStyle = '#9a9fb6'; g.fillRect(0, 0, w, h); speck(g, w, h, 60, ['#868ca6', '#8d92a8'], 5, 12); speck(g, w, h, 200, ['#a8adc2', '#8a8fa8'], 1, 3); g.fillStyle = '#74c0fc'; for (const x of LX) for (let y = 0; y < h; y += 64) { g.beginPath(); g.arc(x, y + 20, 5, 0, TAU); g.fill(); } g.fillStyle = '#eef0f7'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); },
  ];
  const sideDraw = [
    (g, w, h) => { g.fillStyle = '#3f8a3a'; g.fillRect(0, 0, w, h); speck(g, w, h, 400, ['#37803a', '#4f9a3a', '#2f7340', '#5fb347'], 2, 6); speck(g, w, h, 30, ['#6b4426'], 3, 5); },
    (g, w, h) => { g.fillStyle = '#c9ccd6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a9afbd'; g.lineWidth = 3; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#b8a888'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = ((x + y) / 32) % 2 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.05)'; g.fillRect(x, y, 32, 32); } },
    (g, w, h) => { g.fillStyle = '#3f5fb0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,220,200,.45)'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { const x = hash(i) * w, y = hash(i + 9) * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 6, x + 30, y); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#0a0e26'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,130,255,.5)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#3a2212'; g.fillRect(0, 0, w, h); speck(g, w, h, 300, ['#321d0e', '#4a2c16', '#2a1608', '#5a3a1c'], 3, 9); },
    (g, w, h) => { g.fillStyle = '#6d728d'; g.fillRect(0, 0, w, h); speck(g, w, h, 40, ['#5d627d', '#7d8299'], 8, 18); speck(g, w, h, 200, ['#7d8299', '#62677f'], 1, 4); },
  ];
  const roadMat = roadDraw.map((d, i) => { const t = tex(256, 512, d); const o = { map: t }; if (i === 4) Object.assign(o, { emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.55 }); return bendy(new THREE.MeshLambertMaterial(o)); });
  const sideTex = sideDraw.map((d) => tex(256, 256, d, [10, 2.2]));
  const sideMat = sideTex.map((t, i) => bendy(new THREE.MeshLambertMaterial(i === 4 ? { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.4 } : { map: t })));
  const roadGeo = new THREE.PlaneGeometry(ROAD * 2, CH, 1, 8).rotateX(-PI / 2), sideGeo = new THREE.PlaneGeometry(2400, CH, 3, 8).rotateX(-PI / 2);

  // ------------------------------------------------------------ roadside scenery (prototypes are cloned into chunks)
  const protos = new Map();
  const proto = (key, build) => { let p = protos.get(key); if (!p) { p = nocast(build()); protos.set(key, p); } return p.clone(); };
  const barkTex = tex(128, 256, (g, w, h) => { g.fillStyle = '#9a5230'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = ['#7a3c1e', '#b4683c', '#6a3318'][i % 3]; g.fillRect(hash(i) * w, hash(i + 4) * h, 3 + hash(i + 2) * 4, 30 + hash(i + 8) * 70); } }, [2, 14]);
  const winTex = [['#7f8fd0', '#ffe9a8'], ['#9a86c9', '#ffe9a8'], ['#6f9bc8', '#fff3c4'], ['#c98fa8', '#ffe9a8']].map(([c, lit], k) => tex(128, 256, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); for (let y = 10; y < h - 8; y += 32) for (let x = 10; x < w - 12; x += 30) { g.fillStyle = hash(x * 7 + y * 3 + k) < 0.35 ? lit : 'rgba(20,30,90,.45)'; g.fillRect(x, y, 18, 22); } }, [2, 3]));
  const winMat = winTex.map((t) => texMat(t));
  const officeWall = texMat(tex(256, 256, (g, w, h) => { g.fillStyle = '#efe4cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(28, 30, 200, 150); const gr = g.createLinearGradient(0, 36, 0, 174); gr.addColorStop(0, '#6db9f2'); gr.addColorStop(1, '#d3ecff'); g.fillStyle = gr; g.fillRect(34, 36, 188, 138); g.fillStyle = 'rgba(90,120,190,.55)'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 30, 100 + hash(i) * 40, 24, 80 - hash(i) * 40 + 0); g.fillStyle = '#fff'; g.fillRect(125, 36, 6, 138); g.fillRect(34, 102, 188, 6); g.fillStyle = '#b9a67f'; g.fillRect(0, 236, w, 20); }, [2, 1]));
  const rockTex = tex(256, 256, (g, w, h) => { g.fillStyle = '#4a2c16'; g.fillRect(0, 0, w, h); speck(g, w, h, 200, ['#3a2212', '#5a3a1c', '#2a1608', '#6b4526'], 6, 18); }, [3, 2]);
  const tickTex = [0, 1].map((k) => tex(256, 256, (g, w, h) => { g.fillStyle = '#0c1230'; g.fillRect(0, 0, w, h); const tk = k ? ['SLUG', 'BNNA', 'SLME', 'FERN', 'TIE'] : ['WRM', 'DIRT', 'SALT', 'SLUG', 'BNNA']; tk.forEach((s, i) => { const up = s !== 'WRM' && s !== 'DIRT' && s !== 'SALT'; g.font = '900 34px ui-rounded, system-ui'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#e7ecff'; g.fillText(s, 14, 30 + i * 49); g.textAlign = 'right'; g.fillStyle = up ? '#3df5a0' : '#ff5c7a'; g.fillText((up ? '▲ ' : '▼ ') + (1 + hash(i + k * 9) * 9).toFixed(1), 244, 30 + i * 49); }); }));
  const crateTex = tex(128, 128, (g, w, h) => { g.fillStyle = '#c98d4f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a5a2a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.stroke(); g.fillStyle = '#f6e3c0'; g.fillRect(14, 46, 100, 36); g.fillStyle = '#a01d4c'; g.font = '900 22px ui-rounded, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WORMCO', 64, 65); });
  const crateMat = texMat(crateTex);
  const stripeTex = (a, b) => tex(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 16, 0, 16, h); } });
  function palmTree(h) { const t = mat('#8a6a4a'), l = mat('#3f9a4d'), g = grp(); let x = 0; for (let i = 0; i < 5; i++) { const s = C(9 - i, 10 - i, h / 5 + 2, t, x, (i * h) / 5, 0); s.rotation.z = -0.08 * i; g.add(s); x += Math.sin(0.08 * i) * (h / 5); } for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, leaf = mk(GEO.lo, i % 2 ? l : mat('#57b862'), x + Math.cos(a) * 46, h - 8, Math.sin(a) * 46, 52, 4, 13); leaf.rotation.set(0, -a, -0.45); g.add(leaf); } g.add(S(mat('#6a4a2a'), x, h, 0, 9)); return g; }
  function shroomGlow(c) { const cap = glow(c, 1.3), st = mat('#e9f7f3'), g = grp(); for (const [x, z, hh, r] of [[-18, 6, 34, 16], [8, -6, 60, 24], [30, 10, 26, 13]]) { g.add(C(3.5, 4.5, hh, st, x, 0, z)); const d = mk(GEO.dome, cap, x, hh - 2, z, r, r * 0.7, r); g.add(d); } const halo = mk(GEO.plane, new THREE.MeshBasicMaterial({ map: haloTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 6, 40, 16, 220, 160, 1); bendy(halo.material); g.add(halo); return g; }
  const haloTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const haloMat = (c, o = 1) => bendy(new THREE.MeshBasicMaterial({ map: haloTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));

  // fills one ground chunk with scenery for its zone. Deterministic per chunk index.
  function populate(holder, idx, zi) {
    holder.clear(); const r = (k) => hash(idx * 13.7 + k * 3.3 + zi);
    const put = (o, x, z, s = 1, ry = 0) => { o.position.x += x; o.position.z += z; if (s !== 1) o.scale.multiplyScalar(s); o.rotation.y += ry; holder.add(o); return o; };
    for (const side of [-1, 1]) {
      const q = side < 0 ? 0 : 50;
      if (zi === 0) {
        for (let i = 0; i < 4; i++) { const rad = 26 + r(q + i) * 34, x = side * (ROAD + 70 + r(q + i + 10) * 520 + i * 60); put(proto('redwood', () => grp(C(1, 1, 1400, texMat(barkTex)), C(1, 1.9, 90, mat('#8a4a2a')), S(mat('#4f9a3a'), 0, 4, 0, 1.6, 0.12, 1.6))), x, (i - 1.5) * 130 + r(q + i + 20) * 60, 1).scale.set(rad, 1, rad); }
        for (let i = 0; i < 3; i++) put(proto('fern', () => { const g = grp(), m = mat('#3c9a3c'), m2 = mat('#57b548'); for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU, l = mk(GEO.lo, k % 2 ? m : m2, Math.cos(a) * 20, 14, Math.sin(a) * 20, 26, 2.5, 7); l.rotation.set(0, -a, 0.5); g.add(l); } return g; }), side * (ROAD + 26 + r(q + i + 30) * 150), (i - 1) * 170 + r(q + i + 33) * 80, 0.9 + r(q + i + 36) * 0.9);
        if (r(q + 40) < 0.6) put(proto('shroom', () => grp(C(5, 7, 26, mat('#f3e9d2')), mk(GEO.dome, mat('#e8590c'), 0, 22, 0, 24, 16, 24), S(mat('#fff'), -9, 33, 9, 4), S(mat('#fff'), 8, 34, -4, 3.4))), side * (ROAD + 30 + r(q + 41) * 90), r(q + 42) * 400 - 200, 0.8 + r(q + 43));
        if (r(q + 44) < 0.5) put(proto('bush', () => grp(S(mat('#2f7340'), 0, 22, 0, 40, 26, 34, GEO.ico1), S(mat('#3f8a45'), 26, 16, 10, 26, 18, 24, GEO.ico1))), side * (ROAD + 60 + r(q + 45) * 200), r(q + 46) * 400 - 200);
      } else if (zi === 1) {
        for (let i = 0; i < 2; i++) { const w = 210, hgt = 360 + r(q + i) * 560, v = (r(q + i + 5) * 4) | 0, x = side * (ROAD + 150 + w / 2), col = ['#e8590c', '#1c7ed6', '#d6336c', '#2f9e44'][(r(q + i + 7) * 4) | 0]; put(grp(mk(GEO.box, winMat[v], 0, hgt / 2 + 80, 0, w, hgt, 230, false), B(w, 80, 230, mat('#f1dcc0')), B(w + 24, 14, 250, mat(col), 0, 84, 0), B(110, 46, 4, mat('#9fd3f2'), 0, 18, 0)), x, (i - 0.5) * 258); holder.children[holder.children.length - 1].children[3].position.x = -side * (w / 2 + 2); holder.children[holder.children.length - 1].children[3].scale.set(4, 46, 130); }
        put(proto('lamp', () => grp(C(3, 4, 210, mat('#3d4354')), B(46, 5, 5, mat('#3d4354'), 20, 206, 0), S(glow('#fff3b0', 1.2), 40, 200, 0, 11))), side * (ROAD + 26), -120, 1, side > 0 ? PI : 0);
        put(proto('tree', () => grp(C(6, 8, 80, mat('#7a5a3c')), S(mat('#4fae5a'), 0, 116, 0, 46, 44, 46, GEO.ico1), S(mat('#63c26b'), -22, 96, 14, 28, 26, 28, GEO.ico1), S(mat('#3f9a4d'), 24, 100, -8, 26, 24, 26, GEO.ico1))), side * (ROAD + 70), 130, 0.9 + r(q + 20) * 0.4);
        if (r(q + 21) < 0.5) put(proto('bin', () => grp(C(13, 11, 34, mat('#2f9e44')), C(14, 14, 4, mat('#237a36'), 0, 34, 0))), side * (ROAD + 40), 20);
      } else if (zi === 2) {
        put(mk(GEO.plane, officeWall, side * 520, 210, 0, CH, 420, 1, false), 0, 0, 1, -side * PI / 2);
        for (let i = 0; i < 2; i++) put(proto('cubicle', () => grp(B(190, 84, 7, mat('#8fa3c4')), B(7, 84, 120, mat('#8fa3c4'), -92, 0, 60), B(170, 5, 70, mat('#d9c9a8'), 0, 48, 40), B(52, 36, 5, mat('#2b3350'), -30, 62, 30), mk(GEO.box, glow('#74c0fc', 0.9), -30, 80, 33, 44, 28, 1, false), B(10, 12, 10, mat('#2b3350'), -30, 53, 30), B(34, 30, 34, mat('#343a55'), 40, 0, 86), B(34, 40, 6, mat('#343a55'), 40, 30, 102))), side * (ROAD + 150 + r(q + i) * 90), (i - 0.5) * 250, 1, side > 0 ? 0 : 0);
        put(proto('ficus', () => grp(C(18, 13, 38, mat('#c2703d')), C(3, 3, 90, mat('#5a3d2a'), 0, 38, 0), S(mat('#2f9e44'), 0, 150, 0, 38, 34, 38, GEO.ico1), S(mat('#51cf66'), -24, 118, 8, 24, 22, 24, GEO.ico1), S(mat('#40c057'), 22, 124, -10, 26, 22, 26, GEO.ico1))), side * (ROAD + 42), 100 * side);
        if (r(q + 9) < 0.6) put(proto('cooler', () => grp(B(36, 70, 36, mat('#e9ecef')), C(14, 16, 44, mat('#74c0fc', { transparent: true, opacity: 0.75 }), 0, 70, 0))), side * (ROAD + 44), -150);
      } else if (zi === 3) {
        put(palmTree(230 + r(q) * 130), side * (ROAD + 60 + r(q + 1) * 60), r(q + 2) * 300 - 150, 1, r(q + 3) * 6);
        if (r(q + 4) < 0.7) { const col = ['#ff6b6b', '#22b8cf', '#fcc419', '#f06595'][(r(q + 5) * 4) | 0]; put(grp(B(170, 110, 130, mat('#fff4e0')), B(130, 40, 4, mat('#7a4a2a'), 0, 40, 0), mk(GEO.box, texMat(stripeTex(col, '#ffffff')), 0, 128, 0, 190, 36, 150, false), B(180, 8, 140, mat(col), 0, 106, 0)), side * (ROAD + 300), 60); const st = holder.children[holder.children.length - 1].children[1]; st.position.x = -side * 86; st.scale.set(4, 40, 100); }
        for (let i = 0; i < 4; i++) put(proto('rail', () => grp(C(5, 6, 44, mat('#7a4a2a')), B(8, 6, CH / 4, mat('#a8703c'), 0, 36, 0), B(6, 5, CH / 4, mat('#a8703c'), 0, 18, 0))), side * (ROAD + 12), (i - 1.5) * (CH / 4));
      } else if (zi === 4) {
        for (let i = 0; i < 2; i++) put(proto('pillar' + (i + (side > 0 ? 1 : 0)) % 2, () => grp(B(46, 900, 46, mat('#232d5e')), B(6, 900, 48, glow(i % 2 ? '#3df5a0' : '#ff5c7a', 1.2), 0, 0, 0), B(70, 26, 70, mat('#2f3b78')))), side * (ROAD + 90), (i - 0.5) * 260);
        const tb = board(tickTex[side > 0 ? 1 : 0], 230, 230, 0, 150, 0, true); put(tb, side * (ROAD + 300), 0, 1, -side * 0.6);
        put(B(10, 150, 10, mat('#1b2450')), side * (ROAD + 300), 0);
      } else if (zi === 5) {
        put(mk(GEO.plane, texMat(rockTex), side * 300, 215, 0, CH, 430, 1, false), 0, 0, 1, -side * PI / 2);
        put(B(20, 330, 20, mat('#6e4520')), side * (ROAD + 34), -CH / 2 + 10);
        if (r(q) < 0.75) put(shroomGlow(r(q + 1) < 0.5 ? '#78ffe6' : '#be8cff'), side * (ROAD + 70 + r(q + 2) * 70), r(q + 3) * 300 - 150, 0.8 + r(q + 4) * 0.7);
        if (r(q + 5) < 0.5) put(grp(mk(GEO.box, crateMat, 0, 28, 0, 56, 56, 56, false), mk(GEO.box, crateMat, 20, 78, 6, 44, 44, 44, false)), side * (ROAD + 80), r(q + 6) * 300 - 150, 1, r(q + 7));
        for (let i = 0; i < 2; i++) put(K(16 + r(q + 10 + i) * 14, 90 + r(q + 12 + i) * 80, mat('#5a3a1c')), side * (60 + r(q + 14 + i) * 200), r(q + 16 + i) * 480 - 240).rotation.set(PI, 0, 0), holder.children[holder.children.length - 1].position.y = 430 - 40;
      } else {
        for (let i = 0; i < 3; i++) { const s = 20 + r(q + i) * 50; put(S(mat(i % 2 ? '#9a9fb6' : '#7b8099', { flatShading: true }), 0, s * 0.5, 0, s, s * 0.8, s * 0.9, GEO.ico), side * (ROAD + 50 + r(q + i + 5) * 420), r(q + i + 9) * 480 - 240, 1, r(q + i) * 6); }
        if (r(q + 20) < 0.6) put(proto('crater', () => rot(mk(new THREE.TorusGeometry(1, 0.22, 8, 22), mat('#7d8299'), 0, 3, 0, 60, 60, 26, false), PI / 2)), side * (ROAD + 120 + r(q + 21) * 300), r(q + 22) * 400 - 200, 0.6 + r(q + 23) * 1.2);
        if (r(q + 24) < 0.1) put(proto('flag', () => grp(C(2, 2, 170, mat('#dee2e6')), board(signTex([['BIDNESS', '#3b2414', 50]], '#ffd43b', '#3b2414', 256, 128), 100, 56, 52, 112, 0))), side * (ROAD + 70), 0);
      }
    }
    // a welcome arch where each new zone begins
    { const zb = Math.round((idx * CH + CH / 2) / env.ZLEN) * env.ZLEN, lz = zb - idx * CH - CH / 2; if (zb > 0 && Math.abs(lz) <= CH / 2) { const nz = ((Math.floor((zb + 1) / env.ZLEN) % NZ) + NZ) % NZ, pm = mat('#3b2414'); const a = grp(B(16, 250, 16, pm, -(ROAD + 16), 0, 0), B(16, 250, 16, pm, ROAD + 16, 0, 0), board(signTex([[ZONES[nz].name.toUpperCase(), '#ffe45c', ZONES[nz].name.length > 12 ? 44 : 58]], '#3b2414', '#ffe45c', 512, 128, '#ffd43b'), ROAD * 2 + 60, 70, 0, 205, 0, true)); a.position.z = -lz; holder.add(a); } }
    // things that span the road
    if (zi === 2) { put(mk(GEO.plane, mat('#f4ead6'), 0, 420, 0, 1100, CH, 1, false), 0, 0).rotation.x = PI / 2; for (const z of [-130, 130]) put(B(300, 6, 60, glow('#fffbe6', 1.1), 0, 410, 0), 0, z); }
    if (zi === 3 && idx % 2 === 0) { const cols = ['#fff3b0', '#ffa8a8', '#99e9f2']; for (let k = 0; k < 9; k++) { const u = k / 8; put(S(glow(cols[k % 3], 1.4), 0, 0, 0, 4.5, 4.5, 4.5, GEO.lo), (u - 0.5) * (ROAD * 2 + 60), 0).position.y = 290 - Math.sin(u * PI) * 40; } for (const s of [-1, 1]) put(C(3, 4, 290, mat('#6a4a6f')), s * (ROAD + 30), 0); }
    if (zi === 4 && idx % 2 === 0) { put(B(ROAD * 2 + 230, 10, 10, glow('#3df5a0', 1.2), 0, 330, 0), 0, 0); }
    if (zi === 5) { put(mk(GEO.plane, texMat(rockTex), 0, 430, 0, 620, CH, 1, false), 0, 0).rotation.x = PI / 2; put(B(ROAD * 2 + 110, 24, 24, mat('#8a5a30'), 0, 320, 0), 0, -CH / 2 + 10); put(grp(B(3, 30, 3, mat('#3b2414'), 0, 290, 0), B(18, 26, 18, glow('#ffd43b', 1.6), 0, 264, 0), mk(GEO.plane, haloMat('#ffcf66', 0.8), 0, 276, 10, 260, 260, 1, false)), (idx % 2 ? 60 : -60), -CH / 2 + 10); }
  }
  // ferris wheel that hangs on the horizon of the boardwalk
  const wheel = (() => { const m = new THREE.MeshBasicMaterial({ color: '#5d3b7c', fog: false }), g = grp(mk(new THREE.TorusGeometry(1, 0.02, 6, 48), m, 0, 0, 0, 330, 330, 330, false)); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const sp = mk(GEO.box, m, Math.cos(a) * 165, Math.sin(a) * 165, 0, 330, 5, 5, false); sp.rotation.z = a; g.add(sp); g.add(mk(GEO.box, new THREE.MeshBasicMaterial({ color: ['#ff8787', '#ffd43b', '#63e6be', '#74c0fc'][i % 4], fog: false }), Math.cos(a) * 330, Math.sin(a) * 330, 0, 44, 36, 20, false)); } const holder = grp(g, mk(GEO.box, m, -90, -190, 0, 14, 400, 14, false), mk(GEO.box, m, 90, -190, 0, 14, 400, 14, false)); holder.children[1].rotation.z = -0.42; holder.children[2].rotation.z = 0.42; holder.userData.spin = g; scene.add(holder); return holder; })();

  // ------------------------------------------------------------ ground chunks
  const chunks = [];
  for (let i = 0; i < NCH; i++) { const g = new THREE.Group(), road = new THREE.Mesh(roadGeo, roadMat[0]), l = new THREE.Mesh(sideGeo, sideMat[0]), rr = new THREE.Mesh(sideGeo, sideMat[0]), props = new THREE.Group(); road.receiveShadow = true; l.position.set(-ROAD - 1200, -1.5, 0); rr.position.set(ROAD + 1200, -1.5, 0); g.add(road, l, rr, props); scene.add(g); chunks.push({ g, road, l, rr, props, idx: null }); }

  // ------------------------------------------------------------ Sluggy
  const slug = (() => {
    const Y = phong('#ffd83d', 90, { emissive: '#8a6200', emissiveIntensity: 0.45 }), D = phong('#f0bb14', 70, { emissive: '#7a5200', emissiveIntensity: 0.4 }), Wt = phong('#ffffff', 140), Kk = mat('#2a1a0c'), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const prof = [[0, 84], [5, 79], [11, 68], [18, 50], [25, 26], [29, 2], [29, -20], [25, -40], [17, -54], [8, -61], [0, -63]].map(([r, z]) => new THREE.Vector2(r, z));
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 22).rotateX(-PI / 2), Y); hull.scale.set(1.05, 0.74, 1); hull.position.set(0, 21.5, 0); hull.castShadow = true;
    body.add(hull, S(Y, 0, 31, -36, 24, 24, 26), S(D, 0, 33, 0, 22, 9.5, 30));
    for (const [x, y, z, s] of [[-20, 30, 26, 4.5], [18, 34, 36, 4], [-8, 27, 52, 3.5], [22, 36, 8, 3.2], [-23, 36, 0, 3], [6, 18, 70, 2.6]]) body.add(S(D, x, y, z, s, s * 0.6, s));
    body.add(S(mat('#ff9aa0'), -15, 27, -55, 5, 3.4, 2.4), S(mat('#ff9aa0'), 15, 27, -55, 5, 3.4, 2.4));
    const smile = mk(new THREE.TorusGeometry(8, 1.7, 6, 14, PI), Kk, 0, 27, -60.5, 1, 1, 1, false); smile.rotation.z = PI; body.add(smile);
    const stalks = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 12, 46, -38); p.rotation.set(-0.18, 0, -s * 0.24); p.add(C(3, 3.8, 38, Y), S(Wt, 0, 44, 0, 10), S(Kk, 0, 45, -7.6, 4.8), S(Wt, 1.5, 47.5, -11, 1.6)); body.add(p); return p; });
    const tie = new THREE.Group(); tie.position.set(15, 40, -20); tie.add(B(10, 2.5, 34, mat('#e03131', { emissive: '#5a0c0c' }), 0, 0, 17), B(12, 4, 9, mat('#c92a2a'), 0, -1, 0)); body.add(tie);
    const hat = new THREE.Group(); hat.position.set(0, 53, -36); hat.rotation.x = -0.12; body.add(hat);
    const shield = mk(GEO.sph, new THREE.MeshPhongMaterial({ color: '#69db7c', transparent: true, opacity: 0.16, shininess: 140, specular: '#ffffff', depthWrite: false }), 0, 34, 10, 62, 58, 84, false); root.add(shield);
    const magnet = mk(GEO.plane, new THREE.MeshBasicMaterial({ map: iconTex('magnet'), transparent: true, depthWrite: false }), 0, 124, -30, 44, 44, 1, false); root.add(magnet);
    scene.add(root); return { root, body, stalks, tie, hat, shield, magnet, hatId: null, prop: null };
  })();
  function iconTex(kind) { return tex(128, 128, (g) => { g.translate(64, 64); g.scale(1.42, 1.42); drawPower(g, kind, 0.26); }); }
  function setHat(id) {
    if (slug.hatId === id) return; slug.hatId = id; slug.hat.clear(); slug.prop = null; const h = slug.hat;
    if (id === 'hard') h.add(mk(GEO.dome, phong('#ffd43b', 60), 0, 0, 0, 20, 17, 20), C(25, 25, 3, phong('#ffd43b', 60), 0, -1, -3), B(5, 15, 30, mat('#f59f00'), 0, 2, 0));
    else if (id === 'party') h.add(K(15, 38, phong('#f06595', 40)), S(glow('#74c0fc', 0.5), 0, 40, 0, 6), C(15.4, 15.4, 4, mat('#ffd43b'), 0, 8, 0));
    else if (id === 'cowboy') h.add(C(34, 34, 3, mat('#a8683a')), C(15, 18, 22, mat('#a8683a'), 0, 2, 0), C(18.4, 18.4, 5, mat('#5c3d1e'), 0, 3, 0));
    else if (id === 'top') h.add(C(25, 25, 3, phong('#2a2a33', 50)), C(16, 16, 34, phong('#2a2a33', 50), 0, 2, 0), C(16.5, 16.5, 7, mat('#e03131'), 0, 4, 0));
    else if (id === 'prop') { const p = grp(B(40, 2, 7, phong('#ffd43b', 60)), B(7, 2, 40, phong('#ffd43b', 60))); p.position.y = 27; slug.prop = p; h.add(mk(GEO.dome, phong('#339af0', 50), 0, 0, 0, 18, 16, 18), C(1.6, 1.6, 10, mat('#3b2414'), 0, 16, 0), p, B(8, 14, 37, mat('#ff6b6b'), 0, 0, 0)); }
    else if (id === 'crown') { h.add(C(18, 17, 12, phong('#ffd43b', 120))); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; h.add(K(5, 14, phong('#ffd43b', 120), Math.cos(a) * 15, 11, Math.sin(a) * 15), S(glow(i % 2 ? '#e03131' : '#339af0', 0.6), Math.cos(a) * 17.5, 6, Math.sin(a) * 17.5, 2.6)); } }
    h.traverse((c) => { c.castShadow = true; });
  }
  // slime trail ribbon
  const TRN = 40, trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRN * 6), 3));
  { const ix = []; for (let i = 0; i < TRN - 1; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); trailGeo.setIndex(ix); }
  const trail = new THREE.Mesh(trailGeo, bendy(new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))); trail.frustumCulled = false; scene.add(trail);

  // ------------------------------------------------------------ coins (instanced) + entity models
  const coinFace = tex(128, 128, (g) => { g.fillStyle = '#ffcf33'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#e8a100'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.stroke(); g.fillStyle = '#c98500'; g.font = '900 78px ui-rounded, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 64, 68); });
  const coinGeo = new THREE.CylinderGeometry(14, 14, 4, 22).rotateX(PI / 2);
  const coinSide = bendy(new THREE.MeshPhongMaterial({ color: '#f5b800', shininess: 120, specular: '#fff6b8', emissive: '#7a5200', emissiveIntensity: 0.5 })), coinCap = bendy(new THREE.MeshPhongMaterial({ map: coinFace, shininess: 120, specular: '#fff6b8', emissive: '#7a5200', emissiveIntensity: 0.45 }));
  const coins = new THREE.InstancedMesh(coinGeo, [coinSide, coinCap, coinCap], 260); coins.frustumCulled = false; coins.castShadow = true; scene.add(coins);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1), yAxis = new THREE.Vector3(0, 1, 0);

  function worm(zi) {
    const P1 = phong('#ff8fab', 50), P2 = phong('#ffd3df', 50), Wt = phong('#ffffff', 120), Kk = mat('#2a1a0c'), g = grp();
    for (let i = 4; i >= 1; i--) g.add(S(i % 2 ? P2 : P1, 0, 15 - i * 0.6, -i * 17, 16 - i * 1.6));
    const head = grp(S(P1, 0, 0, 0, 18), S(Wt, -7.5, 4, 14.5, 6), S(Wt, 7.5, 4, 14.5, 6), S(Kk, -7, 3.6, 19.4, 2.7), S(Kk, 7, 3.6, 19.4, 2.7));
    const b1 = B(11, 2.8, 2.8, Kk, -8, 9.5, 17); b1.rotation.z = -0.45; const b2 = B(11, 2.8, 2.8, Kk, 8, 9.5, 17); b2.rotation.z = 0.45; const mouth = mk(new THREE.TorusGeometry(5, 1.3, 5, 10, PI), Kk, 0, -9.5, 15.5, 1, 1, 1, false); head.add(b1, b2, mouth);
    if (zi === 4 || zi === 5) head.add(C(20, 20, 2.5, phong('#2a2a33', 40), 0, 13, 0), C(12, 12, 20, phong('#2a2a33', 40), 0, 14, 0), C(12.4, 12.4, 5, mat('#e03131'), 0, 15, 0));
    else if (zi === 6) head.add(mk(GEO.sph, new THREE.MeshPhongMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.3, shininess: 140, depthWrite: false }), 0, 0, 0, 25, 25, 25, false));
    else head.add(mk(GEO.dome, phong('#ffd43b', 60), 0, 8, 0, 16, 13, 16), C(20, 20, 2.5, phong('#ffd43b', 60), 0, 7, 3));
    head.position.set(0, 20, 0); g.add(head); g.scale.setScalar(1.3); g.userData.anim = 'worm'; return g;
  }
  const striped = texMat(stripeTex('#ff922b', '#ffffff')), chevron = signTex([['DETOUR', '#1a1a1a', 52]], '#ffd43b', '#1a1a1a', 256, 128, '#1a1a1a');
  // obstacle builders: [low A, low B, wall, high] per zone
  const OB = [
    [() => { const log = rot(C(22, 22, 72, [texMat(barkTex), mat('#e8c48a'), mat('#e8c48a')], 0, 0, 0), 0, 0, PI / 2); log.position.set(0, 22, 0); return grp(log, S(mat('#5fb347'), 6, 42, 0, 20, 5, 14)); },
     () => grp(C(9, 12, 26, mat('#f8f0dc')), mk(GEO.dome, phong('#f03e3e', 40), 0, 22, 0, 31, 24, 31), S(mat('#fff'), -13, 38, 13, 5.5, 3, 5.5), S(mat('#fff'), 12, 40, 6, 4.5, 3, 4.5), S(mat('#fff'), 0, 44, -10, 5, 3, 5), S(mat('#fff'), 20, 30, 18, 3.6)),
     () => grp(C(29, 37, 172, [texMat(barkTex), mat('#e8c48a'), mat('#e8c48a')]), S(mat('#ffa94d'), 30, 70, 10, 16, 4, 12), S(mat('#ffa94d'), -30, 110, 6, 15, 4, 11), S(mat('#ffa94d'), 22, 136, 22, 13, 4, 10), S(mat('#5fb347'), 0, 3, 0, 44, 5, 44)),
     () => { const log = rot(C(23, 23, 112, [texMat(barkTex), mat('#e8c48a'), mat('#e8c48a')]), 0, 0, PI / 2); log.position.set(0, 76, 0); const g = grp(log, C(7, 9, 62, mat('#7a4c2a'), -44, 0, 0), C(7, 9, 62, mat('#7a4c2a'), 44, 0, 0), S(mat('#5fb347'), 4, 97, 0, 34, 5, 16)); for (const x of [-22, -4, 16, 30]) g.add(B(5, 12 + (x & 7), 3, mat('#4f9a3a'), x, 42, 16)); return g; }],
    [() => grp(mk(GEO.box, striped, 0, 34, 0, 74, 14, 6, true), mk(GEO.box, striped, 0, 14, 0, 74, 10, 6, true), B(6, 44, 26, mat('#495057'), -30, 0, 0), B(6, 44, 26, mat('#495057'), 30, 0, 0), S(glow('#ffb300', 1.3), -30, 49, 0, 5), S(glow('#ffb300', 1.3), 30, 49, 0, 5)),
     () => { const g = grp(); for (const x of [-19, 19]) g.add(B(30, 4, 30, mat('#e8590c'), x, 0, 0), K(12, 44, phong('#ff922b', 30), x, 3, 0), C(7.5, 9.6, 8, mat('#fff'), x, 16, 0)); return g; },
     () => grp(B(60, 170, 60, phong('#e03131', 40)), B(46, 86, 62, mat('#a5d8ff'), 0, 52, 0), B(62, 86, 46, mat('#a5d8ff'), 0, 52, 0), board(signTex([['PHONE', '#e03131', 62]], '#ffffff', '#e03131', 256, 80), 52, 16, 0, 146, 31), B(66, 6, 66, mat('#c92a2a'), 0, 170, 0)),
     () => grp(...posts(mat('#3d4354')), board(chevron, 96, 46, 0, 54, 0), S(glow('#ffb300', 1.4), -40, 108, 0, 6), S(glow('#ffb300', 1.4), 40, 108, 0, 6))],
    [() => grp(B(60, 34, 44, mat('#e9ecef')), B(44, 8, 34, mat('#ced4da'), 0, 34, 0), B(30, 2, 26, mat('#fff'), 0, 42, 8), S(glow('#51cf66', 1.2), 22, 26, 22.5, 3), B(36, 5, 2, mat('#495057'), -6, 14, 22)),
     () => grp(mk(GEO.box, mat('#c98d4f'), 0, 12, 0, 60, 24, 44), mk(GEO.box, mat('#b97a3a'), 5, 34, -3, 50, 20, 38), B(34, 3, 26, mat('#fff'), 5, 44, -3), board(signTex([['TPS', '#3b2414', 70]], '#f6e3c0', '#3b2414', 128, 64), 36, 16, 0, 5, 23)),
     () => { const g = grp(B(58, 150, 48, mat('#a5b1c8'))); for (let i = 0; i < 4; i++) g.add(B(50, 31, 2, mat('#c8d1e2'), 0, 5 + i * 36, 24.5), B(18, 4, 3, mat('#5c677d'), 0, 19 + i * 36, 26)); g.add(C(13, 10, 18, mat('#c2703d'), 0, 150, 0), S(mat('#40c057'), 0, 180, 0, 16, 14, 16, GEO.ico1), S(mat('#2f9e44'), -10, 172, 6, 11, 10, 11, GEO.ico1)); return g; },
     () => grp(...posts(mat('#adb5bd')), board(signTex([['MEETING', '#fff', 46], ['→ → →', '#d3f9d8', 40]], '#2f9e44', '#fff', 256, 128), 96, 46, 0, 54, 0))],
    [() => grp(C(27, 31, 20, mat('#f2cf8d')), C(8, 9, 24, mat('#f7dba3'), -17, 18, 0), C(8, 9, 24, mat('#f7dba3'), 17, 18, 0), C(10, 11, 32, mat('#f7dba3'), 0, 18, 0), K(9.5, 10, mat('#e8b86a'), -17, 42, 0), K(9.5, 10, mat('#e8b86a'), 17, 42, 0), C(0.9, 0.9, 16, mat('#3b2414'), 0, 50, 0), B(10, 7, 1, mat('#f03e3e'), 5, 58, 0)),
     () => { const t = tex(256, 128, (g) => { const c = ['#ff6b6b', '#ffffff', '#339af0', '#ffffff', '#fcc419', '#ffffff']; for (let i = 0; i < 6; i++) { g.fillStyle = c[i]; g.fillRect(i * 43, 0, 43, 128); } }); const b = mk(GEO.sph, bendy(new THREE.MeshPhongMaterial({ map: t, shininess: 60 })), 0, 27, 0, 27, 27, 27); b.rotation.z = 0.5; return grp(b); },
     () => { const g = grp(B(70, 10, 40, mat('#7a4a2a')), B(70, 6, 6, mat('#7a4a2a'), 0, 70, -16)); [['#22b8cf', -22, -0.07], ['#ff6b6b', 0, 0.03], ['#fcc419', 22, 0.09]].forEach(([c, x, a]) => { const s = S(phong(c, 70), x, 92, -6, 15, 86, 4.5); s.rotation.set(0.14, 0, a); g.add(s); const st = S(mat('#ffffff'), x, 92, -3.2, 2, 70, 1.6); st.rotation.set(0.14, 0, a); g.add(st); }); return g; },
     () => grp(...posts(mat('#7a4a2a')), board(signTex([['SURF', '#1c7ed6', 50], ['SHOP', '#e8590c', 50]], '#f7dba3', '#1c7ed6', 256, 128, '#d9a066'), 98, 48, 0, 53, 0))],
    [() => grp(B(60, 38, 16, mat('#9c5b2a')), B(62, 6, 17, mat('#6f3d17'), 0, 22, 0), B(12, 10, 18, phong('#ffd43b', 100), 0, 20, 0), rot(mk(new THREE.TorusGeometry(9, 2, 6, 12, PI), mat('#5c3d1e'), 0, 38, 0, 1, 1, 1), 0, 0, 0)),
     () => grp(B(36, 4, 22, mat('#343a55')), B(8, 12, 8, mat('#343a55'), 0, 4, 0), B(62, 42, 6, mat('#1b2140'), 0, 14, 0), board(tex(128, 80, (g) => { g.fillStyle = '#0c1230'; g.fillRect(0, 0, 128, 80); g.strokeStyle = '#ff5c7a'; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); g.moveTo(8, 14); g.lineTo(38, 30); g.lineTo(58, 22); g.lineTo(86, 54); g.lineTo(120, 66); g.stroke(); }), 58, 38, 0, 16, 3, true)),
     () => { const t = tex(64, 256, (g) => { g.fillStyle = '#0c1230'; g.fillRect(0, 0, 64, 256); for (let i = 0; i < 9; i++) { g.fillStyle = '#1a2250'; g.fillRect(6, 8 + i * 27, 52, 20); for (let k = 0; k < 4; k++) { g.fillStyle = hash(i * 4 + k) < 0.7 ? '#3df5a0' : '#ff5c7a'; g.beginPath(); g.arc(16 + k * 11, 18 + i * 27, 3.2, 0, TAU); g.fill(); } } }); return grp(B(58, 172, 50, mat('#232a4d')), mk(GEO.plane, bendy(new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1 })), 0, 86, 25.6, 50, 164, 1, false)); },
     () => grp(...posts(mat('#232a4d')), board(signTex([['SELL!', '#ff5c7a', 66], ['▼ ▼ ▼', '#ff5c7a', 34]], '#0c1230', '#ff5c7a', 256, 128, '#ff5c7a'), 98, 48, 0, 53, 0, true), B(4, 104, 4, glow('#3df5a0', 1.2), -40, 0, 5), B(4, 104, 4, glow('#3df5a0', 1.2), 40, 0, 5))],
    [() => grp(C(21, 21, 46, mat('#a8683a')), C(24, 24, 4, mat('#5c677d'), 0, 8, 0), C(24, 24, 4, mat('#5c677d'), 0, 34, 0), C(19, 19, 2, mat('#8a5a2a'), 0, 46, 0), board(signTex([['W', '#ffd3df', 90]], '#a8683a', '#ffd3df', 128, 128), 20, 20, 0, 13, 21)),
     () => grp(S(mat('#8a7a6a', { flatShading: true }), 0, 20, 0, 31, 24, 26, GEO.ico), S(mat('#74675a', { flatShading: true }), 20, 10, 12, 14, 11, 12, GEO.ico)),
     () => { const g = grp(); [[0, 0, 0.05], [3, 56, -0.08], [-2, 112, 0.1]].forEach(([x, y, a]) => { const c = mk(GEO.box, crateMat, x, y + 28, 0, 56, 56, 56); c.rotation.y = a; g.add(c); }); return g; },
     () => { const p = rot(C(19, 19, 112, phong('#5f8a6a', 50)), 0, 0, PI / 2); p.position.set(0, 76, 0); const g = grp(p, B(10, 60, 14, mat('#5c677d'), -46, 0, 0), B(10, 60, 14, mat('#5c677d'), 46, 0, 0)); for (const x of [-30, 30]) { const f = rot(C(23, 23, 6, mat('#3f6a4c')), 0, 0, PI / 2); f.position.set(x, 76, 0); g.add(f); } g.add(S(mat('#74c0fc', { transparent: true, opacity: 0.8 }), 8, 50, 0, 3, 5, 3)); return g; }],
    [() => grp(S(mat('#aab0c6', { flatShading: true }), 0, 21, 0, 31, 25, 27, GEO.ico), S(mat('#868ca6'), -8, 36, 16, 6, 3, 6)),
     () => { const gd = phong('#ffd43b', 140), g = grp(); for (const [x, y] of [[-17, 0], [17, 0], [0, 17]]) g.add(B(30, 16, 46, gd, x, y, 0)); return g; },
     () => grp(C(20, 20, 112, phong('#f1f3f5', 70), 0, 14, 0), K(20, 44, phong('#e03131', 60), 0, 126, 0), C(12, 16, 14, mat('#495057')), S(phong('#74c0fc', 120), 0, 96, 19, 9, 9, 3), B(5, 46, 26, phong('#e03131', 60), -24, 0, 0), B(5, 46, 26, phong('#e03131', 60), 24, 0, 0), B(26, 46, 5, phong('#e03131', 60), 0, 0, -24), board(signTex([['$', '#2f9e44', 110]], '#f1f3f5', '#2f9e44', 128, 128), 18, 18, 0, 50, 19.5)),
     () => { const sp = phong('#1c7ed6', 100), g = grp(B(44, 46, 34, phong('#dee2e6', 60), 0, 53, 0), B(40, 30, 3, sp, -44, 61, 0), B(40, 30, 3, sp, 44, 61, 0), C(1.5, 1.5, 18, mat('#3b2414'), 0, 99, 0), S(glow('#ff6b6b', 1.5), 0, 119, 0, 5), B(20, 20, 2, phong('#ffd43b', 100), 0, 66, 17.5)); g.userData.anim = 'bob'; return g; }],
  ];
  const saltModel = () => grp(mk(GEO.cone, phong('#ffffff', 30), -6, 9, 0, 34, 18, 26), mk(GEO.cone, phong('#f1f5fb', 30), 16, 6, 6, 22, 12, 18), C(36, 38, 2, mat('#ffffff'), 0, 0, 0), rot(C(8, 8, 22, phong('#e7f5ff', 90), 0, 0, 0), 0, 0, 1.2), S(glow('#a5d8ff', 1), -10, 30, 4, 2.4), S(glow('#a5d8ff', 1), 14, 22, -6, 2));
  function power(kind) { const c = POWERS[kind].col, g = grp(mk(GEO.sph, new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: 0.32, shininess: 140, specular: '#ffffff', depthWrite: false }), 0, 0, 0, 25, 25, 25, false), mk(GEO.plane, new THREE.MeshBasicMaterial({ map: iconTex(kind), transparent: true, depthWrite: false }), 0, 0, 0, 44, 44, 1, false), mk(new THREE.TorusGeometry(30, 2.2, 6, 28), glow(c, 1.2), 0, 0, 0, 1, 1, 1, false), mk(GEO.plane, haloMat(c, 0.9), 0, 0, -4, 130, 130, 1, false)); g.userData.anim = 'pow'; return g; }
  const entProto = new Map();
  function entMesh(e) {
    const key = e.k === 'pow' ? 'pow' + e.kind : e.k === 'worm' ? 'worm' + e.zi : e.k === 'salt' ? 'salt' : e.k + e.zi + (e.k === 'low' ? e.v % 2 : '');
    let p = entProto.get(key);
    if (!p) { p = e.k === 'pow' ? power(e.kind) : e.k === 'worm' ? worm(e.zi) : e.k === 'salt' ? saltModel() : OB[e.zi][e.k === 'low' ? e.v % 2 : e.k === 'wall' ? 2 : 3](); if (e.k === 'salt' && p.children[3]) p.children[3].position.set(30, 8, 8); entProto.set(key, p); }
    const m = p.clone(); m.userData.anim = p.userData.anim; return m;
  }
  const live = new Map();

  // ------------------------------------------------------------ frame
  const lk = { fog: new THREE.Color(), sun: new THREE.Color(), h1: new THREE.Color(), h2: new THREE.Color() }, tmpC = new THREE.Color(), dirV = new THREE.Vector3(), look = new THREE.Vector3(), camPos = new THREE.Vector3();
  let fov = 70, lastT = 0;
  function resize(w, h, dpr) { if (w === W && h === H) return; W = w; H = h; renderer.setPixelRatio(Math.min(dpr, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function render(R, ZP, hatId) {
    const t = R.t, p = R.p, zi = R.zi % NZ, pz = R.prevZ >= 0 ? R.prevZ : zi, f = R.fade, A = LOOK[pz], Bk = LOOK[zi], dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    // atmosphere
    lk.fog.set(A.fog).lerp(tmpC.set(Bk.fog), f); scene.fog.color.copy(lk.fog); scene.fog.near = lerp(A.fogN, Bk.fogN, f); scene.fog.far = lerp(A.fogF, Bk.fogF, f);
    sun.color.set(A.sun).lerp(tmpC.set(Bk.sun), f); sun.intensity = lerp(A.sunI, Bk.sunI, f); hemi.color.set(A.hemi[0]).lerp(tmpC.set(Bk.hemi[0]), f); hemi.groundColor.set(A.hemi[1]).lerp(tmpC.set(Bk.hemi[1]), f); hemi.intensity = lerp(A.hemiI, Bk.hemiI, f);
    dirV.set(lerp(A.dir[0], Bk.dir[0], f), lerp(A.dir[1], Bk.dir[1], f), lerp(A.dir[2], Bk.dir[2], f)).normalize(); sun.position.set(dirV.x * 900, dirV.y * 900, dirV.z * 900 - 260); sun.target.position.set(0, 0, -260);
    paintSky(pz, zi, f); uBend.value.set(R.bend * 0.00011, -0.000028);
    rings[0].material.map = ringMap(zi); rings[0].material.opacity = f; rings[1].material.map = ringMap(pz); rings[1].material.opacity = 1 - f; rings[1].visible = f < 1;
    const bx = -R.bend * 1500; for (const r of rings) { r.position.set(camera.position.x + bx, 560, camera.position.z); r.rotation.y = PI + R.z * 0.000002; }
    const w6 = zi === 6 ? f : pz === 6 ? 1 - f : 0, w3 = zi === 3 ? f : pz === 3 ? 1 - f : 0;
    stars.visible = w6 > 0; stars.material.opacity = w6; stars.position.copy(camera.position); earth.visible = w6 > 0; earth.position.set(1500 + bx, 2100 - (1 - w6) * 1600, -5200); earth.rotation.y = t * 0.03;
    sunDisc.visible = w3 > 0; sunDisc.position.set(-300 + bx * 1.2, 330 - (1 - w3) * 900, -6000); wheel.visible = w3 > 0.5; wheel.position.set(-1500 + bx, 380, -3600); wheel.userData.spin.rotation.z = t * 0.25;
    sideTex[3].offset.x = t * 0.02;
    // ground chunks + scenery
    const base = Math.floor((R.z - 420) / CH);
    for (let k = 0; k < NCH; k++) { const idx = base + k, c = chunks[((idx % NCH) + NCH) % NCH], wz = idx * CH + CH / 2; if (c.idx !== idx) { c.idx = idx; const z = ((Math.floor(wz / env.ZLEN) % NZ) + NZ) % NZ; c.road.material = roadMat[z]; c.l.material = c.rr.material = sideMat[z]; populate(c.props, idx, z); } c.g.position.z = -(wz - R.z); }
    // Sluggy
    setHat(hatId); const dead = R.state === 'dead', sliding = !dead && p.on && p.slide > 0, s = slug;
    s.root.position.set(p.x, p.y, 0); s.root.rotation.set(dead ? -p.rot : 0, -p.lean * 0.55, -p.lean * 0.5);
    const wob = Math.sin(t * 16) * 0.035; let sy = 1 + wob, sxz = 1 - wob * 0.5, sz = 1;
    if (sliding) { sy = 0.5; sxz = 1.22; sz = 1.15; } else if (!p.on && !dead) { const k = clamp(p.vy / 2200, -0.2, 0.25); sy = 1 + Math.abs(k) * 0.7; sxz = 1 - Math.abs(k) * 0.35; } else { sy += p.sq * 0.16; sxz -= p.sq * 0.1; }
    s.body.scale.set(sxz, sy, sz * (1 + Math.sin(t * 16 + 1.5) * 0.03));
    s.stalks.forEach((st, i) => { const sg = i ? 1 : -1; st.rotation.set(-0.18 + Math.sin(t * 9 + i) * 0.1 - clamp(p.vy / 2500, -0.3, 0.3) + (R.pw.rush > 0 ? 0.5 : 0), 0, -sg * 0.24 + Math.sin(t * 7 + i * 2) * 0.07 - p.lean * 0.5); });
    s.tie.rotation.set(0.35 + Math.sin(t * 13) * 0.3, 0.5 + Math.sin(t * 9) * 0.35, 0); if (s.prop) s.prop.rotation.y = t * 26;
    s.shield.visible = R.pw.shield; s.shield.scale.set(62 + Math.sin(t * 6) * 2, 58, 84); s.magnet.visible = R.pw.magnet > 0; s.magnet.position.y = 124 + Math.sin(t * 5) * 5; s.root.visible = !(R.inv > 0 && R.pw.rush <= 0 && Math.sin(t * 40) > 0);
    s.root.traverse((c) => { if (c.isMesh && c !== s.shield && c !== s.magnet) c.castShadow = true; });
    // slime trail
    { const pos = trailGeo.attributes.position, n = R.trail.length; let last = null; for (let i = 0; i < TRN; i++) { const q = R.trail[n - TRN + i] || null, a = q || last; const x = a ? a.x : p.x, z = a ? -(a.z - R.z) + 62 : 62, w = q ? 8 : 0; pos.setXYZ(i * 2, x - w, 0.8, z); pos.setXYZ(i * 2 + 1, x + w, 0.8, z); if (q) last = q; } pos.needsUpdate = true; trail.visible = !dead; }
    // entities
    let nc = 0; const seen = new Set();
    for (const e of R.ents) {
      if (e.dead) continue; const dz = e.z - R.z; if (dz > 2750 || dz < -330) continue;
      if (e.k === 'coin') { if (nc < 260) { q4.setFromAxisAngle(yAxis, t * 4 + e.z * 0.01); m4.compose(v3.set(e.x, e.y + 16, -dz), q4, s3); coins.setMatrixAt(nc++, m4); } continue; }
      let m = live.get(e); if (!m) { m = entMesh(e); live.set(e, m); scene.add(m); }
      seen.add(e); m.position.set(e.x, e.k === 'pow' ? e.y + 22 + Math.sin(t * 4 + e.z) * 5 : e.y, -dz);
      const an = m.userData.anim;
      if (an === 'worm') { const c = m.children; for (let i = 0; i < 4; i++) { c[i].position.x = Math.sin(t * 9 + i * 0.9 + e.z) * (4 - i) * 2.2; c[i].position.y = 15 - (4 - i) * 0.6 + Math.abs(Math.sin(t * 9 + i * 0.9 + e.z)) * 4; } c[4].position.y = 20 + Math.abs(Math.sin(t * 9 + e.z)) * 5; c[4].rotation.z = Math.sin(t * 9 + e.z) * 0.12; }
      else if (an === 'pow') { m.children[2].rotation.set(t * 2, t * 3, 0); m.children[1].scale.setScalar(44 * (1 + Math.sin(t * 6) * 0.07)); }
      else if (an === 'bob') m.position.y = Math.sin(t * 2 + e.z) * 5;
    }
    coins.count = nc; coins.instanceMatrix.needsUpdate = true;
    for (const [e, m] of live) if (!seen.has(e)) { scene.remove(m); live.delete(e); }
    // camera: sweeps round from Sluggy's face at the start, then chases
    const portrait = W < H, dist = portrait ? 335 : 265, hgt = portrait ? 196 : 128, intro = clamp(1 - t / 1.7, 0, 1), ang = intro * intro * (3 - 2 * intro) * 2.75;
    const shake = R.shake > 0 ? R.shake * 22 : 0, cx = R.camX * 1.0;
    camPos.set(cx + Math.sin(ang) * dist * (1 - intro * 0.35), hgt * (1 - intro * 0.55) + (dead ? R.deadT * 40 : 0), Math.cos(ang) * dist * (1 - intro * 0.35) + (dead ? R.deadT * 60 : 0));
    camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake, camPos.z);
    look.set(lerp(cx * 0.9, p.x, intro), lerp(portrait ? 84 : 62, 40, intro), lerp(-250, -10, intro)); camera.lookAt(look); camera.rotation.z += -p.lean * 0.05 + R.bend * 0.05;
    const baseFov = clamp((2 * Math.atan(0.46 / camera.aspect) * 180) / PI, 46, 82), want = baseFov + (R.pw.rush > 0 ? 13 : 0) + clamp((R.speed - 540) / 520, 0, 1) * 5;
    fov = lerp(fov, want, Math.min(1, dt * 5 + (intro > 0 ? 1 : 0))); if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  // world -> CSS pixels (ignores the gentle world curve; used for 2D overlay effects near the player)
  function project(x, y, dz, ZP) { v3.set(x, y, -(dz - ZP)).project(camera); return [(v3.x + 1) * 0.5 * W, (1 - v3.y) * 0.5 * H, 1]; }
  function reset() { for (const [, m] of live) scene.remove(m); live.clear(); lastT = 0; skyKey = ''; }
  return { render, resize, project, reset, show(on) { canvas.style.display = on ? 'block' : 'none'; }, info: () => renderer.info.render };
}
