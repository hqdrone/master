import type { Board, Part } from '../core/board';
import { connects, terminalAt } from '../core/connect';
import { DIRS, DX, DY, opp, type Dir } from '../core/geom';
import { getPart } from '../core/parts';
import type { Link } from './electric';
import { solveLinear } from './linear';

// Упрощённая гидравлика: та же «узловая» модель, что и у тока.
// Насос — источник давления, слив/фонтан/открытый конец — выход воды, кран — разрыв.
const G_LINK = 50;
const G_PUMP = 1;
const P_PUMP = 1;
const G_SINK = 1;
const G_OPEN = 2;
const G_TANK = 1;
const G_TANK_OUT = 3;
const H_TANK = 0.8; // давление полного бака (меньше насоса — насос всегда может долить)
const G_VALVE = 20;
const G_WHEEL = 4;
const GMIN = 1e-9;

/** Расход «насос → один слив» — для нормировки скоростей. */
export const FLOW_NOM = 0.5;
/** Сколько «воды» в полном баке: при номинальном расходе бак наполняется за 4 с. */
export const TANK_CAP = 2;
export const FLOW_MIN = 0.01;

export interface OpenEnd { x: number; y: number; d: Dir; flow: number }

export interface FluidResult {
  /** расход через деталь: насос — наружу, слив/фонтан — внутрь, кран/колесо — от вывода 0 к 1 */
  flow: Map<number, number>;
  links: Link[];
  /** детали, в которых есть вода (под давлением) */
  wet: Set<number>;
  openEnds: OpenEnd[];
  /** сколько втекает в бак (минус — вытекает) */
  tankIn: Map<number, number>;
  spilling: boolean;
  totalFlow: number;
}

/** Давление воды на выходе бака: почти постоянное, пока бак не пуст. */
const tankHead = (p: Part) => H_TANK * Math.min(1, (p.level ?? 0) / 0.1);

export const isPipe = (p: Part) => getPart(p.type).fluid?.kind === 'pipe';

export function solveFluid(board: Board): FluidResult {
  const res: FluidResult = { flow: new Map(), links: [], wet: new Set(), openEnds: [], tankIn: new Map(), spilling: false, totalFlow: 0 };
  const cellNode = new Map<number, number>();
  const termNode = new Map<number, number[]>();
  let n = 0;
  const parts = board.parts.filter((p) => getPart(p.type).fluid);
  if (!parts.length) return res;
  for (const p of parts) {
    const def = getPart(p.type);
    if (isPipe(p)) cellNode.set(p.id, n++);
    else termNode.set(p.id, (def.terminals ?? []).map(() => n++));
  }
  const nodeFor = (p: Part, d: Dir): number => {
    const c = cellNode.get(p.id);
    if (c !== undefined) return c;
    const k = terminalAt(p, d);
    return k >= 0 ? termNode.get(p.id)?.[k] ?? -1 : -1;
  };

  const A = new Float64Array(n * n);
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++) A[i * n + i] += GMIN;
  const toGround = (a: number, g: number, p = 0) => { A[a * n + a] += g; rhs[a] += g * p; };
  const between = (a: number, b: number, g: number) => {
    A[a * n + a] += g; A[b * n + b] += g; A[a * n + b] -= g; A[b * n + a] -= g;
  };

  const links: { a: number; b: number; ax: number; ay: number; bx: number; by: number }[] = [];
  for (const p of parts) {
    for (const d of [1, 2] as Dir[]) {
      if (!connects(board, p.x, p.y, d, 'water')) continue;
      const q = board.at(p.x + DX[d], p.y + DY[d])!;
      const a = nodeFor(p, d), b = nodeFor(q, opp(d));
      if (a < 0 || b < 0) continue;
      links.push({ a, b, ax: p.x, ay: p.y, bx: q.x, by: q.y });
      between(a, b, G_LINK);
    }
  }

  // открытые концы труб
  const ends: { p: Part; node: number; d: Dir }[] = [];
  for (const p of parts) {
    if (!isPipe(p)) continue;
    const conn = DIRS.filter((d) => connects(board, p.x, p.y, d, 'water'));
    if (conn.length > 1) continue;
    const d = conn.length ? opp(conn[0]) : (1 as Dir);
    const node = cellNode.get(p.id)!;
    ends.push({ p, node, d });
    toGround(node, G_OPEN);
  }

  for (const p of parts) {
    const t = termNode.get(p.id);
    if (!t) continue;
    const kind = getPart(p.type).fluid!.kind;
    if (kind === 'pump' && p.on) toGround(t[0], G_PUMP, P_PUMP);
    if (kind === 'drain' || kind === 'fountain') toGround(t[0], G_SINK);
    if (kind === 'tank') { toGround(t[0], G_TANK); toGround(t[1], G_TANK_OUT, tankHead(p)); }
    if (kind === 'valve' && p.on) between(t[0], t[1], G_VALVE);
    if (kind === 'wheel') between(t[0], t[1], G_WHEEL);
  }

  const v = solveLinear(A, rhs, n);

  for (const l of links) res.links.push({ ax: l.ax, ay: l.ay, bx: l.bx, by: l.by, i: (v[l.a] - v[l.b]) * G_LINK });
  for (const e of ends) {
    const f = v[e.node] * G_OPEN;
    res.openEnds.push({ x: e.p.x, y: e.p.y, d: e.d, flow: f });
    if (f > FLOW_MIN) res.spilling = true;
  }
  for (const p of parts) {
    const c = cellNode.get(p.id);
    if (c !== undefined) { if (v[c] > 0.01) res.wet.add(p.id); continue; }
    const t = termNode.get(p.id)!;
    if (t.some((k) => v[k] > 0.01)) res.wet.add(p.id);
    const kind = getPart(p.type).fluid!.kind;
    let f = 0;
    if (kind === 'pump') f = p.on ? G_PUMP * (P_PUMP - v[t[0]]) : 0;
    if (kind === 'drain' || kind === 'fountain') f = G_SINK * v[t[0]];
    if (kind === 'valve') f = p.on ? G_VALVE * (v[t[0]] - v[t[1]]) : 0;
    if (kind === 'wheel') f = G_WHEEL * (v[t[0]] - v[t[1]]);
    if (kind === 'tank') {
      const inflow = G_TANK * v[t[0]] - G_TANK_OUT * (tankHead(p) - v[t[1]]);
      res.tankIn.set(p.id, inflow);
      f = inflow;
    }
    res.flow.set(p.id, f);
    if (kind === 'pump') res.totalFlow += Math.max(0, f);
  }
  return res;
}

/** Изменить уровни баков за dt. Возвращает true, если какой-то бак переливается. */
export function stepTanks(board: Board, res: FluidResult, dt: number): boolean {
  let overflow = false;
  for (const p of board.parts) {
    const inflow = res.tankIn.get(p.id);
    if (inflow === undefined) continue;
    const lv = (p.level ?? 0) + (inflow * dt) / TANK_CAP;
    if (lv > 1 && inflow > FLOW_MIN) overflow = true;
    p.level = Math.max(0, Math.min(1, lv));
  }
  return overflow;
}

/** Прогнать воду seconds секунд (для тестов и проверки уровней). */
export function runWater(board: Board, seconds: number, dt = 1 / 30): FluidResult {
  let res = solveFluid(board);
  for (let t = 0; t < seconds; t += dt) {
    stepTanks(board, res, dt);
    res = solveFluid(board);
  }
  return res;
}
