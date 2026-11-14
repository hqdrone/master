import { describe, expect, it } from 'vitest';
import { isOn, solveElectric } from '../src/sim/electric';
import { solveLinear } from '../src/sim/linear';
import { connectionMask } from '../src/core/connect';
import { of, parse } from './helpers';

const lampLevels = (rows: string[]) => {
  const b = parse(rows);
  const r = solveElectric(b);
  return of(b, 'lamp').map((p) => r.level.get(p.id)!);
};

describe('линейный решатель', () => {
  it('решает 2×2', () => {
    const x = solveLinear(new Float64Array([2, 1, 1, 3]), new Float64Array([3, 5]), 2);
    expect(x[0]).toBeCloseTo(0.8);
    expect(x[1]).toBeCloseTo(1.4);
  });
});

describe('автотайлинг', () => {
  it('угол и тройник', () => {
    const b = parse(['+-', '|.', '+-']);
    expect(connectionMask(b, 0, 0)).toBe(0b0110); // E + S
    expect(connectionMask(b, 0, 1)).toBe(0b0101); // N + S
  });
});

describe('электрика', () => {
  it('одна лампа горит ярко', () => {
    const [l] = lampLevels(['+-L-+', '|...|', '+-B-+']);
    expect(l).toBeGreaterThan(0.95);
  });

  it('незамкнутая цепь — ток не течёт', () => {
    const b = parse(['+-L.+', '|...|', '+-B-+']);
    const r = solveElectric(b);
    expect(r.batteryCurrent).toBeLessThan(1e-6);
    expect(isOn(of(b, 'lamp')[0], r)).toBe(false);
  });

  it('последовательно тусклее, параллельно ярко', () => {
    const series = lampLevels(['+-L-L-+', '|.....|', '+--B--+']);
    const parallel = lampLevels(['+-L-+', '|...|', '+-L-+', '|...|', '+-B-+']);
    expect(series[0]).toBeLessThan(0.4);
    expect(series[0]).toBeGreaterThan(0.12); // но всё же горят
    expect(parallel[0]).toBeGreaterThan(0.8);
    expect(parallel[1]).toBeGreaterThan(0.8);
  });

  it('выключатель разрывает цепь', () => {
    const on = lampLevels(['+-L-S-+', '|.....|', '+--B--+']);
    const off = lampLevels(['+-L-s-+', '|.....|', '+--B--+']);
    expect(on[0]).toBeGreaterThan(0.9);
    expect(off[0]).toBeLessThan(1e-6);
  });

  it('кнопка работает, пока нажата', () => {
    const b = parse(['+-Z-K-+', '|.....|', '+--B--+']);
    const z = of(b, 'buzzer')[0];
    expect(isOn(z, solveElectric(b))).toBe(false);
    of(b, 'button')[0].pressed = true;
    expect(isOn(z, solveElectric(b))).toBe(true);
  });

  it('короткое замыкание определяется', () => {
    const b = parse(['+---+', '|...|', '+-B-+']);
    const r = solveElectric(b);
    expect(r.hasShort).toBe(true);
    expect(r.shorted.size).toBe(1);
  });

  it('лампа, закороченная проводом, — тоже замыкание и не горит', () => {
    const b = parse(['+-L-+', '+---+', '|...|', '+-B-+']);
    const r = solveElectric(b);
    expect(r.hasShort).toBe(true);
    expect(isOn(of(b, 'lamp')[0], r)).toBe(false);
  });

  it('нормальная цепь — не замыкание', () => {
    const b = parse(['+-L-+', '|...|', '+-B-+']);
    expect(solveElectric(b).hasShort).toBe(false);
  });

  it('светодиод светит только в одну сторону', () => {
    // ток идёт от плюса (справа у B) по кругу: вниз нет — вверх по правой стороне, налево по верху
    const fwd = parse(['+-d-+', '|...|', '+-B-+']);
    const rev = parse(['+-D-+', '|...|', '+-B-+']);
    const rf = solveElectric(fwd);
    const rr = solveElectric(rev);
    expect(isOn(of(fwd, 'led')[0], rf)).toBe(true);
    expect(isOn(of(rev, 'led')[0], rr)).toBe(false);
    expect(rr.ledReversed.size).toBe(1);
  });

  it('мотор крутится, направление зависит от полярности', () => {
    const b = parse(['+-M-+', '|...|', '+-B-+']);
    const r = solveElectric(b);
    const m = of(b, 'motor')[0];
    expect(isOn(m, r)).toBe(true);
    const s1 = Math.sign(r.level.get(m.id)!);
    b.rotate(m.id, 2);
    const s2 = Math.sign(solveElectric(b).level.get(m.id)!);
    expect(s1).toBe(-s2);
  });

  it('детали без батарейки и пустое поле не ломают решатель', () => {
    expect(solveElectric(parse(['....'])).hasShort).toBe(false);
    const r = solveElectric(parse(['L-L', '..M']));
    expect([...r.level.values()].every((v) => v === 0)).toBe(true);
  });

  it('ток по проводам сохраняется (анимация)', () => {
    const b = parse(['+-L-+', '|...|', '+-B-+']);
    const r = solveElectric(b);
    const lamp = r.current.get(of(b, 'lamp')[0].id)!;
    for (const l of r.links) expect(Math.abs(Math.abs(l.i) - Math.abs(lamp))).toBeLessThan(1e-6);
  });
});

describe('доска', () => {
  it('snapshot/restore сохраняет все детали', () => {
    const b = parse(['+-L-+', '|...|', '+-B-+']);
    const s = b.snapshot();
    b.remove(b.parts[0].id);
    b.restore(s);
    expect(b.parts.length).toBe(12);
    expect(b.at(2, 2)?.type).toBe('battery');
  });
});
