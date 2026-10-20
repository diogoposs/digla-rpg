import { ensureProgress } from '../../public/js/game/progression.js';
import { ORC_SPAWN, getMobs } from '../../public/js/game/world-rules.js';

export const orcPoint = (dx = 0, dy = 1) => ({ x: ORC_SPAWN.x + dx, y: ORC_SPAWN.y + dy });
// Focused combat scenarios isolate one creature; integration tests cover groups separately.
export function isolateMobs(account, ids = ['orc']) {
  for (const mob of getMobs(account))
    if (!ids.includes(mob.id)) {
      mob.health = 0;
      mob.respawnAt = Number.MAX_SAFE_INTEGER;
    }
  return account;
}
export const combatAccount = (values = {}) =>
  isolateMobs(ensureProgress({ position: orcPoint(), ...values }));
