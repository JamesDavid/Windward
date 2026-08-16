// ================================================================
// AUDIO (§32) — everything synthesised at runtime with WebAudio.
// Zero bytes of assets, zero requests, fully parameterised feedback.
// ================================================================

const Audio2 = { ctx: null, master: null, windGain: null, ready: false };

function audioInit() {
  if (Audio2.ready) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    Audio2.ctx = ctx;
    Audio2.master = ctx.createGain();
    Audio2.master.gain.value = 0.5;
    Audio2.master.connect(ctx.destination);

    // ambient wind: filtered noise, slowly breathing
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.02;   // brownish noise
      data[i] = v * 8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 420;
    filt.Q.value = 0.6;
    Audio2.windGain = ctx.createGain();
    Audio2.windGain.gain.value = 0.12;
    src.connect(filt).connect(Audio2.windGain).connect(Audio2.master);
    src.start();

    // wind LFO breathing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(Audio2.windGain.gain);
    lfo.start();

    Audio2.ready = true;
  } catch (e) { /* audio stays silent if the context is refused */ }
}

function tone(freq, dur, type, gain, when, slideTo) {
  if (!Audio2.ready) return;
  const ctx = Audio2.ctx;
  const t0 = ctx.currentTime + (when || 0);
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain || 0.2, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(Audio2.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, gain, freq, when) {
  if (!Audio2.ready) return;
  const ctx = Audio2.ctx;
  const t0 = ctx.currentTime + (when || 0);
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq || 900;
  const g = ctx.createGain();
  g.gain.value = gain || 0.3;
  src.connect(filt).connect(g).connect(Audio2.master);
  src.start(t0);
}

function audioPlay(name) {
  if (!Audio2.ready) return;
  switch (name) {
    case 'thunk':       // construction
      noiseBurst(0.09, 0.25, 700);
      tone(120, 0.12, 'sine', 0.25);
      break;
    case 'activate':    // route activation
      tone(523, 0.1, 'sine', 0.14);
      tone(659, 0.12, 'sine', 0.14, 0.07);
      break;
    case 'warn':
      tone(660, 0.09, 'square', 0.08);
      tone(660, 0.09, 'square', 0.08, 0.16);
      break;
    case 'sever':
      tone(520, 0.5, 'sawtooth', 0.12, 0, 130);
      break;
    case 'boom':
      noiseBurst(0.5, 0.5, 400);
      tone(70, 0.5, 'sine', 0.4, 0, 40);
      break;
    case 'chord':       // reconnection
      tone(392, 0.5, 'sine', 0.14);
      tone(494, 0.5, 'sine', 0.12, 0.03);
      tone(587, 0.7, 'sine', 0.12, 0.06);
      break;
    case 'capture':
      tone(392, 0.16, 'triangle', 0.18);
      tone(523, 0.16, 'triangle', 0.18, 0.12);
      tone(659, 0.3, 'triangle', 0.18, 0.24);
      break;
    case 'shotA':       // ballast jar away: deep plop + whistle down
      tone(220, 0.08, 'triangle', 0.07, 0, 90);
      noiseBurst(0.05, 0.06, 1200);
      break;
    case 'shotP':       // siphon jet: watery hiss upward
      noiseBurst(0.12, 0.08, 2400);
      tone(140, 0.1, 'sine', 0.05, 0, 260);
      break;
    case 'impact':
      noiseBurst(0.06, 0.1, 800);
      break;
    case 'ching':       // ore banked at the temple
      tone(1318, 0.08, 'triangle', 0.1);
      tone(1760, 0.16, 'triangle', 0.09, 0.05);
      tone(2637, 0.1, 'sine', 0.05, 0.09);
      break;
    case 'telegraph':   // rising water horn
      tone(98, 1.1, 'sawtooth', 0.14, 0, 147);
      noiseBurst(0.9, 0.12, 300, 0.1);
      break;
    case 'chant':       // consecration
      tone(196, 0.9, 'triangle', 0.1);
      tone(294, 0.9, 'triangle', 0.08, 0.05);
      break;
    case 'victory':
      [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, i * 0.16));
      break;
    case 'defeat':
      [330, 262, 196, 131].forEach((f, i) => tone(f, 0.6, 'sine', 0.2, i * 0.22));
      break;
  }
}

function wireAudio() {
  // combat noise, throttled so massed fire hisses rather than roars
  let lastShot = 0;
  const shot = (name) => {
    if (!Audio2.ready || !Audio2.ctx) return;
    const now = Audio2.ctx.currentTime;
    if (now - lastShot < 0.09) return;
    lastShot = now;
    audioPlay(name);
  };
  Events.on('gunFired', ({ side }) => shot(side === 'A' ? 'shotA' : 'shotP'));
  Events.on('craftFired', () => shot('shotP'));
  Events.on('piecePlaced', ({ side }) => { if (side === 'A') { audioPlay('thunk'); audioPlay('activate'); } });
  Events.on('delivery', ({ side }) => { if (side === 'A') audioPlay('ching'); });
  Events.on('structureBuilt', ({ st }) => { if (st.owner === 'A') audioPlay('thunk'); });
  Events.on('networkSevered', ({ side }) => { if (side === 'A') { audioPlay('sever'); audioPlay('warn'); } });
  Events.on('networkRestored', ({ side }) => { if (side === 'A') audioPlay('chord'); });
  Events.on('structureDestroyed', () => audioPlay('boom'));
  Events.on('structureExploded', () => audioPlay('boom'));
  Events.on('islandClaimed', () => audioPlay('capture'));
  Events.on('consecrationStarted', () => audioPlay('chant'));
  Events.on('tidalSurge', () => { noiseBurst(1.2, 0.5, 250); });
  Events.on('greatTempleHit', () => audioPlay('warn'));
}
