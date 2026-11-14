/** Небольшой синтезатор на Web Audio. Никаких файлов — всё генерируется. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

export function audioReady(): boolean {
  return !!ctx;
}

/** Создать AudioContext — только по действию пользователя. */
export function initAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
}

export function isMuted(): boolean {
  return muted;
}

function noise(): AudioBuffer {
  if (!noiseBuf && ctx) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf!;
}

export interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  delay?: number;
  attack?: number;
}

export function tone(freq: number, dur: number, o: ToneOpts = {}): void {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
  const v = o.vol ?? 0.15;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function hiss(dur: number, o: { vol?: number; type?: BiquadFilterType; freq?: number; delay?: number } = {}): void {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise();
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'highpass';
  f.frequency.value = o.freq ?? 2000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Непрерывный голос (мотор, пищалка, гул), громкость и высота меняются плавно. */
export class Voice {
  private osc: OscillatorNode | null = null;
  private g: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor(private type: OscillatorType, private lowpass = 0) {}

  set(freq: number, vol: number): void {
    if (!ctx || !master) return;
    if (!this.osc) {
      if (vol <= 0.0005) return;
      this.osc = ctx.createOscillator();
      this.osc.type = this.type;
      this.g = ctx.createGain();
      this.g.gain.value = 0;
      let node: AudioNode = this.osc;
      if (this.lowpass) {
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = this.lowpass;
        node = node.connect(this.filter);
      }
      node.connect(this.g).connect(master);
      this.osc.start();
    }
    const t = ctx.currentTime;
    this.osc.frequency.setTargetAtTime(Math.max(20, freq), t, 0.05);
    this.g!.gain.setTargetAtTime(muted ? 0 : vol, t, 0.04);
  }

  stop(): void {
    if (this.osc && ctx) {
      this.g!.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      const o = this.osc;
      setTimeout(() => { try { o.stop(); } catch { /* уже */ } }, 200);
    }
    this.osc = null;
    this.g = null;
    this.filter = null;
  }
}

/** Непрерывный шум через фильтр (вода, воздух). */
export class NoiseVoice {
  private src: AudioBufferSourceNode | null = null;
  private g: GainNode | null = null;

  constructor(private type: BiquadFilterType, private freq: number) {}

  set(vol: number): void {
    if (!ctx || !master) return;
    if (!this.src) {
      if (vol <= 0.0005) return;
      this.src = ctx.createBufferSource();
      this.src.buffer = noise();
      this.src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = this.type;
      f.frequency.value = this.freq;
      this.g = ctx.createGain();
      this.g.gain.value = 0;
      this.src.connect(f).connect(this.g).connect(master);
      this.src.start();
    }
    this.g!.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.08);
  }

  stop(): void {
    if (this.src && ctx) {
      this.g!.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      const s = this.src;
      setTimeout(() => { try { s.stop(); } catch { /* уже */ } }, 300);
    }
    this.src = null;
    this.g = null;
  }
}
