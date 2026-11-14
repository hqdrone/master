import { PAL } from './colors';
import type { Ctx } from './px';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; col: number; size: number; grow: number }

export class Particles {
  list: P[] = [];

  smoke(x: number, y: number): void {
    this.list.push({ x: x + Math.random() * 6 - 3, y, vx: Math.random() * 6 - 3, vy: -10 - Math.random() * 8,
      life: 0, max: 1.2 + Math.random() * 0.6, col: Math.random() < 0.5 ? 6 : 5, size: 2, grow: 2 });
  }

  spark(x: number, y: number, col = 10): void {
    const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 30;
    this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0, max: 0.3 + Math.random() * 0.3, col, size: 1, grow: 0 });
  }

  burst(x: number, y: number, col: number, n = 10): void {
    for (let i = 0; i < n; i++) this.spark(x, y, col);
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow === 0) p.vy += 60 * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }

  draw(c: Ctx): void {
    for (const p of this.list) {
      const k = p.life / p.max;
      c.globalAlpha = 1 - k;
      c.fillStyle = PAL[p.col];
      const s = Math.round(p.size + p.grow * k);
      c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    c.globalAlpha = 1;
  }
}
