import { C } from '../render/colors';
import { disc, rect, type Ctx } from '../render/px';

/** Болтик — пиксельный робот-помощник. */
export function drawRobot(c: Ctx, t: number, talking: boolean): void {
  c.clearRect(0, 0, 16, 16);
  const blink = Math.floor(t * 10) % 40 === 0;
  // антенна
  rect(c, 7, 0, 2, 3, C.lgray);
  disc(c, 8, 1, 1.6, Math.floor(t * 2) % 2 ? C.red : C.orange);
  // голова
  rect(c, 2, 3, 12, 9, C.black);
  rect(c, 3, 4, 10, 7, C.lgray);
  rect(c, 3, 4, 10, 1, C.white);
  // глаза
  if (blink) {
    rect(c, 5, 7, 2, 1, C.navy); rect(c, 9, 7, 2, 1, C.navy);
  } else {
    rect(c, 5, 6, 2, 2, C.blue); rect(c, 9, 6, 2, 2, C.blue);
    rect(c, 5, 6, 1, 1, C.white); rect(c, 9, 6, 1, 1, C.white);
  }
  // рот
  const open = talking && Math.floor(t * 8) % 2 === 0;
  rect(c, 6, 9, 4, open ? 2 : 1, C.dgray);
  // ушки-болтики
  rect(c, 1, 6, 1, 3, C.orange); rect(c, 14, 6, 1, 3, C.orange);
  // тело
  rect(c, 4, 12, 8, 4, C.black);
  rect(c, 5, 12, 6, 4, C.blue);
  rect(c, 7, 13, 2, 2, C.yellow);
}

export class Robot {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private bubble: HTMLElement;
  private c: Ctx;
  private talkUntil = 0;
  private text = '';
  private raf = 0;
  private start = performance.now();

  constructor(cls = 'robot') {
    this.el = document.createElement('div');
    this.el.className = cls;
    this.cv = document.createElement('canvas');
    this.cv.width = 16; this.cv.height = 16;
    this.cv.className = 'px robot-face';
    this.c = this.cv.getContext('2d')!;
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.el.append(this.cv, this.bubble);
    const loop = () => {
      const t = (performance.now() - this.start) / 1000;
      drawRobot(this.c, t, t < this.talkUntil);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  say(text: string): void {
    if (text === this.text) return;
    this.text = text;
    this.bubble.textContent = text;
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('pop');
    this.talkUntil = (performance.now() - this.start) / 1000 + Math.min(2.5, 0.4 + text.length * 0.04);
  }

  get current(): string {
    return this.text;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}
