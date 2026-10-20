import { GROUND_CLEANUP_INTERVAL_MS } from '../public/js/game/world-rules.js';

// Ciclos persistidos: mover um item não adia a próxima limpeza do mundo da conta.
export function createGroundCleanup({ save, now = Date.now }) {
  async function sweep(account) {
    const time = now();
    if (!Number.isSafeInteger(account.nextGroundCleanupAt) || account.nextGroundCleanupAt <= 0) {
      account.nextGroundCleanupAt = time + GROUND_CLEANUP_INTERVAL_MS;
      await save();
      return 0;
    }
    if (time < account.nextGroundCleanupAt) return 0;
    const removed = account.groundItems?.length || 0;
    account.groundItems = [];
    const cycles =
      Math.floor((time - account.nextGroundCleanupAt) / GROUND_CLEANUP_INTERVAL_MS) + 1;
    account.nextGroundCleanupAt += cycles * GROUND_CLEANUP_INTERVAL_MS;
    account.worldRevision = (account.worldRevision || 0) + 1;
    await save();
    return removed;
  }
  return {
    sweep,
    async sweepAll(accounts) {
      for (const account of Object.values(accounts)) await sweep(account);
    },
  };
}
