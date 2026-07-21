// ============================================================================
// SoundFX — synthétiseur audio procédural (Web Audio API), aucun fichier audio.
// ============================================================================

class SoundFXClass {
  constructor() {
    this.actx = null;
    this.master = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.actx = new AC();
      this.master = this.actx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.actx.destination);
    }
    if (this.actx.state === 'suspended') this.actx.resume();
    return this.actx;
  }

  _tone(freq, dur, type = 'sine', peak = 0.3, t0 = 0, freqEnd = null) {
    const a = this.actx;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dur, peak, t0, filterFreq = 1200, type = 'bandpass') {
    const a = this.actx;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filt = a.createBiquadFilter();
    filt.type = type; filt.frequency.value = filterFreq;
    const g = a.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  play(name) {
    if (!this.enabled) return;
    try {
      const a = this.ensure();
      const t = a.currentTime;
      const S = this;
      const fx = {
        hit()        { S._tone(320, 0.09, 'square', 0.22, t, 150); S._noise(0.06, 0.18, t, 2200); },
        swing()      { S._noise(0.09, 0.16, t, 3200, 'highpass'); },
        crit()       { S._tone(520, 0.1, 'square', 0.25, t, 220); S._tone(760, 0.12, 'square', 0.2, t + 0.03); S._noise(0.06, 0.2, t, 3000); },
        hurt()       { S._tone(180, 0.18, 'sawtooth', 0.25, t, 60); },
        enemyhit()   { S._tone(220, 0.12, 'square', 0.2, t, 90); },
        death()      { S._tone(300, 0.35, 'sawtooth', 0.25, t, 40); },
        dodge()      { S._noise(0.18, 0.14, t, 900, 'lowpass'); S._tone(300, 0.14, 'sine', 0.1, t, 500); },
        till()       { S._noise(0.14, 0.22, t, 900, 'lowpass'); },
        water()      { for (let i = 0; i < 4; i++) S._tone(700 - i * 90, 0.09, 'sine', 0.12, t + i * 0.03, 400 - i * 40); },
        chop()       { S._noise(0.1, 0.25, t, 1500); S._tone(150, 0.08, 'square', 0.15, t); },
        mine()       { S._noise(0.09, 0.3, t, 2500); S._tone(90, 0.1, 'square', 0.2, t); },
        pickup()     { S._tone(520, 0.06, 'sine', 0.2, t, 780); S._tone(780, 0.08, 'sine', 0.15, t + 0.05); },
        coin()       { S._tone(880, 0.05, 'square', 0.18, t); S._tone(1320, 0.1, 'square', 0.14, t + 0.05); },
        eat()        { S._noise(0.12, 0.15, t, 600, 'lowpass'); },
        sleep()      { S._tone(440, 0.2, 'sine', 0.15, t, 220); S._tone(220, 0.3, 'sine', 0.12, t + 0.15, 110); },
        craft()      { S._tone(400, 0.07, 'square', 0.18, t); S._tone(600, 0.07, 'square', 0.16, t + 0.07); S._tone(800, 0.09, 'square', 0.14, t + 0.14); },
        place()      { S._tone(300, 0.1, 'square', 0.2, t, 500); },
        buy()        { S._tone(660, 0.08, 'sine', 0.2, t, 880); },
        sell()       { S._tone(500, 0.08, 'sine', 0.2, t, 300); },
        questdone()  { S._tone(523, 0.1, 'square', 0.2, t); S._tone(659, 0.1, 'square', 0.18, t + 0.1); S._tone(783, 0.18, 'square', 0.2, t + 0.2); },
        levelup()    { [400, 500, 650, 880].forEach((f, i) => S._tone(f, 0.12, 'square', 0.2, t + i * 0.1)); },
        chicken()    { S._tone(900, 0.06, 'square', 0.1, t, 1200); S._tone(700, 0.05, 'square', 0.08, t + 0.08); },
        cow()        { S._tone(140, 0.35, 'sawtooth', 0.15, t, 90); },
        stairs()     { S._tone(200, 0.15, 'sine', 0.15, t, 400); S._tone(400, 0.15, 'sine', 0.12, t + 0.1, 600); },
        boss_roar()  { S._tone(90, 0.7, 'sawtooth', 0.35, t, 45); S._noise(0.6, 0.25, t, 400, 'lowpass'); },
        boss_hit()   { S._tone(70, 0.3, 'square', 0.3, t, 40); S._noise(0.2, 0.3, t, 900); },
        shockwave()  { S._noise(0.4, 0.3, t, 300, 'lowpass'); S._tone(80, 0.4, 'sine', 0.25, t, 30); },
        burrow()     { S._noise(0.5, 0.2, t, 250, 'lowpass'); },
        rain()       { S._noise(0.5, 0.06, t, 1400); },
        thunder()    { S._noise(0.7, 0.3, t, 200, 'lowpass'); S._tone(60, 0.7, 'sine', 0.25, t, 30); },
        ui()         { S._tone(500, 0.05, 'square', 0.1, t); },
      };
      if (fx[name]) fx[name]();
    } catch (e) { /* audio non disponible : silencieux */ }
  }
}

export const SoundFX = new SoundFXClass();
