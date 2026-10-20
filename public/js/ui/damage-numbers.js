import { $ } from './dom.js';

// Texto HTML nítido, ancorado no tile do golpe mesmo quando a câmera anda.
export function createDamageNumbers() {
  const active = [];
  return {
    add(event) {
      if (!event.damage || !Number.isFinite(event.x) || !Number.isFinite(event.y)) return;
      const element = document.createElement('span');
      element.className = 'damage-number' + (event.critical ? ' critical' : '');
      if (event.element) element.classList.add('element-' + event.element);
      element.dataset.target = event.type === 'player-hit' ? event.mobId || 'orc' : 'player';
      if (event.weakness) element.classList.add('weakness-hit');
      element.textContent = event.damage;
      $('damage-layer').append(element);
      active.push({ element, x: event.x, y: event.y, started: performance.now() });
    },
    update(renderer, time) {
      for (let i = active.length - 1; i >= 0; i--) {
        const entry = active[i],
          progress = (time - entry.started) / 1100;
        if (progress >= 1) {
          entry.element.remove();
          active.splice(i, 1);
          continue;
        }
        const point = renderer.worldToScreen(entry.x, entry.y);
        entry.element.style.left = point.x + 'px';
        entry.element.style.top = point.y - 48 - progress * 52 + 'px';
        entry.element.style.opacity = Math.min(1, (1 - progress) * 4);
      }
    },
    clear() {
      active.splice(0).forEach(({ element }) => element.remove());
    },
  };
}
