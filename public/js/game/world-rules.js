import { WIDTH, HEIGHT } from '../config.js';
import { syncVitals } from './vitality-rules.js';
import { ITEMS } from '../items.js';
import {
  floorOf,
  sameFloor,
  regionalPoint,
  isSafeZone,
  WORLD_LAYOUT_VERSION,
} from '../world/elevation.js';

export const ORC_SPAWN = regionalPoint('orc', { x: 12, y: 20 });
export const ORC_HEALTH = 300;
export const ORC_LOOT_CAPACITY = 6;
export const ORC_DROP_CHANCE = 1;
export const WEAPON_XP_FACTOR = 0.5;
export const DAMAGE_MIN = 3;
export const DAMAGE_MAX = 6;
export const STAFF_DAMAGE_MIN = 4;
export const STAFF_DAMAGE_MAX = 7;
export const STAFF_DAMAGE_PER_LEVEL = 1;
export const COIN_DROP_MIN = 5;
export const COIN_DROP_MAX = 15;
export const GOLD_PER_SILVER = 100;
export function staffDamage(level) {
  const bonus = Math.max(0, level - 1) * STAFF_DAMAGE_PER_LEVEL;
  return { min: STAFF_DAMAGE_MIN + bonus, max: STAFF_DAMAGE_MAX + bonus };
}
export const ATTACK_INTERVAL_MS = 1000;
export const ORC_MOVE_INTERVAL_MS = 500;
export const ORC_RESPAWN_MS = 15000;
export const WORLD_POLL_MS = 250;
export const GROUND_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
export const ELEMENTS = ['fire', 'water', 'lightning'];
export const ELEMENT_NAMES = { fire: 'Fogo', water: 'Água', lightning: 'Raio' };
export const weaponRange = (account) => ITEMS[account.equipment?.weapon?.id]?.range || 1;
export const distance = (a, b) =>
  sameFloor(a, b) ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity;
export const WEAKNESS_MULTIPLIER = 1.5;
export const MOB_DEFINITIONS = {
  orc_guard_west: {
    name: 'Orc sentinela',
    kind: 'orc',
    spawn: regionalPoint('orc', { x: 10, y: 19 }),
    maxHealth: 400,
    weakness: 'lightning',
    damageMin: 3,
    damageMax: 6,
  },
  orc_guard_east: {
    name: 'Orc guerreiro',
    kind: 'orc',
    spawn: regionalPoint('orc', { x: 15, y: 19 }),
    maxHealth: 500,
    weakness: 'lightning',
    damageMin: 4,
    damageMax: 7,
  },
  orc_captain: {
    name: 'Capitão orc',
    kind: 'orc',
    spawn: regionalPoint('orc', { x: 12, y: 16 }),
    maxHealth: 800,
    weakness: 'lightning',
    damageMin: 5,
    damageMax: 8,
  },
  orc_rampart: {
    name: 'Orc da muralha',
    kind: 'orc',
    spawn: regionalPoint('orc', { x: 8, y: 15, z: 1 }),
    maxHealth: 400,
    weakness: 'lightning',
  },
  orc_cave: {
    name: 'Orc das cavernas',
    kind: 'orc',
    spawn: regionalPoint('orc', { x: 12, y: 18, z: -1 }),
    maxHealth: 400,
    weakness: 'lightning',
  },
  magma_cave: {
    name: 'Elemental de magma',
    kind: 'fire',
    variant: 'guardian',
    spawn: regionalPoint('fire', { x: 41, y: 72, z: -1 }),
    maxHealth: 65,
    weakness: 'water',
    damageMin: 4,
    damageMax: 7,
  },
  tide_cave: {
    name: 'Espírito da gruta',
    kind: 'water',
    variant: 'wisp',
    spawn: regionalPoint('water', { x: 80, y: 60, z: -1 }),
    maxHealth: 55,
    weakness: 'lightning',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
  orc: { name: 'Orc', kind: 'orc', spawn: ORC_SPAWN, maxHealth: ORC_HEALTH, weakness: 'lightning' },
  fire_elemental: {
    name: 'Elemental de fogo',
    kind: 'fire',
    spawn: regionalPoint('fire', { x: 37, y: 78 }),
    maxHealth: 50,
    weakness: 'water',
  },
  water_elemental: {
    name: 'Elemental de água',
    kind: 'water',
    spawn: regionalPoint('water', { x: 79, y: 37 }),
    maxHealth: 50,
    weakness: 'lightning',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
  ember_guardian: {
    name: 'Guardião de brasas',
    kind: 'fire',
    variant: 'guardian',
    spawn: regionalPoint('fire', { x: 42, y: 64 }),
    maxHealth: 70,
    weakness: 'water',
    damageMin: 4,
    damageMax: 7,
  },
  lava_wisp: {
    name: 'Espírito da lava',
    kind: 'fire',
    variant: 'wisp',
    spawn: regionalPoint('fire', { x: 54, y: 74 }),
    maxHealth: 45,
    weakness: 'water',
    damageMin: 2,
    damageMax: 5,
  },
  fire_drake: {
    name: 'Draco de fogo',
    kind: 'fire',
    variant: 'drake',
    spawn: regionalPoint('fire', { x: 35, y: 79 }),
    maxHealth: 90,
    weakness: 'water',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
  tide_guardian: {
    name: 'Guardião das marés',
    kind: 'water',
    variant: 'guardian',
    spawn: regionalPoint('water', { x: 82, y: 37 }),
    maxHealth: 70,
    weakness: 'lightning',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
  reef_spirit: {
    name: 'Espírito do recife',
    kind: 'water',
    variant: 'wisp',
    spawn: regionalPoint('water', { x: 93, y: 47 }),
    maxHealth: 45,
    weakness: 'lightning',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
  water_serpent: {
    name: 'Serpente d’água',
    kind: 'water',
    variant: 'serpent',
    spawn: regionalPoint('water', { x: 84, y: 59 }),
    maxHealth: 90,
    weakness: 'lightning',
    damageMin: 1,
    damageMax: 1,
    attackIntervalMs: 5000,
  },
};
export const getMobs = (account) =>
  [account.orc, ...Object.values(account.elementals || {})].filter(
    (mob) => mob && (mob === account.orc || Object.hasOwn(MOB_DEFINITIONS, mob.id)),
  );
export const getCorpses = (account) =>
  [account.corpse, ...Object.values(account.elementalCorpses || {})].filter(Boolean);
export const mobAt = (account, x, y, z = floorOf(account.position)) =>
  getMobs(account).find(
    (mob) => mob.health > 0 && mob.x === x && mob.y === y && floorOf(mob) === z,
  );

// Novos campos são acrescentados sem apagar peixes, skills ou outfit de contas antigas.
export function ensureWorld(account) {
  const migrateLayout = account.worldLayoutVersion !== WORLD_LAYOUT_VERSION;
  if (!Number.isSafeInteger(account.worldRevision)) account.worldRevision = 0;
  if (!Number.isSafeInteger(account.nextGroundCleanupAt)) account.nextGroundCleanupAt = 0;
  syncVitals(account);
  if (!Array.isArray(account.groundItems)) account.groundItems = [];
  account.groundItems = account.groundItems.filter(
    (item) =>
      item &&
      ITEMS[item.itemId] &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0 &&
      Number.isInteger(item.x) &&
      Number.isInteger(item.y) &&
      item.x >= 0 &&
      item.y >= 0 &&
      item.x < WIDTH &&
      item.y < HEIGHT,
  );
  if (!account.orc) account.orc = { ...ORC_SPAWN, health: ORC_HEALTH, respawnAt: 0 };
  account.elementals ??= {};
  for (const id of Object.keys(account.elementals))
    if (!Object.hasOwn(MOB_DEFINITIONS, id)) delete account.elementals[id];
  account.elementalCorpses ??= {};
  for (const [id, definition] of Object.entries(MOB_DEFINITIONS)) {
    let mob = id === 'orc' ? account.orc : account.elementals[id];
    if (!mob)
      mob = account.elementals[id] = {
        ...definition.spawn,
        health: definition.maxHealth,
        respawnAt: 0,
      };
    // Preserve the health percentage of saved orcs when increasing their maximum.
    // Newly created creatures already have the new health; corpses stay dead.
    if (definition.kind === 'orc' && mob.health > 0) {
      const previousMax =
        mob.maxHealth ||
        (mob.health <= definition.maxHealth / 10
          ? definition.maxHealth / 10
          : definition.maxHealth);
      if (previousMax < definition.maxHealth)
        mob.health = Math.min(
          definition.maxHealth,
          Math.ceil((mob.health * definition.maxHealth) / previousMax),
        );
    }
    mob.z ??= floorOf(definition.spawn);
    if (migrateLayout || isSafeZone(mob))
      Object.assign(mob, definition.spawn, { z: floorOf(definition.spawn) });
    Object.assign(mob, {
      id,
      name: definition.name,
      kind: definition.kind,
      maxHealth: definition.maxHealth,
      weakness: definition.weakness,
      variant: definition.variant || 'elemental',
    });
  }
  account.corpse ??= null;
  for (const corpse of getCorpses(account)) {
    corpse.z ??= 0;
    corpse.mobId ??= 'orc';
    corpse.name = MOB_DEFINITIONS[corpse.mobId]?.name || 'Orc';
    corpse.kind = MOB_DEFINITIONS[corpse.mobId]?.kind || 'orc';
    corpse.slots = Array.from({ length: ORC_LOOT_CAPACITY }, (_, index) =>
      ITEMS[corpse.slots?.[index]?.id] ? corpse.slots[index] : null,
    );
  }
  account.equipment ??= { weapon: null };
  for (const slot of [
    'weapon',
    'helmet',
    'armor',
    'legs',
    'boots',
    'shield',
    'necklace',
    'ring',
    'arrows',
  ]) {
    const item = account.equipment[slot],
      definition = ITEMS[item?.id];
    if (
      !definition ||
      !(definition.equipmentSlot === slot || (slot === 'weapon' && definition.weapon))
    )
      account.equipment[slot] = null;
    else
      item.quantity =
        slot === 'arrows' && Number.isSafeInteger(item.quantity) && item.quantity > 0
          ? item.quantity
          : 1;
  }
  if (!ELEMENTS.includes(account.attackElement)) account.attackElement = 'fire';
  account.worldLayoutVersion = WORLD_LAYOUT_VERSION;
  return account;
}
