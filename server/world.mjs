import { createMobService } from './mobs.mjs';
import { createItemService } from './items.mjs';
import { createTownService } from './town.mjs';
import { createGroundCleanup } from './ground-cleanup.mjs';
import { tickNutrition } from './nutrition.mjs';
import { ensureProgress } from '../public/js/game/progression.js';

// Coordena combate, itens, lojas, banco e limpeza; regras nos respectivos serviços.
export function createWorldService(options) {
  const mobs = createMobService(options),
    items = createItemService(options),
    town = createTownService(options),
    cleanup = createGroundCleanup(options);
  return {
    ...mobs,
    ...items,
    townOpen: town.open,
    buy: town.buy,
    sell: town.sell,
    deposit: town.deposit,
    depositAll: town.depositAll,
    withdraw: town.withdraw,
    bet: town.bet,
    async tick(account) {
      ensureProgress(account);
      if (tickNutrition(account, (options.now || Date.now)())) {
        account.worldRevision++;
        await options.save();
      }
      const removed = await cleanup.sweep(account),
        result = await mobs.tick(account);
      if (removed) result.events.unshift({ type: 'ground-cleanup', count: removed });
      return result;
    },
  };
}
