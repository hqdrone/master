import { hiss, tone, Voice } from './synth';

/** Все звуки игры в одном месте. */
export const sfx = {
  place: () => { tone(900, 0.05, { vol: 0.12 }); tone(1400, 0.03, { vol: 0.06, delay: 0.02 }); },
  remove: () => tone(220, 0.1, { type: 'triangle', vol: 0.25, slideTo: 90 }),
  wire: () => tone(2200, 0.015, { vol: 0.04 }),
  click: () => { tone(1600, 0.02, { vol: 0.1 }); tone(700, 0.03, { vol: 0.08, delay: 0.02 }); },
  ding: () => { tone(1320, 0.5, { type: 'sine', vol: 0.12 }); tone(1980, 0.3, { type: 'sine', vol: 0.04 }); },
  short: () => { hiss(1.4, { vol: 0.18, freq: 1500 }); tone(70, 0.6, { type: 'sawtooth', vol: 0.12 }); },
  step: () => { tone(880, 0.1, { type: 'triangle', vol: 0.15 }); tone(1175, 0.15, { type: 'triangle', vol: 0.15, delay: 0.09 }); },
  error: () => tone(160, 0.15, { vol: 0.1, slideTo: 120 }),
  power: () => { tone(220, 0.35, { type: 'sawtooth', vol: 0.08, slideTo: 880 }); },
  win: () => {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.4 : 0.14, { type: 'square', vol: 0.1, delay: i * 0.12 }));
  },
  rotate: () => tone(600, 0.04, { vol: 0.08, slideTo: 800 }),
};

/** Непрерывные звуки поля. */
export class Ambience {
  motor = new Voice('sawtooth', 500);
  buzzer = new Voice('square', 2500);
  hum = new Voice('sine');

  update(motorSpeed: number, buzzer: number, lamps: number): void {
    this.motor.set(50 + 120 * motorSpeed, motorSpeed > 0.05 ? 0.05 + 0.04 * Math.min(1, motorSpeed) : 0);
    this.buzzer.set(740, buzzer > 0.2 ? 0.035 * Math.min(1, buzzer) : 0);
    this.hum.set(100, Math.min(0.02, lamps * 0.006));
  }

  stop(): void {
    this.motor.stop();
    this.buzzer.stop();
    this.hum.stop();
  }
}
