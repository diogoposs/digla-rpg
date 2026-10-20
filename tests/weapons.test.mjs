import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorldService } from '../server/world.mjs';
import { ensureProgress, skillProgress } from '../public/js/game/progression.js';
import { openAccountStore } from '../server/storage.mjs';
import { findPath } from '../public/js/game/pathfinding.js';
import { createNavigation } from '../public/js/game/navigation.js';
import { ORC_DROP_CHANCE } from '../public/js/game/world-rules.js';
import { WELL } from '../public/js/config.js';
import { combatAccount, orcPoint } from './helpers/combat.mjs';
import { ORC_CASTLE } from '../public/js/world/elevation.js';
const account = () =>
  combatAccount({
    position: orcPoint(),
    inventory: [
      { id: 'sword', quantity: 1 },
      { id: 'staff', quantity: 1 },
    ],
  });

test('loot respeita a configuração de drop, divide armas 1/2 e não sorteia novamente ao abrir', async () => {
  for (const [chance, choice, expected] of [
    [0, 0, 'sword'],
    [ORC_DROP_CHANCE - 0.00001, 0.5, 'staff'],
    [ORC_DROP_CHANCE, 0, null],
  ]) {
    const a = account(),
      values = [0.9999, chance, choice];
    a.orc.health = 1;
    const service = createWorldService({ save: async () => {}, random: () => values.shift() ?? 0 });
    await service.attack(a);
    assert.equal(a.corpse.slots[0]?.id || null, expected);
    assert.equal(a.corpse.slots.filter(Boolean).length, expected ? 2 : 1);
    assert.equal(a.corpse.slots.length, 6);
    const first = structuredClone(service.loot(a, { id: a.corpse.id }).loot);
    assert.deepEqual(service.loot(a, { id: a.corpse.id }).loot, first);
  }
});

test('cajado alcança 3, continua selecionado ao andar e só ganha metade do dano real em Magia', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0, now: () => clock });
  await service.transfer(a, { slot: 1, itemId: 'staff', target: 'equipment' });
  a.position = orcPoint(0, 4);
  assert.equal((await service.attack(a)).events.length, 0);
  a.position = orcPoint(0, 3);
  clock = 250;
  const hit = await service.tick(a);
  assert.equal(hit.events[0].element, 'fire');
  assert.equal(hit.events[0].damage, 4);
  assert.equal(a.skills.magic.xp, 2);
  assert.equal(a.skills.combat.xp, 0);
  a.position = orcPoint(1, 3);
  clock = 1250;
  await service.tick(a);
  assert.equal(a.skills.magic.xp, 4);
  a.position = orcPoint(0, 10);
  clock = 2250;
  assert.equal((await service.tick(a)).orc.targeted, true);
  assert.equal(a.skills.magic.xp, 4);
  a.position = orcPoint(1, 2);
  a.orc.health = 2;
  clock = 3250;
  const killing = await service.tick(a);
  assert.equal(killing.events.find((e) => e.type === 'player-hit').damage, 2);
  assert.equal(a.skills.magic.xp, 5);
  assert.equal(skillProgress(101.5).xp, 1.5);
});

test('espada dá XP de Combate, mãos vazias não dão XP e cajado não atravessa obstáculos', async () => {
  let clock = 0;
  const a = account(),
    service = createWorldService({ save: async () => {}, random: () => 0.9999, now: () => clock });
  await service.attack(a);
  assert.equal(a.skills.combat.xp, 0);
  await service.transfer(a, { slot: 0, itemId: 'sword', target: 'equipment' });
  clock = 1000;
  await service.tick(a);
  assert.equal(a.skills.combat.xp, 4);
  await service.transfer(a, { slot: 1, itemId: 'staff', target: 'equipment' });
  a.position = { x: ORC_CASTLE.x - 1, y: ORC_CASTLE.y + 3 };
  Object.assign(a.orc, { x: ORC_CASTLE.x + 1, y: ORC_CASTLE.y + 3 });
  clock = 2000;
  // Sem mover o orc neste instante, a linha de visão passa pelo poço (30,25).
  const blocked = createWorldService({
    save: async () => {},
    random: () => 0.9999,
    now: () => clock,
  });
  await blocked.attack(a);
  assert.equal(a.skills.magic.xp, 0);
  assert.equal((await blocked.element(a, { element: 'invalid' })).attackElement, 'fire');
  for (const element of ['water', 'lightning', 'fire']) {
    await blocked.element(a, { element });
    assert.equal(a.attackElement, element);
  }
});

test('transferências exigem proximidade, não perdem loot em mochila cheia e armas ocupam slots distintos', async () => {
  const a = account(),
    service = createWorldService({ save: async () => {} });
  a.corpse = {
    id: 'body',
    ...orcPoint(0, 0),
    slots: [{ id: 'staff', quantity: 1 }, null, null, null, null, null],
  };
  a.position = { x: 29, y: 27 };
  const loot = { source: 'loot', corpseId: 'body', slot: 0, itemId: 'staff', target: 'inventory' };
  assert.equal((await service.transfer(a, loot)).transferred, undefined);
  await service.drop(a, { slot: 0, itemId: 'sword', quantity: 1, ...orcPoint() });
  const id = a.groundItems[0].id;
  assert.equal((await service.move(a, { id, ...orcPoint(1, 1) })).moved, undefined);
  a.position = orcPoint();
  assert.equal((await service.move(a, { id, ...orcPoint(1, 1) })).moved, true);
  a.inventory = Array.from({ length: 12 }, () => ({ id: 'sword', quantity: 1 }));
  assert.equal((await service.transfer(a, loot)).transferred, undefined);
  assert.equal(a.corpse.slots[0].id, 'staff');
  a.inventory[4] = null;
  assert.equal((await service.transfer(a, loot)).transferred, true);
  assert.equal(a.inventory[4].id, 'staff');
  assert.equal(a.corpse.slots[0], null);
  assert.equal((await service.transfer(a, loot)).transferred, undefined);
  await service.transfer(a, { slot: 4, itemId: 'staff', target: 'equipment' });
  await service.transfer(a, { slot: 0, itemId: 'sword', target: 'equipment' });
  assert.equal(a.inventory[0].id, 'staff');
  assert.equal(a.equipment.weapon.id, 'sword');
});

test('equipamento, elemento, XP fracionário e loot persistem ao reabrir o banco', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-weapons-'));
  try {
    const store = await openAccountStore(directory),
      a = (store.accounts.player = account());
    const service = createWorldService({ save: store.save, random: () => 0 });
    await service.transfer(a, { slot: 1, itemId: 'staff', target: 'equipment' });
    await service.element(a, { element: 'water' });
    a.orc.health = 3;
    await service.attack(a);
    const loaded = (await openAccountStore(directory)).accounts.player;
    assert.equal(loaded.attackElement, 'water');
    assert.equal(loaded.equipment.weapon.id, 'staff');
    assert.equal(loaded.skills.magic.xp, 1.5);
    assert.equal(loaded.corpse.slots[0].id, 'sword');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('clique encontra caminho sem atravessar obstáculos, aproxima ao alcance e permite cancelar', async () => {
  const canWalk = (x, y) => x >= 0 && y >= 0 && x < 6 && y < 6 && !(x === 2 && y < 4);
  const route = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, canWalk);
  assert.ok(route.length > 8);
  assert.ok(route.every((point) => canWalk(point.x, point.y)));
  assert.equal(findPath({ x: 0, y: 0 }, { x: 10, y: 10 }, canWalk), null);
  const movement = { target: { x: 0, y: 0 }, travel: null };
  const nav = createNavigation({ getMovement: () => movement, canWalk, notify: () => {} });
  const reached = nav.goTo({ x: 1, y: 0 }, 1);
  nav.key();
  assert.equal(await reached, true);
  const cancelled = nav.goTo({ x: 4, y: 0 });
  assert.equal(nav.key(), 'ArrowDown');
  nav.cancel();
  assert.equal(await cancelled, false);
});
