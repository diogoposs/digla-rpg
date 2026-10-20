import { $ } from './dom.js';
import { ELEMENT_NAMES } from '../game/world-rules.js';

export function createMobLabels() {
  const labels = new Map([['orc', $('orc-label')]]);
  return {
    render(mobs) {
      for (const mob of mobs) {
        let label = labels.get(mob.id);
        if (!label) {
          label = document.createElement('button');
          label.type = 'button';
          label.className = 'orc-label';
          label.id = mob.id + '-label';
          label.innerHTML =
            '<span></span><small class="mob-hp"></small><span class="orc-health"><span></span></span>';
          labels.set(mob.id, label);
          $('world').parentElement.append(label);
        }
        label.dataset.mobId = mob.id;
        label.dataset.kind = mob.kind;
        label.setAttribute('aria-label', 'Atacar ' + (mob.id === 'orc' ? 'orc' : mob.name));
        label.firstElementChild.textContent = mob.name;
        label.querySelector('small').textContent = `${mob.health} / ${mob.maxHealth}`;
        label.querySelector('.orc-health > span').style.width =
          `${(mob.health / mob.maxHealth) * 100}%`;
        label.classList.toggle('targeted', !!mob.targeted);
        let weakness = label.querySelector('.mob-weakness');
        if (!weakness) {
          weakness = document.createElement('span');
          weakness.className = 'mob-weakness';
          label.append(weakness);
        }
        weakness.textContent = 'Fraco a ' + ELEMENT_NAMES[mob.weakness];
        label.title = `${mob.name} — fraqueza: ${ELEMENT_NAMES[mob.weakness]} (+50% de dano)`;
        label.dataset.alive = String(mob.health > 0);
      }
    },
    position(positions = {}, running) {
      for (const [id, label] of labels) {
        const point = positions[id];
        label.hidden = !running || label.dataset.alive !== 'true' || !point?.visible;
        if (point) {
          label.style.left = point.x + 'px';
          label.style.top = point.y + 'px';
        }
      }
    },
    hide() {
      for (const label of labels.values()) label.hidden = true;
    },
  };
}
