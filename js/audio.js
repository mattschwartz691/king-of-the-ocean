// King of the Ocean — synthesized audio (WebAudio, no asset files).
let ac = null, master = null, sfxBus = null, musicBus = null, drumBus = null, noiseBuf = null;
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
  drumBus = ac.createGain(); drumBus.gain.value = 0.36; drumBus.connect(master);
  // feedback delay for music
  const delay = ac.createDelay(1); delay.delayTime.value = 0.375;
  const fb = ac.createGain(); fb.gain.value = 0.26;
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
  src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
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

// --- music: a bouncy tropical loop (marimba hook, tresillo bass, off-beat stabs, drums)
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
// chords: D  A  Bm  G   (bass root, stab triad)
const BARS = [
  { bass: 38, stab: [66, 69, 74] },
  { bass: 33, stab: [64, 69, 73] },
  { bass: 35, stab: [66, 71, 74] },
  { bass: 31, stab: [67, 71, 74] },
];
const HOOK_A = [
  [78, _, _, 78, _, 81, _, 78, _, 76, _, 74, _, _, 69, _],
  [76, _, _, 76, _, 78, _, 76, _, 73, _, 69, _, _, _, _],
  [74, _, _, 74, _, 78, _, 74, _, 71, _, 74, _, _, 78, _],
  [79, _, 78, _, 76, _, 74, _, 76, _, _, _, 69, _, 73, _],
];
const HOOK_B = [
  [81, _, _, 81, _, 83, _, 81, _, 78, _, 74, _, _, 78, _],
  [81, _, _, 79, _, 78, _, 76, _, _, 73, _, 76, _, _, _],
  [78, _, _, 78, _, 74, _, 71, _, 74, _, 78, _, _, 81, _],
  [79, _, _, 78, _, 76, _, 74, _, _, _, _, 69, 71, 73, _],
];
const BASS_STEPS = { 0: 0, 3: 0, 6: 12, 8: 0, 11: 7, 14: 12 };

const SCALE = [62, 64, 66, 67, 69, 71, 73]; // D major
function thirdBelow(m) {
  const i = SCALE.findIndex((n) => (n - m) % 12 === 0);
  if (i < 0) return m - 3;
  const j = (i + 5) % 7;                       // two scale steps down
  let d = ((SCALE[i] - SCALE[j]) % 12 + 12) % 12;
  return m - d;
}
function marimba(m, d, vol, len = 0.26) {
  const f = hz(m);
  tone(f, len, { type: 'sine', vol, bus: musicBus, delay: d, attack: 0.004 });
  tone(f * 2, len * 0.6, { type: 'triangle', vol: vol * 0.45, bus: musicBus, delay: d, attack: 0.004 });
  tone(f * 4, 0.06, { type: 'sine', vol: vol * 0.3, bus: musicBus, delay: d, attack: 0.002 });
}
function kick(d, v = 1) { tone(150, 0.2, { to: 42, type: 'sine', vol: 0.95 * v, bus: drumBus, delay: d, attack: 0.003 }); }
function clap(d, v = 1) {
  noise(0.13, { type: 'bandpass', from: 1700, q: 0.9, vol: 0.5 * v, bus: drumBus, delay: d, attack: 0.003 });
  noise(0.05, { type: 'bandpass', from: 2400, q: 1.2, vol: 0.3 * v, bus: drumBus, delay: d + 0.012, attack: 0.002 });
}
function hat(d, v = 1, len = 0.04) { noise(len, { type: 'highpass', from: 7500, q: 0.5, vol: 0.2 * v, bus: drumBus, delay: d, attack: 0.002 }); }

function schedule() {
  if (!ac || !musicOn) return;
  const stepDur = intense ? 0.106 : 0.125;       // 16th notes: 120 bpm, 141 bpm in the final stretch
  while (nextNote < ac.currentTime + 0.25) {
    const s = stepN % 16, barN = Math.floor(stepN / 16);
    const sec = Math.floor(barN / 4) % 4;          // 0: hook A, 1: hook B, 2: breakdown, 3: hook A + harmony
    const bar = BARS[barN % 4];
    const swing = s % 2 ? stepDur * 0.14 : 0;
    const d = Math.max(0, nextNote - ac.currentTime) + swing;
    const breakdown = sec === 2 && !intense;

    // drums
    if (s === 0 || s === 8 || (intense && (s === 4 || s === 12)) || (s === 14 && barN % 4 === 3)) kick(d, breakdown ? 0.7 : 1);
    if (!breakdown && (s === 4 || s === 12)) clap(d);
    if (s % 4 === 2) hat(d, 1, 0.07); else if (s % 2 === 1) hat(d, 0.35); else if (!breakdown) hat(d, 0.5);
    if (barN % 4 === 3 && s >= 12 && !breakdown) clap(d, 0.35 + (s - 12) * 0.15); // little fill into the next phrase

    // bass (tresillo)
    if (s in BASS_STEPS) {
      const f = hz(bar.bass + BASS_STEPS[s]);
      tone(f, stepDur * 2.2, { type: 'triangle', vol: 0.7, bus: musicBus, delay: d, attack: 0.006 });
      tone(f, stepDur * 2.2, { type: 'square', vol: 0.09, bus: musicBus, delay: d, attack: 0.006 });
    }
    // off-beat chord stabs
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      for (const m of bar.stab) tone(hz(m), stepDur * 0.9, { type: 'triangle', vol: breakdown ? 0.07 : 0.11, bus: musicBus, delay: d, attack: 0.004 });
    }
    // lead
    if (breakdown) {
      // sparkly arpeggio to give the hook a rest
      if (s % 2 === 0) { const st = bar.stab; marimba(st[(s / 2) % 3] + (s % 8 >= 4 ? 12 : 0), d, 0.16, 0.18); }
    } else {
      const m = (sec === 1 ? HOOK_B : HOOK_A)[barN % 4][s];
      if (m !== null) {
        marimba(m, d, 0.42);
        if (sec === 3 || intense) marimba(thirdBelow(m), d, 0.15); // diatonic harmony
      }
    }
    nextNote += stepDur; stepN++;
  }
}
export function startMusic() {
  musicOn = true;
  if (!ac || musicTimer) return;
  nextNote = ac.currentTime + 0.1;
  musicTimer = setInterval(schedule, 50);
}
export function setIntense(v) { intense = v; }
