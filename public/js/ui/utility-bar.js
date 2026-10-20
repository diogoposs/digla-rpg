import { ITEMS } from '../items.js';
import { POTIONS } from '../game/utility-rules.js';

const ICONS = {
  h: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m8 9 11 3-3 14 10 4 7-8 7 6-13 12-17-8Z" fill="#a7debd" stroke="#f0edb0" stroke-width="2"/><path d="M4 18h9M2 24h9M5 30h5" stroke="#88f1d9" stroke-width="2"/></svg>',
  b: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m6 19 18-13 18 13ZM10 37h28v5H10Zm4-16h6v16h-6Zm14 0h6v16h-6Z" fill="#c9b97d" stroke="#fff0ac"/><circle cx="24" cy="25" r="6" fill="#65bfe0" stroke="#bcefff"/></svg>',
};
export function createUtilityBar({ onUse }) {
  const frame = document.querySelector('.world-frame'),
    layer = document.getElementById('effect-layer');
  const bars = document.createElement('div');
  bars.id = 'action-bars';
  bars.append(document.getElementById('lightning-abilities'));
  const bar = document.createElement('section');
  bar.id = 'utility-bar';
  bar.setAttribute('aria-label', 'Poções e habilidades gerais');
  bar.innerHTML = `${[0, 1, 2].map((i) => `<button type="button" data-quick="${i}"><span></span><kbd>${i + 1}</kbd><b></b></button>`).join('')}<button type="button" data-utility="h">${ICONS.h}<kbd>H</kbd><b></b></button><button type="button" data-utility="b">${ICONS.b}<kbd>B</kbd><b></b></button>`;
  bars.append(bar);
  frame.append(bars);
  const menu = document.createElement('section');
  menu.id = 'quick-config';
  menu.hidden = true;
  menu.setAttribute('aria-label', 'Configurar atalho de poção');
  menu.innerHTML =
    '<strong>Escolha a poção do atalho</strong>' +
    POTIONS.map(
      (id) =>
        `<button type="button" data-potion="${id}">${ITEMS[id].icon}${ITEMS[id].name}</button>`,
    ).join('') +
    '<button type="button" data-close>Fechar</button>';
  bars.append(menu);
  const aura = document.createElement('span');
  aura.id = 'recall-effect';
  aura.hidden = true;
  aura.innerHTML =
    '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="72" rx="40" ry="18"/><ellipse cx="50" cy="72" rx="28" ry="12"/><path d="M20 65V20m15 42V7m30 55V7m15 58V20"/><path d="m50 8 8 10-8 10-8-10Z"/></svg>';
  layer.append(aura);
  const casting = document.createElement('div');
  casting.id = 'recall-panel';
  casting.hidden = true;
  casting.innerHTML =
    '<span>Retornando ao templo</span><b></b><progress max="10" value="0"></progress><small>Fique parado e evite receber dano</small>';
  frame.append(casting);
  let slots = ['health_potion', 'mana_potion', 'health_potion'],
    utility = {},
    inventory = [],
    offset = 0,
    configIndex = 0,
    active = false;
  function render() {
    if (!active) return;
    const now = Date.now() + offset;
    for (const button of bar.querySelectorAll('[data-quick]')) {
      const id = slots[Number(button.dataset.quick)],
        count = inventory.reduce((n, item) => n + (item?.id === id ? item.quantity : 0), 0);
      button.querySelector('span').innerHTML = ITEMS[id].icon;
      button.querySelector('b').textContent = count;
      button.title = `${Number(button.dataset.quick) + 1}: ${ITEMS[id].name} (${count}). Botão direito para configurar.`;
      button.setAttribute('aria-label', button.title);
    }
    for (const key of ['h', 'b']) {
      const button = bar.querySelector(`[data-utility="${key}"]`),
        remaining = Math.max(
          0,
          (utility[key === 'h' ? 'hasteCooldownUntil' : 'recallCooldownUntil'] || 0) - now,
        );
      button.querySelector('b').textContent =
        remaining > 0
          ? remaining >= 60000
            ? `${Math.ceil(remaining / 60000)}m`
            : `${Math.ceil(remaining / 1000)}s`
          : '';
      button.disabled = remaining > 0 || (key === 'b' && !!utility.recall);
      button.title =
        key === 'h'
          ? 'H: Corrida — 10 mana, velocidade 1,5× por 5s, recarga 10s.'
          : 'B: Templo — permaneça parado por 10s sem dano. Recarga de 10 minutos após chegar.';
      button.setAttribute('aria-label', button.title);
    }
    const recall = utility.recall;
    casting.hidden = aura.hidden = !recall;
    if (recall) {
      casting.querySelector('b').textContent =
        `${Math.max(0, (recall.endsAt - now) / 1000).toFixed(1)}s`;
      casting.querySelector('progress').value = Math.min(
        10,
        Math.max(0, (now - recall.startedAt) / 1000),
      );
    }
  }
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    void onUse(
      b.dataset.quick !== undefined
        ? { key: 'quick', index: Number(b.dataset.quick) }
        : { key: b.dataset.utility },
    );
  });
  bar.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    e.preventDefault();
    configIndex = Number(b.dataset.quick);
    menu.hidden = false;
  });
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.potion)
      await onUse({ key: 'quick', index: configIndex, configure: true, itemId: b.dataset.potion });
    menu.hidden = true;
    document.getElementById('world').focus({ preventScroll: true });
  });
  setInterval(render, 100);
  return {
    sync(data) {
      if (data.quickSlots) slots = data.quickSlots;
      if (data.utility) utility = data.utility;
      if (data.inventory) inventory = data.inventory;
      if (data.serverNow !== undefined) offset = data.serverNow - Date.now();
      render();
    },
    show() {
      active = true;
      bars.hidden = false;
      render();
    },
    hide() {
      active = false;
      bars.hidden = menu.hidden = casting.hidden = aura.hidden = true;
    },
    position(renderer, point) {
      if (aura.hidden) return;
      const p = renderer.worldToScreen(point.x, point.y);
      aura.style.left = p.x + 'px';
      aura.style.top = p.y - 30 * renderer.scale + 'px';
      aura.style.width = aura.style.height = 65 * renderer.scale + 'px';
    },
  };
}
