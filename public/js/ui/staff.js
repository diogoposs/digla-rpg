import { $ } from './dom.js';
import { ELEMENTS, staffDamage } from '../game/world-rules.js';

export function createStaff({ onElement, onTransfer }) {
  let item;
  const close = () => {
    $('staff-panel').hidden = true;
    item = null;
  };
  $('close-staff').onclick = close;
  for (const element of ELEMENTS) $('element-' + element).onclick = () => void onElement(element);
  $('staff-equip').onclick = () => {
    if (item)
      void onTransfer({ ...item, target: item.source === 'equipment' ? 'inventory' : 'equipment' });
    close();
  };
  return {
    open(payload) {
      item = payload;
      $('staff-equip').textContent =
        payload.source === 'equipment' ? 'Guardar na mochila' : 'Equipar cajado';
      $('staff-panel').hidden = false;
    },
    sync(selected, level = 1) {
      const damage = staffDamage(level);
      $('staff-damage').textContent = `${damage.min}–${damage.max}`;
      for (const element of ELEMENTS)
        $('element-' + element).setAttribute('aria-pressed', String(element === selected));
    },
    close,
  };
}
