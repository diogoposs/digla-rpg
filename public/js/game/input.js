import { MOVEMENT } from '../config.js';

// Instala os eventos uma vez. Perder foco sempre solta as teclas pressionadas.
export function createInput({ isPlaying, onPause, onResume, onHide, onAction }) {
  let keys = [],
    active = true;
  const clear = () => {
    keys = [];
  };
  window.addEventListener('keydown', (event) => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="menu"]'))
      return;
    if (
      isPlaying() &&
      active &&
      !document.hidden &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (['f', 'q', 'w', 'e', 'r'].includes(event.key.toLowerCase()) || event.key === 'Escape')
    ) {
      event.preventDefault();
      if (!event.repeat) onAction?.(event.key.toLowerCase());
      return;
    }
    if (!isPlaying() || !MOVEMENT[event.key] || event.altKey || event.ctrlKey || event.metaKey)
      return;
    event.preventDefault();
    if (active && !document.hidden && !keys.includes(event.key)) keys.push(event.key);
  });
  window.addEventListener('keyup', (event) => {
    if (!MOVEMENT[event.key]) return;
    keys = keys.filter((key) => key !== event.key);
    if (isPlaying()) event.preventDefault();
  });
  function pause() {
    clear();
    active = false;
    if (isPlaying()) onPause();
  }
  function resume() {
    clear();
    active = true;
    if (isPlaying()) onResume();
  }
  window.addEventListener('blur', pause);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (document.hasFocus()) resume();
  });
  window.addEventListener('pagehide', onHide);
  return {
    get key() {
      return active ? keys.at(-1) : undefined;
    },
    clear,
    pause,
    resume,
    // Desativa durante saída/salvamento sem disparar os callbacks de foco.
    setActive(value) {
      active = value;
      clear();
    },
  };
}
