import { createMobService } from './mobs.mjs';
import { createItemService } from './items.mjs';
import { createTownService } from './town.mjs';
import { createGroundCleanup } from './ground-cleanup.mjs';
import { tickNutrition } from './nutrition.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { createUtilityService } from './utility.mjs';
import { createAdventureService } from './adventure.mjs';

// Coordena combate, itens, lojas, banco e limpeza; regras nos respectivos serviços.
export function createWorldService(options) {
  const mobs = createMobService(options),
    items = createItemService(options),
    town = createTownService(options),
    cleanup = createGroundCleanup(options);
  const utility = createUtilityService(options, { mobs, items });
  const adventure = createAdventureService(options);
  return {
    ...mobs,
    ...items,
    utility: utility.utility,
    moved(account, destination) {
      if (
        account.position.x !== destination.x ||
        account.position.y !== destination.y ||
        (account.position.z || 0) !== (destination.z || 0)
      )
        adventure.stop(account);
      return utility.moved(account, destination);
    },
    adventure: (a, data) => adventure.action(a, data),
    stop(account, opts) {
      adventure.stop(account);
      return mobs.stop(account, opts);
    },
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
      const update = await utility.tick(account);
      if (update) Object.assign(result, update);
      const gathering = await adventure.tick(account);
      if (gathering) Object.assign(result, gathering);
      if (removed) result.events.unshift({ type: 'ground-cleanup', count: removed });
      return result;
    },
  };
}
