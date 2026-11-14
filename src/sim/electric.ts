import type { Board, Part } from '../core/board';
import { connects, terminalAt } from '../core/connect';
import { DX, DY, opp, type Dir } from '../core/geom';
import { getPart } from '../core/parts';
import { solveLinear } from './linear';

/** Сопротивление провода между соседними клетками. */
export const LINK_R = 0.01;
/** Ток через батарейку, выше которого считаем короткое замыкание. */
export const SHORT_CURRENT = 1.5;
const GMIN = 1e-9;

/** Ток между соседними клетками a → b (для анимации точек). */
export interface Link {
  ax: number; ay: number; bx: number; by: number;
  i: number;
}

export interface ElectricResult {
  /** ток через деталь от вывода 0 к выводу 1 */
  current: Map<number, number>;
  /** выход детали: яркость, скорость (со знаком), громкость… 0..1 */
  level: Map<number, number>;
  links: Link[];
  /** батарейки в коротком замыкании */
  shorted: Set<number>;
  /** светодиоды, стоящие наоборот под напряжением */
  ledReversed: Set<number>;
  hasShort: boolean;
  /** суммарный ток через все батарейки */
  batteryCurrent: number;
}

/** Переопределение состояния ключей: id → замкнут. */
export type Overrides = Map<number, boolean>;

export function isClosed(p: Part, ov?: Overrides): boolean {
  if (ov?.has(p.id)) return ov.get(p.id)!;
  const def = getPart(p.type);
  if (def.interactive === 'hold') return !!p.pressed;
  return !!p.on;
}

interface Element {
  part: Part;
  a: number; b: number;
  g: number;
  /** ЭДС, толкающая ток от a к b */
  emf: number;
  kind: 'source' | 'load' | 'switch' | 'diode';
  diodeOn?: boolean;
}

export function solveElectric(board: Board, ov?: Overrides): ElectricResult {
  // 1. Узлы: клетка провода = узел; каждый вывод детали = узел.
  const cellNode = new Map<number, number>();
  const termNode = new Map<number, [number, number]>();
  let n = 0;
  for (const p of board.parts) {
    const def = getPart(p.type);
    if (def.autotile === 'electric') cellNode.set(p.y * board.w + p.x, n++);
    else if (def.electric && def.terminals) termNode.set(p.id, [n++, n++]);
  }
  const nodeFor = (p: Part, d: Dir): number => {
    const c = cellNode.get(p.y * board.w + p.x);
    if (c !== undefined) return c;
    const t = termNode.get(p.id);
    const k = terminalAt(p, d);
    return t && k >= 0 ? t[k] : -1;
  };

  // 2. Соединения между соседними клетками.
  const links: { a: number; b: number; ax: number; ay: number; bx: number; by: number }[] = [];
  for (const p of board.parts) {
    for (const d of [1, 2] as Dir[]) {
      if (!connects(board, p.x, p.y, d, 'electric')) continue;
      const q = board.at(p.x + DX[d], p.y + DY[d])!;
      const a = nodeFor(p, d);
      const b = nodeFor(q, opp(d));
      if (a < 0 || b < 0) continue;
      links.push({ a, b, ax: p.x, ay: p.y, bx: q.x, by: q.y });
    }
  }

  // 3. Элементы (детали с двумя выводами).
  const elems: Element[] = [];
  for (const p of board.parts) {
    const def = getPart(p.type);
    const t = termNode.get(p.id);
    if (!def.electric || !t) continue;
    const e = def.electric;
    const el: Element = { part: p, a: t[0], b: t[1], g: 1 / e.r, emf: 0, kind: e.kind };
    if (e.kind === 'source') el.emf = e.volts ?? 0;
    if (e.kind === 'switch' && !isClosed(p, ov)) el.g = 0;
    if (e.kind === 'diode') { el.diodeOn = false; el.emf = -(e.vf ?? 0); }
    elems.push(el);
  }

  // 4. Узловой анализ. Диоды — кусочно-линейно, перебираем состояния.
  let v: Float64Array = new Float64Array(n);
  for (let iter = 0; iter < 25 && n > 0; iter++) {
    const A = new Float64Array(n * n);
    const rhs = new Float64Array(n);
    for (let i = 0; i < n; i++) A[i * n + i] += GMIN;
    const stamp = (a: number, b: number, g: number, emf: number) => {
      A[a * n + a] += g; A[b * n + b] += g;
      A[a * n + b] -= g; A[b * n + a] -= g;
      rhs[a] -= g * emf; rhs[b] += g * emf;
    };
    for (const l of links) stamp(l.a, l.b, 1 / LINK_R, 0);
    for (const el of elems) {
      if (el.g === 0) continue;
      if (el.kind === 'diode' && !el.diodeOn) continue;
      stamp(el.a, el.b, el.g, el.emf);
    }
    v = solveLinear(A, rhs, n);
    let changed = false;
    for (const el of elems) {
      if (el.kind !== 'diode') continue;
      const vd = v[el.a] - v[el.b];
      const i = el.g * (vd + el.emf);
      if (!el.diodeOn && vd > -el.emf + 1e-6) { el.diodeOn = true; changed = true; }
      else if (el.diodeOn && i < -1e-9) { el.diodeOn = false; changed = true; }
    }
    if (!changed) break;
  }

  // 5. Результаты.
  const res: ElectricResult = {
    current: new Map(), level: new Map(), links: [], shorted: new Set(), ledReversed: new Set(),
    hasShort: false, batteryCurrent: 0,
  };
  for (const l of links) {
    res.links.push({ ax: l.ax, ay: l.ay, bx: l.bx, by: l.by, i: (v[l.a] - v[l.b]) / LINK_R });
  }
  for (const el of elems) {
    const on = el.g > 0 && (el.kind !== 'diode' || el.diodeOn);
    const i = on ? el.g * (v[el.a] - v[el.b] + el.emf) : 0;
    const p = el.part;
    res.current.set(p.id, i);
    const def = getPart(p.type);
    const nom = def.electric!.nominal ?? 1;
    if (el.kind === 'source') {
      res.batteryCurrent += Math.abs(i);
      if (Math.abs(i) > SHORT_CURRENT) { res.shorted.add(p.id); res.hasShort = true; }
    }
    if (def.output === 'light') res.level.set(p.id, Math.min(1, (i / nom) ** 2));
    else if (def.output === 'spin') res.level.set(p.id, Math.max(-1.5, Math.min(1.5, i / nom)));
    else if (def.output === 'sound') res.level.set(p.id, Math.min(1, Math.abs(i) / nom));
    else if (def.output === 'led') {
      res.level.set(p.id, i > 0 ? Math.min(1, i / nom) : 0);
      if (!on && v[el.b] - v[el.a] > 0.5) res.ledReversed.add(p.id);
    }
  }
  return res;
}

/** Работает ли деталь (лампа горит, мотор крутится…). */
export function isOn(p: Part, res: ElectricResult): boolean {
  const def = getPart(p.type);
  const lv = Math.abs(res.level.get(p.id) ?? 0);
  return lv > (def.onThreshold ?? 0.1);
}
