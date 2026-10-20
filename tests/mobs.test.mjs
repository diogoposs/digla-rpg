import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorldService } from '../server/world.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { MOB_DEFINITIONS, getMobs, getCorpses, distance } from '../public/js/game/world-rules.js';
import { SPAWN, TEMPLE, WELL, STOVE } from '../public/js/config.js';
import { walkable, templeObstacle, houseAt } from '../public/js/world/map.js';
import { openAccountStore } from '../server/storage.mjs';
import { isolateMobs } from './helpers/combat.mjs';

function account(id = 'fire_elemental', element = 'water') {
  const spawn = MOB_DEFINITIONS[id].spawn;
  const position = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
    .map(([dx, dy]) => ({ x: spawn.x + dx, y: spawn.y + dy }))
    .find((p) => walkable(p.x, p.y));
  return isolateMobs(
    ensureProgress({
      position,
      equipment: { weapon: { id: 'staff', quantity: 1 } },
      attackElement: element,
    }),
    ['orc', 'fire_elemental', 'water_elemental'],
  );
}

test('templo permanece aberto e centrado; fogão fica na casa da cozinha', () => {
  assert.equal(TEMPLE.x + (TEMPLE.w - 1) / 2, SPAWN.x);
  assert.equal(TEMPLE.y + (TEMPLE.h - 1) / 2, SPAWN.y);
  assert.equal(WELL.x, SPAWN.x);
  assert.equal(houseAt(STOVE.x, STOVE.y)?.name, 'Cozinha');
  let blocked = 0;
  for (let y = TEMPLE.y; y < TEMPLE.y + TEMPLE.h; y++)
    for (let x = TEMPLE.x; x < TEMPLE.x + TEMPLE.w; x++) if (templeObstacle(x, y)) blocked++;
  assert.equal(blocked, 4);
  for (const definition of Object.values(MOB_DEFINITIONS))
    assert.equal(walkable(definition.spawn.x, definition.spawn.y, definition.spawn.z ?? 0), true);
  assert.ok(MOB_DEFINITIONS.fire_elemental.spawn.y > SPAWN.y);
  assert.ok(MOB_DEFINITIONS.water_elemental.spawn.x > SPAWN.x + 30);
});

test('fraqueza dá +50% só à magia correta, com XP pelo dano real e crítico no máximo ajustado', async () => {
  for (const [id, correct] of [
    ['orc', 'lightning'],
    ['fire_elemental', 'water'],
    ['water_elemental', 'lightning'],
  ]) {
    for (const [element, roll, damage] of [
      [correct, 0, 6],
      [correct, 0.99999, 11],
      ['fire', 0, 4],
    ]) {
      const a = account(id, element),
        service = createWorldService({ save: async () => {}, random: () => roll });
      const before = getMobs(a).map((mob) => mob.health),
        result = await service.attack(a, { mobId: id });
      const event = result.events.find((event) => event.type === 'player-hit');
      assert.equal(event.mobId, id);
      assert.equal(event.damage, damage);
      assert.equal(event.weakness, element === correct);
      assert.equal(event.critical, roll !== 0);
      assert.equal(a.skills.magic.xp, damage / 2);
      getMobs(a).forEach((mob, index) =>
        assert.equal(mob.health, before[index] - (mob.id === id ? damage : 0)),
      );
    }
    const a = account(id, correct);
    a.equipment.weapon = { id: 'sword', quantity: 1 };
    const result = await createWorldService({ save: async () => {}, random: () => 0 }).attack(a, {
      mobId: id,
    });
    assert.equal(result.events[0].damage, 5);
    assert.equal(result.events[0].weakness, false);
  }
});

test('trocar de alvo e alternar ataque não duplica golpes e todos os mobs bloqueiam movimentação/itens', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  await service.attack(a, { mobId: 'fire_elemental' });
  assert.equal(
    (await service.attack(a, { mobId: 'fire_elemental' })).mobs.some((mob) => mob.targeted),
    false,
  );
  const switched = await service.attack(a, { mobId: 'water_elemental' });
  assert.equal(switched.mobs.find((mob) => mob.targeted).id, 'water_elemental');
  assert.equal(a.elementals.water_elemental.health, 50);
  const water = MOB_DEFINITIONS.water_elemental.spawn;
  a.position = { x: water.x, y: water.y - 1 };
  clock = 1000;
  await service.tick(a);
  assert.equal(a.elementals.water_elemental.health, 46);
  a.inventory[0] = { id: 'raw_salmon', quantity: 1 };
  for (const mob of getMobs(a).filter((mob) => mob.health > 0)) {
    assert.equal(service.canMove(a, mob.x, mob.y, mob.z ?? 0), false);
    if ((mob.z ?? 0) !== (a.position.z ?? 0)) continue;
    assert.equal(
      (await service.drop(a, { slot: 0, itemId: 'raw_salmon', quantity: 1, x: mob.x, y: mob.y }))
        .dropped,
      undefined,
    );
  }
});

test('cadáveres e loot de cada mob coexistem, recolhem moedas e cada respawn usa sua própria vida', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  a.corpse = { id: 'old-orc', mobId: 'orc', kind: 'orc', x: 29, y: 14, slots: Array(6).fill(null) };
  a.elementals.fire_elemental.health = 6;
  await service.attack(a, { mobId: 'fire_elemental' });
  const fire = a.elementalCorpses.fire_elemental;
  assert.equal(service.loot(a, { id: fire.id }).loot.mobId, 'fire_elemental');
  await service.transfer(a, {
    source: 'loot',
    corpseId: fire.id,
    slot: 1,
    itemId: 'gold_coin',
    target: 'inventory',
  });
  a.position = account('water_elemental', 'lightning').position;
  a.attackElement = 'lightning';
  a.elementals.water_elemental.health = 6;
  clock = 1000;
  await service.attack(a, { mobId: 'water_elemental' });
  const water = a.elementalCorpses.water_elemental;
  assert.equal(getCorpses(a).length, 3);
  assert.equal(a.corpse.id, 'old-orc');
  assert.equal(service.loot(a, { id: fire.id }).loot, undefined);
  await service.transfer(a, {
    source: 'loot',
    corpseId: water.id,
    slot: 1,
    itemId: 'gold_coin',
    target: 'inventory',
  });
  assert.equal(a.inventory[0].quantity, 10);
  assert.equal(water.slots[1], null);
  assert.equal(fire.slots[1], null);
  clock = 15000;
  await service.tick(a);
  assert.equal(a.elementals.fire_elemental.health, 50);
  assert.equal(a.elementals.water_elemental.health, 0);
  clock = 16000;
  await service.tick(a);
  assert.equal(a.elementals.water_elemental.health, 50);
});

test('elementais perseguem e a morte do jogador encerra os encontros sem dano duplicado', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0.99999, now: () => clock });
  await service.attack(a, { mobId: 'fire_elemental' });
  service.stop(a);
  a.position = {
    x: MOB_DEFINITIONS.fire_elemental.spawn.x,
    y: MOB_DEFINITIONS.fire_elemental.spawn.y - 4,
  };
  for (let i = 0; i < 6 && distance(a.position, a.elementals.fire_elemental) > 1; i++) {
    clock += 500;
    await service.tick(a);
  }
  assert.ok(distance(a.position, a.elementals.fire_elemental) <= 1);
  a.vitals.health = 1;
  clock += 1000;
  const result = await service.tick(a);
  assert.equal(result.playerRespawned, true);
  assert.deepEqual(a.position, SPAWN);
  assert.equal(a.vitals.health, 100);
  assert.ok(result.mobs.every((mob) => !mob.targeted && !mob.chasing));
});

test('contas antigas mantêm orc e itens; estado dos elementais e cadáveres persiste', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-mobs-'));
  try {
    const store = await openAccountStore(directory),
      a = (store.accounts.player = account());
    a.orc.health = 23;
    a.inventory[0] = { id: 'gold_coin', quantity: 35 };
    const service = createWorldService({ save: store.save, random: () => 0 });
    a.elementals.fire_elemental.health = 6;
    await service.attack(a, { mobId: 'fire_elemental' });
    const loaded = (await openAccountStore(directory)).accounts.player;
    ensureProgress(loaded);
    assert.equal(loaded.orc.health, 23);
    assert.equal(loaded.inventory[0].quantity, 35);
    assert.equal(loaded.elementals.fire_elemental.health, 0);
    assert.equal(loaded.elementals.water_elemental.health, 50);
    assert.equal(loaded.elementalCorpses.fire_elemental.slots[1].quantity, 5);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
