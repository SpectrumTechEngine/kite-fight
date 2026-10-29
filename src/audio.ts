// Epic sound kit + gladiator battle music, all made with the Web Audio API (no sound files).
// Everything runs through a big hall echo so hits and cuts sound huge.
// Nothing is created until the first tap, because browsers only allow sound after one.

let ctx: AudioContext | null = null;
let master: GainNode, sfx: GainNode, musicBus: GainNode, wet: GainNode, comp: DynamicsCompressorNode;
let windGain: GainNode, windFilter: BiquadFilterNode, noise: AudioBuffer;
let bus: GainNode;            // where new notes go (sound effects or music)
let on = false, musicOn = false, musicLevel = 0;

function impulse(c: AudioContext, secs: number, decay: number) {
  const len = c.sampleRate * secs, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.knee.value = 10;
    master = ctx.createGain(); master.gain.value = 0.95;
    comp.connect(master).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = on ? 1 : 0; sfx.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(comp);
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 3.4, 2.4);
    wet = ctx.createGain(); wet.gain.value = 0.4; wet.connect(verb).connect(comp);
    bus = sfx;
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Constant wind bed
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.8;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(windFilter).connect(windGain).connect(sfx);
    src.start();
    nextT = ctx.currentTime + 0.1;
    setInterval(tick, 25);
  } catch { ctx = null; }
}

export function setSound(v: boolean) {
  on = v;
  if (v) ensure();
  if (ctx) sfx.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.02);
}
export function setMusic(v: boolean) {
  musicOn = v;
  if (v) ensure();
  if (ctx) musicBus.gain.setTargetAtTime(v ? 0.5 : 0, ctx.currentTime, 0.3);
}
/** 0 = menus (calm), 1 = battle, 2 = someone is on their last notch, -1 = silent */
export function setMusicLevel(n: number) { musicLevel = n; }

/** Call from any tap so the browser lets audio play. */
export function unlock() { if (on || musicOn) ensure(); }

export function wind(level: number, speed: number) {
  if (!ctx || !on) return;
  windGain.gain.setTargetAtTime(level, ctx.currentTime, 0.25);
  windFilter.frequency.setTargetAtTime(280 + speed * 2, ctx.currentTime, 0.25);
}

// ---------- building blocks ----------

const now = () => ctx!.currentTime;

/** Send a node to the current bus and the echo (amount 0..1). */
function out(node: AudioNode, verb = 0.4) {
  node.connect(bus);
  if (verb > 0) { const g = ctx!.createGain(); g.gain.value = verb; node.connect(g).connect(wet); }
}

function env(g: GainNode, t: number, vol: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** One oscillator note; slide = end frequency for pitch sweeps. */
function tone(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine', slide?: number, verb = 0.4, attack = 0.005) {
  const t = now() + at, o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  env(g, t, vol, attack, dur);
  o.connect(g); out(g, verb); o.start(t); o.stop(t + dur + 0.05);
}

/** Filtered noise burst; sweep = end filter frequency. */
function hiss(at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, sweep?: number, q = 1, verb = 0.4, attack = 0.005) {
  const t = now() + at, s = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  s.buffer = noise; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  env(g, t, vol, attack, dur);
  s.connect(f).connect(g); out(g, verb); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

/** Gritty bowed-string note (sawtooth through a filter). */
function bowed(freq: number, at: number, dur: number, vol: number, bright = 1400) {
  const t = now() + at, o = ctx!.createOscillator(), o2 = ctx!.createOscillator(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  o.type = o2.type = 'sawtooth'; o.frequency.value = freq; o2.frequency.value = freq; o2.detune.value = 9;
  f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 1.5;
  env(g, t, vol, 0.012, dur);
  o.connect(f); o2.connect(f); f.connect(g); out(g, 0.3);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

/** Brass section: detuned sawtooths through an opening filter. */
function brass(freqs: number[], at: number, dur: number, vol: number, bite = 3200) {
  const t = now() + at, f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  f.type = 'lowpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(bite, t + 0.1); f.frequency.exponentialRampToValueAtTime(bite * 0.3, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.035); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g); out(g, 0.55);
  for (const fr of freqs) for (const det of [-9, 0, 9]) {
    const o = ctx!.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.05);
  }
}

/** Choir "aah": buzzing voices through vowel filters, with vibrato. */
function choir(freqs: number[], at: number, dur: number, vol: number, vowel: 'ah' | 'oh' = 'ah') {
  const c = ctx!, t = now() + at, g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.5, dur * 0.3));
  g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out(g, 0.7);
  const formants = vowel === 'ah' ? [[800, 1], [1150, 0.5], [2900, 0.25]] : [[450, 1], [800, 0.5], [2830, 0.15]];
  const mix = c.createGain(); mix.gain.value = 1;
  for (const [ff, amp] of formants) { const bp = c.createBiquadFilter(), fg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 8; fg.gain.value = amp; mix.connect(bp).connect(fg).connect(g); }
  for (const fr of freqs) for (const det of [-12, 6]) {
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
    lfo.frequency.value = 5 + Math.random(); lg.gain.value = fr * 0.012;
    lfo.connect(lg).connect(o.frequency);
    o.connect(mix); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
}

/** Taiko war drum. */
function taiko(at: number, vol = 0.8, pitch = 75) {
  tone(pitch * 2.4, at, 0.7, vol, 'sine', pitch * 0.85, 0.35);
  hiss(at, 0.12, vol * 0.5, 'lowpass', 500, 150, 1, 0.3);
}

/** Big gong / bell: clashing overtones that ring for ages. */
function gong(at: number, vol = 0.3, base = 98, dur = 4) {
  [1, 1.47, 2.09, 2.56, 3.21, 4.07, 5.3].forEach((r, i) => tone(base * r, at, dur * (1 - i * 0.1), vol / (1 + i * 0.6), 'sine', base * r * 0.995, 0.7, 0.01));
  hiss(at, 1.2, vol * 0.4, 'bandpass', 3000, 1500, 0.8, 0.7, 0.02);
}

/** Metal clang (sword on sword). */
function clang(at: number, vol: number, base: number) {
  [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(base * r, at, 1.1 - i * 0.2, vol / (1 + i), 'sine', undefined, 0.7));
  hiss(at, 0.15, vol * 1.5, 'highpass', 5000, 12000, 1, 0.4);
}

/** Plucked string (Karplus-Strong): the twang of a kite line. */
function pluck(freq: number, at: number, vol: number, decay = 0.997) {
  const c = ctx!, sr = c.sampleRate, len = Math.floor(sr * 2), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const p = Math.max(2, Math.floor(sr / freq));
  for (let i = 0; i < p; i++) d[i] = Math.random() * 2 - 1;
  for (let i = p; i < len; i++) d[i] = decay * 0.5 * (d[i - p] + d[i - p + 1]);
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = vol;
  s.connect(g); out(g, 0.5); s.start(now() + at);
}

const crash = (at: number, vol = 0.25, dur = 1.8) => hiss(at, dur, vol, 'highpass', 6000, 2500, 0.7, 0.6);
const roll = (at: number, dur: number, vol: number, pitch = 70) => { const n = Math.round(dur / 0.05); for (let i = 0; i < n; i++) taiko(at + i * 0.05, vol * (0.25 + 0.75 * (i / n)), pitch); };

// Chords (as frequency lists)
const Dm = [146.8, 174.6, 220], Bb = [116.5, 146.8, 174.6], C = [130.8, 164.8, 196], Am = [110, 130.8, 164.8], A = [110, 138.6, 164.8], F = [174.6, 220, 261.6];
const up = (ch: number[], n = 2) => ch.map((f) => f * n);

// ---------- sound effects ----------

const play = (fn: () => void) => { if (on && ctx) { bus = sfx; fn(); } };

/** Menu button tap: a small sword "shing" */
export const click = () => play(() => { hiss(0, 0.12, 0.18, 'highpass', 4000, 9000, 2, 0.3); tone(1400, 0, 0.25, 0.06, 'sine', 1350, 0.5); });
/** Picking a match type: drum hit, higher for more cuts */
export const select = (n: number) => play(() => { taiko(0, 0.5, 60 + n * 10); brass(up([Dm[0] * Math.pow(2, n / 12)], 1), 0, 0.35, 0.08); });

/** 3, 2, 1: war drums and rising brass */
export const count = (n: number) => play(() => {
  const ch = n === 3 ? Dm : n === 2 ? Bb : C;
  taiko(0, 1, 70); taiko(0.12, 0.6, 90);
  brass(ch, 0, 0.55, 0.11);
  hiss(0, 0.2, 0.2, 'bandpass', 1800, 700, 1.5, 0.3);
});
/** FIGHT! gong, choir, brass and cymbals all at once */
export const fight = () => play(() => {
  gong(0, 0.35, 87); crash(0, 0.32, 2.5); taiko(0, 1, 60); taiko(0.08, 0.8, 75);
  brass([...Dm, ...up(Dm)], 0, 1.4, 0.13, 4000);
  choir(up(Dm), 0, 2, 0.12);
  hiss(0, 0.6, 0.3, 'bandpass', 500, 4000, 1, 0.3, 0.02);
});

/** Start of a dash: deep whoosh */
export const dash = (mine: boolean) => play(() => {
  hiss(0, 0.4, mine ? 0.38 : 0.16, 'bandpass', 350, 2600, 2.5, 0.25, 0.04);
  if (mine) tone(90, 0, 0.3, 0.12, 'sine', 140, 0.1);
});

/** A pass through a string: a smaller version of the big cut (snap, slice, short BRAAAM, boom). */
export const snip = (mine: boolean, double: boolean) => play(() => {
  duck(0.9);
  hiss(0, 0.035, 0.9, 'highpass', 2500, undefined, 1, 0.4);                 // snap
  hiss(0.015, 0.45, 0.42, 'bandpass', mine ? 1500 : 900, mine ? 10000 : 5000, 5, 0.6, 0.01); // blade slice
  braam(mine ? [55, 73.4] : [41.2, 55], 0.04, 1.1, mine ? 0.22 : 0.26);
  tone(mine ? 110 : 85, 0.03, 1, 0.9, 'sine', 30, 0.4);                     // boom
  taiko(0.03, 1, mine ? 60 : 48);
  crash(0.04, 0.22, 1.4);
  if (double) {
    hiss(0.16, 0.45, 0.42, 'bandpass', 1500, 10000, 5, 0.6, 0.01);
    braam([73.4, 110], 0.18, 1.1, 0.22); taiko(0.18, 1, 70); crash(0.18, 0.25, 1.6);
  }
});
/** Your string is down to its last notch: war-drum heartbeat + low horn */
export const danger = () => play(() => { taiko(0, 0.9, 55); taiko(0.2, 0.6, 55); brass([73.4, 77.8], 0, 0.9, 0.08, 1200); });

/** Distorted low brass cluster: the movie-trailer "BRAAAM". */
function braam(freqs: number[], at: number, dur: number, vol: number) {
  const c = ctx!, t = now() + at, shaper = c.createWaveShaper(), f = c.createBiquadFilter(), g = c.createGain();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 6); }
  shaper.curve = curve;
  f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.25); f.frequency.exponentialRampToValueAtTime(300, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  shaper.connect(f).connect(g); out(g, 0.6);
  for (const fr of freqs) for (const det of [-14, 0, 14]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
    o.connect(shaper); o.start(t); o.stop(t + dur + 0.05);
  }
}

/** Drop the music out for a moment so a big sound stands alone. */
function duck(secs: number) {
  if (!musicOn) return;
  const t = now();
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(0.02, t, 0.03);
  setTimeout(() => { if (musicOn && ctx) musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6); }, secs * 1000);
}

/** A string is cut! Snap, sword slice, BRAAAM, earth-shaking boom, gong, then triumph or doom. */
export const cut = (mine: boolean) => play(() => {
  duck(3);
  // SNAP: the string goes
  hiss(0, 0.04, 1, 'highpass', 2500, undefined, 1, 0.5);
  tone(2400, 0, 0.05, 0.4, 'square', 800, 0.3);
  // SHHHING: long blade slice
  hiss(0.02, 0.7, 0.5, 'bandpass', 1200, 11000, 5, 0.7, 0.01);
  clang(0.02, 0.16, mine ? 1320 : 990);
  // BRAAAM + sub boom
  braam(mine ? [36.7, 55, 73.4] : [34.6, 51.9, 69.3], 0.08, 2.6, 0.32);
  tone(130, 0.06, 2.2, 1, 'sine', 26, 0.4);
  taiko(0.06, 1, 45); taiko(0.1, 0.9, 60);
  gong(0.08, 0.45, mine ? 87 : 65, 5); crash(0.08, 0.45, 3.5);
  hiss(0.08, 2, 0.4, 'lowpass', 2000, 50, 1, 0.8);       // rumble of thunder
  pluck(mine ? 98 : 73, 0.1, 1, 0.998); pluck(mine ? 147 : 110, 0.14, 0.7, 0.998);
  if (mine) {
    roll(0.9, 0.8, 0.7);
    brass([...C, ...up(C)], 1.7, 0.3, 0.14, 5000); taiko(1.7, 1);
    brass([...Dm, ...up(Dm)], 2.05, 2, 0.16, 5000); taiko(2.05, 1); crash(2.05, 0.3, 2.5);
    choir([...up(Dm), ...up(Dm, 4)], 1.7, 3, 0.16);
    hiss(1.5, 3, 0.24, 'bandpass', 1400, 1100, 0.5, 0.6, 0.6);   // the crowd roars
  } else {
    braam([36.7, 43.7], 1.4, 2.4, 0.22);
    choir([146.8, 174.6, 207.7], 1.4, 2.8, 0.12, 'oh');
    gong(1.4, 0.3, 55, 5);
  }
});

/** Kite bounces off the grass: drum thump + boing */
export const bounce = () => play(() => { taiko(0, 0.7, 60); tone(160, 0.02, 0.4, 0.18, 'sine', 560, 0.3); });
/** Kites knock together: shield clash */
export const knock = () => play(() => { clang(0, 0.08, 420); taiko(0, 0.5, 110); });

/** Rammed out of the sky: a huge body-slam, a cartoon whistle down and a thud on the grass */
export const knockdown = () => play(() => {
  clang(0, 0.12, 260); taiko(0, 1, 50); crash(0, 0.18, 1);
  tone(1500, 0.05, 0.5, 0.08, 'sine', 300, 0.3);
  taiko(0.5, 0.9, 42); hiss(0.5, 0.25, 0.3, 'lowpass', 500, 150, 1, 0.3);
});

/** The flyer of a knocked-down kite having a tantrum: angry mumbling "grr-hmph" */
export const grumble = () => play(() => {
  const c = ctx!;
  for (let i = 0; i < 5; i++) {
    const t = now() + i * 0.16, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    const base = 150 + Math.random() * 60;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (i % 2 ? 0.7 : 1.3), t + 0.13);
    f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 400; f.Q.value = 3;
    env(g, t, 0.16, 0.01, 0.14);
    o.connect(f).connect(g); out(g, 0.2); o.start(t); o.stop(t + 0.2);
  }
});

/** A gust is coming: rising whistle. Then the gust itself: a big whoosh. */
export const gustWarn = () => play(() => { tone(600, 0, 1.2, 0.05, 'sine', 1800, 0.5, 0.3); hiss(0, 1.4, 0.12, 'bandpass', 500, 2500, 4, 0.4, 0.6); });
export const gust = () => play(() => { hiss(0, 1.8, 0.45, 'bandpass', 300, 1200, 1.2, 0.5, 0.25); taiko(0, 0.4, 55); });

/** A shield blocks a snip: big ringing shield clang */
export const block = () => play(() => { clang(0, 0.16, 330); clang(0.02, 0.1, 495); taiko(0, 0.6, 90); });

/** Power-ups */
export const pickup = (type: 'glass' | 'boost' | 'mend' | 'shield') => play(() => {
  if (type === 'shield') { clang(0, 0.08, 520); choir(up(Dm), 0, 1.1, 0.07, 'oh'); return; }
  if (type === 'glass') { [1318, 1568, 1976, 2637, 3136].forEach((f, i) => tone(f, i * 0.05, 0.9, 0.09, 'sine', undefined, 0.8)); choir(up(F), 0, 1.2, 0.07); }
  else if (type === 'boost') { hiss(0, 0.6, 0.35, 'bandpass', 250, 6000, 3, 0.3, 0.05); tone(150, 0, 0.55, 0.22, 'sawtooth', 1400, 0.3); taiko(0.5, 0.7, 80); }
  else { choir(F, 0, 1.4, 0.1); [523, 659, 784].forEach((f) => tone(f, 0, 1.2, 0.08, 'triangle', undefined, 0.7)); }
});

/** Someone fainting: wobbly "wooo" going down, then a thump and cartoon tweets */
export const faint = () => play(() => {
  const c = ctx!, t = now(), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(140, t + 1.4);
  lfo.frequency.value = 7; lg.gain.value = 40; lfo.connect(lg).connect(o.frequency);
  env(g, t, 0.2, 0.05, 1.5);
  o.connect(g); out(g, 0.5); o.start(t); lfo.start(t); o.stop(t + 1.6); lfo.stop(t + 1.6);
  taiko(1.45, 1, 45); hiss(1.45, 0.3, 0.3, 'lowpass', 600, 200, 1, 0.3);
  [2200, 2600, 2200, 2600].forEach((f, i) => tone(f, 1.8 + i * 0.16, 0.12, 0.05, 'sine', f * 1.3, 0.4));
});

/** Match won: triumphal march with choir, brass, drums and gong */
export const victory = () => play(() => {
  gong(0, 0.35, 98); crash(0, 0.3, 3);
  roll(0, 0.5, 0.7);
  brass([...Dm, ...up(Dm)], 0.5, 0.3, 0.13, 4500); taiko(0.5, 1);
  brass([...Bb, ...up(Bb)], 0.85, 0.3, 0.13, 4500); taiko(0.85, 0.8);
  brass([...C, ...up(C)], 1.2, 0.3, 0.13, 4500); taiko(1.2, 0.8);
  brass([...up(F, 1), ...up(F)], 1.55, 2.6, 0.15, 5000); taiko(1.55, 1); gong(1.55, 0.35, 87); crash(1.55, 0.35, 3);
  choir(up(F), 1.55, 3, 0.15);
});
/** Match lost: death-knell bell and a mournful choir */
export const defeat = () => play(() => {
  gong(0, 0.3, 65, 5); gong(1.4, 0.25, 65, 5); gong(2.8, 0.2, 65, 5);
  choir(Am, 0.2, 3.6, 0.12, 'oh');
  brass([55, 65.4, 82.4], 0.3, 3.2, 0.09, 900);
});
/** New opponent unlocked */
export const unlockChime = () => play(() => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 2 + i * 0.12, 1, 0.08, 'triangle', undefined, 0.8)); });

// ---------- gladiator battle music ----------
// 100 beats per minute, 16 steps per bar, 4 bars: Dm - Bb - C - A (dark, heroic).

const STEP = 60 / 100 / 4;
const PROG = [{ root: 73.42, ch: Dm }, { root: 58.27, ch: Bb }, { root: 65.41, ch: C }, { root: 55, ch: A }];
const DRUMS = [1, 0, 0, 0.55, 0, 0, 0.7, 0, 1, 0, 0, 0.55, 0, 0, 0.7, 0.45];
const RIFF = [1, 1, 1.5, 1, 1, 1, 1.5, 2];
let step = 0, nextT = 0;

function tick() {
  if (!ctx) return;
  if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05; // after a pause, don't rush to catch up
  while (nextT < ctx.currentTime + 0.12) {
    if (musicOn && musicLevel >= 0) { bus = musicBus; playStep(step, nextT - ctx.currentTime); bus = sfx; }
    nextT += STEP; step = (step + 1) % 64;
  }
}

function playStep(s: number, at: number) {
  const bar = Math.floor(s / 16), i = s % 16, P = PROG[bar], lvl = musicLevel;
  if (i === 0) {
    choir(up(P.ch), at, STEP * 16, lvl === 0 ? 0.05 : 0.07);
    tone(P.root, at, STEP * 16, 0.16, 'sine', undefined, 0.2, 0.2);
  }
  if (lvl === 0) { if (i === 0 || i === 8) taiko(at, 0.4, 70); return; }
  // War drums, with a fill at the end of the phrase
  if (bar === 3 && i >= 8) taiko(at, 0.35 + (i - 8) * 0.07, 85 + (i % 2) * 20);
  else if (DRUMS[i]) taiko(at, 0.6 * DRUMS[i], 70);
  // Driving low string riff
  if (i % 2 === 0) bowed(P.root * 2 * RIFF[i / 2], at, STEP * 1.5, i % 4 === 0 ? 0.09 : 0.06, lvl >= 2 ? 2200 : 1400);
  // Brass blasts
  if (i === 0 && (bar % 2 === 0 || lvl >= 2)) brass(up(P.ch, 1), at, STEP * 6, 0.07);
  if (bar === 3 && (i === 8 || i === 12)) brass(up(P.ch, 1), at, STEP * 3, 0.08);
  // Last notch: frantic high strings and hi-hats
  if (lvl >= 2) {
    if (i % 2 === 1) hiss(at, 0.05, 0.08, 'highpass', 8000, undefined, 1, 0.1);
    bowed(P.ch[i % 3] * 4, at, STEP * 0.9, 0.025, 3000);
  }
  if (bar === 0 && i === 0 && lvl >= 1) crash(at, 0.12, 1.5);
}
