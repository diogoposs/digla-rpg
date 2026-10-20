import { ensureProgress, publicProgress, skillProgress } from '../public/js/game/progression.js';
import {
  COOKING_INTERVAL_MS,
  COOKING_XP,
  SALMON_RECIPE,
  cookingChance,
  nearStove,
} from '../public/js/game/cooking-rules.js';

// Um peixe por tentativa. Consumo, resultado, XP e salvamento ficam no servidor.
export function createCookingService({ save, random = Math.random, now = Date.now }) {
  const sessions = new WeakMap();
  const rawCount = (account) =>
    account.inventory.reduce(
      (sum, item) => sum + (item?.id === SALMON_RECIPE.ingredient ? item.quantity : 0),
      0,
    );
  function canTransform(account) {
    const raw = account.inventory.findIndex((item) => item?.id === SALMON_RECIPE.ingredient);
    if (raw === -1) return false;
    // Se o último cru liberar seu slot, qualquer resultado cabe. Caso contrário,
    // os resultados possíveis precisam caber, para não perder peixe por falta de espaço.
    if (account.inventory[raw].quantity === 1 || account.inventory.includes(null)) return true;
    const possible =
      cookingChance(skillProgress(account.skills.cooking.xp).level) === 1
        ? [SALMON_RECIPE.cooked]
        : [SALMON_RECIPE.cooked, SALMON_RECIPE.burnt];
    return possible.every((id) => account.inventory.some((item) => item?.id === id));
  }
  function current(account) {
    const state = sessions.get(account);
    if (!state) return null;
    if (
      !nearStove(account.position) ||
      account.position.x !== state.x ||
      account.position.y !== state.y ||
      now() - state.lastSeen > 5000
    ) {
      sessions.delete(account);
      return null;
    }
    state.lastSeen = now();
    return state;
  }
  function snapshot(account, state, extra = {}) {
    const progress = publicProgress(account);
    return {
      ...progress,
      active: !!state,
      available: nearStove(account.position),
      rawCount: rawCount(account),
      chance: cookingChance(progress.skills.cooking.level),
      remaining: state?.remaining || 0,
      completed: state?.completed || 0,
      nextAttemptIn: state ? Math.max(0, state.nextAttempt - now()) : 0,
      ...extra,
    };
  }
  function stop(account, message = '') {
    sessions.delete(account);
    return snapshot(account, null, { message });
  }
  return {
    stop,
    open(account) {
      ensureProgress(account);
      if (!nearStove(account.position)) return stop(account, 'Aproxime-se do fogão para cozinhar.');
      return snapshot(account, current(account));
    },
    start(account, recipe, quantity) {
      ensureProgress(account);
      if (!nearStove(account.position)) return stop(account, 'Aproxime-se do fogão para cozinhar.');
      const previous = current(account);
      if (previous) return snapshot(account, previous);
      if (recipe !== SALMON_RECIPE.id || (quantity !== 'all' && quantity !== 1))
        return snapshot(account, null, { message: 'Escolha uma receita e quantidade válidas.' });
      if (!rawCount(account))
        return snapshot(account, null, { message: 'Você precisa de salmão cru na mochila.' });
      if (!canTransform(account))
        return snapshot(account, null, {
          message: 'Libere um espaço na mochila antes de cozinhar.',
        });
      const time = now();
      const state = {
        ...account.position,
        remaining: quantity === 'all' ? rawCount(account) : 1,
        completed: 0,
        nextAttempt: time + COOKING_INTERVAL_MS,
        lastSeen: time,
        busy: false,
      };
      sessions.set(account, state);
      return snapshot(account, state);
    },
    async tick(account) {
      const state = current(account);
      if (!state) return snapshot(account, null, { message: 'Culinária interrompida.' });
      if (!rawCount(account)) return stop(account, 'Acabou o salmão cru.');
      if (!canTransform(account))
        return stop(account, 'Libere um espaço na mochila para continuar.');
      const time = now();
      if (state.busy || time < state.nextAttempt)
        return snapshot(account, state, { attempted: false });
      state.nextAttempt = time + COOKING_INTERVAL_MS;
      const levelBefore = skillProgress(account.skills.cooking.xp).level;
      const success = random() < cookingChance(levelBefore);
      const result = success ? SALMON_RECIPE.cooked : SALMON_RECIPE.burnt;
      const raw = account.inventory.findIndex((item) => item?.id === SALMON_RECIPE.ingredient);
      account.inventory[raw].quantity--;
      if (!account.inventory[raw].quantity) account.inventory[raw] = null;
      let destination = account.inventory.findIndex((item) => item?.id === result);
      if (destination === -1) {
        destination = account.inventory.indexOf(null);
        account.inventory[destination] = { id: result, quantity: 0 };
      }
      account.inventory[destination].quantity++;
      if (success)
        account.skills.cooking.xp = Math.min(
          Number.MAX_SAFE_INTEGER,
          account.skills.cooking.xp + COOKING_XP,
        );
      state.remaining--;
      state.completed++;
      state.busy = true;
      try {
        await save();
      } finally {
        state.busy = false;
      }
      const finished = state.remaining <= 0 || !rawCount(account);
      if (finished) sessions.delete(account);
      return snapshot(account, finished ? null : state, {
        attempted: true,
        result,
        success,
        finished,
        completed: state.completed,
        leveledUp: skillProgress(account.skills.cooking.xp).level > levelBefore,
      });
    },
  };
}
