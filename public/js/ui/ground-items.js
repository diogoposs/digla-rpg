import { $ } from './dom.js';
import { ITEMS } from '../items.js';

// Áreas transparentes sobre os sprites permitem arrasto nativo, sem redesenhar os ícones.
export function createGroundItems({ onDragStart } = {}) {
  const elements = new Map();
  const layer = $('ground-item-layer');
  layer.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-ground-id]');
    if (!item) return;
    event.dataTransfer.setData(
      'application/x-digla-item',
      JSON.stringify({ source: 'ground', id: item.dataset.groundId }),
    );
    event.dataTransfer.effectAllowed = 'move';
    onDragStart?.({ source: 'ground', id: item.dataset.groundId });
  });
  return {
    update(items, renderer) {
      const ids = new Set(items.map((item) => item.id));
      for (const [id, element] of elements) {
        if (!ids.has(id)) {
          element.remove();
          elements.delete(id);
        }
      }
      // Apenas a pilha superior recebe cliques quando há tipos diferentes no mesmo tile.
      for (const item of items) {
        let element = elements.get(item.id);
        if (!element) {
          element = document.createElement('div');
          element.className = 'ground-item-handle';
          element.dataset.groundId = item.id;
          element.draggable = true;
          element.setAttribute('role', 'img');
          elements.set(item.id, element);
          layer.append(element);
        }
        const point = renderer.worldToScreen(item.x, item.y);
        element.style.left = point.x + 'px';
        element.style.top = point.y + 'px';
        element.style.width = element.style.height = 22 * renderer.scale + 'px';
        const label = `${ITEMS[item.itemId].name} × ${item.quantity} no chão`;
        element.setAttribute('aria-label', label);
        element.title = label + ' — arraste para mover; botão direito para recolher';
      }
    },
    clear() {
      layer.replaceChildren();
      elements.clear();
    },
  };
}
