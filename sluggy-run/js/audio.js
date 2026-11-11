// Sluggy Run — audio engine. Everything is synthesized: drums, bass, leads, reverb, echo and all sound effects.
let ac = null, master = null, sfxBus = null, musicBus = null, duck = null, drumBus = null, verbIn = null, echoIn = null, echoDelay = null, musicLP = null, noiseBuf = null;
let muted = false, musicOn = false, timer = null, nextNote = 0, stepN = 0, bpm = 148, hot = false, track = 'bounce', zone = 0, xpose = 0;

export function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); build();
  if (musicOn) startMusic();
}
function build() {
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.95; sfxBus.connect(master);
  musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 18000; musicLP.Q.value = 0.5; musicLP.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0.42; musicBus.connect(musicLP);
  duck = ac.createGain(); duck.connect(musicBus);            // everything tonal pumps against the kick
  drumBus = ac.createGain(); drumBus.gain.value = 1; drumBus.connect(musicBus);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // reverb: a generated stereo impulse
  const len = Math.floor(ac.sampleRate * 1.9), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 400 ? i / 400 : 1); }
  const conv = ac.createConvolver(); conv.buffer = ir; verbIn = ac.createGain(); const verbOut = ac.createGain(); verbOut.gain.value = 0.55; verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(master);
  // tempo echo
  echoIn = ac.createGain(); echoDelay = ac.createDelay(1); const fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
  fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = 0.5; echoDelay.delayTime.value = 0.26;
  echoIn.connect(echoDelay); echoDelay.connect(lp); lp.connect(fb); fb.connect(echoDelay); lp.connect(wet); wet.connect(master);
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export function suspendAudio(s) { if (ac) (s ? ac.suspend() : ac.resume()).catch(() => {}); }

// ---------------------------------------------------------------- building blocks
function route(node, o) {
  let n = node;
  if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); n.connect(p); n = p; }
  n.connect(o.bus || sfxBus);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; n.connect(s); s.connect(verbIn); }
  if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; n.connect(s); s.connect(echoIn); }
}
const when = (o) => (o.at ?? ac.currentTime) + (o.delay || 0);
function env(g, t, dur, vol, attack = 0.006) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function tone(freq, dur, o = {}) {
  if (!ac) return; const t = when(o), osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = freq * (o.vibAmt || 0.03); l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
  env(g, t, dur, o.vol ?? 0.3, o.attack); osc.connect(g); route(g, o); osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ac) return; const t = when(o), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = noiseBuf; src.loop = true;
  f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1; f.frequency.setValueAtTime(o.from || 1000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  env(g, t, dur, o.vol ?? 0.3, o.attack || 0.004); src.connect(f); f.connect(g); route(g, o); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
// several detuned oscillators through a swept low-pass: basses, leads, stabs
function synth(freq, dur, o = {}) {
  if (!ac) return; const t = when(o), f = ac.createBiquadFilter(), g = ac.createGain(), det = o.det || [0];
  f.type = 'lowpass'; f.Q.value = o.q ?? 4; f.frequency.setValueAtTime(o.cut || 2000, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutTo || o.cut || 2000), t + (o.sweep || dur));
  for (const c of det) { const osc = ac.createOscillator(); osc.type = o.type || 'sawtooth'; osc.frequency.setValueAtTime(freq, t); osc.detune.value = c; if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur); osc.connect(f); osc.start(t); osc.stop(t + dur + 0.05); }
  if (o.sub) { const s = ac.createOscillator(), sg = ac.createGain(); s.type = 'sine'; s.frequency.value = freq / 2; sg.gain.value = o.sub; s.connect(sg); sg.connect(g); s.start(t); s.stop(t + dur + 0.05); }
  env(g, t, dur, (o.vol ?? 0.3) / Math.sqrt(det.length), o.attack); f.connect(g); route(g, o);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

// ---------------------------------------------------------------- drums
function kick(at, vol = 0.9) {
  tone(170, 0.2, { to: 48, glide: 0.09, vol: vol * 0.6, bus: drumBus, at }); tone(1100, 0.04, { to: 220, type: 'triangle', vol: vol * 0.5, bus: drumBus, at }); noise(0.02, { from: 3500, q: 0.5, vol: vol * 0.4, bus: drumBus, at });
  if (duck) { duck.gain.cancelScheduledValues(at); duck.gain.setValueAtTime(0.45, at); duck.gain.linearRampToValueAtTime(1, at + 0.2); }
}
function snare(at, vol = 0.5) { noise(0.17, { type: 'highpass', from: 1700, q: 0.7, vol: vol * 1.5, bus: drumBus, verb: 0.35, at }); tone(205, 0.1, { to: 150, type: 'triangle', vol: vol * 0.7, bus: drumBus, at }); }
function clap(at, vol = 0.4) { for (let i = 0; i < 3; i++) noise(0.03, { from: 1300, q: 1.1, vol: vol * 0.8, bus: drumBus, at: at + i * 0.011 }); noise(0.16, { from: 1300, q: 0.9, vol, bus: drumBus, verb: 0.5, at: at + 0.03 }); }
function hat(at, vol = 0.1, open = false, pan = 0) { noise(open ? 0.13 : 0.035, { type: 'highpass', from: open ? 6500 : 8500, q: 0.8, vol: vol * 2.4, bus: drumBus, pan, at }); }
function tom(at, f, vol = 0.4) { tone(f, 0.2, { to: f * 0.55, vol, bus: drumBus, verb: 0.25, at }); }
function riser(at, dur, vol = 0.22) { noise(dur, { from: 500, to: 9000, q: 2.5, vol, attack: dur * 0.9, bus: musicBus, verb: 0.3, at }); synth(hz(52 + xpose), dur, { to: hz(76 + xpose), cut: 600, cutTo: 5000, vol: vol * 0.5, attack: dur * 0.85, det: [-9, 9], bus: musicBus, at }); }
function crash(at, vol = 0.3) { noise(1.1, { type: 'highpass', from: 5000, q: 0.5, vol, bus: drumBus, verb: 0.5, at }); }

// ---------------------------------------------------------------- sound effects
let coinN = 0, coinT = 0;
export const sfx = {
  click() { tone(700, 0.06, { type: 'triangle', vol: 0.2 }); tone(1050, 0.09, { type: 'triangle', vol: 0.14, delay: 0.035 }); },
  jump() { tone(260, 0.2, { to: 760, glide: 0.13, type: 'triangle', vol: 0.2, vib: 22, vibAmt: 0.05 }); noise(0.09, { from: 700, to: 2600, q: 0.9, vol: 0.1 }); },
  jump2() { tone(480, 0.2, { to: 1300, glide: 0.12, type: 'triangle', vol: 0.18 }); tone(960, 0.14, { to: 1900, type: 'sine', vol: 0.1, delay: 0.03, echo: 0.3 }); },
  boing(k = 1) { const f = 150 + k * 110; tone(f, 0.34, { to: f * 3.1, glide: 0.16, type: 'triangle', vol: 0.24, vib: 17, vibAmt: 0.09 }); tone(f * 2, 0.22, { to: f * 4.5, type: 'sine', vol: 0.09, delay: 0.02 }); noise(0.1, { from: 500, to: 3000, q: 0.8, vol: 0.1 }); },
  squish() { noise(0.16, { from: 900, to: 260, q: 3, vol: 0.2 }); tone(240, 0.14, { to: 110, type: 'sine', vol: 0.16 }); },
  splat() { noise(0.2, { from: 2400, to: 300, q: 1.6, vol: 0.34 }); tone(170, 0.16, { to: 70, type: 'sine', vol: 0.3 }); noise(0.05, { type: 'highpass', from: 4000, vol: 0.14, delay: 0.02 }); },
  stick() { noise(0.12, { from: 1500, to: 420, q: 4, vol: 0.24 }); tone(330, 0.1, { to: 190, type: 'triangle', vol: 0.16 }); },
  unstick() { noise(0.09, { from: 400, to: 2200, q: 4, vol: 0.2 }); tone(200, 0.1, { to: 420, type: 'triangle', vol: 0.15 }); },
  drip() { tone(1250, 0.08, { to: 620, type: 'sine', vol: 0.12, verb: 0.4 }); },
  land() { tone(120, 0.1, { to: 60, vol: 0.22 }); noise(0.07, { from: 600, to: 200, q: 0.8, vol: 0.14 }); },
  slide() { noise(0.3, { from: 2800, to: 600, q: 1.6, vol: 0.15 }); tone(300, 0.22, { to: 140, type: 'sine', vol: 0.1 }); },
  swish(dir = 0) { noise(0.13, { from: 900, to: 4200, q: 1.3, vol: 0.17, pan: dir * 0.7 }); tone(420, 0.1, { to: 760, type: 'sine', vol: 0.06, pan: dir * 0.7 }); },
  coin() { // pitch climbs while you keep a streak going
    const now = performance.now(); coinN = now - coinT < 450 ? Math.min(coinN + 1, 10) : 0; coinT = now;
    const f = hz(84 + PENTA[coinN]); tone(f, 0.07, { type: 'square', vol: 0.06 }); tone(f * 1.5, 0.22, { type: 'triangle', vol: 0.13, delay: 0.03, verb: 0.25 }); tone(f * 3, 0.12, { type: 'sine', vol: 0.05, delay: 0.03 });
  },
  stomp(n = 1) { noise(0.16, { from: 1800, to: 300, q: 2.2, vol: 0.34 }); tone(190, 0.16, { to: 60, vol: 0.4 }); tone(hz(72 + PENTA[Math.min(n, 9)]), 0.26, { type: 'triangle', vol: 0.22, delay: 0.04, verb: 0.3 }); tone(hz(84 + PENTA[Math.min(n, 9)]), 0.16, { type: 'sine', vol: 0.1, delay: 0.07 }); },
  smash() { noise(0.22, { from: 2600, to: 260, q: 0.6, vol: 0.36 }); tone(130, 0.2, { to: 50, vol: 0.34 }); noise(0.3, { type: 'highpass', from: 4500, vol: 0.12, delay: 0.03, verb: 0.3 }); },
  power() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.19, delay: i * 0.045, verb: 0.3, pan: (i % 2 ? 0.4 : -0.4) })); noise(0.5, { from: 800, to: 8000, q: 3, vol: 0.12, attack: 0.4 }); },
  shieldPop() { tone(900, 0.3, { to: 180, type: 'sine', vol: 0.26, verb: 0.3 }); noise(0.14, { from: 3200, q: 0.6, vol: 0.22 }); },
  hit() {
    tone(90, 0.55, { to: 34, vol: 0.6 }); noise(0.3, { from: 1400, to: 140, q: 0.7, vol: 0.44 }); synth(196, 0.34, { to: 62, cut: 2400, cutTo: 200, vol: 0.3, det: [-14, 14] });
    [392, 349, 311, 233].forEach((f, i) => tone(f, 0.26, { type: 'triangle', vol: 0.19, delay: 0.3 + i * 0.13, vib: 6, vibAmt: 0.02, verb: 0.3 }));
  },
  zone() { noise(0.6, { from: 400, to: 6000, q: 2, vol: 0.16, attack: 0.45 }); [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.17, delay: 0.3 + i * 0.06, verb: 0.4 })); },
  best() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.22, { type: 'triangle', vol: 0.2, delay: i * 0.085, verb: 0.3 }); tone(f * 2, 0.12, { type: 'sine', vol: 0.06, delay: i * 0.085 }); }); },
  tick(n = 0) { tone(520 + n * 22, 0.04, { type: 'square', vol: 0.06 }); },
  buy() { noise(0.05, { from: 6000, q: 2, vol: 0.25 }); [1319, 1661, 2093].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.16, delay: 0.05 + i * 0.045, verb: 0.3 })); },
  ding() { tone(1568, 0.16, { type: 'triangle', vol: 0.16, verb: 0.3 }); tone(2349, 0.2, { type: 'sine', vol: 0.09, delay: 0.04 }); },
  sparkle() { [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, 0.14, { type: 'sine', vol: 0.09, delay: i * 0.035, verb: 0.4, pan: i % 2 ? 0.5 : -0.5 })); },
  nope() { tone(200, 0.12, { type: 'square', vol: 0.12 }); tone(160, 0.16, { type: 'square', vol: 0.12, delay: 0.1 }); },
};

// ---------------------------------------------------------------- music
// each zone nudges the key and the tone of the mix so the run keeps feeling fresh
const ZKEY = [0, 2, -2, 3, 0, -3, 5], ZCUT = [18000, 18000, 16000, 18000, 18000, 5200, 9000];
export function setZone(z) { zone = z; xpose = ZKEY[z] || 0; if (musicLP) musicLP.frequency.setTargetAtTime(ZCUT[z] || 18000, ac.currentTime, 0.4); }

// Side View: bouncy G-major tune
const CH = [[43, [67, 71, 74]], [40, [64, 67, 71]], [36, [64, 67, 72]], [38, [66, 69, 74]]]; // G  Em  C  D
const LEAD = [
  [79, 0, 83, 0, 81, 79, 0, 76, 0, 79, 0, 0, 74, 0, 76, 0],
  [76, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0, 0, 0, 0, 0],
  [84, 0, 83, 0, 79, 0, 76, 79, 0, 0, 84, 0, 83, 0, 79, 0],
  [81, 0, 78, 0, 74, 0, 78, 0, 81, 0, 86, 0, 0, 81, 83, 0],
];
const BASS1 = [0, -1, 12, -1, 0, -1, 12, 7, 0, -1, 12, -1, 7, -1, 12, 10];
function stepBounce(at) {
  const bar = stepN >> 4, s = stepN & 15, ph = bar % 16, [root, tri] = CH[bar % 4], X = xpose, spb = 60 / bpm / 4;
  const sw = s % 2 ? spb * 0.14 : 0, t = at + sw;                                 // light swing
  if (s % 4 === 0 || (hot && s === 10)) kick(t, 0.8);
  if (s % 8 === 4) (ph % 4 === 3 ? clap : snare)(t, 0.4);
  hat(t, s % 4 === 2 ? 0.13 : 0.06, s % 8 === 6, s % 2 ? 0.3 : -0.3);
  if (ph === 15 && s >= 12) tom(t, 220 - (s - 12) * 28, 0.35);
  if (BASS1[s] >= 0) synth(hz(root + BASS1[s] + X), 0.15, { type: 'square', cut: 1400, cutTo: 380, q: 3, vol: 0.4, sub: 0.12, bus: duck, at: t });
  if (s === 2 || s === 6 || s === 10 || s === 14) for (const n of tri) synth(hz(n + X), 0.1, { type: 'square', cut: 3400, cutTo: 1400, q: 1, vol: 0.16, bus: duck, pan: 0.35, at: t });
  const n = LEAD[bar % 4][s];
  if (n && ph >= 2) { synth(hz(n + X), 0.2, { type: 'square', cut: 5000, cutTo: 1800, q: 2, vol: 0.36, bus: duck, echo: 0.3, verb: 0.15, at: t }); tone(hz(n + 12 + X), 0.12, { type: 'triangle', vol: 0.12, bus: duck, at: t }); }
  if (ph >= 8 && s % 2 === 0) tone(hz(tri[(s >> 1) % 3] + 12 + X), 0.06, { type: 'triangle', vol: 0.1, bus: duck, pan: -0.4, at: t });
}

// 3D Chase: fast E-minor drive. 32-bar form: build (8) → drop (16) → breakdown (4) → climb (4)
const CH2 = [[40, 15], [36, 16], [38, 16], [35, 16]]; // Em  C  D  B   (root, third)
const HOOK = [
  [76, 0, 0, 76, 0, 79, 0, 83, 0, 0, 81, 0, 79, 0, 78, 0],
  [79, 0, 0, 79, 0, 76, 0, 84, 0, 0, 83, 0, 79, 0, 76, 0],
  [81, 0, 0, 81, 0, 78, 0, 86, 0, 0, 83, 0, 81, 0, 78, 0],
  [78, 0, 0, 78, 0, 83, 0, 87, 0, 88, 0, 0, 87, 0, 83, 0],
];
function stepChase(at) {
  const bar = stepN >> 4, s = stepN & 15, ph = bar % 32, [root, third] = CH2[bar % 4], X = xpose, spb = 60 / bpm / 4;
  const build = ph < 8, drop = ph >= 8 && ph < 24, brk = ph >= 24 && ph < 28, climb = ph >= 28, R = root + X;
  if (s === 0 && (ph === 8 || ph === 0)) crash(at, 0.3);
  if (ph === 27 && s === 0) riser(at, spb * 16 * 4.9, 0.2);
  // drums
  if (!brk && !climb) { if (s % 4 === 0 || (hot && s === 14)) kick(at, 0.95); }
  else if (climb) { if (s % (ph === 31 ? 2 : 4) === 0) kick(at, 0.6 + (ph - 28) * 0.08); if (ph >= 30 && (ph === 31 || s % 2 === 0)) snare(at, 0.2 + (ph - 30) * 0.12 + s * 0.012); }
  if ((drop || build) && (s === 4 || s === 12)) { snare(at, 0.5); if (drop) clap(at, 0.3); }
  if (drop && ph % 8 === 7 && s >= 10) tom(at, 260 - (s - 10) * 22, 0.4);
  if (!brk) { hat(at, s % 2 ? 0.06 : 0.1, false, s % 2 ? 0.35 : -0.35); if (s % 4 === 2) hat(at, 0.16, true); if ((hot || drop) && s % 4 === 3) hat(at, 0.05, false, 0.5); }
  // bass: off-beat pump in the build, galloping 16ths in the drop
  const bp = drop || climb ? [0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 12, 7, 12][s] : s % 4 === 2 || s % 4 === 3 ? (s % 8 === 7 ? 12 : 0) : -1;
  if (bp >= 0 && !brk) synth(hz(R + bp), 0.11, { cut: hot ? 3600 : drop ? 2600 : 1500, cutTo: 420, q: 7, vol: 0.42, sub: 0.14, det: [-7, 7], bus: duck, at });
  if (brk && s === 0) synth(hz(R), spb * 15, { cut: 700, cutTo: 1800, q: 2, vol: 0.34, sub: 0.15, det: [-6, 6], attack: 0.3, bus: duck, at });
  // racing arpeggio
  if (ph >= 2) { const a = [0, 7, 12, third, 19, third, 12, 7][s % 8]; synth(hz(R + 24 + a), 0.09, { type: 'square', cut: brk ? 900 + s * 90 : 3600, cutTo: 900, q: 3, vol: brk ? 0.2 : 0.19, bus: duck, pan: s % 2 ? 0.5 : -0.5, echo: 0.22, at }); }
  // chord stabs + pad
  if (!brk && (s === 0 || s === 6 || s === 10)) for (const n of [0, third - 12, 7]) synth(hz(R + 24 + n), 0.18, { cut: 4200, cutTo: 1100, q: 2, vol: 0.17, bus: duck, verb: 0.2, at });
  if ((brk || climb) && s === 0) for (const n of [0, third - 12, 7, 12]) synth(hz(R + 12 + n), spb * 16, { cut: 900, cutTo: climb ? 3600 : 1600, q: 1, vol: 0.2, det: [-8, 8], attack: 0.25, bus: duck, verb: 0.4, at });
  // the hook: supersaw lead in the drop, a quieter echo of it in the build
  const n = HOOK[bar % 4][s];
  if (n && drop) { synth(hz(n + X), 0.26, { cut: 6500, cutTo: 2200, q: 3, vol: 0.62, det: [-14, 0, 14], bus: duck, echo: 0.3, verb: 0.25, at }); tone(hz(n + X + 12), 0.14, { type: 'square', vol: 0.1, bus: duck, at }); }
  else if (n && build && ph >= 4 && s % 2 === 0) synth(hz(n + X), 0.2, { type: 'square', cut: 3000, cutTo: 1100, q: 2, vol: 0.24, bus: duck, echo: 0.35, at });
}
function pump() {
  if (!ac || !musicOn) return;
  if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.05;
  const b = hot ? bpm * 1.06 : bpm; if (echoDelay) echoDelay.delayTime.setTargetAtTime((60 / b) * 0.75, ac.currentTime, 0.2);
  while (nextNote < ac.currentTime + 0.2) { (track === 'chase' ? stepChase : stepBounce)(nextNote); nextNote += 60 / b / 4; stepN++; }
}
export function startMusic() { musicOn = true; if (!ac || timer) return; nextNote = ac.currentTime + 0.08; timer = setInterval(pump, 50); }
export function stopMusic() { musicOn = false; if (timer) { clearInterval(timer); timer = null; } }
export function setHot(h) { hot = h; }
export function setTempo(b) { bpm = b; }
export function setTrack(t) { if (t !== track) { track = t; stepN = 0; } if (t === 'chase' && stepN === 0) stepN = 0; }
export function restartSong() { stepN = 0; }

// Test hook: render a stretch of music offline and report loudness, so levels can be checked without ears.
export async function renderOffline(sec = 20, trk = 'chase', tempo = 172, isHot = false) {
  const keep = { ac, track, stepN, bpm, hot, timer }; if (timer) { clearInterval(timer); timer = null; }
  const sr = 44100; ac = new OfflineAudioContext(2, sec * sr, sr); build(); track = trk; bpm = tempo; hot = isHot; stepN = 0;
  for (let t = 0.05; t < sec - 0.3; t += 60 / bpm / 4) { (trk === 'chase' ? stepChase : stepBounce)(t); stepN++; }
  for (let t = 1; t < sec - 1; t += 2.5) { sfx.coin.call(null); }
  const buf = await ac.startRendering(), L = buf.getChannelData(0), Rr = buf.getChannelData(1), win = sr * 2, out = []; let peak = 0, clip = 0;
  for (let i = 0; i < L.length; i += win) { let sum = 0, n = 0; for (let k = i; k < Math.min(L.length, i + win); k++) { const a = L[k], b = Rr[k]; sum += a * a + b * b; n += 2; const m = Math.max(Math.abs(a), Math.abs(b)); if (m > peak) peak = m; if (m > 0.999) clip++; } out.push(+(10 * Math.log10(sum / n + 1e-12)).toFixed(1)); }
  // crude spectrum split: energy below ~200 Hz vs above ~4 kHz, via one-pole filters
  let lo = 0, hi = 0, all = 0, y = 0, a1 = Math.exp(-2 * Math.PI * 200 / sr), y2 = 0, a2 = Math.exp(-2 * Math.PI * 4000 / sr);
  for (let i = 0; i < L.length; i++) { const x = L[i]; y = (1 - a1) * x + a1 * y; y2 = (1 - a2) * x + a2 * y2; lo += y * y; hi += (x - y2) * (x - y2); all += x * x; }
  ({ ac, track, stepN, bpm, hot } = keep); ac = keep.ac; master = null; if (ac) { build(); if (musicOn) { timer = null; startMusic(); } }
  return { peak: +peak.toFixed(3), clipped: clip, rmsDb: out, lowShare: +(lo / all).toFixed(2), highShare: +(hi / all).toFixed(2) };
}
