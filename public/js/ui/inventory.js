import { BACKPACK_CAPACITY, INITIAL_VITALS } from '../config.js';
import { $ } from './dom.js';
import { ITEMS } from '../items.js';

// Slots vazios: os desenhos apagados são guias, não itens equipados.
const EQUIPMENT_SLOTS = [
  {
    id: 'necklace',
    name: 'Colar',
    shape: '<path d="M6 3v5a6 6 0 0 0 12 0V3M10 17l2-3 2 3-2 3z"/>',
  },
  {
    id: 'helmet',
    name: 'Elmo',
    shape: '<path d="M5 16V9a7 7 0 0 1 14 0v7l-5 3V9h-4v10zM5 11h5m4 0h5"/>',
  },
  { id: 'backpack', name: 'Mochila' },
  {
    id: 'sword',
    name: 'Espada',
    shape: '<path d="m6 18 3-3m-4-1 5 5M9 15 19 5l1-2-3 1L7 14M4 20l2-2"/>',
  },
  {
    id: 'armor',
    name: 'Armadura',
    shape: '<path d="m8 3-5 3 2 5 3-1-1 10h10l-1-10 3 1 2-5-5-3-4 3zM12 6v11"/>',
  },
  { id: 'shield', name: 'Escudo', shape: '<path d="m12 3 8 3-1 8-7 7-7-7-1-8zM12 6v11M7 10h10"/>' },
  {
    id: 'ring',
    name: 'Anel',
    shape: '<circle cx="12" cy="14" r="6"/><path d="m8 5 4-3 4 3-4 5z"/>',
  },
  { id: 'legs', name: 'Calça', shape: '<path d="M5 3h14l-1 18h-5l-1-10-1 10H6zM5 6h14"/>' },
  {
    id: 'arrows',
    name: 'Flechas',
    shape: '<path d="M8 21 17 3m-3 2 3-2 1 4M5 18l3 3 4-1M4 16l3 2m5-4L19 2m-2 12L21 5"/>',
  },
  {
    id: 'boots',
    name: 'Botas',
    shape: '<path d="M3 4h6v10l2 2v4H2v-5h1zM14 4h6v10l2 2v4h-9v-5h1zM3 8h6m5 0h6"/>',
  },
];

// Arte da mochila em SVG com formas de pixel art.
const BACKPACK_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true" class="backpack-icon" shape-rendering="crispEdges">
  <path fill="#171914" d="M12 3h8v3h4v3h3v19H5V9h3V6h4z"/>
  <path fill="#9a7145" d="M13 4h6v2h-6zM9 8h14v3h2v15H7V11h2z"/>
  <path fill="#b38b54" d="M9 8h14v5H9zM8 15h3v9H8z"/>
  <path fill="#684b31" d="M9 13h14v2H9zM23 12h2v14h-2zM12 17h9v8h-9z"/>
  <path fill="#997144" d="M13 18h7v5h-7z"/>
  <path fill="#d2b071" d="M14 10h4v6h-4zM14 19h4v2h-4z"/>
  <path fill="#55402b" d="M15 11h2v3h-2z"/>
  <path fill="#d1a46a" d="M10 8h11v1H10zM8 16h2v1H8z"/>
</svg>`;

export function createInventory({
  onUse,
  onDragStart,
  onDragEnd,
  onTransfer,
  onStaff,
  onDeposit,
} = {}) {
  for (const slot of EQUIPMENT_SLOTS) {
    const element = document.createElement(slot.id === 'backpack' ? 'button' : 'div');
    element.className = 'equipment-slot';
    element.dataset.equipment = slot.id;
    if (slot.id === 'backpack') {
      element.type = 'button';
      element.id = 'backpack-slot';
      element.title = 'Mochila — botão direito para abrir';
      element.setAttribute('aria-label', 'Mochila — botão direito para abrir');
      element.setAttribute('aria-expanded', 'false');
      element.setAttribute('aria-controls', 'backpack-panel');
      element.innerHTML = BACKPACK_ICON + '<span class="slot-name">Mochila</span>';
    } else {
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', slot.name + ' — espaço vazio');
      element.title = slot.name + ' — espaço vazio';
      element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" class="slot-placeholder">${slot.shape}</svg><span class="slot-name" aria-hidden="true">${slot.name}</span>`;
    }
    $('equipment-grid').append(element);
  }
  for (let index = 0; index < BACKPACK_CAPACITY; index++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.slot = index;
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-label', `Espaço ${index + 1} — vazio`);
    slot.title = `Espaço ${index + 1} — vazio`;
    $('inventory-grid').append(slot);
  }
  $('backpack-capacity').textContent = `${BACKPACK_CAPACITY} espaços`;
  $('inventory-grid').addEventListener('click', (event) => {
    const slot = event.target.closest('.inventory-slot');
    if (!slot?.dataset.item || event.shiftKey) return;
    onDeposit?.({
      source: 'inventory',
      slot: Number(slot.dataset.slot),
      itemId: slot.dataset.item,
    });
  });
  $('inventory-grid').addEventListener('contextmenu', (event) => {
    const slot = event.target.closest('.inventory-slot');
    if (!slot?.dataset.item) return;
    event.preventDefault();
    const payload = {
      source: 'inventory',
      slot: Number(slot.dataset.slot),
      itemId: slot.dataset.item,
    };
    if (onDeposit?.(payload)) return;
    if (slot.dataset.item === 'staff') onStaff?.(payload);
    else void onUse?.(payload);
  });
  $('inventory-grid').addEventListener('dragstart', (event) => {
    const slot = event.target.closest('.inventory-slot');
    if (!slot?.dataset.item) {
      event.preventDefault();
      return;
    }
    const payload = {
      slot: Number(slot.dataset.slot),
      itemId: slot.dataset.item,
      quantity: Number(slot.dataset.quantity),
    };
    event.dataTransfer.setData('application/x-digla-item', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  });
  $('inventory-grid').addEventListener('dragend', () => onDragEnd?.());
  function dropTarget(element, target, equipmentSlot) {
    element.addEventListener('dragover', (event) => {
      if (Array.from(event.dataTransfer.types).includes('application/x-digla-item')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    });
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      try {
        const payload = JSON.parse(event.dataTransfer.getData('application/x-digla-item'));
        const slot = event.target.closest('.inventory-slot');
        void onTransfer?.({
          ...payload,
          target,
          ...(equipmentSlot ? { equipmentSlot } : {}),
          ...(slot ? { targetSlot: Number(slot.dataset.slot) } : {}),
        });
      } catch {
        /* Somente itens do jogo. */
      }
    });
  }
  dropTarget($('inventory-grid'), 'inventory');
  const equipmentElements = EQUIPMENT_SLOTS.filter((slot) => slot.id !== 'backpack').map((slot) => {
    const element = document.querySelector(`[data-equipment="${slot.id}"]`);
    // O atributo "sword" é mantido no HTML; no estado/API o espaço se chama "weapon".
    const equipmentSlot = slot.id === 'sword' ? 'weapon' : slot.id;
    const placeholder = element.innerHTML;
    dropTarget(element, 'equipment', equipmentSlot);
    element.addEventListener('dragstart', (event) => {
      if (!element.dataset.item) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData(
        'application/x-digla-item',
        JSON.stringify({
          source: 'equipment',
          slot: equipmentSlot,
          itemId: element.dataset.item,
          quantity: Number(element.dataset.quantity),
        }),
      );
      event.dataTransfer.effectAllowed = 'move';
      onDragStart?.();
    });
    element.addEventListener('dragend', () => onDragEnd?.());
    element.addEventListener('contextmenu', (event) => {
      if (!element.dataset.item) return;
      event.preventDefault();
      const payload = { source: 'equipment', slot: equipmentSlot, itemId: element.dataset.item };
      if (payload.itemId === 'staff') onStaff?.(payload);
      else void onTransfer?.({ ...payload, target: 'inventory' });
    });
    return { element, equipmentSlot, placeholder, name: slot.id === 'sword' ? 'Arma' : slot.name };
  });

  function setOpen(open, restoreFocus = false) {
    $('backpack-panel').hidden = !open;
    $('backpack-slot').setAttribute('aria-expanded', String(open));
    $('backpack-slot').classList.toggle('is-open', open);
    if (restoreFocus) $('backpack-slot').focus({ preventScroll: true });
  }
  function toggle() {
    setOpen($('backpack-panel').hidden);
  }
  $('backpack-slot').addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggle();
  });
  // Enter/Espaço e tecla de menu oferecem o mesmo acesso pelo teclado.
  $('backpack-slot').addEventListener('click', (event) => {
    if (event.detail === 0) toggle();
  });
  $('backpack-slot').addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      toggle();
    }
  });
  $('close-backpack').onclick = () => setOpen(false, true);

  function updateVital(id, value, max) {
    $(id + '-value').textContent = `${value} / ${max}`;
    const bar = $(id + '-bar');
    bar.setAttribute('aria-valuemax', max);
    bar.setAttribute('aria-valuenow', value);
    bar.firstElementChild.style.width = `${(value / max) * 100}%`;
  }
  return {
    renderEquipment(equipment = {}) {
      for (const { element, equipmentSlot, placeholder, name } of equipmentElements) {
        const item = equipment[equipmentSlot];
        const definition = ITEMS[item?.id];
        const signature = definition ? `${item.id}:${item.quantity}` : '';
        if (element.dataset.rendered !== signature) {
          element.innerHTML = definition
            ? definition.icon +
              (definition.stackable ? `<span class="item-quantity">${item.quantity}</span>` : '') +
              `<span class="slot-name">${name}</span>`
            : placeholder;
          element.dataset.rendered = signature;
        }
        element.dataset.item = item?.id || '';
        element.dataset.quantity = item?.quantity || 0;
        element.draggable = !!definition;
        element.setAttribute(
          'aria-label',
          definition ? `${definition.name} — equipado` : `${name} — espaço vazio`,
        );
        element.title = definition
          ? `${definition.name} — botão direito para ${item.id === 'staff' ? 'escolher elemento' : 'guardar'}`
          : `${name} — arraste um item compatível`;
      }
    },
    render(items = []) {
      let used = 0;
      [...$('inventory-grid').children].forEach((slot, index) => {
        const item = items[index];
        const definition = ITEMS[item?.id];
        const content = definition
          ? `${definition.icon}<span class="item-quantity">${item.quantity}</span>`
          : '';
        const signature = definition ? `${item.id}:${item.quantity}` : '';
        if (slot.dataset.rendered !== signature) {
          slot.innerHTML = content;
          slot.dataset.rendered = signature;
        }
        slot.classList.toggle('has-item', !!definition);
        slot.dataset.item = item?.id || '';
        slot.dataset.quantity = item?.quantity || 0;
        slot.draggable = !!definition;
        const label = definition
          ? `${definition.name} × ${item.quantity}`
          : `Espaço ${index + 1} — vazio`;
        slot.setAttribute('aria-label', label);
        slot.title =
          label +
          (item?.id === 'gold_coin' ? ' — botão direito: trocar 100 por 1 moeda cinza' : '');
        if (item) used++;
      });
      $('backpack-capacity').textContent = `${used} / ${BACKPACK_CAPACITY} espaços`;
    },
    reset() {
      setOpen(false);
      updateVital('health', INITIAL_VITALS.health, INITIAL_VITALS.maxHealth);
      updateVital('mana', INITIAL_VITALS.mana, INITIAL_VITALS.maxMana);
    },
    renderVitals(vitals = INITIAL_VITALS) {
      updateVital('health', vitals.health, vitals.maxHealth);
      updateVital('mana', vitals.mana, vitals.maxMana);
    },
  };
}
