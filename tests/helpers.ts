import '../src/core/electricParts';
import '../src/core/mechanicParts';
import { Board } from '../src/core/board';

/** Простая схема из ASCII: B батарейка, L лампа, M мотор, Z пищалка, S выкл.(вкл), s выкл.(выкл),
 *  K кнопка, D светодиод (анод слева), d светодиод наоборот, - | + провод. Поворот: детали горизонтальные,
 *  а в вертикальных колонках (если над/под деталью провод) — rot=1. */
export function parse(rows: string[]): Board {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const b = new Board(w, h);
  const isWire = (x: number, y: number) => '-|+'.includes(rows[y]?.[x] ?? ' ');
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const vertical = isWire(x, y - 1) || isWire(x, y + 1);
      const rot = vertical && !(isWire(x - 1, y) || isWire(x + 1, y)) ? 1 : 0;
      const map: Record<string, () => void> = {
        '-': () => b.add({ type: 'wire', x, y, rot: 0 }),
        '|': () => b.add({ type: 'wire', x, y, rot: 0 }),
        '+': () => b.add({ type: 'wire', x, y, rot: 0 }),
        B: () => b.add({ type: 'battery', x, y, rot }),
        L: () => b.add({ type: 'lamp', x, y, rot }),
        M: () => b.add({ type: 'motor', x, y, rot }),
        Z: () => b.add({ type: 'buzzer', x, y, rot }),
        S: () => b.add({ type: 'switch', x, y, rot, on: true }),
        s: () => b.add({ type: 'switch', x, y, rot, on: false }),
        K: () => b.add({ type: 'button', x, y, rot }),
        D: () => b.add({ type: 'led', x, y, rot }),
        g: () => b.add({ type: 'gear_s', x, y, rot: 0 }),
        d: () => b.add({ type: 'led', x, y, rot: rot + 2 }),
      };
      map[ch]?.();
    }),
  );
  return b;
}

export const of = (b: Board, type: string) => b.parts.filter((p) => p.type === type);
