// Sluggy Run — synthesized audio (no asset files).
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, musicOn = false, timer = null, nextNote = 0, stepN = 0, bpm = 148, hot = false;

export function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0.2; musicBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (musicOn) startMusic();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export function suspendAudio(s) { if (ac) (s ? ac.suspend() : ac.resume()).catch(() => {}); }

function tone(freq, dur, o = {}) {
  if (!ac) return;
  const t = (o.at ?? ac.currentTime) + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(o.bus || sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ac) return;
  const t = (o.at ?? ac.currentTime) + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1; f.frequency.setValueAtTime(o.from || 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(o.bus || sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

let coinN = 0, coinT = 0;
export const sfx = {
  click() { tone(700, 0.06, { type: 'triangle', vol: 0.2 }); tone(1050, 0.08, { type: 'triangle', vol: 0.13, delay: 0.035 }); },
  jump() { tone(300, 0.16, { to: 720, type: 'square', vol: 0.11 }); noise(0.08, { from: 900, to: 2500, q: 0.8, vol: 0.1 }); },
  jump2() { tone(520, 0.16, { to: 1250, type: 'square', vol: 0.1 }); tone(780, 0.14, { to: 1560, type: 'triangle', vol: 0.1, delay: 0.03 }); },
  land() { noise(0.07, { from: 500, to: 180, q: 0.8, vol: 0.14 }); },
  slide() { noise(0.22, { from: 2600, to: 700, q: 1.2, vol: 0.12 }); },
  coin() { // pitch climbs while you keep a streak going
    const now = performance.now(); coinN = now - coinT < 450 ? Math.min(coinN + 1, 10) : 0; coinT = now;
    const f = hz(84 + PENTA[coinN]); tone(f, 0.06, { type: 'square', vol: 0.07 }); tone(f * 1.5, 0.15, { type: 'triangle', vol: 0.12, delay: 0.03 });
  },
  stomp(n = 1) { tone(180, 0.12, { to: 70, type: 'square', vol: 0.26 }); noise(0.08, { from: 1400, q: 0.7, vol: 0.24 }); tone(hz(72 + PENTA[Math.min(n, 9)]), 0.2, { type: 'triangle', vol: 0.2, delay: 0.04 }); },
  smash() { noise(0.16, { from: 2400, to: 300, q: 0.6, vol: 0.3 }); tone(140, 0.14, { to: 60, type: 'square', vol: 0.2 }); },
  power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.13, { type: 'triangle', vol: 0.2, delay: i * 0.045 })); },
  shieldPop() { tone(900, 0.25, { to: 200, type: 'sine', vol: 0.25 }); noise(0.12, { from: 3000, q: 0.6, vol: 0.2 }); },
  hit() { tone(220, 0.4, { to: 55, type: 'sawtooth', vol: 0.3 }); noise(0.25, { from: 1200, to: 150, q: 0.7, vol: 0.34 }); [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.16, delay: 0.25 + i * 0.11 })); },
  zone() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.07 })); },
  best() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.2, delay: i * 0.085 })); },
  tick(n = 0) { tone(520 + n * 22, 0.04, { type: 'square', vol: 0.06 }); },
  buy() { noise(0.05, { from: 6000, q: 2, vol: 0.25 }); [1319, 1661, 2093].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: 0.05 + i * 0.045 })); },
  nope() { tone(200, 0.12, { type: 'square', vol: 0.12 }); tone(160, 0.16, { type: 'square', vol: 0.12, delay: 0.1 }); },
};

// ---- music: bouncy 16-step loop, G major, four chords, call-and-answer lead
const CH = [[43, [67, 71, 74]], [40, [64, 67, 71]], [36, [64, 67, 72]], [38, [66, 69, 74]]]; // G  Em  C  D
const LEAD = [
  [79, 0, 83, 0, 81, 79, 0, 76, 0, 79, 0, 0, 74, 0, 76, 0],
  [76, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0, 0, 0, 0, 0],
  [84, 0, 83, 0, 79, 0, 76, 79, 0, 0, 84, 0, 83, 0, 79, 0],
  [81, 0, 78, 0, 74, 0, 78, 0, 81, 0, 86, 0, 0, 81, 83, 0],
];
function step(at) {
  const bar = (stepN >> 4) % 8, s = stepN & 15, [root, tri] = CH[bar % 4];
  if (s % 4 === 0) { tone(120, 0.11, { to: 45, vol: 0.5, bus: musicBus, at }); }
  if (s % 8 === 4) noise(0.09, { from: 1900, q: 0.7, vol: 0.3, bus: musicBus, at });
  if (s % 2 === 0) noise(0.025, { from: 8000, q: 1.2, vol: s % 4 === 2 ? 0.16 : 0.08, bus: musicBus, at });
  if (hot && s % 2 === 1) noise(0.02, { from: 9000, q: 1.2, vol: 0.08, bus: musicBus, at });
  const bassPat = [0, -1, 12, -1, 0, -1, 12, 7, 0, -1, 12, -1, 7, -1, 12, 10][s];
  if (bassPat >= 0) tone(hz(root + bassPat), 0.13, { type: 'triangle', vol: 0.5, bus: musicBus, at });
  if (s === 2 || s === 6 || s === 10 || s === 14) for (const n of tri) tone(hz(n), 0.09, { type: 'square', vol: 0.055, bus: musicBus, at });
  const n = LEAD[(bar % 4)][s] + (bar >= 4 && s >= 8 && bar % 2 ? 0 : 0);
  if (n && (bar < 4 || s % 2 === 0 || bar % 2)) { tone(hz(n), 0.17, { type: 'square', vol: 0.085, bus: musicBus, at }); tone(hz(n + 12), 0.1, { type: 'triangle', vol: 0.05, bus: musicBus, at }); }
}
function pump() {
  if (!ac || !musicOn) return;
  if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.05;
  while (nextNote < ac.currentTime + 0.18) { step(nextNote); nextNote += 60 / (hot ? bpm * 1.12 : bpm) / 4; stepN++; }
}
export function startMusic() { musicOn = true; if (!ac || timer) return; nextNote = ac.currentTime + 0.08; timer = setInterval(pump, 50); }
export function stopMusic() { musicOn = false; if (timer) { clearInterval(timer); timer = null; } }
export function setHot(h) { hot = h; }
export function setTempo(b) { bpm = b; }
