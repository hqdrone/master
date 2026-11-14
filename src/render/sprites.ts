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
  /** заклинило — трясётся */
  jam?: boolean;
  /** координата клетки в пикселях (для непрерывных лент) */
  gx?: number;
  /** в детали есть вода */
  wet?: boolean;
  /** уровень воды в баке 0..1 */
  fill?: number;
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

// ---------- Механика (оранжевый — вращение) ----------

function gear(c: Ctx, r: number, teeth: number, a: number, body: number, hub: number = C.brown): void {
  disc(c, 8, 8, r + 1, C.black);
  for (let k = 0; k < teeth; k++) {
    const ang = a + (k * Math.PI * 2) / teeth;
    const tx = 8 + Math.cos(ang) * (r + 1.5), ty = 8 + Math.sin(ang) * (r + 1.5);
    rect(c, Math.round(tx - 1.5), Math.round(ty - 1.5), 3, 3, C.black);
  }
  for (let k = 0; k < teeth; k++) {
    const ang = a + (k * Math.PI * 2) / teeth;
    const tx = 8 + Math.cos(ang) * (r + 1.2), ty = 8 + Math.sin(ang) * (r + 1.2);
    rect(c, Math.round(tx - 1), Math.round(ty - 1), 2, 2, body);
  }
  disc(c, 8, 8, r, body);
  disc(c, 8, 8, r * 0.45, hub);
  // метка, чтобы было видно вращение
  line(c, 8, 8, 8 + Math.cos(a) * r * 0.8, 8 + Math.sin(a) * r * 0.8, C.yellow);
  rect(c, 7, 7, 2, 2, C.black);
}

registerSprite('gear_s', (c, s) => gear(c, 6, 8, s.angle ?? 0, C.orange));
registerSprite('gear_b', (c, s) => gear(c, 8.5, 16, s.angle ?? 0, C.orange, C.peach));

registerSprite('crank', (c, s) => {
  gear(c, 6, 8, s.angle ?? 0, C.orange);
  const a = s.angle ?? 0;
  const hx = 8 + Math.cos(a) * 6, hy = 8 + Math.sin(a) * 6;
  line(c, 8, 8, hx, hy, C.lgray, 2);
  disc(c, hx, hy, 2.2, C.black);
  disc(c, hx, hy, 1.5, s.on ? C.red : C.pink);
});

registerSprite('fan', (c, s) => {
  gear(c, 4, 8, s.angle ?? 0, C.orange);
  const a = (s.angle ?? 0) * 1;
  const cols = [C.pink, C.yellow, C.blue, C.green];
  for (let k = 0; k < 4; k++) {
    const ang = a + (k * Math.PI) / 2;
    const ex = 8 + Math.cos(ang) * 7, ey = 8 + Math.sin(ang) * 7;
    const sx = 8 + Math.cos(ang + 0.5) * 5, sy = 8 + Math.sin(ang + 0.5) * 5;
    line(c, 8, 8, ex, ey, cols[k], 2);
    line(c, ex, ey, sx, sy, cols[k], 2);
  }
  disc(c, 8, 8, 1.5, C.white);
});

registerSprite('wheel', (c, s) => {
  const a = s.angle ?? 0;
  disc(c, 8, 8, 7.5, C.black);
  disc(c, 8, 8, 6.5, C.dgray);
  disc(c, 8, 8, 4.5, C.lgray);
  for (let k = 0; k < 3; k++) {
    const ang = a + (k * Math.PI * 2) / 3;
    line(c, 8, 8, 8 + Math.cos(ang) * 4.5, 8 + Math.sin(ang) * 4.5, C.dgray, 1);
  }
  disc(c, 8, 8, 1.6, C.orange);
});

registerSprite('pusher', (c, s) => {
  const a = s.angle ?? 0;
  // кривошип слева, шток вправо
  rect(c, 1, 12, 14, 2, C.brown);
  gear(c, 4, 8, a, C.orange);
  const px = 8 + Math.cos(a) * 3, py = 8 + Math.sin(a) * 3;
  const ext = Math.round(3 + Math.cos(a) * 3); // 0..6
  const headX = 11 + ext;
  line(c, px, py, headX - 2, 8, C.white, 1);
  rect(c, headX - 2, 7, 2, 2, C.lgray);
  rect(c, headX, 4, 3, 8, C.black);
  rect(c, headX, 5, 2, 6, C.red);
});

const BELT_D = C.black;
registerSprite('axle', (c, s) => {
  const m = s.mask ?? 0;
  const stripe = Math.floor(((s.angle ?? 0) * 2) % 4 + 4) % 4;
  const seg = (x: number, y: number, w: number, h: number, horiz: boolean) => {
    rect(c, x, y, w, h, C.lgray);
    const len = horiz ? w : h;
    for (let i = (stripe + (horiz ? x : y)) % 4; i < len; i += 4) {
      if (horiz) rect(c, x + i, y, 1, h, C.dgray); else rect(c, x, y + i, w, 1, C.dgray);
    }
  };
  if (!m) { seg(2, 6, 12, 4, true); return; }
  if (m & 1) seg(6, 0, 4, 8, false);
  if (m & 4) seg(6, 8, 4, 8, false);
  if (m & 8) seg(0, 6, 8, 4, true);
  if (m & 2) seg(8, 6, 8, 4, true);
  rect(c, 5, 5, 6, 6, C.dgray);
  rect(c, 6, 6, 4, 4, C.orange);
});

registerSprite('belt', (c, s) => {
  const m = s.mask ?? 0;
  const ph = Math.floor(((s.angle ?? 0) % 4) + 4) % 4;
  const band = (x: number, y: number, w: number, h: number, horiz: boolean, rev: boolean) => {
    rect(c, x, y, w, h, BELT_D);
    const len = horiz ? w : h;
    for (let i = 0; i < len; i++) {
      const k = rev ? (len - 1 - i) : i;
      if ((k + ph + (horiz ? x : y)) % 4 === 0) {
        if (horiz) rect(c, x + i, y + 1, 1, h - 2, C.orange); else rect(c, x + 1, y + i, w - 2, 1, C.orange);
      }
    }
  };
  if (!m) { band(2, 6, 12, 4, true, false); return; }
  if (m & 1) band(6, 0, 4, 8, false, true);
  if (m & 4) band(6, 8, 4, 8, false, false);
  if (m & 8) band(0, 6, 8, 4, true, true);
  if (m & 2) band(8, 6, 8, 4, true, false);
  rect(c, 6, 6, 4, 4, BELT_D);
});

registerSprite('conveyor', (c, s) => {
  const m = s.mask ?? 0;
  const v = s.angle ?? 0;
  // рама
  rect(c, 0, 6, 16, 6, C.black);
  rect(c, 0, 7, 16, 4, C.dgray);
  const ph = Math.floor(((v % 4) + 4) % 4);
  for (let x = 0; x < 16; x++) if ((x - ph + 400) % 4 === 0) rect(c, x, 7, 1, 1, C.lgray);
  // ролики на концах
  if (!(m & 8)) { disc(c, 2, 9, 3, C.black); disc(c, 2, 9, 2, C.orange); }
  if (!(m & 2)) { disc(c, 14, 9, 3, C.black); disc(c, 14, 9, 2, C.orange); }
  rect(c, 3, 12, 2, 4, C.dgray); rect(c, 11, 12, 2, 4, C.dgray);
  // ящики едут сверху
  const p = ((((v * 1) - (s.gx ?? 0)) % 32) + 32) % 32;
  if (p < 16) {
    const x = Math.round(p) - 3;
    rect(c, x, 1, 7, 6, C.black);
    rect(c, x + 1, 2, 5, 4, C.brown);
    rect(c, x + 1, 2, 5, 1, C.peach);
  }
});

// ---------- Вода (синий) ----------

/** Кусок трубы от центра к стороне side (0..3) в локальных координатах. */
function pipeArm(c: Ctx, side: number, wet: boolean, from = 5): void {
  const inner = wet ? C.blue : C.black;
  if (side === 1) { rect(c, from, 5, 16 - from, 6, C.lgray); rect(c, from, 6, 16 - from, 4, inner); }
  if (side === 3) { rect(c, 0, 5, 16 - from, 6, C.lgray); rect(c, 0, 6, 16 - from, 4, inner); }
  if (side === 0) { rect(c, 5, 0, 6, 16 - from, C.lgray); rect(c, 6, 0, 4, 16 - from, inner); }
  if (side === 2) { rect(c, 5, from, 6, 16 - from, C.lgray); rect(c, 6, from, 4, 16 - from, inner); }
}

registerSprite('pipe', (c, s) => {
  const m = s.mask ?? 0;
  const wet = !!s.wet;
  if (!m) { rect(c, 2, 5, 12, 6, C.lgray); rect(c, 2, 6, 12, 4, wet ? C.blue : C.black); return; }
  rect(c, 5, 5, 6, 6, C.lgray);
  for (let d = 0; d < 4; d++) if (m & (1 << d)) pipeArm(c, d, wet, 8);
  rect(c, 6, 6, 4, 4, wet ? C.blue : C.black);
  const n = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  if (n === 1) {
    // открытый конец — раструб
    const d = [0, 1, 2, 3].find((k) => m & (1 << k))!;
    const o = (d + 2) % 4;
    if (o === 1) rect(c, 11, 4, 2, 8, C.lgray);
    if (o === 3) rect(c, 3, 4, 2, 8, C.lgray);
    if (o === 0) rect(c, 4, 3, 8, 2, C.lgray);
    if (o === 2) rect(c, 4, 11, 8, 2, C.lgray);
  }
});

registerSprite('pump', (c, s) => {
  pipeArm(c, 1, !!s.wet, 12);
  rect(c, 1, 2, 12, 12, C.black);
  rect(c, 2, 3, 10, 10, C.navy);
  disc(c, 7, 8, 4.5, s.on ? C.blue : C.lavender);
  const a = s.angle ?? 0;
  for (let k = 0; k < 3; k++) {
    const ang = a + (k * Math.PI * 2) / 3;
    line(c, 6.5, 7.5, 6.5 + Math.cos(ang) * 4, 7.5 + Math.sin(ang) * 4, C.white);
  }
  rect(c, 3, 1, 3, 2, s.on ? C.green : C.red);
  rect(c, 9, 1, 2, 2, C.dgray);
});

registerSprite('valve', (c, s) => {
  pipeArm(c, 3, !!s.wet, 11);
  pipeArm(c, 1, !!s.wet && !!s.on, 11);
  rect(c, 4, 4, 8, 8, C.black);
  rect(c, 5, 5, 6, 6, C.dgray);
  rect(c, 6, 6, 4, 4, s.on ? (s.wet ? C.blue : C.black) : C.dgray);
  // ручка-вентиль сверху
  rect(c, 7, 1, 2, 4, C.lgray);
  if (s.on) rect(c, 7, 0, 2, 3, C.green), rect(c, 4, 1, 8, 1, C.green);
  else rect(c, 3, 1, 10, 2, C.red);
});

registerSprite('tank', (c, s) => {
  pipeArm(c, 3, !!s.wet, 14);
  pipeArm(c, 1, (s.fill ?? 0) > 0.02, 14);
  rect(c, 2, 1, 12, 14, C.black);
  rect(c, 3, 2, 10, 12, C.navy);
  const h = Math.round((s.fill ?? 0) * 12);
  if (h > 0) {
    rect(c, 3, 14 - h, 10, h, C.blue);
    const wave = Math.floor(s.t * 4) % 2;
    rect(c, 3 + wave, 14 - h, 9, 1, C.white);
  }
  // мерные риски
  for (const y of [5, 8, 11]) rect(c, 12, y, 1, 1, C.lgray);
});

registerSprite('drain', (c, s) => {
  pipeArm(c, 3, !!s.wet, 12);
  rect(c, 4, 3, 10, 10, C.black);
  rect(c, 5, 4, 8, 8, C.dgray);
  for (let y = 5; y < 12; y += 2) rect(c, 5, y, 8, 1, C.black);
  if (s.wet) {
    const a = s.t * 8;
    rect(c, Math.round(9 + Math.cos(a) * 2), Math.round(8 + Math.sin(a) * 2), 2, 2, C.blue);
  }
});

registerSprite('fountain', (c, s) => {
  pipeArm(c, 2, !!s.wet, 12);
  rect(c, 1, 9, 14, 5, C.black);
  rect(c, 2, 10, 12, 3, C.lgray);
  rect(c, 3, 10, 10, 2, s.wet ? C.blue : C.dgray);
  rect(c, 6, 5, 4, 5, C.black);
  rect(c, 7, 5, 2, 5, C.dgray);
  if (s.wet && (s.level ?? 0) > 0.05) rect(c, 7, 3, 2, 2, C.white);
});

registerSprite('waterwheel', (c, s) => {
  pipeArm(c, 3, !!s.wet, 13);
  pipeArm(c, 1, !!s.wet, 13);
  const a = s.angle ?? 0;
  disc(c, 8, 8, 7, C.black);
  disc(c, 8, 8, 6, C.brown);
  for (let k = 0; k < 6; k++) {
    const ang = a + (k * Math.PI) / 3;
    line(c, 7.5, 7.5, 7.5 + Math.cos(ang) * 6.5, 7.5 + Math.sin(ang) * 6.5, C.peach, 2);
  }
  disc(c, 8, 8, 2.2, s.wet ? C.blue : C.dgray);
  rect(c, 7, 7, 2, 2, C.orange);
});

/** Нарисовать деталь в клетке (px, py) с поворотом. */
export function drawPart(c: Ctx, type: string, px: number, py: number, rot: number, s: SpriteState): void {
  const fn = sprites.get(type);
  if (!fn) { rect(c, px + 2, py + 2, 12, 12, C.pink); return; }
  c.save();
  if (s.jam) px += Math.floor(s.t * 30) % 2 ? 1 : -1;
  c.translate(px + 8, py + 8);
  c.rotate((rot * Math.PI) / 2);
  c.translate(-8, -8);
  fn(c, s);
  c.restore();
}
