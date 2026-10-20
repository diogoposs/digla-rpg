export const FOOD_INTERVAL_MS = 3000;
export const FOOD_TICKS_PER_SALMON = 20; // 1 minuto por salmão.
export const FOOD_HEALTH = 20;
export const FOOD_MANA = 15;

// O próximo intervalo é persistido e avançado antes de salvar, evitando ticks duplicados.
export function tickNutrition(account, time = Date.now()) {
  const effect = account.foodEffect;
  if (
    !effect ||
    !Number.isSafeInteger(effect.remainingTicks) ||
    effect.remainingTicks <= 0 ||
    !Number.isFinite(effect.nextTickAt)
  ) {
    account.foodEffect = null;
    return false;
  }
  if (time < effect.nextTickAt) return false;
  const ticks = Math.min(
    effect.remainingTicks,
    Math.floor((time - effect.nextTickAt) / FOOD_INTERVAL_MS) + 1,
  );
  account.vitals.health = Math.min(
    account.vitals.maxHealth,
    account.vitals.health + FOOD_HEALTH * ticks,
  );
  account.vitals.mana = Math.min(account.vitals.maxMana, account.vitals.mana + FOOD_MANA * ticks);
  effect.remainingTicks -= ticks;
  effect.nextTickAt += ticks * FOOD_INTERVAL_MS;
  if (!effect.remainingTicks) account.foodEffect = null;
  return true;
}
export function eatSalmon(account, time = Date.now()) {
  tickNutrition(account, time);
  if (account.foodEffect) account.foodEffect.remainingTicks += FOOD_TICKS_PER_SALMON;
  else
    account.foodEffect = {
      remainingTicks: FOOD_TICKS_PER_SALMON,
      nextTickAt: time + FOOD_INTERVAL_MS,
    };
}
