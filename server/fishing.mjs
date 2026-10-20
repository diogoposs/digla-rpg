import { ensureProgress, publicProgress, skillProgress } from '../public/js/game/progression.js';
import {
  FISHING_INTERVAL_MS,
  SALMON_XP,
  cursorPosition,
  isGreen,
  nearWater,
  salmonChance,
} from '../public/js/game/fishing-rules.js';

// RNG, XP e inventário são decididos aqui, nunca pelo navegador.
// Não há pesca offline: uma tentativa por chamada válida, com intervalo mínimo de 600 ms.
export function createFishingService({ save, random = Math.random, now = Date.now }) {
  const sessions = new WeakMap();
  let nextChallengeId = 1;

  function challenge(state, time) {
    state.challenge = {
      id: nextChallengeId++,
      startedAt: time,
      pressed: false,
      boosted: false,
      position: 0,
    };
  }
  function hasSpace(account) {
    return account.inventory.some((item) => item === null || item.id === 'raw_salmon');
  }
  function snapshot(account, state, extra = {}) {
    const time = now();
    return {
      active: !!state,
      ...publicProgress(account),
      ...(state
        ? {
            challenge: { ...state.challenge, elapsed: time - state.challenge.startedAt },
            chance: salmonChance(
              skillProgress(account.skills.fishing.xp).level,
              state.challenge.boosted,
            ),
            nextAttemptIn: Math.max(0, state.nextAttempt - time),
          }
        : {}),
      ...extra,
    };
  }
  function stop(account, message = '') {
    sessions.delete(account);
    return snapshot(account, null, { message });
  }
  function current(account) {
    const state = sessions.get(account);
    if (!state) return null;
    if (
      account.position.x !== state.x ||
      account.position.y !== state.y ||
      !nearWater(account.position) ||
      now() - state.lastSeen > 5000
    ) {
      sessions.delete(account);
      return null;
    }
    state.lastSeen = now();
    return state;
  }

  return {
    stop,
    start(account) {
      ensureProgress(account);
      if (!nearWater(account.position))
        return stop(account, 'Chegue a um quadrado da água para pescar.');
      if (!hasSpace(account)) return stop(account, 'Sua mochila está cheia.');
      let state = current(account);
      if (!state) {
        const time = now();
        state = {
          ...account.position,
          nextAttempt: time + FISHING_INTERVAL_MS,
          lastSeen: time,
          busy: false,
        };
        challenge(state, time);
        sessions.set(account, state);
      }
      return snapshot(account, state);
    },
    press(account, id) {
      const state = current(account);
      if (!state) return stop(account, 'A pesca foi interrompida. Aperte F para começar.');
      const bar = state.challenge;
      // Um único segundo F por peixe. Segurar a tecla ou repetir chamadas não acumula bônus.
      if (id !== bar.id || bar.pressed) return snapshot(account, state);
      bar.pressed = true;
      bar.position = cursorPosition(now() - bar.startedAt);
      bar.boosted = isGreen(bar.position);
      return snapshot(account, state);
    },
    async tick(account) {
      const state = current(account);
      if (!state) return stop(account, 'A pesca foi interrompida. Aperte F para começar.');
      if (!hasSpace(account)) return stop(account, 'Sua mochila está cheia.');
      const time = now();
      if (state.busy || time < state.nextAttempt)
        return snapshot(account, state, { attempted: false });
      state.nextAttempt = time + FISHING_INTERVAL_MS;
      const levelBefore = skillProgress(account.skills.fishing.xp).level;
      const chance = salmonChance(levelBefore, state.challenge.boosted);
      const caught = random() < chance;
      if (caught) {
        let index = account.inventory.findIndex((item) => item?.id === 'raw_salmon');
        if (index === -1) {
          index = account.inventory.indexOf(null);
          account.inventory[index] = { id: 'raw_salmon', quantity: 0 };
        }
        account.inventory[index].quantity++;
        account.skills.fishing.xp = Math.min(
          Number.MAX_SAFE_INTEGER,
          account.skills.fishing.xp + SALMON_XP,
        );
        challenge(state, time);
        state.busy = true;
        try {
          await save();
        } finally {
          state.busy = false;
        }
      }
      return snapshot(account, state, {
        attempted: true,
        caught,
        leveledUp: caught && skillProgress(account.skills.fishing.xp).level > levelBefore,
      });
    },
  };
}
