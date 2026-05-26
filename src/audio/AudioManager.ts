export class AudioManager {
  private ctx: AudioContext | null = null;
  private volume = 0.7;
  private initialized = false;

  init(volume: number): void {
    this.volume = volume;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    this.initialized = true;
  }

  setVolume(v: number): void {
    this.volume = v;
    localStorage.setItem('boxe-fp-volume', String(v));
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  playImpact(): void {
    this.playTone(120, 0.08, 'square', 0.35);
    this.playNoise(0.06, 400);
  }

  playBlock(): void {
    this.playTone(280, 0.05, 'sine', 0.25);
  }

  playWhoosh(): void {
    this.playNoise(0.04, 200, 0.15);
  }

  playBell(): void {
    this.playTone(880, 0.5, 'sine', 0.4);
    setTimeout(() => this.playTone(660, 0.4, 'sine', 0.3), 120);
  }

  playKnockdown(): void {
    this.playTone(60, 0.3, 'sawtooth', 0.3);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain * this.volume;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playNoise(duration: number, filterFreq: number, gain = 0.2): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain * this.volume;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }
}
