import { $ } from './dom.js';
import { ORC_LOOT_CAPACITY, distance } from '../game/world-rules.js';
import { ITEMS } from '../items.js';

export function createLoot({ onTransfer, onDragStart } = {}) {
  let openedId = null;
  for (let index = 0; index < ORC_LOOT_CAPACITY; index++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.slot = index;
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-label', `Espaço ${index + 1} — vazio`);
    $('loot-grid').append(slot);
  }
  function close() {
    openedId = null;
    $('loot-panel').hidden = true;
  }
  $('close-loot').onclick = close;
  $('loot-grid').addEventListener('dragstart', (event) => {
    const slot = event.target.closest('[data-item]');
    if (!slot?.dataset.item) {
      event.preventDefault();
      return;
    }
    const payload = {
      source: 'loot',
      corpseId: openedId,
      slot: Number(slot.dataset.slot),
      itemId: slot.dataset.item,
    };
    event.dataTransfer.setData('application/x-digla-item', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
    onDragStart?.(payload);
  });
  $('loot-grid').addEventListener('contextmenu', (event) => {
    const slot = event.target.closest('[data-item]');
    if (!slot?.dataset.item) return;
    event.preventDefault();
    void onTransfer?.({
      source: 'loot',
      corpseId: openedId,
      slot: Number(slot.dataset.slot),
      itemId: slot.dataset.item,
      target: 'inventory',
    });
  });
  function render(corpse) {
    [...$('loot-grid').children].forEach((element, index) => {
      const item = corpse.slots[index],
        definition = ITEMS[item?.id],
        signature = item ? item.id + ':' + item.quantity : '';
      if (element.dataset.rendered !== signature) {
        element.innerHTML = definition
          ? definition.icon + `<span class="item-quantity">${item.quantity}</span>`
          : '';
        element.dataset.rendered = signature;
      }
      element.dataset.item = item?.id || '';
      element.draggable = !!definition;
      element.setAttribute(
        'aria-label',
        definition ? `${definition.name} × ${item.quantity}` : `Espaço ${index + 1} — vazio`,
      );
      element.title = definition
        ? `${definition.name} — arraste ou botão direito para recolher`
        : 'Vazio';
    });
    $('loot-capacity').textContent = `${corpse.slots.filter(Boolean).length} / 6 espaços`;
  }
  return {
    open(loot) {
      openedId = loot.id;
      $('loot-heading').firstChild.textContent = `Loot de ${loot.name || 'Orc'} `;
      render(loot);
      $('loot-panel').hidden = false;
    },
    sync(corpses, position) {
      const corpse = corpses.find((corpse) => corpse.id === openedId);
      if (openedId && (corpse?.id !== openedId || !position || distance(corpse, position) > 1))
        close();
      if (openedId) render(corpse);
    },
    close,
  };
}
