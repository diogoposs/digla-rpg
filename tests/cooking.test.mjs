import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCookingService } from '../server/cooking.mjs';
import { ensureProgress, skillProgress } from '../public/js/game/progression.js';
import { cookingChance, nearStove } from '../public/js/game/cooking-rules.js';
import { STOVE } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';
import { openAccountStore } from '../server/storage.mjs';

const makeAccount = (quantity) =>
  ensureProgress({
    position: { x: STOVE.x - 1, y: STOVE.y },
    inventory: [{ id: 'raw_salmon', quantity }],
  });

test('fogão fica próximo ao spawn e a chance aumenta 5 pontos até 100%', () => {
  assert.equal(walkable(STOVE.x, STOVE.y), false);
  assert.equal(nearStove({ x: STOVE.x - 1, y: STOVE.y }), true);
  assert.equal(nearStove({ x: 29, y: 27 }), false);
  assert.equal(cookingChance(1), 0.25);
  assert.equal(cookingChance(2), 0.3);
  assert.equal(cookingChance(16), 1);
  assert.equal(cookingChance(50), 1);
});

test('um peixe por tentativa, resultado correto, pilhas separadas e XP apenas em sucesso', async () => {
  let clock = 0,
    roll = 0.9,
    rolls = 0;
  const account = makeAccount(3);
  const service = createCookingService({
    now: () => clock,
    random: () => {
      rolls++;
      return roll;
    },
    save: async () => {},
  });
  const started = service.start(account, 'salmon', 'all');
  assert.equal(started.remaining, 3);
  clock = 1199;
  assert.equal((await service.tick(account)).attempted, false);
  assert.equal(rolls, 0);
  clock = 1200;
  const burnt = await service.tick(account);
  assert.equal(burnt.result, 'burnt_salmon');
  assert.equal(burnt.skills.cooking.totalXp, 0);
  assert.equal(account.inventory[0].quantity, 2);
  assert.equal(account.inventory[1].id, 'burnt_salmon');
  assert.equal((await service.tick(account)).attempted, false);
  roll = 0;
  clock += 1200;
  const roasted = await service.tick(account);
  assert.equal(roasted.result, 'roasted_salmon');
  assert.equal(roasted.skills.cooking.totalXp, 10);
  clock += 1200;
  const finished = await service.tick(account);
  assert.equal(finished.active, false);
  assert.equal(finished.finished, true);
  assert.equal(account.inventory.filter(Boolean).length, 2);
  assert.equal(account.inventory.find((item) => item?.id === 'roasted_salmon').quantity, 2);
  assert.equal(account.inventory.find((item) => item?.id === 'burnt_salmon').quantity, 1);
  assert.equal(finished.rawCount, 0);
  assert.equal(finished.skills.cooking.totalXp, 20);
  assert.equal(finished.skills.fishing.totalXp, 0);
  assert.equal(service.start(account, 'salmon', 1).active, false);
});

test('mochila cheia não perde ingredientes; último cru pode liberar o próprio espaço', async () => {
  const account = makeAccount(2);
  account.inventory = Array.from({ length: 12 }, (_, index) =>
    index ? { id: 'test', quantity: 1 } : { id: 'raw_salmon', quantity: 2 },
  );
  let clock = 0;
  const service = createCookingService({ save: async () => {}, random: () => 0, now: () => clock });
  assert.equal(service.start(account, 'salmon', 1).active, false);
  assert.equal(account.inventory[0].quantity, 2);
  account.inventory[0].quantity = 1;
  assert.equal(service.start(account, 'salmon', 1).active, true);
  clock = 1200;
  await service.tick(account);
  assert.deepEqual(account.inventory[0], { id: 'roasted_salmon', quantity: 1 });
  // Com 100% de chance, basta ter a pilha de assados; queimados já não são possíveis.
  account.inventory[0] = { id: 'raw_salmon', quantity: 2 };
  account.inventory[1] = { id: 'roasted_salmon', quantity: 1 };
  account.skills.cooking.xp = 100 * (2 ** 15 - 1);
  assert.equal(service.start(account, 'salmon', 1).active, true);
  clock += 1200;
  await service.tick(account);
  assert.equal(account.inventory[1].quantity, 2);
});

test('movimento, parada, tempo offline e receitas inválidas não consomem peixe', async () => {
  const account = makeAccount(3);
  let clock = 0;
  const service = createCookingService({ save: async () => {}, random: () => 0, now: () => clock });
  assert.equal(service.start(account, 'other', 'all').active, false);
  service.start(account, 'salmon', 'all');
  service.stop(account);
  clock = 1200;
  assert.equal((await service.tick(account)).active, false);
  assert.equal(account.inventory[0].quantity, 3);
  service.start(account, 'salmon', 'all');
  account.position = { x: 29, y: 27 };
  clock += 1200;
  assert.equal((await service.tick(account)).active, false);
  assert.equal(account.inventory[0].quantity, 3);
  assert.equal(service.open(account).available, false);
  account.position = { x: STOVE.x - 1, y: STOVE.y };
  service.start(account, 'salmon', 'all');
  clock += 6000;
  assert.equal((await service.tick(account)).active, false);
  assert.equal(account.inventory[0].quantity, 3);
});

test('chamadas simultâneas não duplicam resultado e o nível atualiza a chance', async () => {
  const account = makeAccount(3);
  account.skills.cooking.xp = 90;
  let clock = 0,
    release;
  const service = createCookingService({
    now: () => clock,
    random: () => 0,
    save: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  service.start(account, 'salmon', 1);
  clock = 1200;
  const pending = service.tick(account);
  assert.equal((await service.tick(account)).attempted, false);
  assert.equal(account.inventory[0].quantity, 2);
  release();
  const result = await pending;
  assert.equal(result.leveledUp, true);
  assert.equal(result.chance, 0.3);
  assert.equal(skillProgress(account.skills.cooking.xp).level, 2);
});

test('culinária e peixes transformados persistem ao reabrir o banco', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-cooking-'));
  try {
    const store = await openAccountStore(directory);
    store.accounts.cook = makeAccount(2);
    store.accounts.cook.skills.fishing.xp = 120;
    let clock = 0;
    const service = createCookingService({ save: store.save, random: () => 0, now: () => clock });
    service.start(store.accounts.cook, 'salmon', 1);
    clock = 1200;
    await service.tick(store.accounts.cook);
    const reopened = await openAccountStore(directory);
    assert.equal(reopened.accounts.cook.skills.cooking.xp, 10);
    assert.equal(reopened.accounts.cook.skills.fishing.xp, 120);
    assert.equal(
      reopened.accounts.cook.inventory.find((item) => item?.id === 'roasted_salmon').quantity,
      1,
    );
    assert.equal(reopened.accounts.cook.inventory[0].quantity, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
