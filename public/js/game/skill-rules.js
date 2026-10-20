// Custos por nível: 100, 200, 400... O XP excedente permanece na skill.
export function skillProgress(totalXp = 0) {
  const total =
    Number.isFinite(totalXp) && totalXp > 0 && totalXp <= Number.MAX_SAFE_INTEGER / 2 ? totalXp : 0;
  let level = 1,
    xp = total,
    required = 100;
  while (xp >= required) {
    xp -= required;
    level++;
    required *= 2;
  }
  return { level, totalXp: total, xp, required };
}
