export interface Slot {
  date: number;
  w: number;
  h: number;
  parts: string;
}

export interface SaveData {
  stars: Record<string, number>;
  safetySeen: boolean;
  muted: boolean;
  slots: (Slot | null)[];
}

const KEY = 'master-izobretatelya-v1';

function fresh(): SaveData {
  return { stars: {}, safetySeen: false, muted: false, slots: [null, null, null] };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return fresh();
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* приватный режим или нет места — играем без сохранения */
  }
}

export const save = {
  get: (): SaveData => data,
  stars: (id: string): number => data.stars[id] ?? 0,
  setStars(id: string, n: number): void {
    data.stars[id] = Math.max(n, data.stars[id] ?? 0);
    persist();
  },
  setSafetySeen(): void {
    data.safetySeen = true;
    persist();
  },
  setMuted(m: boolean): void {
    data.muted = m;
    persist();
  },
  setSlot(i: number, s: Slot | null): void {
    data.slots[i] = s;
    persist();
  },
};
