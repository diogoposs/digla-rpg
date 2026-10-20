import { api } from '../api.js';
import { $ } from '../ui/dom.js';
import { ITEMS } from '../items.js';
import { COOKING_INTERVAL_MS, COOKING_XP, SALMON_RECIPE } from './cooking-rules.js';

export function createCooking({ prepare, onProgress, onSessionExpired }) {
  let visible = false,
    state = null,
    timer,
    busy = false,
    version = 0,
    deadline = 0;
  let stopping = Promise.resolve();
  $('cooking-recipe-icon').innerHTML = ITEMS[SALMON_RECIPE.ingredient].icon;
  const notify = (text) => {
    $('fishing-message').textContent = text;
  };

  function apply(result) {
    onProgress(result);
    state = result;
    if (!result.available) {
      hide();
      notify(result.message || 'Aproxime-se do fogão.');
      return;
    }
    $('cooking-chance').textContent = `${Math.round(result.chance * 100)}% de sucesso`;
    $('cooking-bar-level').textContent = result.skills.cooking.level;
    $('cooking-raw-count').textContent = `${result.rawCount} salmão(ões) cru(s) na mochila`;
    $('cook-one').disabled = result.active || !result.rawCount;
    $('cook-all').disabled = result.active || !result.rawCount;
    $('cook-all').textContent = `Cozinhar todos (${result.rawCount})`;
    $('cooking-running').hidden = !result.active;
    $('cooking-remaining').textContent = `${result.remaining} por cozinhar`;
    deadline = performance.now() + result.nextAttemptIn;
    if (result.attempted) {
      const text = result.success
        ? `Salmão assado! +${COOKING_XP} XP de Culinária.`
        : 'O salmão queimou. Ele foi guardado na mochila.';
      $('cooking-result').textContent = text;
      notify(text + (result.leveledUp ? ` Culinária nível ${result.skills.cooking.level}!` : ''));
    } else if (result.message) $('cooking-result').textContent = result.message;
    else if (!result.active && !result.rawCount)
      $('cooking-result').textContent = 'Pesque salmão cru para cozinhar aqui.';
  }
  function hide() {
    visible = false;
    state = null;
    clearTimeout(timer);
    $('cooking-panel').hidden = true;
  }
  function failed(error) {
    hide();
    if (error.status === 401) onSessionExpired();
    else notify(error.message);
  }
  function schedule(currentVersion) {
    clearTimeout(timer);
    if (!visible || !state?.active || version !== currentVersion) return;
    timer = setTimeout(
      async () => {
        try {
          const result = await api('cooking/tick', {});
          if (version !== currentVersion) return;
          apply(result);
          schedule(currentVersion);
        } catch (error) {
          if (version === currentVersion) failed(error);
        }
      },
      Math.max(20, state.nextAttemptIn),
    );
  }
  async function start(quantity) {
    if (busy || !visible || state?.active) return;
    busy = true;
    const currentVersion = version;
    $('cook-one').disabled = true;
    $('cook-all').disabled = true;
    try {
      const result = await api('cooking/start', { recipe: SALMON_RECIPE.id, quantity });
      if (version !== currentVersion) return;
      $('cooking-result').textContent = result.active ? 'Preparando um salmão por vez…' : '';
      apply(result);
      schedule(currentVersion);
    } catch (error) {
      if (version === currentVersion) failed(error);
    } finally {
      busy = false;
    }
  }
  function close(notice = '') {
    const wasOpen = visible || busy;
    version++;
    hide();
    if (notice && wasOpen) notify(notice);
    if (wasOpen)
      stopping = stopping
        .catch(() => {})
        .then(() => api('cooking/stop', {}))
        .then(onProgress)
        .catch(() => {});
    return stopping;
  }
  $('cook-one').onclick = () => void start(1);
  $('cook-all').onclick = () => void start('all');
  $('close-cooking').onclick = () => void close();
  $('stop-cooking').onclick = async () => {
    if (busy) return;
    const currentVersion = ++version;
    clearTimeout(timer);
    busy = true;
    try {
      const result = await api('cooking/stop', {});
      if (version === currentVersion) {
        apply(result);
        $('cooking-result').textContent =
          'Preparo interrompido. Os peixes restantes continuam crus.';
      }
    } catch (error) {
      if (version === currentVersion) failed(error);
    } finally {
      busy = false;
    }
  };
  return {
    get isOpen() {
      return visible;
    },
    async open() {
      if (visible || busy) return;
      busy = true;
      const currentVersion = version;
      try {
        await stopping;
        if (!(await prepare()) || currentVersion !== version) return;
        const result = await api('cooking/open', {});
        if (currentVersion !== version) return;
        visible = true;
        $('cooking-panel').hidden = false;
        $('cooking-result').textContent = 'Escolha o que deseja cozinhar.';
        apply(result);
        schedule(currentVersion);
      } catch (error) {
        if (version === currentVersion) failed(error);
      } finally {
        busy = false;
      }
    },
    close,
    reset() {
      version++;
      hide();
    },
    update(time) {
      if (state?.active)
        $('cooking-progress-fill').style.width =
          `${Math.min(100, Math.max(0, 1 - (deadline - time) / COOKING_INTERVAL_MS) * 100)}%`;
    },
  };
}
