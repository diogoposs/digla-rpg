import { BACKPACK_CAPACITY, GAME_VERSION } from '../config.js';
import { ensureWorld, getMobs, getCorpses } from './world-rules.js';
import { ensureTown } from './town-rules.js';
import { skillProgress } from './skill-rules.js';
import { ensureUtility } from './utility-rules.js';
import { ensureAdventure, combatStats } from './adventure-rules.js';
export { skillProgress } from './skill-rules.js';

// XP total é salvo; nível e progresso são calculados para não ficarem inconsistentes.
// Custos por nível: 100, 200, 400, 800... (totais: 100, 300, 700, 1500...).

// Compatibilidade com contas criadas antes de existirem skills e inventário.
export function ensureProgress(account) {
  ensureWorld(account);
  ensureTown(account);
  ensureUtility(account);
  ensureAdventure(account);
  account.skills ??= {};
  for (const skill of ['fishing', 'magic', 'cooking', 'combat', 'vitality', 'mining', 'smithing']) {
    const xp = account.skills[skill]?.xp;
    account.skills[skill] = {
      xp: Number.isFinite(xp) && xp >= 0 && xp <= Number.MAX_SAFE_INTEGER / 2 ? xp : 0,
    };
  }
  if (!Array.isArray(account.inventory)) account.inventory = [];
  account.inventory = Array.from(
    { length: BACKPACK_CAPACITY },
    (_, index) => account.inventory[index] || null,
  );
  return account;
}

export function publicProgress(account) {
  ensureProgress(account);
  return {
    gameVersion: GAME_VERSION,
    vitals: account.vitals,
    worldRevision: account.worldRevision,
    nextGroundCleanupAt: account.nextGroundCleanupAt,
    groundItems: account.groundItems,
    orc: account.orc,
    corpse: account.corpse,
    mobs: getMobs(account),
    corpses: getCorpses(account),
    inventory: account.inventory,
    bank: account.bank,
    equipment: account.equipment,
    attackElement: account.attackElement,
    abilityCooldowns: account.abilityCooldowns || {},
    utility: account.utility,
    quickSlots: account.quickSlots,
    quests: account.quests,
    gameSettings: account.gameSettings,
    combatStats: combatStats(account),
    gathering: account.gathering || null,
    miningNodes: account.miningNodes,
    serverNow: Date.now(),
    skills: {
      fishing: skillProgress(account.skills.fishing.xp),
      magic: skillProgress(account.skills.magic.xp),
      cooking: skillProgress(account.skills.cooking.xp),
      combat: skillProgress(account.skills.combat.xp),
      vitality: skillProgress(account.skills.vitality.xp),
      mining: skillProgress(account.skills.mining.xp),
      smithing: skillProgress(account.skills.smithing.xp),
    },
  };
}
