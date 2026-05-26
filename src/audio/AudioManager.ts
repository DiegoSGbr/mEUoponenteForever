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
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const t0 = ctx.currentTime;

    // Punch de boxe: "thump" no grave + "crack" no agudo (ruido filtrado).
    const thumpFreq = 95 + Math.random() * 20;
    const thumpDur = 0.07 + Math.random() * 0.02;
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(thumpFreq, t0);
    thump.frequency.exponentialRampToValueAtTime(
      Math.max(35, thumpFreq * 0.55),
      t0 + thumpDur,
    );
    thumpGain.gain.setValueAtTime(0.001, t0);
    thumpGain.gain.exponentialRampToValueAtTime(
      0.55 * this.volume,
      t0 + 0.008,
    );
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t0 + thumpDur);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(t0);
    thump.stop(t0 + thumpDur + 0.01);

    // Agudo: transiente curto e metálico.
    const crackDur = 0.035 + Math.random() * 0.015;
    this.playNoise(crackDur, 1400 + Math.random() * 900, 0.22 + Math.random() * 0.05);

    // Corpo extra: ruído levemente mais grave para dar "massa" ao golpe.
    this.playNoise(0.05 + Math.random() * 0.02, 320 + Math.random() * 170, 0.12);
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

  playStartBell(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const t0 = ctx.currentTime;

    // Sino mais "metálico": múltiplas parciais + um toque de ruído filtrado.
    const partials = [
      { f: 980, a: 0.55 },
      { f: 1240, a: 0.38 },
      { f: 1480, a: 0.22 },
    ];

    for (let i = 0; i < partials.length; i++) {
      const { f, a } = partials[i];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * (0.985 + Math.random() * 0.03), t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(a * 0.65 * this.volume, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.7);
    }

    // Ruído "ping" rápido.
    const noiseDur = 0.12;
    this.playNoise(noiseDur, 1800 + Math.random() * 1200, 0.18);
    // Cauda complementar.
    setTimeout(() => this.playTone(740, 0.35, 'sine', 0.22), 90);
  }

  playKnockdown(): void {
    this.playTone(60, 0.3, 'sawtooth', 0.3);
  }

  playCrowdCheer(durationMs = 3200): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const t0 = ctx.currentTime;
    const duration = durationMs / 1000;

    // Ruído contínuo modulando (voz/ambiente de torcida).
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520 + Math.random() * 60;
    band.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12 * this.volume, t0 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    // LFO pra pulsar o "delírio".
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 9 + Math.random() * 2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.28;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(band);
    band.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.05);

    // Aplausos: “claps” rápidos aleatórios.
    const clapCount = Math.floor(22 + Math.random() * 10);
    const clapDur = 0.035;
    const baseTime = t0 + 0.05;
    for (let i = 0; i < clapCount; i++) {
      const at = baseTime + (i / clapCount) * duration + (Math.random() - 0.5) * 0.09;
      const clampedAt = Math.max(t0, at);
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * clapDur), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;

      const s = ctx.createBufferSource();
      s.buffer = noise;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400 + Math.random() * 900;
      bp.Q.value = 1.2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, clampedAt);
      g.gain.exponentialRampToValueAtTime(
        (0.16 + Math.random() * 0.08) * this.volume,
        clampedAt + 0.004,
      );
      g.gain.exponentialRampToValueAtTime(0.001, clampedAt + clapDur);

      s.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      s.start(clampedAt);
      s.stop(clampedAt + clapDur + 0.01);
    }
  }

  playCrowdBoo(durationMs = 3000): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.initialized) return;

    const t0 = ctx.currentTime;
    const duration = durationMs / 1000;

    // Vaias: ruído grave/baixo modulando e alguns “bursts”.
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 260 + Math.random() * 40;
    band.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.11 * this.volume, t0 + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 2.5 + Math.random() * 1.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(band);
    band.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.05);

    const burstCount = Math.floor(10 + Math.random() * 8);
    const burstDur = 0.11;
    for (let i = 0; i < burstCount; i++) {
      const at = t0 + (i / burstCount) * duration + Math.random() * 0.35;
      const clampedAt = Math.min(t0 + duration, Math.max(t0, at));
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * burstDur), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;

      const s = ctx.createBufferSource();
      s.buffer = noise;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 420 + Math.random() * 180;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, clampedAt);
      g.gain.exponentialRampToValueAtTime(
        (0.14 + Math.random() * 0.07) * this.volume,
        clampedAt + 0.01,
      );
      g.gain.exponentialRampToValueAtTime(0.001, clampedAt + burstDur);

      s.connect(hp);
      hp.connect(g);
      g.connect(ctx.destination);
      s.start(clampedAt);
      s.stop(clampedAt + burstDur + 0.02);
    }
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
