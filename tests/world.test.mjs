import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWorldService } from '../server/world.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { SPAWN } from '../public/js/config.js';
import { ORC_SPAWN, MOB_DEFINITIONS, getMobs } from '../public/js/game/world-rules.js';
import { openAccountStore } from '../server/storage.mjs';
import { combatAccount, orcPoint } from './helpers/combat.mjs';

const account = () =>
  combatAccount({
    position: { ...SPAWN },
    inventory: [
      { id: 'raw_salmon', quantity: 3 },
      { id: 'roasted_salmon', quantity: 2 },
      { id: 'burnt_salmon', quantity: 1 },
    ],
  });

test('vida 10× migra orcs salvos uma vez, mantém mortos e não altera elementais', () => {
  const a = ensureProgress({
    orc: { ...ORC_SPAWN, health: 23, maxHealth: 30 },
    elementals: {
      orc_captain: { ...MOB_DEFINITIONS.orc_captain.spawn, health: 40, maxHealth: 80 },
      orc_guard_west: {
        ...MOB_DEFINITIONS.orc_guard_west.spawn,
        health: 0,
        maxHealth: 40,
        respawnAt: 5000,
      },
      fire_elemental: { ...MOB_DEFINITIONS.fire_elemental.spawn, health: 25, maxHealth: 50 },
    },
  });
  assert.equal(a.orc.health, 230);
  assert.equal(a.orc.maxHealth, 300);
  assert.equal(a.elementals.orc_captain.health, 400);
  assert.equal(a.elementals.orc_captain.maxHealth, 800);
  assert.equal(a.elementals.orc_guard_west.health, 0);
  assert.equal(a.elementals.orc_guard_west.respawnAt, 5000);
  assert.equal(a.elementals.fire_elemental.health, 25);
  ensureProgress(a);
  assert.equal(a.orc.health, 230);
  assert.equal(a.elementals.orc_captain.health, 400);
  for (const mob of getMobs(ensureProgress({})))
    assert.equal(mob.health, MOB_DEFINITIONS[mob.id].maxHealth);
});

test('salmão assado inicia regeneração, respeita máximos e não consome com vida e mana cheias', async () => {
  let time = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, now: () => time });
  assert.equal((await service.use(a, { slot: 1, itemId: 'roasted_salmon' })).consumed, undefined);
  assert.equal(a.inventory[1].quantity, 2);
  a.vitals.health = 85;
  assert.equal((await service.use(a, { slot: 1, itemId: 'roasted_salmon' })).consumed, true);
  assert.equal(a.vitals.health, 85);
  time = 3000;
  await service.tick(a);
  assert.equal(a.vitals.health, 100);
  assert.equal(a.inventory[1].quantity, 1);
  a.vitals.health = 50;
  assert.equal((await service.use(a, { slot: 0, itemId: 'raw_salmon' })).consumed, undefined);
  assert.equal((await service.use(a, { slot: 2, itemId: 'burnt_salmon' })).consumed, undefined);
  assert.equal(a.vitals.health, 50);
  assert.equal((await service.use(a, { slot: 0, itemId: 'roasted_salmon' })).consumed, undefined);
});

test('largar/recolher preserva quantidade e recusa água, casas, limites e orc vivo', async () => {
  const a = account(),
    service = createWorldService({ save: async () => {} });
  for (const point of [{ x: 44, y: 31 }, { x: 23, y: 18 }, { x: -1, y: 27 }, ORC_SPAWN]) {
    assert.equal(
      (await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 3, ...point })).dropped,
      undefined,
    );
  }
  assert.equal(a.inventory[0].quantity, 3);
  assert.equal(a.groundItems.length, 0);
  assert.equal(
    (await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 99, x: 30, y: 27 })).dropped,
    undefined,
  );
  await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 2, x: 30, y: 27 });
  assert.equal(a.inventory[0].quantity, 1);
  assert.equal(a.groundItems[0].quantity, 2);
  await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 1, x: 30, y: 27 });
  assert.equal(a.inventory[0], null);
  assert.equal(a.groundItems.length, 1);
  assert.equal(a.groundItems[0].quantity, 3);
  const id = a.groundItems[0].id;
  a.position = { x: 29, y: 24 };
  assert.equal((await service.pickup(a, { id })).pickedUp, undefined);
  a.position = { ...SPAWN };
  assert.equal((await service.pickup(a, { id })).pickedUp, true);
  assert.equal(a.inventory[0].quantity, 3);
  assert.equal(a.groundItems.length, 0);
  assert.equal((await service.pickup(a, { id })).pickedUp, undefined);
});

test('orc tem 300 de vida, ambos causam 3–6 e cooldown impede dano por spam', async () => {
  let clock = 0;
  const a = account();
  a.position = orcPoint();
  const service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  const hit = await service.attack(a);
  assert.equal(a.orc.maxHealth, 300);
  assert.equal(a.orc.health, 297);
  assert.deepEqual(hit.events, [
    {
      type: 'player-hit',
      mobId: 'orc',
      mobName: 'Orc',
      weakness: false,
      damage: 3,
      critical: false,
      x: ORC_SPAWN.x,
      y: ORC_SPAWN.y,
      z: 0,
    },
  ]);
  assert.equal((await service.attack(a, { toggle: false })).events.length, 0);
  clock = 1000;
  const exchange = await service.tick(a);
  assert.equal(a.orc.health, 294);
  assert.equal(a.vitals.health, 97);
  assert.equal(exchange.events.filter((event) => event.damage).length, 2);
  const b = account();
  b.position = orcPoint();
  let time = 0;
  const maximum = createWorldService({
    save: async () => {},
    random: () => 0.99999,
    now: () => time,
  });
  const critical = (await maximum.attack(b)).events[0];
  assert.equal(critical.damage, 6);
  assert.equal(critical.critical, true);
  time = 1000;
  const maximumExchange = await maximum.tick(b);
  assert.deepEqual(
    maximumExchange.events.find((event) => event.type === 'orc-hit'),
    {
      type: 'orc-hit',
      mobId: 'orc',
      mobName: 'Orc',
      damage: 6,
      critical: true,
      ...orcPoint(),
      z: 0,
    },
  );
  assert.equal(b.vitals.health, 94);
  assert.equal(service.canMove(a, a.orc.x, a.orc.y), false);
});

test('orc persegue em tiles caminháveis, morre e reaparece; jogador retorna ao spawn sem perder itens', async () => {
  let clock = 0;
  const a = account();
  a.position = orcPoint(0, 4);
  const service = createWorldService({
    save: async () => {},
    random: () => 0.99999,
    now: () => clock,
  });
  await service.tick(a);
  clock = 500;
  await service.tick(a);
  assert.equal(a.orc.y, ORC_SPAWN.y + 1);
  a.position = orcPoint(0, 2);
  a.orc.health = 30; // Short wounded-enemy scenario for corpse/respawn checks.
  await service.attack(a);
  for (let i = 0; i < 5; i++) {
    clock += 1000;
    await service.tick(a);
  }
  assert.equal(a.orc.health, 0);
  assert.equal(a.corpse.x, a.orc.x);
  assert.equal(a.corpse.y, a.orc.y);
  assert.equal(a.corpse.slots[1].id, 'gold_coin');
  assert.equal(a.corpse.slots[1].quantity, 15);
  assert.equal(service.canMove(a, a.corpse.x, a.corpse.y), true);
  assert.deepEqual(service.loot(a, { id: a.corpse.id }).loot.slots, a.corpse.slots);
  assert.equal(service.loot(a, { id: 'inexistente' }).loot, undefined);
  const corpseId = a.corpse.id;
  const respawnAt = a.orc.respawnAt;
  clock = respawnAt;
  await service.tick(a);
  assert.equal(a.orc.health, 300);
  assert.equal(a.corpse.id, corpseId);
  a.position = { ...SPAWN };
  assert.equal(service.loot(a, { id: corpseId }).loot, undefined);
  a.vitals.health = 3;
  a.position = orcPoint();
  clock += 1000;
  const death = await service.tick(a);
  assert.equal(death.playerRespawned, true);
  assert.deepEqual(a.position, SPAWN);
  assert.equal(a.vitals.health, a.vitals.maxHealth);
  assert.equal(a.inventory[0].quantity, 3);
});

test('vida, itens no chão e corpo com loot sobrevivem a reabrir o banco', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-world-'));
  try {
    const store = await openAccountStore(directory);
    store.accounts.player = account();
    store.accounts.player.vitals.health = 75;
    const service = createWorldService({ save: store.save, random: () => 0.99999 });
    await service.use(store.accounts.player, { slot: 1, itemId: 'roasted_salmon' });
    await service.drop(store.accounts.player, {
      slot: 0,
      itemId: 'raw_salmon',
      quantity: 3,
      x: 30,
      y: 27,
    });
    store.accounts.player.position = orcPoint();
    store.accounts.player.orc.health = 6;
    await service.attack(store.accounts.player);
    const loaded = await openAccountStore(directory);
    assert.equal(loaded.accounts.player.vitals.health, 75);
    assert.equal(loaded.accounts.player.foodEffect.remainingTicks, 20);
    assert.equal(loaded.accounts.player.inventory[0], null);
    assert.equal(loaded.accounts.player.groundItems[0].quantity, 3);
    assert.equal(loaded.accounts.player.orc.health, 0);
    assert.equal(loaded.accounts.player.corpse.slots[1].id, 'gold_coin');
    const restored = createWorldService({ save: loaded.save });
    assert.deepEqual(
      restored.loot(loaded.accounts.player, { id: loaded.accounts.player.corpse.id }).loot.slots,
      loaded.accounts.player.corpse.slots,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('mover pilhas no chão valida destino, junta quantidades e não duplica itens', async () => {
  const a = account(),
    service = createWorldService({ save: async () => {} });
  await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 2, x: 30, y: 27 });
  await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 1, x: 30, y: 28 });
  const id = a.groundItems[0].id;
  for (const point of [{ x: 44, y: 31 }, { x: 23, y: 18 }, { x: -1, y: 27 }, ORC_SPAWN])
    assert.equal((await service.move(a, { id, ...point })).moved, undefined);
  assert.deepEqual(
    a.groundItems.map((item) => item.quantity),
    [2, 1],
  );
  assert.equal((await service.move(a, { id, x: 29, y: 27 })).moved, true);
  assert.equal(a.groundItems[0].x, 29);
  assert.equal((await service.move(a, { id, x: 30, y: 28 })).moved, true);
  assert.equal(a.groundItems.length, 1);
  assert.equal(a.groundItems[0].quantity, 3);
  assert.equal((await service.move(a, { id, x: 30, y: 28 })).moved, undefined);
  await service.pickup(a, { id: a.groundItems[0].id });
  assert.equal(a.inventory[0].quantity, 3);
});
