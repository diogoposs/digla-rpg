import { ITEMS } from '../items.js';
import { skillProgress } from './skill-rules.js';

export function ensureSettings(a) {
  // Existing test characters keep their sandbox; new accounts explicitly start in normal mode.
  a.gameSettings ??= { testMode: true };
  a.gameSettings.testMode = a.gameSettings.testMode === true;
}
export const QUESTS = {
  kitchen: {
    npc: 'food',
    name: 'Reabastecendo a cozinha',
    description: 'Rafhi precisa de cinco salmões assados.',
    deliver: { roasted_salmon: 5 },
    rewards: { gold_coin: 20 },
  },
  supplies: {
    npc: 'potions',
    name: 'Preparação para a viagem',
    description: 'Pang troca três salmões assados por suprimentos.',
    requires: 'kitchen',
    deliver: { roasted_salmon: 3 },
    rewards: { health_potion: 3, mana_potion: 3 },
  },
  threat: {
    npc: 'gear',
    name: 'A ameaça dos orcs',
    description: 'Derrote cinco orcs depois de aceitar a missão.',
    requires: 'supplies',
    kills: 5,
    kind: 'orc',
    rewards: { iron_sword: 1 },
  },
  warfare: {
    npc: 'gear',
    name: 'Equipamento de guerra',
    description: 'Derrote três orcs guerreiros na fortaleza.',
    requires: 'threat',
    kills: 3,
    mobId: 'orc_guard_east',
    rewards: { reinforced_armor: 1 },
  },
  commander: {
    npc: 'gear',
    name: 'O comandante da fortaleza',
    description: 'Entre na caverna dos orcs e derrote o comandante na sala ao norte.',
    requires: 'warfare',
    kills: 1,
    mobId: 'orc_commander',
    rewards: { gold_coin: 100, commander_blade: 1 },
  },
};
export const FORGE = { id: 'forge', x: 35, y: 22, z: 0, name: 'Forja de Matlo' };
export const ORE_NODES = [
  { id: 'orc-mountain-iron', x: 85, y: 14, z: 1 },
  { id: 'orc-iron-west', x: 81, y: 25, z: -1 },
  { id: 'orc-iron-east', x: 90, y: 27, z: -1 },
  { id: 'magma-iron', x: 53, y: 117, z: -1 },
  { id: 'tide-iron', x: 147, y: 85, z: -1 },
].map((n) => ({ ...n, name: 'Veio de ferro', capacity: 5, respawnMs: 60000 }));
export const RECIPES = {
  iron_bar: {
    name: 'Fundir barra de ferro',
    level: 1,
    materials: { iron_ore: 2 },
    output: 'iron_bar',
    quantity: 1,
    xp: 10,
  },
  iron_sword: {
    name: 'Forjar espada de ferro',
    level: 1,
    materials: { iron_bar: 3 },
    output: 'iron_sword',
    quantity: 1,
    xp: 30,
  },
  iron_helmet: {
    name: 'Forjar elmo de ferro',
    level: 1,
    materials: { iron_bar: 2 },
    output: 'iron_helmet',
    quantity: 1,
    xp: 20,
  },
  reinforced_armor: {
    name: 'Forjar armadura reforçada',
    level: 2,
    materials: { iron_bar: 5 },
    output: 'reinforced_armor',
    quantity: 1,
    xp: 50,
  },
};
export function ensureAdventure(a) {
  ensureSettings(a);
  a.quests ??= {};
  a.miningNodes ??= {};
  for (const id of Object.keys(QUESTS)) {
    const q = a.quests[id];
    if (q)
      a.quests[id] = {
        status: ['active', 'ready', 'completed'].includes(q.status) ? q.status : 'active',
        kills: Number.isSafeInteger(q.kills) && q.kills >= 0 ? q.kills : 0,
      };
  }
}
export function recordKill(a, mob) {
  for (const [id, q] of Object.entries(QUESTS)) {
    const state = a.quests?.[id];
    if (state?.status !== 'active' || !q.kills) continue;
    if ((q.mobId && q.mobId === mob.id) || (q.kind && q.kind === mob.kind)) {
      state.kills = Math.min(q.kills, state.kills + 1);
      if (state.kills === q.kills) state.status = 'ready';
    }
  }
}
export function combatStats(a) {
  const weapon = ITEMS[a.equipment?.weapon?.id],
    level = skillProgress(a.skills?.combat?.xp || 0).level;
  const bonus =
    weapon?.melee || a.equipment?.weapon?.id === 'sword'
      ? (weapon.atk || 0) + Math.floor((level - 1) / 2)
      : 0;
  const arm = Object.values(a.equipment || {}).reduce(
    (n, item) => n + (ITEMS[item?.id]?.arm || 0),
    0,
  );
  return { min: 3 + bonus, max: 6 + bonus, arm, reduction: arm / (arm + 20) };
}
export function equipmentRequirement(a, item) {
  return (
    !item?.requires ||
    Object.entries(item.requires).every(
      ([skill, level]) => skillProgress(a.skills?.[skill]?.xp || 0).level >= level,
    )
  );
}
export function mobMaximum(a, def) {
  return def.kind === 'orc' && !a.gameSettings?.testMode ? def.maxHealth / 10 : def.maxHealth;
}
export function prices(id, testMode = true) {
  if (testMode) return { buy: 1, sell: 1 };
  const item = ITEMS[id];
  const buy =
    item?.price ??
    (item?.category === 'potion'
      ? 8
      : item?.category === 'food'
        ? 5
        : item?.category === 'equipment'
          ? 25
          : 2);
  return { buy, sell: Math.max(1, Math.floor(buy * 0.3)) };
}
