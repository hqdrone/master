import { C } from '../render/colors';
import { disc, iconCanvas, rect } from '../render/px';
import { drawPart } from '../render/sprites';

export function partIcon(type: string): HTMLCanvasElement {
  return iconCanvas(16, (c) => {
    const rot = 0;
    drawPart(c, type, 0, 0, rot, { t: 0, mask: 0b1010, level: type === 'lamp' ? 0.8 : 0, on: type === 'switch' });
  }, 'px icon');
}

export function starIcon(filled: boolean): HTMLCanvasElement {
  return iconCanvas(9, (c) => {
    const col = filled ? C.yellow : C.dgray;
    rect(c, 4, 0, 1, 2, col);
    rect(c, 3, 2, 3, 1, col);
    rect(c, 0, 3, 9, 1, col);
    rect(c, 1, 4, 7, 1, col);
    rect(c, 2, 5, 5, 1, col);
    rect(c, 2, 6, 2, 1, col); rect(c, 5, 6, 2, 1, col);
    rect(c, 1, 7, 2, 1, col); rect(c, 6, 7, 2, 1, col);
    if (filled) rect(c, 4, 2, 1, 1, C.white);
  }, 'px star');
}

export function lockIcon(): HTMLCanvasElement {
  return iconCanvas(9, (c) => {
    rect(c, 2, 0, 5, 1, C.lgray); rect(c, 1, 1, 1, 3, C.lgray); rect(c, 7, 1, 1, 3, C.lgray);
    rect(c, 0, 4, 9, 5, C.orange); rect(c, 4, 5, 1, 2, C.black);
  }, 'px lock');
}

/** Значок мира. */
export function worldIcon(world: string): HTMLCanvasElement {
  return iconCanvas(16, (c) => {
    switch (world) {
      case 'electric':
        rect(c, 8, 1, 4, 2, C.yellow); rect(c, 6, 3, 4, 2, C.yellow); rect(c, 4, 5, 4, 2, C.yellow);
        rect(c, 4, 7, 9, 2, C.yellow); rect(c, 8, 9, 4, 2, C.yellow); rect(c, 6, 11, 4, 2, C.yellow);
        rect(c, 4, 13, 3, 2, C.yellow);
        break;
      case 'mechanic':
        disc(c, 8, 8, 7, C.orange);
        for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7]]) rect(c, x, y, 2, 2, C.navy);
        disc(c, 8, 8, 3, C.brown); disc(c, 8, 8, 1.5, C.navy);
        break;
      case 'water':
        rect(c, 7, 1, 2, 2, C.blue); rect(c, 6, 3, 4, 2, C.blue); disc(c, 8, 10, 5, C.blue);
        rect(c, 6, 8, 2, 3, C.white);
        break;
      case 'air':
        disc(c, 6, 9, 4, C.white); disc(c, 10, 8, 5, C.white); disc(c, 13, 10, 3, C.white);
        rect(c, 2, 10, 13, 3, C.white); rect(c, 3, 12, 11, 1, C.lgray);
        break;
      default:
        rect(c, 1, 7, 14, 8, C.lgray); rect(c, 2, 2, 3, 5, C.dgray); rect(c, 10, 4, 3, 3, C.dgray);
        rect(c, 3, 10, 3, 3, C.yellow); rect(c, 9, 10, 3, 3, C.yellow);
        rect(c, 2, 0, 2, 2, C.lgray);
    }
  }, 'px world-icon');
}
