import { describe, expect, it } from 'vitest';
import '../src/core/electricParts';
import '../src/core/mechanicParts';
import '../src/core/waterParts';
import { LEVELS } from '../src/levels';
import { boardForLevel, placeItem } from '../src/levels/build';
import { isPath } from '../src/levels/types';
import { checkGoal, makeCtx } from '../src/sim/goals';
import { getPart } from '../src/core/parts';
import { runWater } from '../src/sim/fluid';

describe('уровни', () => {
  it('14 уровней электрики, 10 механики, id уникальны', () => {
    expect(LEVELS.filter((l) => l.world === 'electric').length).toBe(14);
    expect(LEVELS.filter((l) => l.world === 'mechanic').length).toBe(10);
    expect(LEVELS.filter((l) => l.world === 'water').length).toBe(10);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  for (const level of LEVELS) {
    describe(`${level.id} ${level.title}`, () => {
      it('детали существуют и в пределах поля', () => {
        const items = [...(level.prePlaced ?? []), ...(level.steps ?? []), ...(level.solution ?? [])];
        for (const s of items) {
          getPart(s.type);
          const cells = isPath(s) ? s.path : [[s.x, s.y]];
          for (const [x, y] of cells) {
            expect(x >= 0 && y >= 0 && x < level.grid.w && y < level.grid.h, `${s.type} ${x},${y}`).toBe(true);
          }
        }
        for (const t of Object.keys(level.palette)) getPart(t);
      });

      it('без решения цель не выполнена', () => {
        expect(checkGoal(level.goal!, makeCtx(boardForLevel(level)))).toBe(false);
      });

      it('решается', () => {
        const b = boardForLevel(level);
        const items = level.mode === 'instruction' ? level.steps! : level.solution!;
        expect(items?.length).toBeGreaterThan(0);
        const before = b.parts.length;
        for (const s of items) placeItem(b, s, false);
        // шаги не должны налезать друг на друга (переключатели уже стоящих деталей не считаем)
        const cells = items.reduce((n, s) => n + (isPath(s) ? s.path.length : boardForLevel(level).at(s.x, s.y) ? 0 : 1), 0);
        expect(b.parts.length - before).toBe(cells);
        // в инструкции после сборки нужно щёлкнуть выключатели / нажать кнопки
        if (level.mode === 'instruction') for (const p of b.parts) { p.on = true; p.pressed = true; }
        if (level.world === 'water') runWater(b, 20); // баки наполняются/пустеют со временем
        const ctx = makeCtx(b);
        expect(ctx.res.hasShort).toBe(false);
        expect(ctx.mech.hasJam).toBe(false);
        expect(checkGoal(level.goal!, ctx)).toBe(true);
        // хватает деталей в палитре
        for (const [t, n] of Object.entries(level.palette)) {
          if (n >= 0) expect(b.count(t, true), t).toBeLessThanOrEqual(n);
        }
        if (level.stars) expect(b.parts.filter((p) => !p.pre).length).toBeLessThanOrEqual(level.stars.maxParts);
      });
    });
  }

  it('«Лампа, но не пищалка»: пищалка без выключателя не засчитывается', () => {
    const level = LEVELS.find((l) => l.id === 'el-10')!;
    const b = boardForLevel(level);
    for (const s of level.solution!) if (isPath(s)) placeItem(b, s, false);
    b.add({ type: 'switch', x: 4, y: 2, rot: 0, on: true });
    b.add({ type: 'wire', x: 4, y: 4, rot: 0 }); // пищалка всегда пищит
    expect(checkGoal(level.goal!, makeCtx(b))).toBe(false);
  });

  it('«Обе кнопки»: параллельные кнопки не подходят', () => {
    const or = LEVELS.find((l) => l.id === 'el-14')!;
    const and = LEVELS.find((l) => l.id === 'el-13')!;
    const b = boardForLevel(or);
    for (const s of or.solution!) placeItem(b, s, false);
    expect(checkGoal(and.goal!, makeCtx(b))).toBe(false);
    expect(checkGoal(or.goal!, makeCtx(b))).toBe(true);
  });
});

describe('механические задачки: неверные решения', () => {
  const lv = (id: string) => LEVELS.find((l) => l.id === id)!;
  const tryIt = (id: string, items: Parameters<typeof placeItem>[1][]) => {
    const b = boardForLevel(lv(id));
    for (const s of items) placeItem(b, s, false);
    return checkGoal(lv(id).goal!, makeCtx(b));
  };
  it('«По часовой»: одни шестерни дают против часовой', () => {
    expect(tryIt('mh-07', [2, 3, 4, 5].map((x) => ({ type: 'gear_s', x, y: 3 })))).toBe(false);
  });
  it('«Быстрая вертушка»: цепочка маленьких шестерён не ускоряет', () => {
    expect(tryIt('mh-08', [2, 3, 4, 5].map((x) => ({ type: 'gear_s', x, y: 3 })))).toBe(false);
  });
  it('«Две ручки»: шестерни между ручками заклинивают', () => {
    expect(tryIt('mh-10', [{ type: 'gear_s', x: 1, y: 3 }, { type: 'gear_s', x: 1, y: 4 }, { type: 'gear_s', x: 2, y: 3 }])).toBe(false);
  });
});

describe('водяные задачки: неверные решения', () => {
  const lv = (id: string) => LEVELS.find((l) => l.id === id)!;
  it('«Наполни бак»: открыли оба крана — лужа', () => {
    const b = boardForLevel(lv('wt-07'));
    for (const p of b.parts) if (p.type === 'valve' || p.type === 'pump') p.on = true;
    runWater(b, 20);
    expect(checkGoal(lv('wt-07').goal!, makeCtx(b))).toBe(false);
  });
  it('«Без луж»: третий конец не закрыт — лужа', () => {
    const b = boardForLevel(lv('wt-08'));
    placeItem(b, { type: 'fountain', x: 4, y: 1, rot: 0 }, false);
    placeItem(b, { type: 'drain', x: 4, y: 7, rot: 1 }, false);
    expect(checkGoal(lv('wt-08').goal!, makeCtx(b))).toBe(false);
  });
  it('«Колесо и вертушка»: без слива колесо стоит', () => {
    const b = boardForLevel(lv('wt-09'));
    for (const s of lv('wt-09').solution!) if (!('type' in s && s.type === 'drain')) placeItem(b, s, false);
    expect(checkGoal(lv('wt-09').goal!, makeCtx(b))).toBe(false);
  });
});
