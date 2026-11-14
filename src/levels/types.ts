import type { Goal } from '../sim/goals';
import type { World } from '../core/parts';

export interface PlacedSpec {
  type: string;
  x: number;
  y: number;
  rot?: number;
  locked?: boolean;
  on?: boolean;
  pressed?: boolean;
  level?: number;
  hint?: string;
}

export interface PathSpec {
  type: string;
  path: [number, number][];
  locked?: boolean;
  hint?: string;
}

export type ItemSpec = PlacedSpec | PathSpec;

export interface LevelDef {
  id: string;
  world: World;
  mode: 'instruction' | 'puzzle' | 'sandbox';
  title: string;
  grid: { w: number; h: number };
  /** тип → сколько можно поставить (-1 = сколько угодно) */
  palette: Record<string, number>;
  prePlaced?: ItemSpec[];
  steps?: ItemSpec[];
  goal?: Goal;
  stars?: { maxParts: number };
  intro?: string;
  outro?: string;
  /** подсказка после «Включаем!» */
  afterPower?: string;
  /** эталонное решение задачки (для тестов) */
  solution?: ItemSpec[];
}

export const isPath = (s: ItemSpec): s is PathSpec => 'path' in s;
