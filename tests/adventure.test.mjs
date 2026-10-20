import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureProgress } from '../public/js/game/progression.js';
import { createWorldService } from '../server/world.mjs';
import {
  combatStats,
  QUESTS,
  ORE_NODES,
  FORGE,
  prices,
} from '../public/js/game/adventure-rules.js';
import { TOWN_POINTS, shopStock } from '../public/js/game/town-rules.js';
import { getMobs, MOB_DEFINITIONS } from '../public/js/game/world-rules.js';
import { walkable } from '../public/js/world/map.js';
import { combatAccount, orcPoint, isolateMobs } from './helpers/combat.mjs';

const setup = (extra) => ensureProgress({ position: { x: 25, y: 20 }, ...extra });
const near = (a, id) => {
  const n = TOWN_POINTS[id];
  a.position = { x: n.x, y: n.y + 1 };
};
test('espadas usam ATK e Combate; armadura mitiga físico; requisitos impedem equipar cedo', async () => {
  const a = combatAccount({ equipment: { weapon: { id: 'sword', quantity: 1 } } });
  assert.deepEqual([combatStats(a).min, combatStats(a).max], [5, 8]);
  a.skills.combat.xp = 300;
  assert.deepEqual([combatStats(a).min, combatStats(a).max], [6, 9]);
  const b = combatAccount({ inventory: [{ id: 'iron_sword', quantity: 1 }] });
  const s = createWorldService({ save: async () => {} });
  assert.equal((await s.use(b, { slot: 0, itemId: 'iron_sword' })).transferred, undefined);
  b.skills.combat.xp = 300;
  assert.equal((await s.use(b, { slot: 0, itemId: 'iron_sword' })).transferred, true);
  const equipment = {
    helmet: { id: 'iron_helmet' },
    armor: { id: 'iron_armor' },
    legs: { id: 'iron_legs' },
    boots: { id: 'iron_boots' },
    shield: { id: 'iron_shield' },
  };
  const c = combatAccount({ equipment });
  assert.equal(combatStats(c).arm, 5);
  assert.equal(combatStats(c).reduction, 0.2);
  let time = 0;
  const combat = createWorldService({
    save: async () => {},
    now: () => time,
    random: () => 0.9999,
  });
  await combat.tick(c);
  time = 1000;
  const hit = await combat.tick(c);
  assert.equal(hit.events.find((e) => e.type === 'orc-hit').damage, 5);
});
test('missões exigem sequência/NPC e entregas/recompensas são atômicas e únicas', async () => {
  const a = setup({ inventory: [{ id: 'roasted_salmon', quantity: 8 }] }),
    s = createWorldService({ save: async () => {} });
  await s.adventure(a, { action: 'accept', id: 'supplies' });
  assert.equal(a.quests.supplies, undefined);
  await s.adventure(a, { action: 'accept', id: 'kitchen' });
  await Promise.all([
    s.adventure(a, { action: 'claim', id: 'kitchen' }),
    s.adventure(a, { action: 'claim', id: 'kitchen' }),
  ]);
  assert.equal(a.inventory.find((i) => i?.id === 'gold_coin').quantity, 20);
  assert.equal(a.inventory.find((i) => i?.id === 'roasted_salmon').quantity, 3);
  near(a, 'potions');
  await s.adventure(a, { action: 'accept', id: 'supplies' });
  await s.adventure(a, { action: 'claim', id: 'supplies' });
  assert.equal(a.quests.supplies.status, 'completed');
  assert.equal(a.inventory.find((i) => i?.id === 'mana_potion').quantity, 3);
  const loaded = ensureProgress(JSON.parse(JSON.stringify(a)));
  assert.equal(loaded.quests.kitchen.status, 'completed');
  assert.equal(loaded.skills.vitality.xp, 0);
  const full = setup({
    inventory: Array.from({ length: 12 }, () => ({ id: 'sword', quantity: 1 })),
  });
  full.quests.kitchen = { status: 'active', kills: 0 };
  full.inventory[0] = { id: 'roasted_salmon', quantity: 6 };
  const before = JSON.stringify(full.inventory);
  await s.adventure(full, { action: 'claim', id: 'kitchen' });
  assert.equal(JSON.stringify(full.inventory), before);
  assert.equal(full.quests.kitchen.status, 'active');
});
test('abates só contam após aceitar e seguem tipos; recompensa especial garantida no final', async () => {
  let time = 0;
  const a = combatAccount({ quests: { supplies: { status: 'completed' } } }),
    s = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  a.orc.health = 1;
  await s.attack(a);
  assert.equal(a.quests.threat, undefined);
  near(a, 'gear');
  await s.adventure(a, { action: 'accept', id: 'threat' });
  a.position = orcPoint();
  for (let i = 0; i < 5; i++) {
    time += 1000;
    a.orc.health = 1;
    await s.attack(a, { toggle: false });
  }
  assert.equal(a.quests.threat.kills, 5);
  near(a, 'gear');
  await s.adventure(a, { action: 'claim', id: 'threat' });
  assert.equal(a.inventory.find((i) => i?.id === 'iron_sword').quantity, 1);
  await s.adventure(a, { action: 'accept', id: 'warfare' });
  a.position = orcPoint();
  time += 1000;
  a.orc.health = 1;
  await s.attack(a, { toggle: false });
  assert.equal(a.quests.warfare.kills, 0);
  a.quests.warfare = { status: 'completed', kills: 3 };
  near(a, 'gear');
  await s.adventure(a, { action: 'accept', id: 'commander' });
  a.position = { x: 86, y: 17, z: -1 };
  a.elementals.orc_commander.health = 1;
  time += 1000;
  await s.attack(a, { mobId: 'orc_commander', toggle: false });
  assert.equal(a.quests.commander.status, 'ready');
  near(a, 'gear');
  await s.adventure(a, { action: 'claim', id: 'commander' });
  assert.ok(a.inventory.some((i) => i?.id === 'commander_blade'));
});
test('modo normal/teste preserva percentual de vida, mortos, itens e usa preços separados', async () => {
  const a = setup({ gameSettings: { testMode: false } }),
    s = createWorldService({ save: async () => {} });
  assert.equal(a.orc.maxHealth, 30);
  a.orc.health = 15;
  a.elementals.orc_guard_west.health = 0;
  await s.adventure(a, { action: 'settings', enabled: true });
  assert.equal(a.orc.health, 150);
  assert.equal(a.orc.maxHealth, 300);
  assert.equal(a.elementals.orc_guard_west.health, 0);
  await s.adventure(a, { action: 'settings', enabled: false });
  assert.equal(a.orc.health, 15);
  assert.equal(a.elementals.orc_commander.maxHealth, 400);
  assert.deepEqual(prices('iron_sword', false), { buy: 100, sell: 30 });
  assert.equal(prices('mana_potion', true).buy, 1);
  assert.equal(
    shopStock('gear').some((i) => i.id === 'commander_blade'),
    false,
  );
  near(a, 'gear');
  a.inventory[0] = { id: 'gold_coin', quantity: 100 };
  await s.buy(a, { id: 'gear', itemId: 'iron_sword' });
  assert.equal(
    a.inventory.some((i) => i?.id === 'gold_coin'),
    false,
  );
  const slot = a.inventory.findIndex((i) => i?.id === 'iron_sword');
  await s.sell(a, { id: 'gear', slot, itemId: 'iron_sword' });
  assert.equal(a.inventory.find((i) => i?.id === 'gold_coin').quantity, 30);
});
test('mineração tem cargas/tempo/XP, sem ganhos offline; forja valida nível e mochila antes de consumir', async () => {
  let time = 0;
  const n = ORE_NODES[0],
    a = setup({ position: { x: n.x, y: n.y + 1, z: n.z } }),
    s = createWorldService({ save: async () => {}, now: () => time });
  isolateMobs(a, []);
  for (const node of ORE_NODES)
    assert.ok(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([x, y]) => walkable(node.x + x, node.y + y, node.z)),
    );
  await s.adventure(a, { action: 'mine', id: n.id });
  for (time = 250; time <= 12500; time += 250) await s.tick(a);
  assert.equal(a.inventory.find((i) => i?.id === 'iron_ore').quantity, 5);
  assert.equal(a.skills.mining.xp, 50);
  assert.equal(a.miningNodes[n.id].remaining, 0);
  assert.equal(a.gathering, null);
  time = 80000;
  await s.adventure(a, { action: 'mine', id: n.id });
  time += 3000;
  await s.tick(a);
  assert.equal(a.gathering, null);
  assert.equal(a.inventory.find((i) => i?.id === 'iron_ore').quantity, 5);
  a.position = { x: FORGE.x + 1, y: FORGE.y + 1 };
  await s.adventure(a, { action: 'craft', id: 'iron_bar' });
  assert.equal(a.inventory.find((i) => i?.id === 'iron_ore').quantity, 3);
  assert.equal(a.skills.smithing.xp, 10);
  const before = JSON.stringify(a.inventory);
  await s.adventure(a, { action: 'craft', id: 'reinforced_armor' });
  assert.equal(JSON.stringify(a.inventory), before);
  a.inventory = Array.from({ length: 12 }, () => ({ id: 'sword', quantity: 1 }));
  a.inventory[0] = { id: 'iron_ore', quantity: 3 };
  const full = JSON.stringify(a.inventory);
  await s.adventure(a, { action: 'craft', id: 'iron_bar' });
  assert.equal(JSON.stringify(a.inventory), full);
});
test('comandante anuncia especiais, é possível desviar; sair da sala restaura encontro', async () => {
  let time = 0;
  const a = isolateMobs(
      setup({ position: { x: 86, y: 19, z: -1 }, gameSettings: { testMode: false } }),
      ['orc_commander'],
    ),
    s = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  const first = await s.tick(a);
  assert.ok(first.hazards.length);
  const warning = first.hazards[0];
  assert.ok(warning.endsAt > time);
  assert.equal(a.vitals.health, 100);
  a.position = { x: 81, y: 19, z: -1 };
  for (time = 250; time <= 1000; time += 250) await s.tick(a);
  assert.equal(a.vitals.health, 100);
  a.elementals.orc_commander.health = 200;
  a.position = { x: 86, y: 23, z: -1 };
  time = 1250;
  await s.tick(a);
  assert.equal(a.elementals.orc_commander.health, 400);
  assert.equal((await s.tick(a)).hazards.length, 0);
});
test('arqueiro recua e atira, xamã avisa área, defensor reduz dano físico', async () => {
  let time = 0;
  const a = isolateMobs(setup({ position: { x: 85, y: 25 } }), ['orc_archer']),
    s = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  const old = a.elementals.orc_archer.x;
  await s.tick(a);
  assert.ok(a.elementals.orc_archer.x < old || a.elementals.orc_archer.y !== 25);
  for (time = 250; time <= 2000; time += 250) await s.tick(a);
  assert.ok(a.vitals.health < 100);
  const b = isolateMobs(setup({ position: { x: 88, y: 23 } }), ['orc_shaman']),
    u = createWorldService({ save: async () => {}, now: () => time });
  assert.equal((await u.tick(b)).hazards[0].kind, 'spell');
  const c = isolateMobs(setup({ position: { x: 88, y: 28 } }), ['orc_defender']),
    v = createWorldService({ save: async () => {}, random: () => 0 });
  const hit = await v.attack(c, { mobId: 'orc_defender' });
  assert.equal(hit.events.find((e) => e.type === 'player-hit').damage, 2);
});
test('E aceita ponto sem alvo, rejeita alcance/paredes/piso e não cobra em tentativas inválidas', async () => {
  const a = combatAccount({ equipment: { weapon: { id: 'lightning_staff', quantity: 1 } } }),
    s = createWorldService({ save: async () => {}, now: () => 0, random: () => 0 });
  assert.equal((await s.cast(a, { key: 'e', x: 86, y: 26, z: 1 })).cast, false);
  assert.equal(a.vitals.mana, 100);
  assert.equal((await s.cast(a, { key: 'e', x: 86, y: 33 })).cast, false);
  assert.equal(a.vitals.mana, 100);
  const r = await s.cast(a, { key: 'e', x: 86, y: 26 });
  assert.equal(r.cast, true);
  assert.equal(a.vitals.mana, 90);
  assert.equal(r.events.find((e) => e.type === 'player-hit').damage, 18);
});
