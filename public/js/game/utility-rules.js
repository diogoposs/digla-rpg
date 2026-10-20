export const HASTE_DURATION_MS = 5000;
export const HASTE_COOLDOWN_MS = 10000;
export const RECALL_DURATION_MS = 10000;
export const RECALL_COOLDOWN_MS = 10 * 60000;
export const POTIONS = ['health_potion', 'mana_potion'];
export function ensureUtility(account) {
  account.utility ??= {};
  for (const key of ['hasteUntil', 'hasteCooldownUntil', 'recallCooldownUntil'])
    if (!Number.isSafeInteger(account.utility[key]) || account.utility[key] < 0)
      account.utility[key] = 0;
  account.quickSlots = Array.from({ length: 3 }, (_, i) =>
    POTIONS.includes(account.quickSlots?.[i]) ? account.quickSlots[i] : POTIONS[i % 2],
  );
  return account.utility;
}
export function cancelRecall(account) {
  if (!account.utility?.recall) return false;
  account.utility.recall = null;
  account.worldRevision = (account.worldRevision || 0) + 1;
  return true;
}
