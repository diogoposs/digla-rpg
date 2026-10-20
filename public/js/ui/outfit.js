import { DEFAULT_OUTFIT, COLORS, COLOR_NAMES, DIRECTIONS } from '../config.js';
import { drawPreview } from '../graphics/character.js';
import { $, errorAt } from './dom.js';

export function createOutfitPicker({ onConfirm, onBack }) {
  let outfit = { ...DEFAULT_OUTFIT },
    part = 'head',
    direction = 0;

  function render() {
    drawPreview($('outfit-preview'), outfit, DIRECTIONS[direction], 4);
    document.querySelectorAll('[data-outfit]').forEach((button) => {
      const selected = button.dataset.outfit === outfit.type;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected);
      drawPreview(
        button.querySelector('canvas'),
        { ...outfit, type: button.dataset.outfit },
        'down',
        1,
      );
    });
    document.querySelectorAll('[data-part]').forEach((button) => {
      const selected = button.dataset.part === part;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected);
    });
    [...$('palette').children].forEach((button, index) => {
      const selected = index === outfit[part];
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected);
    });
  }

  COLORS.forEach((color, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.backgroundColor = color;
    button.title = COLOR_NAMES[index];
    button.setAttribute('aria-label', COLOR_NAMES[index]);
    button.onclick = () => {
      outfit[part] = index;
      render();
    };
    $('palette').append(button);
  });
  document.querySelectorAll('[data-outfit]').forEach(
    (button) =>
      (button.onclick = () => {
        outfit.type = button.dataset.outfit;
        render();
      }),
  );
  document.querySelectorAll('[data-part]').forEach(
    (button) =>
      (button.onclick = () => {
        part = button.dataset.part;
        render();
      }),
  );
  $('rotate-left').onclick = () => {
    direction = (direction + 1) % 4;
    render();
  };
  $('rotate-right').onclick = () => {
    direction = (direction + 3) % 4;
    render();
  };
  $('back-to-account').onclick = () => {
    hide();
    onBack();
  };
  $('create-character').onclick = async () => {
    const button = $('create-character');
    button.disabled = true;
    button.firstElementChild.textContent = 'Preparando sua jornada…';
    errorAt('outfit-error', '');
    try {
      await onConfirm({ ...outfit });
    } catch (error) {
      errorAt('outfit-error', error.message);
    } finally {
      button.disabled = false;
      button.firstElementChild.textContent = 'Começar minha jornada';
    }
  };

  function hide() {
    $('outfit-view').hidden = true;
    $('auth-view').hidden = false;
    errorAt('outfit-error', '');
  }
  return {
    show(username) {
      $('preview-name').textContent = username;
      $('auth-view').hidden = true;
      $('outfit-view').hidden = false;
      render();
      $('back-to-account').focus();
    },
    hide,
  };
}
