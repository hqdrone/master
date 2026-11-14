import { initAudio, isMuted, setMuted } from '../audio/synth';
import { sfx } from '../audio/sounds';
import { save } from '../save/progress';
import { h } from './dom';
import { T } from './texts';

export function soundButton(): HTMLButtonElement {
  const b = h('button', { cls: 'btn small' });
  const upd = () => (b.textContent = isMuted() ? T.soundOff : T.soundOn);
  upd();
  b.addEventListener('click', () => {
    initAudio();
    setMuted(!isMuted());
    save.setMuted(isMuted());
    upd();
    sfx.click();
  });
  return b;
}

export function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  return h('button', { cls, text, on: { click: () => { initAudio(); sfx.click(); onClick(); } } });
}

/** Модальное окно поверх экрана. Возвращает функцию закрытия. */
export function modal(content: HTMLElement): () => void {
  const ov = h('div', { cls: 'overlay' }, h('div', { cls: 'card pop' }, content));
  document.body.append(ov);
  return () => ov.remove();
}
