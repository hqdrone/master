import { getPart } from './parts';

export interface Part {
  id: number;
  type: string;
  x: number;
  y: number;
  rot: number;
  /** нельзя двигать/удалять */
  locked?: boolean;
  /** поставлена уровнем (не считается в звёздах и палитре) */
  pre?: boolean;
  /** выключатель включён */
  on?: boolean;
  /** кнопка нажата */
  pressed?: boolean;
  /** уровень воды в баке 0..1 */
  level?: number;
}

export type NewPart = Omit<Part, 'id'>;

export class Board {
  parts: Part[] = [];
  /** растёт при любом изменении — по нему кэшируется симуляция */
  version = 0;
  private nextId = 1;
  private index: (Part | undefined)[] = [];
  private indexVersion = -1;

  constructor(public w: number, public h: number) {}

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  touch(): void {
    this.version++;
  }

  at(x: number, y: number): Part | undefined {
    if (!this.inBounds(x, y)) return undefined;
    if (this.indexVersion !== this.version) {
      this.index = new Array(this.w * this.h);
      for (const p of this.parts) this.index[p.y * this.w + p.x] = p;
      this.indexVersion = this.version;
    }
    return this.index[y * this.w + x];
  }

  get(id: number): Part | undefined {
    return this.parts.find((p) => p.id === id);
  }

  add(np: NewPart): Part | null {
    if (!this.inBounds(np.x, np.y) || this.at(np.x, np.y)) return null;
    getPart(np.type); // проверка, что тип существует
    const p: Part = { ...np, rot: ((np.rot % 4) + 4) % 4, id: this.nextId++ };
    this.parts.push(p);
    this.touch();
    return p;
  }

  remove(id: number): Part | undefined {
    const i = this.parts.findIndex((p) => p.id === id);
    if (i < 0) return undefined;
    const [p] = this.parts.splice(i, 1);
    this.touch();
    return p;
  }

  move(id: number, x: number, y: number): boolean {
    const p = this.get(id);
    if (!p || !this.inBounds(x, y)) return false;
    const o = this.at(x, y);
    if (o && o !== p) return false;
    p.x = x;
    p.y = y;
    this.touch();
    return true;
  }

  rotate(id: number, by = 1): void {
    const p = this.get(id);
    if (!p) return;
    p.rot = (((p.rot + by) % 4) + 4) % 4;
    this.touch();
  }

  count(type: string, onlyPlayer = false): number {
    return this.parts.filter((p) => p.type === type && (!onlyPlayer || !p.pre)).length;
  }

  snapshot(): string {
    return JSON.stringify(this.parts.map(({ id: _id, ...rest }) => rest));
  }

  restore(s: string): void {
    const list = JSON.parse(s) as NewPart[];
    this.parts = [];
    this.touch();
    for (const np of list) this.add(np);
    this.touch();
  }

  clone(): Board {
    const b = new Board(this.w, this.h);
    b.parts = this.parts.map((p) => ({ ...p }));
    b.nextId = this.nextId;
    return b;
  }
}
