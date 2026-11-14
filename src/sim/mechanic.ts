import type { Board, Part } from '../core/board';
import { connects } from '../core/connect';
import { DX, DY, type Dir } from '../core/geom';
import { getPart } from '../core/parts';
import type { ElectricResult } from './electric';

/** Скорость, ниже которой считаем, что не крутится. */
export const SPIN_MIN = 0.05;
const EPS = 1e-6;

export interface MechResult {
  /** угловая скорость (для шестерён и осей; + = по часовой) или скорость ленты (для ремней) */
  speed: Map<number, number>;
  /** детали в заклинившей системе */
  jammed: Set<number>;
  hasJam: boolean;
  /** номер связной механической системы */
  comp: Map<number, number>;
}

/** Во сколько раз значение у b больше, чем у a (null — не связаны механически). */
function ratio(a: Part, b: Part): number | null {
  const ma = getPart(a.type).mech, mb = getPart(b.type).mech;
  if (!ma || !mb) return null;
  const ta = ma.teeth ?? 8, tb = mb.teeth ?? 8;
  const k = `${ma.role}-${mb.role}`;
  switch (k) {
    case 'gear-gear': return -ta / tb; // зацепление: в другую сторону, маленькая быстрее
    case 'gear-axle': case 'axle-gear': case 'axle-axle': return 1; // ось: то же вращение
    case 'gear-belt': return ta; // лента бежит со скоростью края шестерни
    case 'belt-gear': return 1 / tb;
    case 'belt-belt': return 1;
    default: return null;
  }
}

function sourceSpeed(p: Part, el: ElectricResult | null): number {
  const src = getPart(p.type).mech?.source;
  if (src === 'crank') return p.on ? 1 : 0;
  if (src === 'motor') return el?.level.get(p.id) ?? 0;
  return 0;
}

export function solveMech(board: Board, el: ElectricResult | null): MechResult {
  const res: MechResult = { speed: new Map(), jammed: new Set(), hasJam: false, comp: new Map() };
  const parts = board.parts.filter((p) => getPart(p.type).mech);
  const adj = new Map<number, { q: Part; r: number }[]>();
  for (const p of parts) adj.set(p.id, []);
  for (const p of parts) {
    for (const d of [1, 2] as Dir[]) {
      if (!connects(board, p.x, p.y, d)) continue;
      const q = board.at(p.x + DX[d], p.y + DY[d])!;
      const r = ratio(p, q);
      if (r === null || !adj.has(q.id)) continue;
      adj.get(p.id)!.push({ q, r });
      adj.get(q.id)!.push({ q: p, r: 1 / r });
    }
  }

  let compId = 0;
  for (const start of parts) {
    if (res.comp.has(start.id)) continue;
    // обход: относительные скорости от корня = 1
    const rel = new Map<number, number>([[start.id, 1]]);
    const members: Part[] = [start];
    let conflict = false;
    for (let i = 0; i < members.length; i++) {
      const p = members[i];
      const vp = rel.get(p.id)!;
      for (const { q, r } of adj.get(p.id)!) {
        const want = vp * r;
        const have = rel.get(q.id);
        if (have === undefined) { rel.set(q.id, want); members.push(q); }
        else if (Math.abs(have - want) > EPS * Math.max(1, Math.abs(want))) conflict = true;
      }
    }
    for (const m of members) res.comp.set(m.id, compId);
    compId++;

    // источники задают масштаб; разные мнения = заклинило
    let k: number | null = null;
    for (const m of members) {
      const s = sourceSpeed(m, el);
      if (Math.abs(s) < SPIN_MIN) continue;
      const km = s / rel.get(m.id)!;
      if (k === null) k = km;
      else if (Math.abs(k - km) > EPS * Math.max(1, Math.abs(km))) conflict = true;
    }
    if (k !== null && conflict) {
      for (const m of members) { res.jammed.add(m.id); res.speed.set(m.id, 0); }
      res.hasJam = true;
      continue;
    }
    for (const m of members) res.speed.set(m.id, k === null || conflict ? 0 : k * rel.get(m.id)!);
  }
  return res;
}

export function spins(p: Part, m: MechResult): boolean {
  return Math.abs(m.speed.get(p.id) ?? 0) > SPIN_MIN;
}
