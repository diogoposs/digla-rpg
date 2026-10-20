import { nearStove } from './cooking-rules.js';
import { nearWater } from './fishing-rules.js';
import { $ } from '../ui/dom.js';
import { FLOOR_LINKS } from '../world/elevation.js';
import { distance } from './world-rules.js';

// F escolhe a ação pelo contexto. Adicione novas interações neste módulo.
export function createActions({ getPosition, fishing, cooking, world }) {
  let busy = false;
  return {
    async interact(kind) {
      if (busy) return;
      busy = true;
      try {
        if (kind === 'stove') {
          await fishing.stop();
          await cooking.open();
        } else if (kind === 'water') {
          await cooking.close();
          await fishing.press();
        }
      } finally {
        busy = false;
      }
    },
    async press(key) {
      if (['q', 'w', 'e', 'r'].includes(key)) {
        await world.cast(key);
        return;
      }
      if (key === 'escape') {
        void world?.stopAttack();
        void fishing.stop('Pesca encerrada.');
        void cooking.close('Culinária encerrada.');
        return;
      }
      if (busy) return;
      busy = true;
      try {
        if (world?.nearMob()) {
          await cooking.close();
          await fishing.stop();
          await world.attack();
        } else if (nearStove(getPosition())) {
          await fishing.stop();
          await cooking.open();
        } else {
          await cooking.close();
          await fishing.press();
        }
      } finally {
        busy = false;
      }
    },
    update() {
      const passage = FLOOR_LINKS.find((link) => distance(getPosition(), link.from) <= 1);
      const text = world?.nearMob()
        ? 'F · Atacar ' + world.nearbyMobName()
        : passage
          ? `Pise ${passage.kind === 'hole' ? 'no buraco' : 'na escada'} · ${passage.name}`
          : nearStove(getPosition()) && !cooking.isOpen
            ? 'F · Usar fogão'
            : nearWater(getPosition()) && !fishing.active
              ? 'F · Pescar'
              : '';
      if ($('action-prompt').textContent !== text) $('action-prompt').textContent = text;
    },
  };
}
