import { Board } from '../core/board';
import { isPath, type ItemSpec, type LevelDef } from './types';

/** Поставить на доску деталь или путь проводов. */
export function placeItem(b: Board, s: ItemSpec, pre: boolean): void {
  if (isPath(s)) {
    for (const [x, y] of s.path) {
      if (!b.at(x, y)) b.add({ type: s.type, x, y, rot: 0, locked: s.locked, pre });
    }
  } else {
    b.add({ type: s.type, x: s.x, y: s.y, rot: s.rot ?? 0, locked: s.locked, pre, on: s.on, pressed: s.pressed });
  }
}

export function boardForLevel(level: LevelDef): Board {
  const b = new Board(level.grid.w, level.grid.h);
  for (const s of level.prePlaced ?? []) placeItem(b, s, true);
  return b;
}
