import type { LevelDef } from './types';

const mods = import.meta.glob<LevelDef>('./*.json', { eager: true, import: 'default' });

/** Все уровни, отсортированные по имени файла (01-…, 02-…). */
export const LEVELS: LevelDef[] = Object.keys(mods)
  .sort()
  .map((k) => mods[k]);

export function levelsOf(world: string): LevelDef[] {
  return LEVELS.filter((l) => l.world === world);
}

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}
