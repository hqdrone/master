import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/style.css';
import './core/electricParts';
import './core/mechanicParts';
import { setMuted } from './audio/synth';
import { levelsOf } from './levels';
import type { LevelDef } from './levels/types';
import { save } from './save/progress';
import { Game } from './ui/game';
import { mapScreen, menuScreen, safetyDialog, setWorld, workshopLevel, type Nav } from './ui/screens';

const app = document.getElementById('app')!;
setMuted(save.get().muted);

let current: { el: HTMLElement; destroy(): void; mounted?: () => void } | null = null;

function show(s: { el: HTMLElement; destroy(): void; mounted?: () => void }): void {
  current?.destroy();
  app.innerHTML = '';
  app.append(s.el);
  current = s;
  s.mounted?.();
}

const nav: Nav = {
  menu: () => show(menuScreen(nav)),
  map: () => {
    show(mapScreen(nav));
    if (!save.get().safetySeen) safetyDialog(() => {});
  },
  level: (l: LevelDef) => {
    const list = levelsOf(l.world);
    const i = list.findIndex((x) => x.id === l.id);
    const next = list[i + 1];
    setWorld(l.world);
    show(new Game({
      level: l,
      onExit: () => nav.map(),
      onNext: next ? () => nav.level(next) : () => nav.map(),
    }));
  },
  workshop: () => show(new Game({ level: workshopLevel(), onExit: () => nav.menu() })),
};

nav.menu();
