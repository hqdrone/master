import type { Board, Part } from '../core/board';
import { getPart } from '../core/parts';
import { isOn, solveElectric, type ElectricResult, type Overrides } from './electric';

export type Goal = Record<string, unknown>;

export interface GoalCtx {
  board: Board;
  res: ElectricResult;
  solve: (ov: Overrides) => ElectricResult;
}

type Checker = (arg: any, ctx: GoalCtx) => boolean;

const checkers = new Map<string, Checker>();

/** Новые условия победы добавляются здесь. */
export function registerGoal(name: string, fn: Checker): void {
  checkers.set(name, fn);
}

export function checkGoal(goal: Goal, ctx: GoalCtx): boolean {
  for (const [k, arg] of Object.entries(goal)) {
    const fn = checkers.get(k);
    if (!fn) throw new Error(`Неизвестная цель: ${k}`);
    if (!fn(arg, ctx)) return false;
  }
  return true;
}

export function makeCtx(board: Board, res?: ElectricResult): GoalCtx {
  return { board, res: res ?? solveElectric(board), solve: (ov) => solveElectric(board, ov) };
}

const ofType = (b: Board, t: string) => b.parts.filter((p) => p.type === t);
const anyOn = (b: Board, res: ElectricResult, t: string) => ofType(b, t).some((p) => isOn(p, res));

function countCheck(t: string) {
  return (arg: unknown, { board, res }: GoalCtx) => {
    const list = ofType(board, t);
    const on = list.filter((p) => isOn(p, res)).length;
    if (arg === false) return on === 0;
    if (arg === 'all') return list.length > 0 && on === list.length;
    if (typeof arg === 'number') return on >= arg;
    return on > 0; // true | 'any'
  };
}

registerGoal('all', (arg: Goal[], ctx) => arg.every((g) => checkGoal(g, ctx)));
registerGoal('any', (arg: Goal[], ctx) => arg.some((g) => checkGoal(g, ctx)));
registerGoal('not', (arg: Goal, ctx) => !checkGoal(arg, ctx));
registerGoal('lampOn', countCheck('lamp'));
registerGoal('motorSpins', countCheck('motor'));
registerGoal('buzzerOn', countCheck('buzzer'));
registerGoal('ledOn', countCheck('led'));
registerGoal('noShortCircuit', (arg, { res }) => (arg === false ? res.hasShort : !res.hasShort));
registerGoal('count', (arg: Record<string, number>, { board }) =>
  Object.entries(arg).every(([t, n]) => ofType(board, t).length >= n),
);

function inputs(board: Board, kind: string): Part[] {
  return board.parts.filter((p) => {
    const it = getPart(p.type).interactive;
    return it && (kind === 'any' || p.type === kind);
  });
}

function combos(list: Part[]): Overrides[] {
  const out: Overrides[] = [];
  for (let m = 0; m < 1 << list.length; m++) {
    out.push(new Map(list.map((p, i) => [p.id, !!(m & (1 << i))])));
  }
  return out;
}

/** Таблица истинности: выход работает ровно тогда, когда fn(входы). */
registerGoal('truth', (arg: { inputs: string; fn: 'and' | 'or' | 'id'; output: string }, ctx) => {
  const ins = inputs(ctx.board, arg.inputs);
  const need = arg.fn === 'id' ? 1 : 2;
  if (ins.length !== need) return false;
  return combos(ins).every((ov) => {
    const vals = [...ov.values()];
    const expect = arg.fn === 'and' ? vals.every(Boolean) : vals.some(Boolean);
    const r = ctx.solve(ov);
    return !r.hasShort && anyOn(ctx.board, r, arg.output) === expect;
  });
});

/** Можно ли, щёлкая выключателями/кнопками, получить состояние state. */
registerGoal('reachable', (arg: { inputs: string; state: Record<string, boolean> }, ctx) => {
  const ins = inputs(ctx.board, arg.inputs);
  if (ins.length > 6) return false;
  return combos(ins).some((ov) => {
    const r = ctx.solve(ov);
    return Object.entries(arg.state).every(([t, want]) => anyOn(ctx.board, r, t) === want);
  });
});
