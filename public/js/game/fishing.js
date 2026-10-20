import { api } from '../api.js';
import { $ } from '../ui/dom.js';
import { cursorPosition, nearWater, GREEN_START, GREEN_END } from './fishing-rules.js';

// O cliente anima a barra; servidor verifica o F, sorteia o peixe e salva o XP.
export function createFishing({ getPosition, prepare, onProgress, onSessionExpired }) {
  $('fishing-panel').style.setProperty('--green-start', `${GREEN_START * 100}%`);
  $('fishing-panel').style.setProperty('--green-width', `${(GREEN_END - GREEN_START) * 100}%`);
  let state = null,
    syncTime = 0,
    timer,
    busy = false,
    version = 0,
    stopping = Promise.resolve();
  let lastMessage = '';
  let catchMessageUntil = 0;

  function message(text) {
    if (text !== lastMessage) {
      $('fishing-message').textContent = text;
      lastMessage = text;
    }
  }
  function apply(result) {
    if (
      state &&
      result.challenge &&
      (result.challenge.id < state.challenge.id ||
        (result.challenge.id === state.challenge.id &&
          state.challenge.pressed &&
          !result.challenge.pressed))
    )
      return;
    onProgress(result);
    state = result.active ? result : null;
    syncTime = performance.now();
    $('fishing-panel').hidden = !state;
    if (!state) {
      clearTimeout(timer);
      if (result.message) message(result.message);
      return;
    }
    $('fishing-chance').textContent = `${Math.round(state.chance * 100)}% de chance`;
    $('fishing-bar-level').textContent = state.skills.fishing.level;
    const bar = state.challenge;
    $('fishing-panel').classList.toggle('fishing-boosted', bar.boosted);
    $('fishing-instruction').textContent = !bar.pressed
      ? 'Aperte F no centro verde · Esc para parar'
      : bar.boosted
        ? 'Acertou! Chance dobrada até a captura.'
        : 'Fora do centro. Bônus na próxima captura.';
    if (result.caught) {
      catchMessageUntil = performance.now() + 2200;
      message(
        `Salmão cru capturado! +10 XP${result.leveledUp ? ` · Pesca nível ${state.skills.fishing.level}!` : ''}`,
      );
    } else if (result.attempted && performance.now() >= catchMessageUntil)
      message('O peixe escapou. Continuando a pescar…');
  }
  function failed(error) {
    state = null;
    clearTimeout(timer);
    $('fishing-panel').hidden = true;
    if (error.status === 401) onSessionExpired();
    else message(error.message);
  }
  function schedule(currentVersion) {
    clearTimeout(timer);
    if (!state || currentVersion !== version) return;
    timer = setTimeout(
      async () => {
        try {
          const result = await api('fishing/tick', {});
          if (currentVersion !== version) return;
          apply(result);
          schedule(currentVersion);
        } catch (error) {
          if (currentVersion === version) failed(error);
        }
      },
      Math.max(20, state.nextAttemptIn),
    );
  }

  return {
    get active() {
      return !!state;
    },
    async press() {
      if (busy) return;
      if (!state && !nearWater(getPosition())) {
        message('Chegue a um quadrado da água para pescar.');
        return;
      }
      busy = true;
      const currentVersion = version;
      try {
        if (!state) {
          await stopping;
          if (!(await prepare()) || currentVersion !== version) return;
          const result = await api('fishing/start', {});
          if (currentVersion !== version) return;
          message('Linha lançada. Acerte o centro verde com F!');
          apply(result);
          schedule(currentVersion);
        } else if (!state.challenge.pressed) {
          const result = await api('fishing/press', { challengeId: state.challenge.id });
          if (currentVersion !== version) return;
          // Um tick pode ter concluído enquanto o F estava a caminho; use sempre o desafio mais novo.
          if (!state || result.challenge?.id >= state.challenge.id) apply(result);
          schedule(currentVersion);
        }
      } catch (error) {
        if (currentVersion === version) failed(error);
      } finally {
        busy = false;
      }
    },
    stop(notice = '') {
      const wasActive = state || busy;
      version++;
      state = null;
      clearTimeout(timer);
      $('fishing-panel').hidden = true;
      if (notice && wasActive) message(notice);
      if (wasActive)
        stopping = api('fishing/stop', {})
          .then(onProgress)
          .catch(() => {});
      return stopping;
    },
    reset() {
      version++;
      state = null;
      clearTimeout(timer);
      $('fishing-panel').hidden = true;
      message('');
    },
    update(time) {
      if (!state) return;
      const bar = state.challenge;
      const position = bar.pressed ? bar.position : cursorPosition(bar.elapsed + time - syncTime);
      $('fishing-cursor').style.left = `${position * 100}%`;
    },
  };
}
