import { lookItem } from '../game/look-rules.js';

// One capture handler covers inventory, equipment, loot, shops, bank and the world.
export function createInspection({ isRunning, describeWorld }) {
  const game = document.querySelector('#game'),
    frame = document.querySelector('.world-frame');
  const message = document.createElement('p');
  message.id = 'look-message';
  message.className = 'look-message';
  message.hidden = true;
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  frame.append(message);
  const menu = document.createElement('div');
  menu.id = 'item-context-menu';
  menu.className = 'item-context-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Ações do item');
  menu.innerHTML =
    '<button id="item-context-use" role="menuitem" type="button">Usar</button><button id="item-context-look" role="menuitem" type="button">Olhar</button>';
  document.body.append(menu);
  let timer, selected;
  function close() {
    menu.hidden = true;
    selected = null;
  }
  function show(text) {
    if (!text) return;
    clearTimeout(timer);
    message.textContent = text;
    message.hidden = false;
    timer = setTimeout(() => {
      message.hidden = true;
    }, 6500);
  }
  function itemInfo(target) {
    const item = target.closest('[data-item]');
    if (item?.dataset.item)
      return lookItem(
        item.dataset.item,
        Number(item.dataset.quantity) ||
          Number(item.querySelector('.item-quantity')?.textContent) ||
          1,
      );
    if (target.closest('#backpack-slot')) return lookItem('backpack');
    if (target.closest('.inventory-slot, .equipment-slot, .town-slot'))
      return 'You see an empty slot.';
    return null;
  }
  document.addEventListener(
    'click',
    (event) => {
      if (!isRunning() || !game.contains(event.target)) return;
      if (!event.shiftKey) {
        close();
        return;
      }
      const text = itemInfo(event.target) || describeWorld(event);
      if (!text) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      show(text);
    },
    true,
  );
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (!isRunning() || !game.contains(event.target) || event.diglaUse) return;
      const item = event.target.closest('[data-item]');
      const ground = event.target.closest('[data-ground-id]');
      if (!item?.dataset.item && !ground) {
        close();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = item || ground;
      const selectOnly = !!(
        target.closest('#town-stock') ||
        (target.closest('#town-bag') && document.querySelector('#town-bank').hidden)
      );
      selected = {
        target,
        selectOnly,
        x: event.clientX,
        y: event.clientY,
        text: item ? itemInfo(item) : describeWorld(event),
      };
      const label = selectOnly
        ? 'Selecionar'
        : target.closest('#town-bank')
          ? 'Retirar'
          : target.closest('#town-bag') && !document.querySelector('#town-bank').hidden
            ? 'Guardar'
            : ground || target.closest('#loot-grid')
              ? 'Recolher'
              : item?.dataset.item === 'staff'
                ? 'Configurar / usar'
                : 'Usar';
      menu.querySelector('#item-context-use').textContent = label;
      menu.hidden = false;
      menu.style.left =
        Math.max(4, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 4)) + 'px';
      menu.style.top =
        Math.max(4, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 4)) + 'px';
      menu.querySelector('#item-context-look').focus({ preventScroll: true });
    },
    true,
  );
  menu.querySelector('#item-context-look').onclick = () => {
    const text = selected?.text;
    close();
    show(text);
  };
  menu.querySelector('#item-context-use').onclick = () => {
    const entry = selected;
    close();
    if (!entry?.target.isConnected) return;
    const box = entry.target.getBoundingClientRect();
    const event = new MouseEvent(entry.selectOnly ? 'click' : 'contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
      button: entry.selectOnly ? 0 : 2,
    });
    event.diglaUse = true;
    entry.target.dispatchEvent(event);
  };
  menu.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!menu.contains(event.target)) close();
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (menu.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        (document.activeElement === menu.firstElementChild
          ? menu.lastElementChild
          : menu.firstElementChild
        ).focus();
      }
    },
    true,
  );
  return {
    clear() {
      close();
      clearTimeout(timer);
      message.hidden = true;
    },
    show,
  };
}
