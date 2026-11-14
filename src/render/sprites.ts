import { C } from './colors';
import { disc, line, rect, type Ctx } from './px';

/** Состояние для рисования детали. */
export interface SpriteState {
  on?: boolean;
  pressed?: boolean;
  /** выход 0..1 (яркость, громкость), для мотора — угол */
  level?: number;
  angle?: number;
  mask?: number;
  short?: boolean;
  t: number;
}

/** Спрайт рисуется в локальных координатах 16×16 при rot = 0 (выводы слева и справа). */
export type SpriteFn = (c: Ctx, s: SpriteState) => void;

const sprites = new Map<string, SpriteFn>();
export function registerSprite(type: string, fn: SpriteFn): void { sprites.set(type, fn); }
export function getSprite(type: string): SpriteFn | undefined { return sprites.get(type); }

const WIRE = C.lgray;
const leads = (c: Ctx, l = 4, r = 4) => { rect(c, 0, 7, l, 2, WIRE); rect(c, 16 - r, 7, r, 2, WIRE); };

registerSprite('wire', (c, s) => {
  const m = s.mask ?? 0;
  if (!m) { rect(c, 3, 7, 10, 2, WIRE); rect(c, 3, 6, 1, 4, WIRE); rect(c, 12, 6, 1, 4, WIRE); return; }
  rect(c, 7, 7, 2, 2, WIRE);
  if (m & 1) rect(c, 7, 0, 2, 7, WIRE);
  if (m & 2) rect(c, 9, 7, 7, 2, WIRE);
  if (m & 4) rect(c, 7, 9, 2, 7, WIRE);
  if (m & 8) rect(c, 0, 7, 7, 2, WIRE);
  const n = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  if (n >= 3) rect(c, 6, 6, 4, 4, WIRE);
  if (n === 1) { // открытый конец — заглушка
    rect(c, 6, 6, 4, 4, C.dgray);
  }
});

registerSprite('battery', (c, s) => {
  leads(c, 2, 2);
  const blink = s.short && Math.floor(s.t * 8) % 2 === 0;
  rect(c, 2, 3, 11, 10, C.black);
  rect(c, 3, 4, 4, 8, C.dgray);
  rect(c, 7, 4, 5, 8, blink ? C.white : C.red);
  rect(c, 3, 4, 9, 1, blink ? C.yellow : C.lgray);
  rect(c, 13, 6, 1, 4, C.lgray);
  rect(c, 4, 8, 2, 1, C.white); // минус
  rect(c, 8, 8, 3, 1, C.white); // плюс
  rect(c, 9, 7, 1, 3, C.white);
});

registerSprite('lamp', (c, s) => {
  const lv = s.level ?? 0;
  leads(c, 3, 3);
  const glass = lv > 0.5 ? C.yellow : lv > 0.12 ? C.orange : lv > 0.02 ? C.brown : C.dgray;
  disc(c, 8, 8, 6, C.black);
  disc(c, 8, 8, 5, glass);
  const fil = lv > 0.12 ? C.white : C.lgray;
  rect(c, 5, 9, 1, 2, fil); rect(c, 10, 9, 1, 2, fil);
  rect(c, 6, 8, 1, 1, fil); rect(c, 7, 9, 2, 1, fil); rect(c, 9, 8, 1, 1, fil);
  rect(c, 5, 5, 2, 1, C.white); rect(c, 5, 6, 1, 1, C.white);
});

registerSprite('switch', (c, s) => {
  leads(c, 4, 4);
  rect(c, 2, 11, 12, 3, C.brown);
  rect(c, 3, 12, 10, 1, s.on ? C.green : C.red);
  rect(c, 3, 6, 2, 4, C.lavender);
  rect(c, 11, 6, 2, 4, C.lavender);
  if (s.on) {
    rect(c, 4, 6, 9, 2, C.white);
    rect(c, 11, 4, 3, 3, C.white);
  } else {
    line(c, 4, 6, 10, 1, C.white, 2);
  }
});

registerSprite('button', (c, s) => {
  leads(c, 4, 4);
  rect(c, 2, 12, 12, 2, C.brown);
  rect(c, 3, 8, 2, 3, C.lavender);
  rect(c, 11, 8, 2, 3, C.lavender);
  const p = s.pressed;
  const by = p ? 7 : 4;
  rect(c, 3, by, 10, 2, C.lgray);
  rect(c, 7, by - 2, 2, 2, C.dgray);
  rect(c, 5, by - 4, 6, 3, C.black);
  rect(c, 6, by - 4, 4, 2, p ? C.pink : C.red);
});

registerSprite('motor', (c, s) => {
  leads(c, 3, 3);
  disc(c, 8, 8, 6, C.black);
  disc(c, 8, 8, 5, C.lavender);
  rect(c, 5, 5, 2, 1, C.lgray);
  // вертушка
  const a = s.angle ?? 0;
  for (let k = 0; k < 3; k++) {
    const ang = a + (k * Math.PI * 2) / 3;
    line(c, 7.5, 7.5, 7.5 + Math.cos(ang) * 5, 7.5 + Math.sin(ang) * 5, C.orange, 2);
  }
  rect(c, 7, 7, 2, 2, C.white);
});

registerSprite('buzzer', (c, s) => {
  const lv = s.level ?? 0;
  const shake = lv > 0.2 ? (Math.floor(s.t * 40) % 2) : 0;
  leads(c, 3, 3);
  disc(c, 8, 8 - shake, 6, C.black);
  disc(c, 8, 8 - shake, 5, C.dgray);
  disc(c, 8, 8 - shake, 3, C.black);
  rect(c, 7, 7 - shake, 2, 2, lv > 0.2 ? C.yellow : C.dgray);
});

registerSprite('led', (c, s) => {
  const lv = s.level ?? 0;
  leads(c, 4, 4);
  const body = lv > 0.2 ? C.red : C.plum;
  // треугольник-стрелка: ток идёт слева направо
  for (let x = 4; x <= 10; x++) {
    const hh = Math.round(((11 - x) / 7) * 5);
    rect(c, x, 8 - hh, 1, hh * 2, body);
  }
  rect(c, 4, 3, 1, 10, C.black);
  rect(c, 11, 3, 2, 10, lv > 0.2 ? C.white : C.lgray);
  if (lv > 0.2) { rect(c, 5, 6, 2, 1, C.pink); }
});

/** Нарисовать деталь в клетке (px, py) с поворотом. */
export function drawPart(c: Ctx, type: string, px: number, py: number, rot: number, s: SpriteState): void {
  const fn = sprites.get(type);
  if (!fn) { rect(c, px + 2, py + 2, 12, 12, C.pink); return; }
  c.save();
  c.translate(px + 8, py + 8);
  c.rotate((rot * Math.PI) / 2);
  c.translate(-8, -8);
  fn(c, s);
  c.restore();
}
