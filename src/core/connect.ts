import type { Board, Part } from './board';
import { DIRS, DX, DY, opp, rotDir, type Dir } from './geom';
import { getPart, type PortKind } from './parts';

/** Какие порты деталь предлагает в сторону d (в мировых координатах). */
export function offersKinds(p: Part, d: Dir): PortKind[] {
  const def = getPart(p.type);
  const out: PortKind[] = [];
  const has = (sides: readonly Dir[]) => sides.some((s) => rotDir(s, p.rot) === d);
  if (def.autotile && (!def.sides || has(def.sides))) out.push(def.autotile);
  if (def.terminals && def.portKind && has(def.terminals)) out.push(def.portKind);
  if (def.mech?.role === 'gear' && has(def.mech.sides ?? DIRS)) out.push('mechanical', 'belt');
  return out;
}

/** Первый порт в сторону d (или undefined). */
export function offers(p: Part, d: Dir): PortKind | undefined {
  return offersKinds(p, d)[0];
}

/** Номер вывода детали, смотрящего в сторону d, или -1. */
export function terminalAt(p: Part, d: Dir): number {
  const def = getPart(p.type);
  if (!def.terminals) return -1;
  return def.terminals.findIndex((t) => rotDir(t, p.rot) === d);
}

/** Соединена ли клетка (x,y) с соседом в сторону d (по типу kind или любому общему). */
export function connects(board: Board, x: number, y: number, d: Dir, kind?: PortKind): boolean {
  const a = board.at(x, y);
  const b = board.at(x + DX[d], y + DY[d]);
  if (!a || !b) return false;
  const ka = offersKinds(a, d);
  const kb = offersKinds(b, opp(d));
  return ka.some((k) => (!kind || k === kind) && kb.includes(k));
}

/** Битовая маска соединений клетки (бит d = соединено в сторону d) — для автотайлинга. */
export function connectionMask(board: Board, x: number, y: number): number {
  let m = 0;
  for (const d of DIRS) if (connects(board, x, y, d)) m |= 1 << d;
  return m;
}
