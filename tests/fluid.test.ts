import { describe, expect, it } from 'vitest';
import { Board, type NewPart } from '../src/core/board';
import { runWater, solveFluid } from '../src/sim/fluid';
import { solveMech } from '../src/sim/mechanic';
import './helpers';

/** Ряд по y=1 слева направо. P — насос (вкл), p — насос (выкл), - труба, V/v — кран откр/закр,
 *  T — бак, D — слив, F — фонтан (вход снизу — ставим над трубой отдельно), W — водяное колесо. */
function row(s: string, extra: NewPart[] = []): Board {
  const b = new Board(s.length, 3);
  [...s].forEach((ch, x) => {
    const y = 1;
    const m: Record<string, NewPart> = {
      P: { type: 'pump', x, y, rot: 0, on: true }, p: { type: 'pump', x, y, rot: 0 },
      '-': { type: 'pipe', x, y, rot: 0 }, V: { type: 'valve', x, y, rot: 0, on: true },
      v: { type: 'valve', x, y, rot: 0 }, T: { type: 'tank', x, y, rot: 0, level: 0 },
      D: { type: 'drain', x, y, rot: 0 }, W: { type: 'waterwheel', x, y, rot: 0 },
    };
    if (m[ch]) b.add(m[ch]);
  });
  for (const e of extra) b.add(e);
  return b;
}
const flowOf = (b: Board, type: string, r = solveFluid(b)) => r.flow.get(b.parts.find((p) => p.type === type)!.id) ?? 0;

describe('вода', () => {
  it('насос → трубы → слив: вода течёт', () => {
    const b = row('P---D');
    const r = solveFluid(b);
    expect(flowOf(b, 'drain', r)).toBeGreaterThan(0.4);
    expect(r.spilling).toBe(false);
    expect(r.links.every((l) => l.i > 0.4)).toBe(true);
  });

  it('выключенный насос — ничего', () => {
    expect(flowOf(row('p---D'), 'drain')).toBe(0);
  });

  it('закрытый кран режет поток, но труба до крана с водой', () => {
    const b = row('P-v-D');
    const r = solveFluid(b);
    expect(flowOf(b, 'drain', r)).toBeLessThan(1e-6);
    expect(r.wet.has(b.at(1, 1)!.id)).toBe(true);
    expect(r.wet.has(b.at(3, 1)!.id)).toBe(false);
    expect(flowOf(row('P-V-D'), 'drain')).toBeGreaterThan(0.4);
  });

  it('открытый конец трубы — вода выливается', () => {
    const r = solveFluid(row('P---'));
    expect(r.spilling).toBe(true);
    expect(r.openEnds[0].d).toBe(1);
  });

  it('тупик без выхода — вода стоит, не течёт', () => {
    const b = row('P--v');
    const r = solveFluid(b);
    expect(r.totalFlow).toBeLessThan(1e-6);
    expect(r.spilling).toBe(false);
  });

  it('фонтан снизу от трубы работает', () => {
    const b = row('P--', [{ type: 'fountain', x: 2, y: 0, rot: 0 }]);
    // труба (2,1) соединена с фонтаном сверху — открытых концов нет
    const r = solveFluid(b);
    expect(flowOf(b, 'fountain', r)).toBeGreaterThan(0.4);
    expect(r.spilling).toBe(false);
  });

  it('бак наполняется со временем, а слив опустошает его', () => {
    const b = row('P--T');
    runWater(b, 6);
    expect(b.at(3, 1)!.level).toBe(1);
    const d = row('T-VD');
    d.at(0, 1)!.level = 1;
    runWater(d, 30);
    expect(d.at(0, 1)!.level).toBeLessThan(0.05);
  });

  it('две ветки — вода делится', () => {
    const b = new Board(5, 3);
    b.add({ type: 'pump', x: 0, y: 1, rot: 0, on: true });
    for (const [x, y] of [[1, 1], [2, 1], [2, 0], [2, 2], [3, 0], [3, 2]]) b.add({ type: 'pipe', x, y, rot: 0 });
    b.add({ type: 'drain', x: 4, y: 0, rot: 0 });
    b.add({ type: 'drain', x: 4, y: 2, rot: 0 });
    const r = solveFluid(b);
    const [a, c] = b.parts.filter((p) => p.type === 'drain').map((p) => r.flow.get(p.id)!);
    expect(a).toBeCloseTo(c, 5);
    expect(a).toBeGreaterThan(0.2);
  });

  it('водяное колесо крутится только если воде есть куда уйти, и крутит вертушку', () => {
    const dead = row('P-W-v');
    expect(Math.abs(flowOf(dead, 'waterwheel'))).toBeLessThan(1e-6);
    const b = row('P-W-D', [{ type: 'fan', x: 2, y: 0, rot: 0 }]);
    const w = solveFluid(b);
    const m = solveMech(b, null, w);
    expect(Math.abs(m.speed.get(b.at(2, 1)!.id)!)).toBeGreaterThan(0.5);
    expect(Math.abs(m.speed.get(b.at(2, 0)!.id)!)).toBeGreaterThan(0.5);
  });
});
