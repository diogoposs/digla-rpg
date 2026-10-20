import { $ } from './dom.js';

const SHAPES = {
  physical: '<path d="M5 20h28V10l13 15-13 15V30H5Z"/>',
  fire: '<path d="M25 2c8 16-2 13 5 24 3-7 8-9 7-16 16 18 10 35-12 37C3 46 2 27 15 17c-2 12 5 12 4 18C29 23 16 19 25 2Z"/>',
  water:
    '<circle cx="25" cy="27" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M25 5c-6 9-13 15-13 23a13 13 0 0 0 26 0C38 20 31 14 25 5Z" opacity=".6"/><circle cx="7" cy="10" r="3"/><circle cx="44" cy="12" r="4"/>',
  lightning: '<path d="m28 1-18 27h13l-3 21 23-31H29l8-17Z"/>',
};
const ARC =
  '<path d="m26 1-8 17 12-3-15 19 13-3-5 18M19 17 6 12l4 12M24 32l19-9-5 15" fill="none" stroke="currentColor" stroke-width="2"/>';
function stormArt(ability) {
  if (ability === 'r')
    return `<svg viewBox="0 0 100 100"><g class="shock-rings" fill="none" stroke="currentColor"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="32" stroke-dasharray="4 7"/><circle cx="50" cy="50" r="19"/></g><g class="storm-arcs">${Array.from({ length: 8 }, (_, i) => `<path d="m50 48 4-15-8 3 4-25-5 7" transform="rotate(${i * 45} 50 50)"/>`).join('')}</g></svg>`;
  return `<svg viewBox="0 0 100 100"><path class="storm-rune" d="m50 4 46 46-46 46L4 50Z M18 18h64v64H18Z"/><g>${Array.from({ length: 9 }, (_, i) => `<g class="storm-strike" style="animation-delay:${(i % 4) * 75}ms" transform="translate(${(i % 3) * 33 + 8} ${Math.floor(i / 3) * 33 - 8}) scale(.48)">${ARC}</g>`).join('')}</g></svg>`;
}
export function createElementEffects() {
  const active = [];
  const areas = [];
  return {
    add(event) {
      if (event.areaSize) {
        const element = document.createElement('span');
        element.className = 'lightning-area-effect';
        element.dataset.ability = event.ability;
        element.innerHTML = stormArt(event.ability);
        $('effect-layer').append(element);
        areas.push({ ...event, element, started: performance.now() });
        return;
      }
      if (!SHAPES[event.element]) return;
      const hit = document.createElement('span'),
        projectile = document.createElement('span');
      hit.className = `element-hit element-${event.element}`;
      hit.dataset.ability = event.ability || 'auto';
      hit.innerHTML =
        event.element === 'lightning'
          ? `<svg viewBox="0 0 50 50"><circle class="impact-ring" cx="25" cy="28" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/><g class="impact-bolt">${ARC}<path d="m26 1-8 17 12-3-15 19 13-3-5 18" fill="none" stroke="#fffce5" stroke-width="1"/></g><g class="impact-sparks" stroke="currentColor">${Array.from({ length: 8 }, (_, i) => `<path d="M25 5v5" transform="rotate(${i * 45} 25 25)"/>`).join('')}</g></svg>`
          : `<svg viewBox="0 0 50 50">${SHAPES[event.element]}</svg>`;
      projectile.className = `spell-projectile element-${event.element}`;
      if (event.element === 'lightning')
        projectile.innerHTML =
          '<svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="m0 10 21-4 8 9 18-12 8 13 20-9 25 3"/></svg>';
      $('effect-layer').append(hit, projectile);
      active.push({ ...event, hit, projectile, started: performance.now() });
    },
    update(renderer, time) {
      for (let i = areas.length - 1; i >= 0; i--) {
        const area = areas[i],
          progress = (time - area.started) / 1100;
        if (progress >= 1) {
          area.element.remove();
          areas.splice(i, 1);
          continue;
        }
        const point = renderer.worldToScreen(area.x, area.y),
          tile = 32 * renderer.scale;
        area.element.style.left = point.x + 'px';
        area.element.style.top = point.y + 'px';
        area.element.style.width = area.element.style.height = area.areaSize * tile + 'px';
        area.element.style.setProperty('--tile', tile + 'px');
        area.element.style.opacity = Math.min(1, (1 - progress) * 2);
      }
      for (let index = active.length - 1; index >= 0; index--) {
        const event = active[index],
          progress = (time - event.started) / 700;
        if (progress >= 1) {
          event.hit.remove();
          event.projectile.remove();
          active.splice(index, 1);
          continue;
        }
        const to = renderer.worldToScreen(event.x, event.y),
          from = renderer.worldToScreen(event.fromX, event.fromY),
          travel = Math.min(1, progress / 0.25);
        if (event.element === 'lightning') {
          const dx = to.x - from.x,
            dy = to.y - from.y;
          event.projectile.style.left = from.x + 'px';
          event.projectile.style.top = from.y - 22 * renderer.scale + 'px';
          event.projectile.style.width = Math.max(4, Math.hypot(dx, dy) * travel) + 'px';
          event.projectile.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
        } else {
          event.projectile.style.left = from.x + (to.x - from.x) * travel + 'px';
          event.projectile.style.top = from.y + (to.y - from.y) * travel - 22 + 'px';
        }
        event.projectile.hidden = travel >= 1;
        event.hit.style.left = to.x + 'px';
        event.hit.style.top = to.y - 26 * renderer.scale + 'px';
        event.hit.hidden = travel < 1;
        event.hit.style.opacity = Math.min(1, (1 - progress) * 2);
        event.hit.style.transform = `translate(-50%,-50%) scale(${(0.7 + progress * 0.6) * renderer.scale}) rotate(${event.element === 'lightning' ? Math.sin(progress * 70) * 7 : 0}deg)`;
      }
    },
    clear() {
      areas.splice(0).forEach(({ element }) => element.remove());
      active.splice(0).forEach(({ hit, projectile }) => {
        hit.remove();
        projectile.remove();
      });
    },
  };
}
