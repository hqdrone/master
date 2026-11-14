import { allParts } from '../core/parts';
import { levelsOf } from '../levels';
import type { LevelDef } from '../levels/types';
import { save } from '../save/progress';
import { button, modal, soundButton } from './common';
import { h } from './dom';
import { lockIcon, starIcon, worldIcon } from './icons';
import { Robot } from './robot';
import { T } from './texts';

const ALL = new URLSearchParams(location.search).has('all');
const WORLDS = ['electric', 'mechanic', 'water', 'air', 'factory'];

export function levelUnlocked(list: LevelDef[], i: number): boolean {
  return ALL || i === 0 || save.stars(list[i - 1].id) > 0;
}

export function workshopUnlocked(): boolean {
  return ALL || levelsOf('electric').every((l) => save.stars(l.id) > 0);
}

/** Детали, встреченные в пройденных уровнях. */
export function workshopLevel(): LevelDef {
  const seen = new Set<string>();
  for (const l of levelsOf('electric')) {
    if (!ALL && !save.stars(l.id)) continue;
    for (const t of Object.keys(l.palette)) seen.add(t);
    for (const s of l.prePlaced ?? []) seen.add(s.type);
  }
  const palette: Record<string, number> = {};
  for (const d of allParts()) if (d.world === 'electric' && seen.has(d.type)) palette[d.type] = -1;
  return { id: 'workshop-electric', world: 'electric', mode: 'sandbox', title: T.workshop, grid: { w: 16, h: 10 }, palette };
}

export interface Nav {
  menu(): void;
  map(): void;
  level(l: LevelDef): void;
  workshop(): void;
}

export function menuScreen(nav: Nav): { el: HTMLElement; destroy(): void } {
  const robot = new Robot('robot big');
  robot.say(T.robot.hello);
  const ws = button(T.workshop, () => {
    if (workshopUnlocked()) nav.workshop();
    else robot.say(T.workshopLocked);
  }, 'btn big');
  if (!workshopUnlocked()) ws.append(lockIcon());
  const el = h('div', { cls: 'screen menu' },
    h('h1', { cls: 'title', text: T.gameTitle }),
    robot.el,
    h('div', { cls: 'col' }, button(T.play, () => nav.map(), 'btn big primary'), ws, soundButton()),
  );
  return { el, destroy: () => robot.destroy() };
}

export function safetyDialog(then: () => void): void {
  const robot = new Robot('robot');
  robot.say(T.robot.safety);
  let close = () => {};
  close = modal(h('div', { cls: 'safety' },
    robot.el,
    h('div', { cls: 'row' }, button(T.ok, () => { save.setSafetySeen(); robot.destroy(); close(); then(); }, 'btn primary')),
  ));
}

export function mapScreen(nav: Nav): { el: HTMLElement; destroy(): void } {
  const worldsRow = h('div', { cls: 'worlds' });
  for (const w of WORLDS) {
    const open = w === 'electric';
    const card = h('div', { cls: `world ${open ? 'open' : 'closed'}` },
      worldIcon(w), h('div', { cls: 'wname', text: T.worlds[w] }),
      open ? null : h('div', { cls: 'soon' }, lockIcon(), h('span', { text: T.soon })),
    );
    worldsRow.append(card);
  }

  const grid = h('div', { cls: 'levels' });
  const list = levelsOf('electric');
  list.forEach((l, i) => {
    const unlocked = levelUnlocked(list, i);
    const st = save.stars(l.id);
    const stars = h('div', { cls: 'stars' });
    for (let k = 0; k < 3; k++) stars.append(starIcon(k < st));
    const cell = h('button', { cls: `lvl ${unlocked ? '' : 'locked'} ${st ? 'done' : ''} ${l.mode}`, title: l.title },
      h('div', { cls: 'num', text: String(i + 1) }),
      h('div', { cls: 'ltitle', text: l.title }),
      h('div', { cls: 'mode', text: l.mode === 'instruction' ? T.instruction : T.puzzle }),
      unlocked ? stars : lockIcon(),
    );
    if (unlocked) cell.addEventListener('click', () => nav.level(l));
    else cell.disabled = true;
    grid.append(cell);
  });
  const ws = h('button', { cls: `lvl workshop ${workshopUnlocked() ? '' : 'locked'}` },
    h('div', { cls: 'num' }, starIcon(true)), h('div', { cls: 'ltitle', text: T.workshop }),
    workshopUnlocked() ? null : lockIcon());
  ws.addEventListener('click', () => { if (workshopUnlocked()) nav.workshop(); });
  grid.append(ws);

  const el = h('div', { cls: 'screen map' },
    h('header', { cls: 'topbar' },
      button(T.back, () => nav.menu(), 'btn small'),
      h('h1', { text: T.worldsTitle }), h('div', { cls: 'spacer' }), soundButton()),
    worldsRow,
    h('h2', { cls: 'wtitle', text: T.worlds.electric }),
    grid,
  );
  return { el, destroy: () => {} };
}
