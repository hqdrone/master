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

const PLAYABLE = ['electric', 'mechanic', 'water'];
let currentWorld = 'electric';

const worldDone = (w: string) => levelsOf(w).every((l) => save.stars(l.id) > 0);

export function worldUnlocked(w: string): boolean {
  const i = PLAYABLE.indexOf(w);
  if (i < 0) return false;
  return ALL || i === 0 || worldDone(PLAYABLE[i - 1]);
}

export function levelUnlocked(list: LevelDef[], i: number): boolean {
  return ALL || i === 0 || save.stars(list[i - 1].id) > 0;
}

export function workshopUnlocked(): boolean {
  return ALL || worldDone('electric');
}

/** Детали, встреченные в пройденных уровнях. */
export function workshopLevel(): LevelDef {
  const seen = new Set<string>();
  for (const l of PLAYABLE.flatMap((w) => levelsOf(w))) {
    if (!ALL && !save.stars(l.id)) continue;
    for (const t of Object.keys(l.palette)) seen.add(t);
    for (const s of l.prePlaced ?? []) seen.add(s.type);
  }
  const palette: Record<string, number> = {};
  for (const d of allParts()) if (seen.has(d.type)) palette[d.type] = -1;
  return { id: 'workshop', world: 'electric', mode: 'sandbox', title: T.workshop, grid: { w: 16, h: 10 }, palette };
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
    h('div', { cls: 'col' }, button(T.play, () => nav.map(), 'btn big primary'), ws,
      h('div', { cls: 'row' }, soundButton(), fullscreenButton())),
  );
  return { el, destroy: () => robot.destroy() };
}

/** На телефоне адресная строка съедает место — даём развернуть игру. */
function fullscreenButton(): HTMLElement | null {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  if (!(d.fullscreenEnabled || d.webkitFullscreenEnabled) || !matchMedia('(pointer: coarse)').matches) return null;
  return button(T.fullscreen, () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  }, 'btn small');
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
  const title = h('h2', { cls: 'wtitle' });
  const grid = h('div', { cls: 'levels' });

  const renderWorlds = () => {
    worldsRow.innerHTML = '';
    for (const w of WORLDS) {
      const open = worldUnlocked(w);
      const playable = PLAYABLE.includes(w);
      const card = h('button', { cls: `world ${open ? 'open' : 'closed'} ${w === currentWorld ? 'current' : ''}` },
        worldIcon(w), h('div', { cls: 'wname', text: T.worlds[w] }),
        open ? null : h('div', { cls: 'soon' }, lockIcon(), h('span', { text: playable ? T.locked : T.soon })),
      );
      if (open) card.addEventListener('click', () => { currentWorld = w; renderWorlds(); renderLevels(); });
      else card.addEventListener('click', () => { if (playable) robot.say(T.worldLocked); });
      worldsRow.append(card);
    }
  };

  const renderLevels = () => {
    title.textContent = T.worlds[currentWorld];
    grid.innerHTML = '';
    const list = levelsOf(currentWorld);
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
    ws.addEventListener('click', () => { if (workshopUnlocked()) nav.workshop(); else robot.say(T.workshopLocked); });
    grid.append(ws);
  };

  const robot = new Robot();
  robot.say(T.robot.pickLevel);
  if (!worldUnlocked(currentWorld)) currentWorld = 'electric';
  renderWorlds();
  renderLevels();

  const el = h('div', { cls: 'screen map' },
    h('header', { cls: 'topbar' },
      button(T.back, () => nav.menu(), 'btn small'),
      h('h1', { text: T.worldsTitle }), h('div', { cls: 'spacer' }), soundButton()),
    worldsRow, title, grid,
    h('footer', { cls: 'helper' }, robot.el),
  );
  return { el, destroy: () => robot.destroy() };
}

/** Последний открытый мир (для «Дальше» после последнего уровня). */
export function setWorld(w: string): void {
  currentWorld = w;
}
