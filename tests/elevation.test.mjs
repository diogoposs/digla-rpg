import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPAWN, SAFE_ZONE } from '../public/js/config.js';
import {
  FLOOR_LINKS,
  floorOf,
  transitionAt,
  validFloorMove,
  isSafeZone,
  sameFloor,
  regionalPoint,
} from '../public/js/world/elevation.js';
import { walkable } from '../public/js/world/map.js';
import { Movement } from '../public/js/game/movement.js';
import { MOB_DEFINITIONS, getMobs, distance } from '../public/js/game/world-rules.js';
import { ensureProgress } from '../public/js/game/progression.js';
import { createWorldService } from '../server/world.mjs';
import { isolateMobs } from './helpers/combat.mjs';
import { nearStove } from '../public/js/game/cooking-rules.js';
import { nearWater } from '../public/js/game/fishing-rules.js';
import { lineOfSight } from '../public/js/game/pathfinding.js';

const key = (point) => `${point.x},${point.y},${floorOf(point)}`;
test('todos os andares, entradas, saídas e spawns são alcançáveis a partir da vila', () => {
  const queue = [SPAWN],
    seen = new Set([key(SPAWN)]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      let point = { x: current.x + dx, y: current.y + dy, z: floorOf(current) };
      if (!walkable(point.x, point.y, point.z)) continue;
      point = transitionAt(point.x, point.y, point.z)?.to || point;
      if (seen.has(key(point))) continue;
      seen.add(key(point));
      queue.push(point);
    }
  }
  for (const link of FLOOR_LINKS) {
    assert.ok(walkable(link.from.x, link.from.y, link.from.z), link.id);
    assert.ok(seen.has(key(link.to)), `Passagem isolada: ${link.id}`);
    assert.equal(
      transitionAt(link.to.x, link.to.y, link.to.z),
      undefined,
      `Retorno automático em ciclo: ${link.id}`,
    );
  }
  for (const mob of Object.values(MOB_DEFINITIONS)) assert.ok(seen.has(key(mob.spawn)), mob.name);
});

test('pisar na escada ou buraco muda a posição e o andar do personagem', () => {
  for (const link of FLOOR_LINKS) {
    const adjacent = [
      [0, 1, 'ArrowUp'],
      [0, -1, 'ArrowDown'],
      [1, 0, 'ArrowLeft'],
      [-1, 0, 'ArrowRight'],
    ]
      .map(([dx, dy, key]) => ({
        point: { x: link.from.x + dx, y: link.from.y + dy, z: link.from.z },
        key,
      }))
      .find(({ point }) => walkable(point.x, point.y, point.z));
    const movement = new Movement(adjacent.point, {});
    assert.equal(movement.update(1000, 16, adjacent.key), true);
    assert.deepEqual(movement.target, link.to);
    assert.equal(movement.player.z, link.to.z);
    assert.equal(validFloorMove(adjacent.point, movement.target), true);
  }
});

test('andar não pode ser forjado, nem ataques e interações atravessam pisos', async () => {
  const up = FLOOR_LINKS[0];
  assert.equal(validFloorMove(SPAWN, up.to), false);
  assert.equal(validFloorMove(up.from, up.to), true);
  assert.equal(validFloorMove(up.from, { ...up.to, z: 99 }), false);
  assert.equal(distance({ x: 1, y: 1 }, { x: 1, y: 1, z: 1 }), Infinity);
  assert.equal(
    lineOfSight({ x: 1, y: 1 }, { x: 1, y: 1, z: -1 }, () => true),
    false,
  );
  const mob = MOB_DEFINITIONS.orc_cave;
  const account = isolateMobs(ensureProgress({ position: { ...mob.spawn, z: 0 } }), ['orc_cave']);
  const service = createWorldService({ save: async () => {}, now: () => 1000 });
  assert.equal(((await service.attack(account, { mobId: 'orc_cave' })).events || []).length, 0);
  assert.equal(account.elementals.orc_cave.health, mob.maxHealth);
  assert.equal(nearStove({ x: 21, y: 30, z: -1 }), false);
  assert.equal(nearWater(regionalPoint('water', { x: 90, y: 56, z: -1 })), true);
});

test('pilhas com as mesmas coordenadas ficam separadas por andar e não podem ser coletadas de outro piso', async () => {
  const point = regionalPoint('orc', { x: 19, y: 20, z: -1 });
  const account = ensureProgress({
    position: point,
    inventory: [{ id: 'gold_coin', quantity: 3 }],
    groundItems: [
      { id: 'surface', itemId: 'gold_coin', quantity: 5, x: point.x, y: point.y, z: 0 },
    ],
  });
  const service = createWorldService({ save: async () => {} });
  assert.equal((await service.pickup(account, { id: 'surface' })).pickedUp, undefined);
  assert.equal(
    (await service.drop(account, { slot: 0, itemId: 'gold_coin', x: point.x, y: point.y, z: 0 }))
      .dropped,
    undefined,
  );
  assert.equal(
    (await service.drop(account, { slot: 0, itemId: 'gold_coin', x: point.x, y: point.y })).dropped,
    true,
  );
  assert.equal(account.groundItems.length, 2);
  const underground = account.groundItems.find((item) => floorOf(item) === -1);
  assert.equal(underground.quantity, 3);
  assert.equal((await service.pickup(account, { id: underground.id })).pickedUp, true);
  assert.equal(account.inventory[0].quantity, 3);
  assert.equal(account.groundItems[0].quantity, 5);
});

test('mobs e cadáveres mantêm o piso e o loot permanece inacessível de outro andar', async () => {
  let time = 0;
  const spawn = MOB_DEFINITIONS.orc_cave.spawn;
  const account = isolateMobs(ensureProgress({ position: { x: spawn.x + 1, y: spawn.y, z: -1 } }), [
    'orc_cave',
  ]);
  account.elementals.orc_cave.health = 3;
  const service = createWorldService({ save: async () => {}, random: () => 0, now: () => time });
  await service.attack(account, { mobId: 'orc_cave' });
  const corpse = account.elementalCorpses.orc_cave;
  assert.equal(corpse.z, -1);
  assert.ok(service.loot(account, { id: corpse.id }).loot);
  account.position.z = 0;
  assert.equal(service.loot(account, { id: corpse.id }).loot, undefined);
});

test('área inicial de 30x30 não tem spawns, nem permite perseguição ou dano', async () => {
  assert.equal(SAFE_ZONE.w, 30);
  assert.equal(SAFE_ZONE.h, 30);
  for (const definition of Object.values(MOB_DEFINITIONS))
    assert.equal(isSafeZone(definition.spawn), false, definition.name);
  const account = ensureProgress({ position: { x: SAFE_ZONE.x + SAFE_ZONE.w - 1, y: SPAWN.y } });
  isolateMobs(account, ['orc']);
  account.orc.x = SAFE_ZONE.x + SAFE_ZONE.w;
  account.orc.y = SPAWN.y;
  let time = 0;
  const service = createWorldService({ save: async () => {}, random: () => 0, now: () => time });
  await service.attack(account);
  for (let i = 0; i < 8; i++) {
    time += 500;
    await service.tick(account);
    assert.equal(isSafeZone(account.orc), false);
  }
  assert.equal(account.vitals.health, 100);
  assert.equal(account.orc.health, 300);
});

test('contas antigas reposicionam monstros sem apagar mochila, banco ou XP', () => {
  const account = ensureProgress({
    position: SPAWN,
    orc: { x: 29, y: 14, health: 23 },
    elementals: { fire_elemental: { x: 29, y: 38, health: 40 } },
    inventory: [{ id: 'gold_coin', quantity: 10 }],
    bank: [{ id: 'staff', quantity: 1 }],
    skills: { magic: { xp: 150 } },
  });
  assert.equal(isSafeZone(account.orc), false);
  assert.equal(account.orc.x, MOB_DEFINITIONS.orc.spawn.x);
  assert.equal(account.elementals.fire_elemental.y, MOB_DEFINITIONS.fire_elemental.spawn.y);
  assert.equal(account.orc.health, 230);
  assert.equal(account.inventory[0].quantity, 10);
  assert.equal(account.bank[0].id, 'staff');
  assert.equal(account.skills.magic.xp, 150);
});
