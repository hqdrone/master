import { Board, type Part } from '../core/board';
import { getPart } from '../core/parts';
import { boardForLevel } from '../levels/build';
import { isPath, type ItemSpec, type LevelDef } from '../levels/types';
import { isOn, solveElectric, type ElectricResult } from '../sim/electric';
import { checkGoal } from '../sim/goals';
import { solveMech, SPIN_MIN, type MechResult } from '../sim/mechanic';
import { FLOW_MIN, solveFluid, stepTanks, type FluidResult } from '../sim/fluid';
import { Renderer, TILE, type Ghost } from '../render/renderer';
import { initAudio } from '../audio/synth';
import { Ambience, sfx } from '../audio/sounds';
import { save } from '../save/progress';
import { button, modal, soundButton } from './common';
import { h } from './dom';
import { partIcon, starIcon } from './icons';
import { Robot } from './robot';
import { T } from './texts';

export interface GameConfig {
  level: LevelDef;
  onExit: () => void;
  onNext?: () => void;
}

type Drag =
  | { kind: 'paint'; type: string; last: { x: number; y: number }; pushed: boolean }
  | { kind: 'erase'; pushed: boolean }
  | { kind: 'part'; id: number; start: { x: number; y: number }; moved: boolean; hold: boolean };

const TICK = 1 / 30;

export class Game {
  readonly el: HTMLElement;
  private level: LevelDef;
  private board: Board;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private wrap: HTMLElement;
  private robot = new Robot();
  private amb = new Ambience();
  private paletteEl: HTMLElement;
  private stepEl: HTMLElement;
  private powerBtn: HTMLButtonElement;
  private items = new Map<string, { el: HTMLElement; count: HTMLElement }>();

  private sim: ElectricResult | null = null;
  private mech: MechResult | null = null;
  private water: FluidResult | null = null;
  /** растёт при каждом пересчёте симуляции — для кэша проверки цели */
  private simStamp = 0;
  private levelsAtSolve = new Map<number, number>();
  private splashCd = 0;
  private hadJam = false;
  private tickPhase = 0;
  private told = new Set<string>();
  private simVersion = -1;
  private goalVersion = -1;
  private goalOk = false;
  private powered: boolean;
  private brush: { type: string; rot: number } | null = null;
  private selected: number | null = null;
  private hover: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  private paletteDrag: string | null = null;
  private paletteWasSelected = false;
  private undo: string[] = [];
  private angles = new Map<number, number>();
  private prevOn = new Map<number, boolean>();
  private hadShort = false;
  private stepIndex = -2;
  private won = false;
  private winHold = 0;
  private openTime = 0;
  private hintLockUntil = 0;
  private lastWheel = 0;

  private t = 0;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private cleanup: (() => void)[] = [];

  constructor(private cfg: GameConfig) {
    this.level = cfg.level;
    this.board = boardForLevel(this.level);
    this.powered = this.level.mode !== 'instruction';

    this.canvas = h('canvas', { cls: 'field' });
    this.renderer = new Renderer(this.canvas);
    this.powerBtn = button(T.powerOn, () => this.powerOn(), 'btn power hidden');
    this.wrap = h('div', { cls: 'field-wrap' }, this.canvas, this.powerBtn);
    this.paletteEl = h('aside', { cls: 'palette' });
    this.stepEl = h('span', { cls: 'step' });

    const tools = h('aside', { cls: 'tools' },
      button(T.rotate, () => this.rotateAction(), 'btn tool'),
      button(T.remove, () => this.removeSelected(), 'btn tool'),
      button(T.undo, () => this.doUndo(), 'btn tool'),
    );
    if (this.level.mode === 'sandbox') {
      tools.append(
        h('div', { cls: 'sep' }),
        button(T.save, () => this.slotDialog('save'), 'btn tool'),
        button(T.load, () => this.slotDialog('load'), 'btn tool'),
        button(T.clear, () => { this.pushUndo(); this.board.parts = this.board.parts.filter((p) => p.locked); this.board.touch(); }, 'btn tool'),
      );
    }

    this.el = h('div', { cls: 'screen level' },
      h('header', { cls: 'topbar' },
        button(T.menu, () => this.exit(), 'btn small'),
        h('h1', { text: this.level.title }),
        this.stepEl,
        h('div', { cls: 'spacer' }),
        button(T.restart, () => this.restart(), 'btn small'),
        soundButton(),
      ),
      h('div', { cls: 'body' }, this.paletteEl, this.wrap, tools),
      h('footer', { cls: 'helper' }, this.robot.el),
    );

    this.buildPalette();
    this.robot.say(this.level.intro ?? (this.level.mode === 'sandbox' ? T.robot.sandbox : ''));
    this.hintLockUntil = 3.5;
    this.bindInput();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Вызывается после вставки в DOM. */
  mounted(): void {
    this.fit();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.amb.stop();
    this.robot.destroy();
    for (const f of this.cleanup) f();
  }

  private exit(): void {
    this.cfg.onExit();
  }

  // ---------- палитра ----------

  private buildPalette(): void {
    this.paletteEl.innerHTML = '';
    for (const type of Object.keys(this.level.palette)) {
      const count = h('span', { cls: 'count' });
      const el = h('button', { cls: 'pal-item', title: T.parts[type] ?? type },
        partIcon(type), h('span', { cls: 'name', text: T.parts[type] ?? type }), count);
      el.addEventListener('pointerdown', (e) => {
        initAudio();
        e.preventDefault();
        this.paletteWasSelected = this.brush?.type === type;
        this.brush = { type, rot: this.brush?.rot ?? 0 };
        this.selected = null;
        this.paletteDrag = type;
        sfx.click();
      });
      this.items.set(type, { el, count });
      this.paletteEl.append(el);
    }
  }

  private remaining(type: string): number {
    const n = this.level.palette[type];
    if (n === undefined) return 0;
    if (n < 0) return Infinity;
    return n - this.board.count(type, true);
  }

  private updatePalette(highlight: string | null): void {
    for (const [type, { el, count }] of this.items) {
      const r = this.remaining(type);
      count.textContent = r === Infinity ? '∞' : String(r);
      el.classList.toggle('selected', this.brush?.type === type);
      el.classList.toggle('empty', r <= 0);
      el.classList.toggle('hint', highlight === type);
    }
  }

  // ---------- действия ----------

  private pushUndo(): void {
    this.undo.push(this.board.snapshot());
    if (this.undo.length > 60) this.undo.shift();
  }

  private doUndo(): void {
    const s = this.undo.pop();
    if (!s) return;
    this.board.restore(s);
    this.selected = null;
    sfx.remove();
  }

  private restart(): void {
    this.board = boardForLevel(this.level);
    this.undo = [];
    this.selected = null;
    this.brush = null;
    this.won = false;
    this.winHold = 0;
    this.powered = this.level.mode !== 'instruction';
    this.powerBtn.classList.add('hidden');
    this.stepIndex = -2;
    this.sim = null;
    this.mech = null;
    this.water = null;
    this.simVersion = -1;
    this.goalVersion = -1;
    this.prevOn.clear();
    this.told.clear();
    this.robot.say(this.level.intro ?? T.robot.sandbox);
    this.hintLockUntil = this.t + 3;
  }

  private place(type: string, x: number, y: number, rot: number, quiet = false): boolean {
    if (!this.board.inBounds(x, y) || this.board.at(x, y)) return false;
    if (this.remaining(type) <= 0) {
      this.say(T.robot.outOf, 2);
      sfx.error();
      return false;
    }
    this.board.add({ type, x, y, rot: getPart(type).autotile ? 0 : rot });
    if (quiet) sfx.wire(); else sfx.place();
    const r = this.renderer.particles;
    for (let i = 0; i < 4; i++) r.spark(x * TILE + 8, y * TILE + 8, 6);
    return true;
  }

  private eraseAt(x: number, y: number, d: { pushed: boolean }): void {
    const p = this.board.at(x, y);
    if (!p) return;
    if (p.locked) { this.say(T.robot.locked, 1.5); return; }
    if (!d.pushed) { this.pushUndo(); d.pushed = true; }
    this.board.remove(p.id);
    if (this.selected === p.id) this.selected = null;
    sfx.remove();
  }

  private rotatePart(p: Part): void {
    if (p.locked) { this.say(T.robot.locked, 1.5); sfx.error(); return; }
    const def = getPart(p.type);
    if (def.autotile || def.anyRot) return;
    this.pushUndo();
    this.board.rotate(p.id);
    sfx.rotate();
  }

  private rotateAction(): void {
    const p = this.selected != null ? this.board.get(this.selected) : undefined;
    if (p) this.rotatePart(p);
    else if (this.brush) { this.brush.rot = (this.brush.rot + 1) % 4; sfx.rotate(); }
  }

  private removeSelected(): void {
    const p = this.selected != null ? this.board.get(this.selected) : undefined;
    if (p) this.eraseAt(p.x, p.y, { pushed: false });
  }

  private setPressed(p: Part, v: boolean): void {
    if (p.pressed === v) return;
    p.pressed = v;
    this.board.touch();
    sfx.click();
  }

  private powerOn(): void {
    this.powered = true;
    this.powerBtn.classList.add('hidden');
    sfx.power();
    this.robot.say(this.level.afterPower ?? T.robot.watch);
    this.hintLockUntil = this.t + 2.5;
  }

  // ---------- ввод ----------

  private bindInput(): void {
    const cv = this.canvas;
    const cell = (e: { clientX: number; clientY: number }) =>
      this.renderer.cellAt(e.clientX, e.clientY, this.board.w, this.board.h);

    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      initAudio();
      e.preventDefault();
      const c = cell(e);
      if (!c) return;
      cv.setPointerCapture(e.pointerId);
      const p = this.board.at(c.x, c.y);
      if (e.button === 2) {
        const d = { kind: 'erase' as const, pushed: false };
        this.drag = d;
        this.eraseAt(c.x, c.y, d);
        return;
      }
      if (e.button !== 0) return;
      const brushWire = this.brush && getPart(this.brush.type).autotile ? this.brush.type : null;
      const pWire = p && getPart(p.type).autotile && this.level.palette[p.type] !== undefined ? p.type : null;
      const wire = brushWire && (!p || p.type === brushWire) ? brushWire : !this.brush && pWire ? pWire : null;
      if (wire) {
        const d: Drag = { kind: 'paint', type: wire, last: c, pushed: false };
        this.drag = d;
        if (!p) { this.pushUndo(); d.pushed = true; this.place(wire, c.x, c.y, 0, true); }
        this.selected = null;
        return;
      }
      if (p) {
        this.selected = p.id;
        const hold = getPart(p.type).interactive === 'hold';
        this.drag = { kind: 'part', id: p.id, start: c, moved: false, hold };
        if (hold) this.setPressed(p, true);
        return;
      }
      if (this.brush) {
        this.pushUndo();
        if (!this.place(this.brush.type, c.x, c.y, this.brush.rot)) this.undo.pop();
        return;
      }
      this.selected = null;
    });

    const move = (e: PointerEvent) => {
      const c = cell(e);
      this.hover = c;
      const d = this.drag;
      if (!d || !c) return;
      if (d.kind === 'paint') {
        // проходим все клетки между прошлой и текущей, по 4 направлениям
        let { x, y } = d.last;
        while (x !== c.x || y !== c.y) {
          if (x !== c.x) x += Math.sign(c.x - x); else y += Math.sign(c.y - y);
          if (!this.board.at(x, y)) {
            if (!d.pushed) { this.pushUndo(); d.pushed = true; }
            if (!this.place(d.type, x, y, 0, true)) break;
          }
        }
        d.last = c;
      } else if (d.kind === 'erase') {
        this.eraseAt(c.x, c.y, d);
      } else if (d.kind === 'part' && !d.moved && (c.x !== d.start.x || c.y !== d.start.y)) {
        const p = this.board.get(d.id);
        if (p && !p.locked) {
          d.moved = true;
          if (d.hold) this.setPressed(p, false);
        }
      }
    };

    const up = (e: PointerEvent) => {
      const c = cell(e);
      if (this.paletteDrag) {
        const type = this.paletteDrag;
        this.paletteDrag = null;
        if (c && this.brush) {
          this.pushUndo();
          if (!this.place(type, c.x, c.y, this.brush.rot)) this.undo.pop();
        } else if (!c && this.paletteWasSelected && this.items.get(type)?.el.contains(e.target as Node)) {
          this.brush = null; // повторный щелчок по выбранной детали — снять выбор
        }
      }
      const d = this.drag;
      this.drag = null;
      if (!d || d.kind !== 'part') return;
      const p = this.board.get(d.id);
      if (!p) return;
      if (d.moved) {
        if (c && !this.board.at(c.x, c.y)) {
          this.pushUndo();
          this.board.move(p.id, c.x, c.y);
          sfx.place();
        }
      } else if (d.hold) {
        this.setPressed(p, false);
      } else if (getPart(p.type).interactive === 'toggle') {
        p.on = !p.on;
        this.board.touch();
        this.hintLockUntil = 0; // ребёнок что-то сделал — пусть робот реагирует
        sfx.click();
      }
    };

    const key = (e: KeyboardEvent) => {
      if (document.querySelector('.overlay')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'я')) { e.preventDefault(); this.doUndo(); return; }
      if (k === 'r' || k === 'к') {
        const hp = this.hover ? this.board.at(this.hover.x, this.hover.y) : undefined;
        const sel = this.selected != null ? this.board.get(this.selected) : undefined;
        if (this.brush) { this.brush.rot = (this.brush.rot + 1) % 4; sfx.rotate(); }
        else if (sel) this.rotatePart(sel);
        else if (hp) this.rotatePart(hp);
      }
      if (k === 'delete' || k === 'backspace') this.removeSelected();
      if (k === 'escape') { this.brush = null; this.selected = null; }
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastWheel < 180) return;
      this.lastWheel = now;
      const c = cell(e);
      const p = c ? this.board.at(c.x, c.y) : undefined;
      if (p && !this.brush) this.rotatePart(p);
      else if (this.brush) { this.brush.rot = (this.brush.rot + (e.deltaY > 0 ? 1 : 3)) % 4; sfx.rotate(); }
    };

    const resize = () => this.fit();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', resize);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('pointerleave', () => { if (!this.paletteDrag) this.hover = null; });
    this.cleanup.push(() => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', resize);
    });
  }

  private fit(): void {
    const r = this.wrap.getBoundingClientRect();
    this.renderer.fit(this.board.w, this.board.h, r.width - 16, r.height - 16);
  }

  // ---------- инструкция ----------

  private stepOk(s: ItemSpec): boolean {
    if (isPath(s)) return s.path.every(([x, y]) => this.board.at(x, y)?.type === s.type);
    const p = this.board.at(s.x, s.y);
    if (!p || p.type !== s.type) return false;
    const want = s.rot ?? 0;
    if (getPart(s.type).anyRot) return true;
    return getPart(s.type).symmetric ? p.rot % 2 === want % 2 : p.rot === want;
  }

  private updateSteps(): { ghosts: Ghost[]; highlight: string | null } {
    const steps = this.level.steps;
    if (this.level.mode !== 'instruction' || !steps) {
      this.stepEl.textContent = '';
      return { ghosts: [], highlight: null };
    }
    let i = steps.findIndex((s) => !this.stepOk(s));
    if (i < 0) i = steps.length;
    if (i !== this.stepIndex) {
      if (i > this.stepIndex && this.stepIndex >= 0) {
        sfx.step();
      }
      this.stepIndex = i;
      if (i >= steps.length) {
        if (!this.powered) {
          this.powerBtn.classList.remove('hidden');
          this.robot.say(T.robot.ready);
        }
      } else {
        const s = steps[i];
        this.robot.say(s.hint ?? T.place[s.type] ?? '');
        this.hintLockUntil = 0;
      }
    }
    this.stepEl.textContent = i >= steps.length ? T.stepsDone : T.step(i + 1, steps.length);
    if (i >= steps.length || this.powered) return { ghosts: [], highlight: null };
    const s = steps[i];
    if (isPath(s)) {
      return {
        ghosts: s.path.filter(([x, y]) => !this.board.at(x, y)).map(([x, y]) => ({ type: s.type, x, y, rot: 0 })),
        highlight: s.type,
      };
    }
    const p = this.board.at(s.x, s.y);
    if (p && p.type === s.type) {
      this.robot.say(T.robot.rotateIt);
      return { ghosts: [{ type: s.type, x: s.x, y: s.y, rot: s.rot ?? 0 }], highlight: null };
    }
    return { ghosts: [{ type: s.type, x: s.x, y: s.y, rot: s.rot ?? 0 }], highlight: s.type };
  }

  // ---------- цикл ----------

  private frame = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    while (this.acc >= TICK) {
      this.tick(TICK);
      this.acc -= TICK;
    }
    this.t += dt;

    const { ghosts, highlight } = this.updateSteps();
    this.updatePalette(highlight);

    let preview = null;
    if (this.brush && this.hover && !this.drag) {
      const { x, y } = this.hover;
      preview = { type: this.brush.type, x, y, rot: this.brush.rot, ok: !this.board.at(x, y) && this.remaining(this.brush.type) > 0 };
      if (this.board.at(x, y)) preview = null;
    }
    this.renderer.draw({
      board: this.board, sim: this.sim, mech: this.mech, water: this.water, t: this.t, dt, angles: this.angles,
      ghosts, preview, selected: this.selected,
    });
    this.raf = requestAnimationFrame(this.frame);
  };

  private say(text: string, lock = 2.5): void {
    this.robot.say(text);
    this.hintLockUntil = this.t + lock;
  }

  private tick(dt: number): void {
    const b = this.board;
    const events0: string[] = [];
    if (this.powered) {
      // баки меняются со временем: пересчитываем воду, когда уровни заметно сдвинулись
      let tanksMoved = false;
      for (const [id, lv] of this.levelsAtSolve) {
        const p = b.get(id);
        const now = p?.level ?? 0;
        if (Math.abs(now - lv) > 0.02 || ((now === 0 || now === 1) && now !== lv)) tanksMoved = true;
      }
      if (b.version !== this.simVersion || tanksMoved) {
        this.sim = solveElectric(b);
        this.water = solveFluid(b);
        this.mech = solveMech(b, this.sim, this.water);
        this.simVersion = b.version;
        this.simStamp++;
        this.levelsAtSolve = new Map(b.parts.filter((p) => p.type === 'tank').map((p) => [p.id, p.level ?? 0]));
      }
    } else { this.sim = null; this.mech = null; this.water = null; }
    const sim = this.sim;
    const mech = this.mech;
    const water = this.water;
    if (water) this.waterTick(water, dt, events0);

    let motorMax = 0, buzzMax = 0, lamps = 0, gearMax = 0;
    const events: string[] = events0;
    if (sim && mech) {
      for (const p of b.parts) {
        const def = getPart(p.type);
        const lv = sim.level.get(p.id) ?? 0;
        if (def.fluid?.kind === 'pump' && p.on) this.angles.set(p.id, (this.angles.get(p.id) ?? 0) + dt * 10);
        if (def.mech) {
          const v = mech.speed.get(p.id) ?? 0;
          // ленты — скорость в пикселях, шестерни — угол
          const k = def.mech.role === 'belt' ? 3.5 : 4;
          this.angles.set(p.id, (this.angles.get(p.id) ?? 0) + v * dt * k);
          if (def.mech.role === 'gear') gearMax = Math.max(gearMax, Math.abs(v) * (8 / (def.mech.teeth ?? 8)));
          if (def.mech.output) {
            const on = Math.abs(v) > SPIN_MIN;
            if (on && !this.prevOn.get(p.id)) events.push(p.type);
            this.prevOn.set(p.id, on);
          }
        }
        if (def.output === 'spin') motorMax = Math.max(motorMax, Math.abs(lv));
        if (def.output === 'sound') buzzMax = Math.max(buzzMax, lv);
        if (def.output === 'light') lamps += lv;
        if (def.output) {
          const on = isOn(p, sim);
          if (on && !this.prevOn.get(p.id)) {
            events.push(p.type);
            if (def.output === 'light' || def.output === 'led') sfx.ding();
            this.renderer.particles.burst(p.x * TILE + 8, p.y * TILE + 8, 10, 6);
          }
          this.prevOn.set(p.id, on);
        }
        if (sim.shorted.has(p.id) && Math.random() < 0.5) this.renderer.particles.smoke(p.x * TILE + 8, p.y * TILE + 4);
        if (mech.jammed.has(p.id) && Math.random() < 0.05) this.renderer.particles.spark(p.x * TILE + 8, p.y * TILE + 8, 9);
      }
      if (sim.hasShort && !this.hadShort) { sfx.short(); this.say(T.robot.short, 3); }
      this.hadShort = sim.hasShort;
      if (mech.hasJam && !this.hadJam) { sfx.jam(); this.say(T.robot.jam, 3); }
      this.hadJam = mech.hasJam;
    }
    this.amb.update(motorMax, buzzMax, lamps);
    this.amb.updateWater(water?.totalFlow ?? 0);
    // «тик-тик» шестерён
    const before = Math.floor(this.tickPhase);
    this.tickPhase += Math.min(gearMax, 3) * dt * 5;
    if (Math.floor(this.tickPhase) !== before) sfx.tick();

    if (sim && mech) this.hints(sim, mech, events);
    if (water && this.t >= this.hintLockUntil) this.waterHints(water, events);

    // проверка цели
    if (sim && mech && !this.won && this.level.goal) {
      if (this.goalVersion !== this.simStamp) {
        this.goalOk = checkGoal(this.level.goal, { board: b, res: sim, mech, water: water!, solve: (ov) => solveElectric(b, ov) });
        this.goalVersion = this.simStamp;
      }
      this.winHold = this.goalOk ? this.winHold + dt : 0;
      if (this.winHold > 2) this.win();
    }
  }

  /** Баки, брызги, фонтаны. */
  private waterTick(water: FluidResult, dt: number, events: string[]): void {
    const b = this.board;
    const P = this.renderer.particles;
    const fullBefore = new Set(b.parts.filter((p) => p.type === 'tank' && (p.level ?? 0) >= 0.95).map((p) => p.id));
    const overflow = stepTanks(b, water, dt);
    for (const p of b.parts) {
      if (p.type === 'tank' && (p.level ?? 0) >= 0.95 && !fullBefore.has(p.id)) events.push('tankFull');
      if (p.type === 'tank' && overflow && (p.level ?? 0) >= 1 && (water.tankIn.get(p.id) ?? 0) > FLOW_MIN) {
        if (Math.random() < 0.6) P.drop(p.x * TILE + 3 + Math.random() * 10, p.y * TILE + 1, (Math.random() - 0.5) * 40, -20 - Math.random() * 20);
      }
      if (p.type === 'fountain') {
        const f = water.flow.get(p.id) ?? 0;
        const on = f > FLOW_MIN * 5;
        if (on) for (let k = 0; k < 2; k++) {
          // струя вверх (с учётом поворота фонтана)
          const ang = -Math.PI / 2 + (p.rot * Math.PI) / 2 + (Math.random() - 0.5) * 0.5;
          const v = 40 + 60 * Math.min(1.5, f / 0.5);
          P.drop(p.x * TILE + 8, p.y * TILE + 6, Math.cos(ang) * v, Math.sin(ang) * v, Math.random() < 0.3 ? 7 : 12);
        }
        if (on && !this.prevOn.get(p.id)) events.push('fountain');
        this.prevOn.set(p.id, on);
      }
    }
    for (const e of water.openEnds) {
      if (e.flow < FLOW_MIN) continue;
      const ox = [8, 15, 8, 0][e.d], oy = [0, 8, 15, 8][e.d];
      const vx = [0, 1, 0, -1][e.d] * 30, vy = [-1, 0, 1, 0][e.d] * 30;
      for (let k = 0; k < 2; k++) P.drop(e.x * TILE + ox, e.y * TILE + oy, vx + (Math.random() - 0.5) * 15, vy - 10);
    }
    this.splashCd -= dt;
    if ((water.spilling || overflow) && this.splashCd <= 0) { sfx.splash(); this.splashCd = 1.2; }
    if (water.spilling) events.push('spill');
    if (overflow) events.push('overflow');
  }

  private waterHints(water: FluidResult, events: string[]): void {
    const once = (key: string, text: string, cond: boolean) => {
      if (!cond || this.told.has(key)) return false;
      this.told.add(key); this.say(text, 3.5); return true;
    };
    if (once('spill', T.robot.spill, events.includes('spill'))) return;
    if (once('overflow', T.robot.overflow, events.includes('overflow'))) return;
    if (once('full', T.robot.tankFull, events.includes('tankFull'))) return;
    if (once('fountain', T.robot.fountain, events.includes('fountain'))) return;
    const pumpOn = this.board.parts.some((p) => p.type === 'pump' && p.on);
    if (once('dead', T.robot.deadEnd, pumpOn && water.totalFlow < FLOW_MIN && this.board.count('pipe') > 0)) return;
  }

  private hints(sim: ElectricResult, mech: MechResult, events: string[]): void {
    const b = this.board;
    const loads = b.parts.filter((p) => getPart(p.type).output).length;
    const bats = b.count('battery');
    if (sim.hasShort) { this.robot.say(T.robot.short); this.hintLockUntil = this.t + 2; return; }
    if (mech.hasJam) { this.robot.say(T.robot.jam); this.hintLockUntil = this.t + 2; return; }
    if (this.t >= this.hintLockUntil) {
      // механика: каждую мысль — один раз за уровень
      const fast = b.parts.some((p) => getPart(p.type).mech?.output && Math.abs(mech.speed.get(p.id) ?? 0) >= 1.9);
      const turning = b.parts.filter((p) => getPart(p.type).mech?.role === 'gear' && Math.abs(mech.speed.get(p.id) ?? 0) > SPIN_MIN);
      const once = (key: string, text: string, cond: boolean) => {
        if (!cond || this.told.has(key)) return false;
        this.told.add(key); this.say(text, 3.5); return true;
      };
      if (once('fast', T.robot.faster, fast)) return;
      if (once('opposite', T.robot.opposite, turning.length >= 3)) return;
      if (once('belt', T.robot.beltSame, b.count('belt') > 0 && turning.length >= 2)) return;
      if (events.includes('conveyor') && once('conv', T.robot.conveyor, true)) return;
      if (events.includes('pusher') && once('push', T.robot.pusher, true)) return;
    }
    if (sim.ledReversed.size) { this.say(T.robot.ledBack, 2); return; }
    if (this.t < this.hintLockUntil) return;
    if (events.includes('lamp')) {
      const lit = b.parts.filter((p) => p.type === 'lamp' && isOn(p, sim));
      const dim = lit.some((p) => (sim.level.get(p.id) ?? 0) < 0.5);
      this.say(lit.length > 1 && dim ? T.robot.dim : T.robot.lampOn, 3);
      return;
    }
    if (events.includes('motor')) { this.say(T.robot.motor, 3); return; }
    if (events.includes('fan') || events.includes('wheel') || events.includes('waterwheel')) { this.say(T.robot.spinning, 3); return; }
    if (events.includes('buzzer')) { this.say(T.robot.buzzer, 3); return; }
    if (events.includes('led')) { this.say(T.robot.lampOn, 3); return; }
    if (loads > 0 && bats === 0 && this.level.mode === 'sandbox') { this.say(T.robot.noBattery, 3); return; }
    if (loads > 0 && bats > 0 && sim.batteryCurrent < 1e-3) {
      this.openTime += TICK;
      if (this.openTime > 2) this.say(T.robot.open, 3);
    } else {
      this.openTime = 0;
    }
  }

  private stars(): number {
    if (this.level.mode !== 'puzzle' || !this.level.stars) return 3;
    const n = this.board.parts.filter((p) => !p.pre).length;
    const max = this.level.stars.maxParts;
    return n <= max ? 3 : n <= max + 3 ? 2 : 1;
  }

  private win(): void {
    this.won = true;
    const stars = this.stars();
    save.setStars(this.level.id, stars);
    sfx.win();
    const starRow = h('div', { cls: 'stars big' });
    for (let i = 0; i < 3; i++) starRow.append(starIcon(i < stars));
    let close = () => {};
    const btns = h('div', { cls: 'row' },
      button(T.again, () => { close(); this.restart(); }, 'btn'),
      button(T.map, () => { close(); this.exit(); }, 'btn'),
    );
    if (this.cfg.onNext) btns.append(button(T.next, () => { close(); this.cfg.onNext!(); }, 'btn primary'));
    close = modal(h('div', { cls: 'win' },
      h('h2', { text: T.win }), starRow,
      h('p', { cls: 'learned', text: this.level.outro ?? '' }),
      btns,
    ));
  }

  // ---------- слоты мастерской ----------

  private slotDialog(mode: 'save' | 'load'): void {
    let close = () => {};
    const list = h('div', { cls: 'slots' });
    save.get().slots.forEach((s, i) => {
      const label = `${T.slot(i + 1)}: ${s ? new Date(s.date).toLocaleDateString('ru-RU') : T.empty}`;
      const b = button(label, () => {
        if (mode === 'save') {
          save.setSlot(i, { date: Date.now(), w: this.board.w, h: this.board.h, parts: this.board.snapshot() });
          this.say(T.saved, 2);
        } else if (s) {
          this.pushUndo();
          this.board.restore(s.parts);
          this.board.parts = this.board.parts.filter((p) => this.board.inBounds(p.x, p.y) && this.level.palette[p.type] !== undefined);
          this.board.touch();
          this.say(T.loaded, 2);
        }
        close();
      }, 'btn slot');
      if (mode === 'load' && !s) b.disabled = true;
      list.append(b);
    });
    close = modal(h('div', {},
      h('h2', { text: mode === 'save' ? T.chooseSlotSave : T.chooseSlotLoad }),
      list,
      h('div', { cls: 'row' }, button(T.close, () => close(), 'btn small')),
    ));
  }
}
