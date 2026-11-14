import type { Board, Part } from '../core/board';
import { connectionMask, offersKinds } from '../core/connect';
import { DIRS, DX, DY, opp } from '../core/geom';
import { getPart } from '../core/parts';
import type { ElectricResult } from '../sim/electric';
import type { MechResult } from '../sim/mechanic';
import type { FluidResult } from '../sim/fluid';
import type { Link } from '../sim/electric';
import { BOARD_BG, BOARD_DOT, C, PAL } from './colors';
import { Particles } from './particles';
import { line, rect, type Ctx } from './px';
import { drawPart } from './sprites';

export const TILE = 16;

export interface Ghost { type: string; x: number; y: number; rot: number }

export interface Scene {
  board: Board;
  sim: ElectricResult | null;
  mech: MechResult | null;
  water: FluidResult | null;
  t: number;
  dt: number;
  angles: Map<number, number>;
  /** призраки шага инструкции */
  ghosts: Ghost[];
  /** предпросмотр под курсором */
  preview: (Ghost & { ok: boolean }) | null;
  selected: number | null;
  /** подсветить клетки (например, выбранная, где нужно повернуть) */
}

export class Renderer {
  readonly low: HTMLCanvasElement;
  private lc: Ctx;
  private vc: Ctx;
  scale = 3;
  particles = new Particles();
  private phases = new Map<string, number>();

  constructor(public view: HTMLCanvasElement) {
    this.low = document.createElement('canvas');
    this.lc = this.low.getContext('2d')!;
    this.vc = view.getContext('2d')!;
  }

  /** Подобрать масштаб: целое число ФИЗИЧЕСКИХ пикселей на пиксель арта —
   *  чётко и на телефонах с плотным экраном, и на обычных мониторах. */
  fit(w: number, h: number, availW: number, availH: number): void {
    const lw = w * TILE, lh = h * TILE;
    this.low.width = lw; this.low.height = lh;
    const dpr = window.devicePixelRatio || 1;
    const fitK = Math.min((availW * dpr) / lw, (availH * dpr) / lh);
    let k = Math.max(1, Math.floor(fitK));
    // на маленьком экране целый масштаб может «съесть» до трети места — тогда
    // берём дробный (пиксели чуть неровные, зато поле крупнее)
    if (fitK / k > 1.12) k = Math.floor(fitK * 4) / 4;
    this.scale = k / dpr;
    this.view.width = Math.round(lw * k); this.view.height = Math.round(lh * k);
    this.view.style.width = `${this.view.width / dpr}px`;
    this.view.style.height = `${this.view.height / dpr}px`;
  }

  cellAt(clientX: number, clientY: number, w: number, h: number): { x: number; y: number } | null {
    const r = this.view.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * w);
    const y = Math.floor(((clientY - r.top) / r.height) * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    return { x, y };
  }

  draw(s: Scene): void {
    const c = this.lc;
    const { board } = s;
    c.imageSmoothingEnabled = false;
    rect(c, 0, 0, this.low.width, this.low.height, BOARD_BG);
    for (let y = 0; y < board.h; y++)
      for (let x = 0; x < board.w; x++) rect(c, x * TILE, y * TILE, 1, 1, BOARD_DOT);

    // призраки шага
    const ghostCells = new Set(s.ghosts.map((g) => `${g.x},${g.y}`));
    const pulse = 0.35 + 0.25 * Math.sin(s.t * 5);
    for (const g of s.ghosts) {
      c.globalAlpha = pulse;
      let m = 0;
      const kind = getPart(g.type).autotile;
      if (kind) {
        for (const d of DIRS) {
          const nx = g.x + DX[d], ny = g.y + DY[d];
          const q = board.at(nx, ny);
          if (ghostCells.has(`${nx},${ny}`) || (q && offersKinds(q, opp(d)).includes(kind))) m |= 1 << d;
        }
      }
      drawPart(c, g.type, g.x * TILE, g.y * TILE, g.rot, { t: s.t, mask: m });
      c.globalAlpha = 1;
      this.brackets(c, g.x, g.y, Math.floor(s.t * 4) % 2 ? C.yellow : C.white);
    }

    // детали
    for (const p of board.parts) this.drawOne(c, p, s);

    // ток
    if (s.sim) this.drawFlow(c, s, s.sim.links, 0.28, 1.5, 'e');
    if (s.water) this.drawFlow(c, s, s.water.links, 0.5, Infinity, 'w');

    // свечение
    c.globalCompositeOperation = 'lighter';
    if (s.sim) {
      for (const p of board.parts) {
        const lv = Math.abs(s.sim.level.get(p.id) ?? 0);
        const out = getPart(p.type).output;
        const cx = p.x * TILE + 8, cy = p.y * TILE + 8;
        if (out === 'light' && lv > 0.02) this.glow(c, cx, cy, 6 + 16 * lv, `rgba(255,236,39,${0.55 * lv})`);
        if (out === 'led' && lv > 0.2) this.glow(c, cx, cy, 10, `rgba(255,0,77,${0.6 * lv})`);
        if (s.sim.shorted.has(p.id)) this.glow(c, cx, cy, 14 + 4 * Math.sin(s.t * 20), 'rgba(255,0,77,0.5)');
      }
    }
    c.globalCompositeOperation = 'source-over';

    // волны звука у пищалки
    if (s.sim) {
      for (const p of board.parts) {
        if (getPart(p.type).output !== 'sound') continue;
        const lv = s.sim.level.get(p.id) ?? 0;
        if (lv < 0.2) continue;
        const ph = (s.t * 3) % 1;
        this.arc(c, p.x * TILE + 8, p.y * TILE + 8, 8 + ph * 8, 1 - ph);
      }
    }

    // выделение и предпросмотр
    if (s.selected != null) {
      const p = board.get(s.selected);
      if (p) this.brackets(c, p.x, p.y, Math.floor(s.t * 3) % 2 ? C.white : C.blue);
    }
    if (s.preview) {
      const g = s.preview;
      c.globalAlpha = 0.6;
      drawPart(c, g.type, g.x * TILE, g.y * TILE, g.rot, { t: s.t, mask: 0 });
      c.globalAlpha = 1;
      if (!g.ok) {
        line(c, g.x * TILE + 3, g.y * TILE + 3, g.x * TILE + 12, g.y * TILE + 12, C.red, 2);
        line(c, g.x * TILE + 12, g.y * TILE + 3, g.x * TILE + 3, g.y * TILE + 12, C.red, 2);
      }
    }

    this.particles.update(s.dt);
    this.particles.draw(c);

    // на экран — целым масштабом без сглаживания
    const v = this.vc;
    v.imageSmoothingEnabled = false;
    v.clearRect(0, 0, this.view.width, this.view.height);
    v.drawImage(this.low, 0, 0, this.view.width, this.view.height);
  }

  private drawOne(c: Ctx, p: Part, s: Scene): void {
    const def = getPart(p.type);
    const sim = s.sim;
    const lv = sim?.level.get(p.id) ?? 0;
    drawPart(c, p.type, p.x * TILE, p.y * TILE, p.rot, {
      t: s.t,
      on: p.on,
      pressed: p.pressed,
      angle: s.angles.get(p.id) ?? 0,
      mask: def.autotile ? connectionMask(s.board, p.x, p.y) : 0,
      short: sim?.shorted.has(p.id),
      jam: s.mech?.jammed.has(p.id),
      wet: s.water?.wet.has(p.id),
      fill: p.level,
      level: Math.abs(lv) || Math.abs(s.water?.flow.get(p.id) ?? 0) / 0.5,
      gx: p.x * TILE,
    });
    if (p.locked && !def.autotile) {
      rect(c, p.x * TILE + 1, p.y * TILE + 1, 2, 2, C.dgray);
    }
  }

  /** Бегущие точки по проводам/трубам: скорость = сила потока. */
  private drawFlow(c: Ctx, s: Scene, links: Link[], nominal: number, danger: number, tag: string): void {
    const { board } = s;
    const isTile = (x: number, y: number) => {
      const q = board.at(x, y);
      return !!q && !!getPart(q.type).autotile;
    };
    const water = tag === 'w';
    for (const l of links) {
      const ai = Math.abs(l.i);
      if (ai < 0.004) continue;
      const key = `${tag}${l.ax},${l.ay},${l.bx},${l.by}`;
      const speed = Math.min(90, 10 + 45 * (ai / nominal));
      const ph = ((this.phases.get(key) ?? 0) + Math.sign(l.i) * speed * s.dt + 1600) % 16;
      this.phases.set(key, ph);
      const ax = l.ax * TILE + 7, ay = l.ay * TILE + 7;
      const dx = (l.bx - l.ax), dy = (l.by - l.ay);
      const aw = isTile(l.ax, l.ay), bw = isTile(l.bx, l.by);
      c.fillStyle = water ? PAL[C.white] : ai > danger ? PAL[C.red] : PAL[C.yellow];
      for (let k = 0; k < 4; k++) {
        const d = (ph + k * 4) % 16;
        const inA = d < 8;
        if (inA && !aw && d < 4) continue; // внутри детали — только на выводе
        if (!inA && !bw && d > 12) continue;
        if (water && k % 2) continue; // капли реже
        c.fillRect(Math.round(ax + dx * d), Math.round(ay + dy * d), 2, 2);
      }
    }
  }

  private glow(c: Ctx, x: number, y: number, r: number, col: string): void {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private arc(c: Ctx, x: number, y: number, r: number, alpha: number): void {
    c.globalAlpha = Math.max(0, alpha);
    c.fillStyle = PAL[C.yellow];
    for (let a = -2.4; a <= -0.7; a += 0.12) {
      c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
    c.globalAlpha = 1;
  }

  private brackets(c: Ctx, cx: number, cy: number, col: number): void {
    const x = cx * TILE, y = cy * TILE;
    rect(c, x, y, 4, 1, col); rect(c, x, y, 1, 4, col);
    rect(c, x + 12, y, 4, 1, col); rect(c, x + 15, y, 1, 4, col);
    rect(c, x, y + 15, 4, 1, col); rect(c, x, y + 12, 1, 4, col);
    rect(c, x + 12, y + 15, 4, 1, col); rect(c, x + 15, y + 12, 1, 4, col);
  }
}
