// Sluggy's Business — synthesized audio.
let ac = null, master = null, sfxBus = null, musicBus = null, drumBus = null, noiseBuf = null;
let muted = false, musicOn = false, timer = null, nextNote = 0, stepN = 0;

export function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0.26; musicBus.connect(master);
  drumBus = ac.createGain(); drumBus.gain.value = 0.26; drumBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (musicOn) startMusic();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }

function tone(freq, dur, o = {}) {
  if (!ac) return;
  const t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(o.bus || sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ac) return;
  const t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1; f.frequency.setValueAtTime(o.from || 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(o.bus || sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let lastCoin = 0;
export const sfx = {
  click() { tone(700, 0.06, { type: 'triangle', vol: 0.2 }); tone(1050, 0.08, { type: 'triangle', vol: 0.13, delay: 0.035 }); },
  tick(n = 0) { tone(520 + n * 28, 0.045, { type: 'square', vol: 0.07 }); },
  bid(up) { tone(up ? 880 : 620, 0.05, { type: 'triangle', vol: 0.16 }); },
  lock() { tone(392, 0.09, { type: 'square', vol: 0.12 }); tone(587, 0.14, { type: 'square', vol: 0.12, delay: 0.07 }); noise(0.06, { from: 3000, q: 0.6, vol: 0.2 }); },
  drum() { for (let i = 0; i < 8; i++) noise(0.05, { from: 300, q: 1.5, vol: 0.12 + i * 0.02, delay: i * 0.06 }); },
  gavel() { tone(190, 0.14, { to: 70, type: 'square', vol: 0.36 }); noise(0.07, { from: 1600, q: 0.6, vol: 0.36 }); },
  coin() {
    const now = performance.now(); if (now - lastCoin < 45) return; lastCoin = now;
    const f = 1568 + Math.random() * 300; tone(f, 0.07, { type: 'square', vol: 0.07 }); tone(f * 1.5, 0.16, { type: 'triangle', vol: 0.12, delay: 0.035 });
  },
  chaching() { noise(0.05, { from: 6000, q: 2, vol: 0.25 }); [1319, 1661, 2093].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: 0.05 + i * 0.045 })); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.22, delay: i * 0.06 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.08 })); },
  pop() { tone(300, 0.14, { to: 900, type: 'sine', vol: 0.28 }); noise(0.05, { from: 2200, q: 0.7, vol: 0.18 }); },
  worm() { tone(180, 0.5, { to: 70, type: 'sawtooth', vol: 0.16 }); tone(240, 0.45, { to: 95, type: 'sawtooth', vol: 0.1, delay: 0.05 }); noise(0.3, { from: 400, to: 150, q: 2, vol: 0.2 }); },
  bird() { [2600, 3100, 2600, 3300].forEach((f, i) => tone(f, 0.07, { to: f * 1.15, type: 'sine', vol: 0.14, delay: i * 0.08 })); },
  day() { tone(659, 0.12, { type: 'triangle', vol: 0.2 }); tone(988, 0.25, { type: 'triangle', vol: 0.2, delay: 0.11 }); },
  payday() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.18, delay: i * 0.05 })); },
  warn() { [220, 208].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.14, delay: i * 0.28 })); },
  fanfare() { [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 6 ? 0.9 : 0.16, { type: 'triangle', vol: 0.26, delay: i * 0.12 })); [262, 330, 392].forEach((f) => tone(f, 1.2, { type: 'sawtooth', vol: 0.06, delay: 0.72 })); },
  sad() { [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.26, { type: 'triangle', vol: 0.22, delay: i * 0.22 })); },
};

// ---- music: a jaunty swing "bidness" strut (I – VI7 – ii7 – V7), triplet grid, 12 steps per bar
const BARS = [
  { bass: [36, 40, 43, 45], stab: [64, 67, 69] },
  { bass: [45, 49, 52, 49], stab: [61, 64, 67] },
  { bass: [38, 41, 45, 41], stab: [60, 65, 69] },
  { bass: [43, 47, 50, 47], stab: [59, 65, 67] },
];
const MEL = [
  [[0, 76], [2, 79], [3, 84], [5, 81], [6, 79], [8, 76], [9, 79]],
  [[0, 81], [2, 79], [3, 76], [5, 73], [6, 76], [9, 81]],
  [[0, 77], [2, 81], [3, 86], [5, 84], [6, 81], [8, 77], [9, 81]],
  [[0, 83], [2, 81], [3, 79], [5, 77], [6, 74], [8, 71], [9, 74], [11, 79]],
  [[0, 84], [3, 84], [5, 81], [6, 84], [9, 88]],
  [[0, 85], [3, 85], [5, 81], [6, 85], [9, 88]],
  [[0, 86], [2, 84], [3, 81], [5, 77], [6, 81], [8, 84], [9, 86]],
  [[0, 83], [3, 79], [6, 74], [8, 77], [9, 79], [11, 83]],
];
function schedule() {
  if (!ac || !musicOn) return;
  const sd = 0.152;
  while (nextNote < ac.currentTime + 0.25) {
    const s = stepN % 12, barN = Math.floor(stepN / 12), bar = BARS[barN % 4], beat = (s / 3) | 0;
    const d = Math.max(0, nextNote - ac.currentTime);
    const sec = Math.floor(barN / 8) % 3; // 0,1: melody; 2: comping break
    if (s % 3 === 0) {
      tone(hz(bar.bass[beat]), sd * 2.6, { type: 'triangle', vol: 0.8, bus: musicBus, delay: d, attack: 0.008 });
      if (beat % 2 === 0) tone(120, 0.14, { to: 45, type: 'sine', vol: 0.8, bus: drumBus, delay: d, attack: 0.003 });
      else noise(0.09, { type: 'bandpass', from: 1900, q: 1, vol: 0.4, bus: drumBus, delay: d });
    }
    if (s % 3 !== 1) noise(s % 3 === 0 ? 0.05 : 0.03, { type: 'highpass', from: 7000, q: 0.5, vol: s % 3 === 0 ? 0.16 : 0.1, bus: drumBus, delay: d });
    if (s === 5 || s === 11 || (sec === 2 && s === 2)) for (const m of bar.stab) tone(hz(m), sd * 1.1, { type: 'triangle', vol: 0.13, bus: musicBus, delay: d });
    if (sec < 2) {
      for (const [st, m] of MEL[barN % 8]) if (st === s) {
        tone(hz(m), sd * 1.8, { type: 'triangle', vol: 0.34, bus: musicBus, delay: d, attack: 0.012 });
        tone(hz(m), sd * 1.5, { type: 'square', vol: 0.045, bus: musicBus, delay: d, attack: 0.012 });
      }
    }
    nextNote += sd; stepN++;
  }
}
export function startMusic() {
  musicOn = true; if (!ac || timer) return;
  nextNote = ac.currentTime + 0.1; timer = setInterval(schedule, 50);
}
