import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorldService } from '../server/world.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { SPAWN, WELL, STOVE, TEMPLE } from '../public/js/config.js';
import { walkable, templeObstacle } from '../public/js/world/map.js';
import { distance } from '../public/js/game/world-rules.js';
import { openAccountStore } from '../server/storage.mjs';
import { combatAccount, orcPoint } from './helpers/combat.mjs';
import { ORC_CASTLE } from '../public/js/world/elevation.js';
import { ORC_SPAWN } from '../public/js/game/world-rules.js';
const account = () => combatAccount();

test('templo conserva spawn e passagens; fonte restaura vida/mana somente de perto', async () => {
  const a = account(),
    service = createWorldService({ save: async () => {} });
  assert.equal(walkable(SPAWN.x, SPAWN.y), true);
  assert.equal(templeObstacle(TEMPLE.x, TEMPLE.y), true);
  assert.equal(walkable(WELL.x, WELL.y), false);
  assert.equal(walkable(STOVE.x, STOVE.y), false);
  a.position = { ...SPAWN };
  a.vitals.health = 9;
  a.vitals.mana = 4;
  assert.equal((await service.heal(a)).healed, undefined);
  assert.equal(a.vitals.health, 9);
  assert.equal(a.vitals.mana, 4);
  a.position = { x: WELL.x - 1, y: WELL.y + 1 };
  assert.equal((await service.heal(a)).healed, true);
  assert.equal(a.vitals.health, a.vitals.maxHealth);
  assert.equal(a.vitals.mana, a.vitals.maxMana);
});

test('segundo ataque desliga alvo sem parar perseguição do orc; terceiro liga novamente', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  assert.equal((await service.attack(a)).orc.targeted, true);
  assert.equal(a.orc.health, 297);
  const stopped = await service.attack(a);
  assert.equal(stopped.orc.targeted, false);
  assert.equal(stopped.orc.chasing, true);
  clock = 1000;
  await service.tick(a);
  assert.equal(a.orc.health, 297);
  assert.equal(a.vitals.health, 97);
  assert.equal((await service.attack(a)).orc.targeted, true);
  assert.equal(a.orc.health, 294);
});

test('orc mantém perseguição fora da antiga área, seguindo o alvo sem atravessar obstáculos', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  await service.attack(a);
  service.stop(a);
  a.position = { x: ORC_CASTLE.x + 16, y: ORC_CASTLE.y + 13 };
  for (let i = 0; i < 20 && distance(a.position, a.orc) > 1; i++) {
    clock += 500;
    await service.tick(a);
    assert.equal(walkable(a.orc.x, a.orc.y), true);
  }
  assert.ok(distance(a.position, a.orc) <= 1);
  assert.ok(distance(a.orc, ORC_SPAWN) > 7);
  a.position = { x: ORC_CASTLE.x + 21, y: ORC_CASTLE.y + 13 };
  for (let i = 0; i < 40 && distance(a.position, a.orc) > 1; i++) {
    clock += 500;
    await service.tick(a);
    assert.equal(walkable(a.orc.x, a.orc.y), true);
  }
  assert.ok(distance(a.position, a.orc) <= 1);
});

test('cajado usa 4–7 no nível 1 e acrescenta 1 aos dois limites por nível, com crítico no máximo', async () => {
  for (const [xp, level] of [
    [0, 1],
    [100, 2],
    [300, 3],
  ])
    for (const roll of [0, 0.99999]) {
      const a = account();
      a.equipment.weapon = { id: 'staff', quantity: 1 };
      a.skills.magic.xp = xp;
      const service = createWorldService({ save: async () => {}, random: () => roll });
      const event = (await service.attack(a)).events.find((event) => event.type === 'player-hit');
      const expected = (roll === 0 ? 4 : 7) + level - 1;
      assert.equal(event.damage, expected);
      assert.equal(event.critical, roll !== 0);
      assert.equal(a.skills.magic.xp, xp + expected / 2);
    }
});

test('toda morte deixa moedas entre 5 e 15 e o loot não é sorteado novamente', async () => {
  for (const [roll, expected] of [
    [0, 5],
    [0.99999, 15],
  ]) {
    const a = account();
    a.orc.health = 1;
    const service = createWorldService({ save: async () => {}, random: () => roll });
    await service.attack(a);
    const coins = a.corpse.slots.find((item) => item?.id === 'gold_coin');
    assert.equal(coins.quantity, expected);
    const first = structuredClone(a.corpse.slots);
    assert.deepEqual(service.loot(a, { id: a.corpse.id }).loot.slots, first);
  }
});

test('trocar 100 moedas conserva valor, usa pilha cinza e não perde moedas com mochila cheia', async () => {
  const a = account(),
    service = createWorldService({ save: async () => {} }),
    use = () => service.use(a, { slot: 0, itemId: 'gold_coin' });
  a.inventory[0] = { id: 'gold_coin', quantity: 99 };
  assert.equal((await use()).converted, undefined);
  a.inventory = Array.from({ length: 12 }, (_, i) =>
    i ? { id: 'sword', quantity: 1 } : { id: 'gold_coin', quantity: 100 },
  );
  assert.equal((await use()).converted, true);
  assert.deepEqual(a.inventory[0], { id: 'silver_coin', quantity: 1 });
  a.inventory[0] = { id: 'gold_coin', quantity: 125 };
  assert.equal((await use()).converted, undefined);
  assert.equal(a.inventory[0].quantity, 125);
  a.inventory[1] = { id: 'silver_coin', quantity: 3 };
  assert.equal((await use()).converted, true);
  assert.equal(a.inventory[0].quantity, 25);
  assert.equal(a.inventory[1].quantity, 4);
  a.inventory = Array(12).fill(null);
  a.inventory[0] = { id: 'gold_coin', quantity: 250 };
  await use();
  await use();
  assert.equal(a.inventory[0].quantity, 50);
  assert.equal(a.inventory[1].quantity, 2);
  assert.equal((await use()).converted, undefined);
});

test('restauração e moedas convertidas persistem no banco', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-temple-'));
  try {
    const store = await openAccountStore(directory),
      a = (store.accounts.player = account());
    a.position = { x: WELL.x - 1, y: WELL.y + 1 };
    a.vitals.health = 7;
    a.vitals.mana = 2;
    a.inventory[0] = { id: 'gold_coin', quantity: 115 };
    const service = createWorldService({ save: store.save });
    await service.heal(a);
    await service.use(a, { slot: 0, itemId: 'gold_coin' });
    const loaded = (await openAccountStore(directory)).accounts.player;
    assert.equal(loaded.vitals.health, 100);
    assert.equal(loaded.vitals.mana, 100);
    assert.deepEqual(loaded.inventory.slice(0, 2), [
      { id: 'gold_coin', quantity: 15 },
      { id: 'silver_coin', quantity: 1 },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
