import type { Board, Part } from './board';
import { DIRS, DX, DY, opp, rotDir, type Dir } from './geom';
import { getPart, type PortKind } from './parts';

/** Какой порт деталь предлагает в сторону d (в мировых координатах). */
export function offers(p: Part, d: Dir): PortKind | undefined {
  const def = getPart(p.type);
  if (def.autotile) return def.autotile;
  if (def.terminals && def.portKind) {
    for (const t of def.terminals) if (rotDir(t, p.rot) === d) return def.portKind;
  }
  return undefined;
}

/** Номер вывода детали, смотрящего в сторону d, или -1. */
export function terminalAt(p: Part, d: Dir): number {
  const def = getPart(p.type);
  if (!def.terminals) return -1;
  return def.terminals.findIndex((t) => rotDir(t, p.rot) === d);
}

/** Соединена ли клетка (x,y) с соседом в сторону d. */
export function connects(board: Board, x: number, y: number, d: Dir, kind?: PortKind): boolean {
  const a = board.at(x, y);
  const b = board.at(x + DX[d], y + DY[d]);
  if (!a || !b) return false;
  const ka = offers(a, d);
  if (!ka || (kind && ka !== kind)) return false;
  return offers(b, opp(d)) === ka;
}

/** Битовая маска соединений клетки (бит d = соединено в сторону d) — для автотайлинга. */
export function connectionMask(board: Board, x: number, y: number): number {
  let m = 0;
  for (const d of DIRS) if (connects(board, x, y, d)) m |= 1 << d;
  return m;
}
