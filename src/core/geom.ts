/** Направления: 0 = север, 1 = восток, 2 = юг, 3 = запад. */
export type Dir = 0 | 1 | 2 | 3;
export const N: Dir = 0;
export const E: Dir = 1;
export const S: Dir = 2;
export const W: Dir = 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opp = (d: number): Dir => ((d + 2) % 4) as Dir;
/** Повернуть направление по часовой стрелке на rot четвертей. */
export const rotDir = (d: number, rot: number): Dir => ((((d + rot) % 4) + 4) % 4) as Dir;
