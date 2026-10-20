import { SPAWN } from '../public/js/config.js';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { distance } from '../public/js/game/world-rules.js';
import {
  ensureUtility,
  cancelRecall,
  POTIONS,
  HASTE_DURATION_MS,
  HASTE_COOLDOWN_MS,
  RECALL_DURATION_MS,
  RECALL_COOLDOWN_MS,
} from '../public/js/game/utility-rules.js';

export function createUtilityService({ save, now = Date.now }, { mobs, items }) {
  const lastTicks = new WeakMap();
  const response = (a, message, extra = {}) => ({
    ...publicProgress(a),
    serverNow: now(),
    message,
    ...extra,
  });
  return {
    moved(a, destination) {
      return distance(a.position, destination) !== 0 && cancelRecall(a);
    },
    async utility(a, { key, index, itemId, configure = false } = {}) {
      ensureProgress(a);
      const u = ensureUtility(a),
        time = now();
      if (key === 'quick') {
        if (!Number.isInteger(index) || index < 0 || index > 2)
          return response(a, 'Atalho inválido.');
        if (configure) {
          if (!POTIONS.includes(itemId)) return response(a, 'Escolha uma poção de vida ou mana.');
          a.quickSlots[index] = itemId;
          a.worldRevision++;
          await save();
          return response(a, 'Atalho atualizado.');
        }
        const id = a.quickSlots[index],
          slot = a.inventory.findIndex((item) => item?.id === id);
        if (slot < 0) return response(a, 'Você não tem essa poção na mochila.');
        return { ...(await items.use(a, { slot, itemId: id })), serverNow: time };
      }
      if (a.vitals.health <= 0) return response(a, 'Você não pode usar esta habilidade agora.');
      if (key === 'h') {
        if (time < u.hasteCooldownUntil) return response(a, 'Corrida em recarga.');
        if (a.vitals.mana < 10) return response(a, 'Mana insuficiente: a corrida custa 10.');
        a.vitals.mana -= 10;
        u.hasteUntil = time + HASTE_DURATION_MS;
        u.hasteCooldownUntil = time + HASTE_COOLDOWN_MS;
        a.worldRevision++;
        await save();
        return response(a, 'Corrida: velocidade 1,5× por 5 segundos.');
      }
      if (key === 'b') {
        if (u.recall) return response(a, 'O retorno ao templo já está sendo preparado.');
        if (time < u.recallCooldownUntil) return response(a, 'Retorno ao templo em recarga.');
        u.recall = {
          startedAt: time,
          endsAt: time + RECALL_DURATION_MS,
          position: { ...a.position },
        };
        lastTicks.set(a, time);
        mobs.stop(a);
        a.worldRevision++;
        await save();
        return response(a, 'Retornando ao templo: fique parado por 10 segundos sem sofrer dano.');
      }
      return response(a, 'Habilidade inválida.');
    },
    async tick(a) {
      const u = ensureUtility(a),
        time = now(),
        last = lastTicks.get(a);
      lastTicks.set(a, time);
      if (!u.recall) return null;
      if (
        last === undefined ||
        time - last > 2000 ||
        distance(a.position, u.recall.position) !== 0 ||
        a.vitals.health <= 0
      ) {
        cancelRecall(a);
        await save();
        return response(a, 'Retorno ao templo cancelado.');
      }
      if (time < u.recall.endsAt) return null;
      u.recall = null;
      u.recallCooldownUntil = time + RECALL_COOLDOWN_MS;
      a.position = { ...SPAWN };
      mobs.stop(a, { disengage: true });
      a.worldRevision++;
      await save();
      return response(a, 'Você retornou ao templo.', { teleported: true, position: { ...SPAWN } });
    },
  };
}
