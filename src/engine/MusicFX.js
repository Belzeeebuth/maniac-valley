// ============================================================================
// MusicFX — musique d'ambiance générative (Web Audio API), sans fichier audio.
// Séquenceur pas-à-pas avec lookahead : arpèges + basse + nappe, l'ambiance
// change selon la scène (ferme paisible / mine tendue / combat de boss).
// ============================================================================

const SCENES = {
  farm: { bpm: 96,  scale: [0, 2, 4, 7, 9, 12, 14], base: 261.63, wave: 'triangle', density: 0.6, bass: 'sine',     bassEvery: 8, padEvery: 16, vol: 0.10 },
  mine: { bpm: 78,  scale: [0, 3, 5, 7, 10, 12],    base: 174.61, wave: 'sine',     density: 0.4, bass: 'sine',     bassEvery: 8, padEvery: 16, vol: 0.09 },
  boss: { bpm: 148, scale: [0, 3, 5, 6, 7, 10, 12], base: 196.00, wave: 'sawtooth', density: 0.85, bass: 'square',  bassEvery: 4, padEvery: 8,  vol: 0.11 },
};

export class MusicFX {
  constructor() {
    this.actx = null; this.master = null; this.filter = null;
    this.enabled = true; this.playing = false;
    this.scene = 'farm';
    this.step = 0; this.nextTime = 0; this.timer = null;
    this.lookahead = 0.1; this.tick = 25;
  }

  _ensure() {
    if (this.actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.actx = new AC();
    this.filter = this.actx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 2600; this.filter.Q.value = 0.5;
    this.master = this.actx.createGain(); this.master.gain.value = SCENES[this.scene].vol;
    this.filter.connect(this.master); this.master.connect(this.actx.destination);
  }

  start() {
    try {
      this._ensure();
      if (this.actx.state === 'suspended') this.actx.resume();
      if (this.playing) return;
      this.playing = true;
      this.nextTime = this.actx.currentTime + 0.1;
      this.timer = setInterval(() => this._scheduler(), this.tick);
    } catch (e) { /* audio indisponible */ }
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) { if (this.master) this.master.gain.value = 0; }
    else if (this.master) this.master.gain.value = SCENES[this.scene].vol;
    return this.enabled;
  }

  setScene(name) {
    if (!SCENES[name] || name === this.scene) return;
    this.scene = name; this.step = 0;
    if (this.master && this.enabled) {
      const now = this.actx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(SCENES[name].vol, now + 0.6);
    }
  }

  _freq(scaleDeg, octave = 0) {
    const cfg = SCENES[this.scene];
    const semi = cfg.scale[((scaleDeg % cfg.scale.length) + cfg.scale.length) % cfg.scale.length] + octave * 12;
    return cfg.base * Math.pow(2, semi / 12);
  }

  _voice(freq, t, dur, type, peak) {
    const a = this.actx;
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.filter);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _scheduleStep(step, t) {
    const cfg = SCENES[this.scene];
    // arpège
    if (Math.random() < cfg.density) {
      const deg = [0, 2, 4, 2, 0, 4, 6, 4][step % 8] + (Math.random() < 0.25 ? 7 : 0);
      this._voice(this._freq(deg, 1), t, 0.28, cfg.wave, 0.22);
    }
    // basse
    if (step % cfg.bassEvery === 0) {
      const root = [0, 4, 5, 3][(step / cfg.bassEvery | 0) % 4];
      this._voice(this._freq(root, -1), t, 0.5, cfg.bass, 0.28);
    }
    // nappe (accord doux)
    if (step % cfg.padEvery === 0) {
      const root = [0, 5][(step / cfg.padEvery | 0) % 2];
      this._voice(this._freq(root, 0), t, 1.2, 'sine', 0.10);
      this._voice(this._freq(root + 2, 0), t, 1.2, 'sine', 0.08);
    }
    // percussion douce sur le contretemps (boss)
    if (this.scene === 'boss' && step % 2 === 1) this._voice(60, t, 0.08, 'square', 0.12);
  }

  _scheduler() {
    if (!this.playing) return;
    const cfg = SCENES[this.scene];
    const stepDur = 60 / cfg.bpm / 2; // croches
    while (this.nextTime < this.actx.currentTime + this.lookahead) {
      this._scheduleStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }
}
