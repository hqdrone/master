import { PAL } from './colors';

/** Мелкие помощники для рисования пикселями на низком разрешении. */
export type Ctx = CanvasRenderingContext2D;

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: number | string): void {
  c.fillStyle = typeof col === 'number' ? PAL[col] : col;
  c.fillRect(x, y, w, h);
}

export function disc(c: Ctx, cx: number, cy: number, r: number, col: number | string): void {
  c.fillStyle = typeof col === 'number' ? PAL[col] : col;
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    let x0 = Infinity, x1 = -Infinity;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    }
    if (x1 >= x0) c.fillRect(x0, y, x1 - x0 + 1, 1);
  }
}

export function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: number | string, w = 1): void {
  c.fillStyle = typeof col === 'number' ? PAL[col] : col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Картинка из строк-маски: символ = индекс палитры в hex, '.' — прозрачно. */
export function mask(c: Ctx, rows: string[], ox = 0, oy = 0): void {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      rect(c, ox + x, oy + y, 1, 1, parseInt(ch, 16));
    }
  });
}

/** Маленький canvas с картинкой для HTML-интерфейса (масштабируется CSS, pixelated). */
export function iconCanvas(size: number, draw: (c: Ctx) => void, cls = 'px'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  cv.className = cls;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  draw(c);
  return cv;
}
