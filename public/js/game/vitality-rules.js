import { INITIAL_VITALS } from '../config.js';
import { skillProgress } from './skill-rules.js';

export const VITALITY_HEALTH_PER_LEVEL = 30;
export const VITALITY_MANA_PER_LEVEL = 15;
export function syncVitals(account) {
  const bonus = skillProgress(account.skills?.vitality?.xp).level - 1;
  const maxHealth = INITIAL_VITALS.maxHealth + bonus * VITALITY_HEALTH_PER_LEVEL;
  const maxMana = INITIAL_VITALS.maxMana + bonus * VITALITY_MANA_PER_LEVEL;
  const old = account.vitals || {};
  account.vitals = {
    maxHealth,
    maxMana,
    health: Math.max(
      0,
      Math.min(maxHealth, Number.isFinite(old.health) ? old.health : INITIAL_VITALS.health),
    ),
    mana: Math.max(
      0,
      Math.min(maxMana, Number.isFinite(old.mana) ? old.mana : INITIAL_VITALS.mana),
    ),
  };
}
export function gainVitalityXp(account, damage) {
  if (!Number.isSafeInteger(damage) || damage <= 0) return;
  account.skills ??= {};
  // Soma em terços inteiros para 300 de dano resultar exatamente em 100 XP.
  const thirds = Math.round(skillProgress(account.skills.vitality?.xp).totalXp * 3);
  account.skills.vitality = { xp: (thirds + damage) / 3 };
  syncVitals(account);
}
