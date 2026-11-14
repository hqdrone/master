import type { Dir } from './geom';

export type PortKind = 'electric' | 'water' | 'air' | 'mechanical' | 'belt';
export type World = 'electric' | 'mechanic' | 'water' | 'air' | 'factory';

/** Электрическая модель детали (для MNA). */
export interface ElectricSpec {
  /** source — батарейка (ЭДС + внутреннее сопротивление), load — нагрузка, switch — ключ, diode — светодиод */
  kind: 'source' | 'load' | 'switch' | 'diode';
  /** сопротивление, Ом */
  r: number;
  /** ЭДС источника, В */
  volts?: number;
  /** прямое падение напряжения диода, В */
  vf?: number;
  /** «номинальный» ток, при котором выход = 1 */
  nominal?: number;
}

/** Механическая модель детали. */
export interface MechSpec {
  /** gear — всё, что вращается и цепляется зубьями; axle — ось; belt — ремень/конвейер */
  role: 'gear' | 'axle' | 'belt';
  /** число зубьев (для gear) */
  teeth?: number;
  /** стороны (при rot = 0), где деталь цепляется; по умолчанию все */
  sides?: Dir[];
  /** источник вращения */
  source?: 'crank' | 'motor';
  /** деталь «показывает» вращение (вертушка, колесо…) */
  output?: boolean;
}

export interface PartDef {
  type: string;
  world: World;
  /** Провод/труба/шланг: соединяется со всеми соседями этого типа (автотайлинг). */
  autotile?: PortKind;
  /** ограничить стороны автотайлинга (при rot = 0), например конвейер — только E/W */
  sides?: Dir[];
  mech?: MechSpec;
  /** поворот ни на что не влияет (шестерни) */
  anyRot?: boolean;
  /** Два вывода детали при rot = 0 (для электрики: [минус/анод, плюс/катод]). */
  terminals?: [Dir, Dir];
  portKind?: PortKind;
  electric?: ElectricSpec;
  /** Поворот на 180° ничего не меняет (для проверки шагов инструкции). */
  symmetric?: boolean;
  interactive?: 'toggle' | 'hold';
  /** Чем деталь «показывает» работу. */
  output?: 'light' | 'spin' | 'sound' | 'led';
  /** Порог выхода, выше которого деталь считается работающей. */
  onThreshold?: number;
}

const registry = new Map<string, PartDef>();

export function registerPart(def: PartDef): void {
  registry.set(def.type, def);
}

export function getPart(type: string): PartDef {
  const d = registry.get(type);
  if (!d) throw new Error(`Неизвестная деталь: ${type}`);
  return d;
}

export function hasPart(type: string): boolean {
  return registry.has(type);
}

export function allParts(): PartDef[] {
  return [...registry.values()];
}
