import { describe, expect, it } from 'vitest';
import { Board } from '../src/core/board';
import { solveElectric } from '../src/sim/electric';
import { solveMech } from '../src/sim/mechanic';
import { parse } from './helpers';

/** Ряд деталей слева направо; c — ручка (крутится), C — ручка стоит. */
function rowBoard(types: string[], y = 1, h = 3): Board {
  const b = new Board(types.length, h);
  types.forEach((t, x) => {
    if (t === '.') return;
    if (t === 'c') b.add({ type: 'crank', x, y, rot: 0, on: true });
    else b.add({ type: t, x, y, rot: 0 });
  });
  return b;
}
const speeds = (b: Board) => {
  const m = solveMech(b, null);
  return b.parts.sort((a, c) => a.x - c.x).map((p) => m.speed.get(p.id) ?? 0);
};

describe('механика', () => {
  it('соседние шестерни крутятся в разные стороны', () => {
    expect(speeds(rowBoard(['c', 'gear_s', 'gear_s', 'fan']))).toEqual([1, -1, 1, -1]);
  });

  it('большая крутит маленькую быстрее, маленькая большую — медленнее', () => {
    const [, , big, fan] = speeds(rowBoard(['c', 'axle', 'gear_b', 'fan']));
    expect(big).toBe(1);
    expect(fan).toBe(-2);
    const [, b2] = speeds(rowBoard(['c', 'gear_b']));
    expect(b2).toBe(-0.5);
  });

  it('ось передаёт то же вращение', () => {
    expect(speeds(rowBoard(['c', 'axle', 'axle', 'wheel']))).toEqual([1, 1, 1, 1]);
  });

  it('ремень: то же направление', () => {
    const b = new Board(5, 3);
    b.add({ type: 'crank', x: 0, y: 1, rot: 0, on: true });
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [3, 0]]) b.add({ type: 'belt', x, y, rot: 0 });
    b.add({ type: 'fan', x: 3, y: 1, rot: 0 });
    const m = solveMech(b, null);
    expect(m.speed.get(b.at(3, 1)!.id)).toBe(1);
  });

  it('ось и ремень не цепляются друг к другу', () => {
    const s = speeds(rowBoard(['c', 'axle', 'belt', 'fan']));
    expect(s[3]).toBe(0);
  });

  it('конвейер едет вправо от шестерни по часовой', () => {
    const s = speeds(rowBoard(['c', 'gear_s', 'gear_s', 'conveyor', 'conveyor']));
    expect(s[2]).toBe(1);
    expect(s[3]).toBeGreaterThan(0);
  });

  it('конвейер не цепляется сверху/снизу', () => {
    const b = new Board(2, 2);
    b.add({ type: 'crank', x: 0, y: 1, rot: 0, on: true });
    b.add({ type: 'conveyor', x: 0, y: 0, rot: 0 });
    expect(solveMech(b, null).speed.get(b.at(0, 0)!.id)).toBe(0);
  });

  it('две ручки в разные стороны — заклинило', () => {
    expect(solveMech(rowBoard(['c', 'gear_s', 'c']), null).hasJam).toBe(false); // через одну — в одну сторону
    const b = rowBoard(['c', 'gear_s', 'gear_s', 'c']);
    const m = solveMech(b, null);
    expect(m.hasJam).toBe(true);
    expect([...m.speed.values()].every((v) => v === 0)).toBe(true);
  });

  it('две ручки через ось — не заклинило', () => {
    const m = solveMech(rowBoard(['c', 'axle', 'c']), null);
    expect(m.hasJam).toBe(false);
  });

  it('кольцо с осью (нечётное) заклинивает при вращении', () => {
    // c g
    // a a     ручка-шестерня-ось-ось-ручка: одно зацепление в кольце — противоречие
    const b = new Board(2, 2);
    b.add({ type: 'crank', x: 0, y: 0, rot: 0, on: true });
    b.add({ type: 'gear_s', x: 1, y: 0, rot: 0 });
    b.add({ type: 'axle', x: 1, y: 1, rot: 0 });
    b.add({ type: 'axle', x: 0, y: 1, rot: 0 });
    expect(solveMech(b, null).hasJam).toBe(true);
    b.get(1)!.on = false;
    expect(solveMech(b, null).hasJam).toBe(false);
  });

  it('мотор от батарейки крутит шестерню сверху', () => {
    const b = parse(['..g..', '+-M-+', '|...|', '+-B-+']);
    const el = solveElectric(b);
    const m = solveMech(b, el);
    const g = b.at(2, 0)!;
    expect(Math.abs(m.speed.get(g.id)!)).toBeGreaterThan(0.5);
    // сбоку мотора (где провода) шестерня не цепляется
    expect(m.comp.get(b.at(1, 1)!.id)).toBeUndefined();
  });
});
