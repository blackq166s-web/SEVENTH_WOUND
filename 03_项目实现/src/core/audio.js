// 纯合成音效（无外部资源），首次用户交互后初始化
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.volume = 0.55;
    this.voices = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 0.8);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  _ok() {
    if (!this.ctx || this.muted) return false;
    if (this.voices > 28) return false;
    this.voices++;
    setTimeout(() => { this.voices--; }, 120);
    return true;
  }

  tone(f0, f1, dur, type = 'square', gain = 0.18, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur = 0.14, gain = 0.25, f0 = 2200, f1 = 300, type = 'lowpass', delay = 0) {
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  shoot(kind = 'pistol') {
    if (!this._ok()) return;
    switch (kind) {
      case 'pistol': this.tone(340, 110, 0.09, 'square', 0.14); this.noise(0.06, 0.12, 3000, 800); break;
      case 'rifle': this.tone(430, 150, 0.07, 'square', 0.13); this.noise(0.05, 0.11, 3200, 900); break;
      case 'smg': this.tone(520, 220, 0.05, 'square', 0.09); this.noise(0.04, 0.08, 3600, 1200); break;
      case 'shotgun':
        this.noise(0.22, 0.36, 1600, 140);
        this.tone(180, 55, 0.16, 'triangle', 0.16);
        break;
      case 'flame': this.noise(0.16, 0.13, 900, 320, 'bandpass'); break;
      case 'plasma': this.tone(880, 260, 0.13, 'sawtooth', 0.11); this.noise(0.09, 0.08, 2600, 600, 'bandpass'); break;
      case 'gauss': this.tone(1700, 90, 0.22, 'sawtooth', 0.13); this.noise(0.2, 0.14, 5000, 400, 'highpass'); break;
      case 'rocket': this.noise(0.32, 0.26, 900, 180); this.tone(150, 45, 0.3, 'triangle', 0.14); break;
      case 'minigun': this.tone(300, 130, 0.045, 'square', 0.1); this.noise(0.04, 0.1, 2800, 800); break;
      default: this.tone(400, 120, 0.08, 'square', 0.12);
    }
  }

  explosion(power = 1) {
    if (!this._ok()) return;
    this.noise(0.45 * power, 0.36 * power, 1200, 60);
    this.tone(110, 28, 0.4 * power, 'sine', 0.3 * power);
  }

  hit() {
    if (!this._ok()) return;
    this.noise(0.045, 0.1, 4200, 1800, 'highpass');
  }

  hurt() {
    if (!this._ok()) return;
    this.tone(230, 62, 0.28, 'sawtooth', 0.2);
    this.noise(0.2, 0.14, 700, 120);
  }

  pickup() {
    if (!this._ok()) return;
    this.tone(680, 700, 0.05, 'sine', 0.14);
    this.tone(1020, 1040, 0.07, 'sine', 0.1, 0.045);
  }

  levelup() {
    if (!this._ok()) return;
    this.tone(520, 520, 0.1, 'triangle', 0.16);
    this.tone(660, 660, 0.1, 'triangle', 0.16, 0.09);
    this.tone(880, 880, 0.18, 'triangle', 0.16, 0.18);
  }

  empty() {
    if (!this._ok()) return;
    this.tone(1400, 900, 0.035, 'square', 0.07);
  }

  reload() {
    if (!this._ok()) return;
    this.noise(0.05, 0.1, 2000, 700);
    this.tone(600, 400, 0.05, 'square', 0.06, 0.08);
  }

  click() {
    if (!this._ok()) return;
    this.tone(900, 500, 0.045, 'square', 0.09);
  }

  die() {
    if (!this._ok()) return;
    this.tone(300, 40, 0.9, 'sawtooth', 0.22);
    this.noise(0.9, 0.2, 900, 60);
  }

  wave() {
    if (!this._ok()) return;
    this.tone(220, 300, 0.16, 'triangle', 0.13);
    this.tone(330, 440, 0.2, 'triangle', 0.11, 0.14);
  }

  // 守层者登场：把采样率压到 8kHz 做失真，制造"庞然大物"的压迫感（STORY §10）
  bossIntro() {
    if (!this._ok()) return;
    if (!this._lowBuf) {
      const rate = 8000;
      const len = Math.floor(rate * 1.2);
      const buf = this.ctx.createBuffer(1, len, rate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // 一阶低通的白噪声 → 闷响，再靠浏览器重采样出颗粒感
        last = last * 0.93 + (Math.random() * 2 - 1) * 0.07;
        d[i] = Math.max(-1, Math.min(1, last * 5));
      }
      this._lowBuf = buf;
    }
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this._lowBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 1.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 1.2);
    this.tone(58, 26, 1.2, 'sine', 0.26);
  }
}
