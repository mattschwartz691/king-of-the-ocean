// King of the Ocean — synthesized audio (WebAudio, no asset files).
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, musicTimer = null, nextNote = 0, stepN = 0, intense = false, musicOn = false;

export function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0.34; musicBus.connect(master);
  // feedback delay for music
  const delay = ac.createDelay(1); delay.delayTime.value = 0.33;
  const fb = ac.createGain(); fb.gain.value = 0.35;
  const dl = ac.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
  musicBus.connect(delay); delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (musicOn) startMusic();
}

export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export function isMuted() { return muted; }

function tone(freq, dur, o = {}) {
  if (!ac) return;
  const t = ac.currentTime + (o.delay || 0);
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const v = (o.vol ?? 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(o.bus || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ac) return;
  const t = ac.currentTime + (o.delay || 0);
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.from || 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ac.createGain(), v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone(660, 0.07, { type: 'triangle', vol: 0.2 }); tone(990, 0.09, { type: 'triangle', vol: 0.14, delay: 0.04 }); },
  dash(v = 1) { noise(0.28, { from: 500, to: 3200, q: 1.2, vol: 0.34 * v }); tone(190, 0.2, { to: 520, type: 'sawtooth', vol: 0.06 * v }); },
  hit(v = 1) {
    noise(0.16, { from: 3000, to: 500, q: 0.7, vol: 0.5 * v });
    tone(170, 0.24, { to: 50, type: 'square', vol: 0.3 * v });
    tone(1400, 0.12, { to: 700, type: 'triangle', vol: 0.16 * v });
  },
  clash(v = 1) {
    for (const f of [1244, 1661, 2217]) tone(f, 0.35, { type: 'triangle', vol: 0.13 * v });
    noise(0.1, { from: 5000, q: 0.5, vol: 0.4 * v });
  },
  zap(v = 1) { tone(900, 0.3, { to: 90, type: 'sawtooth', vol: 0.2 * v }); noise(0.25, { from: 4000, to: 1500, q: 3, vol: 0.3 * v }); },
  sting(v = 1) { tone(720, 0.26, { to: 240, type: 'square', vol: 0.14 * v }); tone(1080, 0.2, { to: 360, type: 'sine', vol: 0.14 * v }); },
  eat(v = 1) { const f = 620 + Math.random() * 260; tone(f, 0.07, { to: f * 1.6, type: 'sine', vol: 0.2 * v }); },
  gold() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.05 })); },
  frenzy() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.2, { type: 'sawtooth', vol: 0.11, delay: i * 0.055 })); },
  crown(v = 1) { [659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.26, { type: 'triangle', vol: 0.24 * v, delay: i * 0.07 })); },
  lost() { [523, 415, 330].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.2, delay: i * 0.08 })); },
  power(v = 1) { tone(440, 0.3, { to: 1320, type: 'sine', vol: 0.24 * v }); tone(660, 0.3, { to: 1980, type: 'triangle', vol: 0.1 * v, delay: 0.05 }); },
  pop(v = 1) { tone(500, 0.1, { to: 1400, type: 'sine', vol: 0.22 * v }); noise(0.07, { from: 2500, q: 0.6, vol: 0.2 * v }); },
  shield(v = 1) { tone(1200, 0.25, { to: 500, type: 'sine', vol: 0.2 * v }); noise(0.15, { from: 3000, q: 0.6, vol: 0.2 * v }); },
  count() { tone(523, 0.16, { type: 'triangle', vol: 0.3 }); },
  go() { tone(784, 0.4, { type: 'triangle', vol: 0.3 }); tone(1047, 0.45, { type: 'triangle', vol: 0.24 }); tone(1568, 0.5, { type: 'sine', vol: 0.14 }); },
  final() { [880, 880, 1175].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.12, delay: i * 0.13 })); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.2, { type: 'triangle', vol: 0.26, delay: i * 0.13 })); },
  lose() { [392, 370, 330, 262].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.25, { type: 'triangle', vol: 0.22, delay: i * 0.2 })); },
};

// --- generative music: breezy pentatonic arps over a slow bass
const CHORDS = [
  [146.83, [293.66, 369.99, 440, 587.33, 739.99]],   // D
  [123.47, [246.94, 293.66, 369.99, 493.88, 587.33]], // Bm
  [196.0, [293.66, 392, 493.88, 587.33, 783.99]],     // G
  [220.0, [277.18, 329.63, 440, 554.37, 659.25]],     // A
];
const PATTERN = [0, 2, 1, 3, 2, 4, 3, 1, 0, 3, 2, 4, 1, 3, 2, 0];

function schedule() {
  if (!ac || !musicOn) return;
  const stepDur = intense ? 0.15 : 0.2;
  while (nextNote < ac.currentTime + 0.25) {
    const bar = Math.floor(stepN / 16) % CHORDS.length, s = stepN % 16;
    const [bass, notes] = CHORDS[bar];
    const dly = Math.max(0, nextNote - ac.currentTime);
    if (s % 8 === 0) {
      tone(bass / 2, stepDur * 7.5, { type: 'triangle', vol: 0.5, bus: musicBus, delay: dly, attack: 0.03 });
      tone(bass, stepDur * 7.5, { type: 'sine', vol: 0.22, bus: musicBus, delay: dly, attack: 0.05 });
    }
    if (s % 2 === 0 || intense || (stepN >> 4) % 2 === 1) {
      const f = notes[PATTERN[s]] * ((stepN >> 5) % 2 && s % 4 === 3 ? 2 : 1);
      tone(f, stepDur * 1.7, { type: 'triangle', vol: s % 4 === 0 ? 0.3 : 0.2, bus: musicBus, delay: dly });
    }
    if (intense && s % 4 === 0) tone(60, 0.12, { to: 40, type: 'sine', vol: 0.8, bus: musicBus, delay: dly });
    nextNote += stepDur; stepN++;
  }
}
export function startMusic() {
  musicOn = true;
  if (!ac || musicTimer) return;
  nextNote = ac.currentTime + 0.1;
  musicTimer = setInterval(schedule, 60);
}
export function setIntense(v) { intense = v; }
