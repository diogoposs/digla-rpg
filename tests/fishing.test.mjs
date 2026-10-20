import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createFishingService } from '../server/fishing.mjs';
import { openAccountStore } from '../server/storage.mjs';
import { ensureProgress, skillProgress } from '../public/js/game/progression.js';
import { nearWater, salmonChance } from '../public/js/game/fishing-rules.js';
import { walkable } from '../public/js/world/map.js';

export function shorePosition() {
  for (let y = 20; y < 40; y++)
    for (let x = 35; x < 50; x++) if (walkable(x, y) && nearWater({ x, y })) return { x, y };
  throw new Error('O mapa precisa de uma margem acessível.');
}

test('custos dobram a cada nível e preservam o XP excedente', () => {
  assert.deepEqual(skillProgress(100), { level: 2, totalXp: 100, xp: 0, required: 200 });
  assert.deepEqual(skillProgress(290), { level: 2, totalXp: 290, xp: 190, required: 200 });
  assert.deepEqual(skillProgress(300), { level: 3, totalXp: 300, xp: 0, required: 400 });
  assert.equal(skillProgress(710).level, 4);
  assert.equal(skillProgress(710).xp, 10);
  assert.ok(salmonChance(1) > 0 && salmonChance(1) < 1);
  assert.ok(salmonChance(2) > salmonChance(1));
  assert.equal(salmonChance(1, true), salmonChance(1) * 2);
  assert.equal(salmonChance(200, true), 0.9);
});

test('pesca valida margem, intervalo, bônus, RNG, empilhamento e nível', async () => {
  let clock = 1000,
    roll = (salmonChance(1) + salmonChance(1, true)) / 2,
    rolls = 0,
    saves = 0;
  const service = createFishingService({
    now: () => clock,
    random: () => {
      rolls++;
      return roll;
    },
    save: async () => {
      saves++;
    },
  });
  const account = ensureProgress({ position: { x: 29, y: 27 } });
  assert.equal(service.start(account).active, false);
  account.position = shorePosition();
  const first = service.start(account);
  assert.equal(first.active, true);
  clock += 599;
  assert.equal((await service.tick(account)).attempted, false);
  assert.equal(rolls, 0);
  clock++;
  assert.equal((await service.tick(account)).caught, false);
  assert.equal(rolls, 1);
  assert.equal((await service.tick(account)).attempted, false);
  const boosted = service.press(account, first.challenge.id);
  assert.equal(boosted.challenge.boosted, true);
  assert.equal(boosted.chance, salmonChance(1, true));
  clock += 100;
  assert.equal(service.press(account, first.challenge.id).challenge.boosted, true);
  clock += 500;
  const caught = await service.tick(account);
  assert.equal(caught.caught, true);
  assert.equal(caught.skills.fishing.totalXp, 10);
  assert.equal(caught.challenge.pressed, false);
  assert.equal(caught.chance, salmonChance(1));
  assert.notEqual(caught.challenge.id, first.challenge.id);
  assert.equal(service.press(account, first.challenge.id).challenge.pressed, false);
  roll = 0;
  for (let i = 0; i < 9; i++) {
    clock += 600;
    await service.tick(account);
  }
  assert.equal(account.skills.fishing.xp, 100);
  assert.equal(skillProgress(account.skills.fishing.xp).level, 2);
  assert.equal(account.inventory.filter(Boolean).length, 1);
  assert.deepEqual(account.inventory[0], { id: 'raw_salmon', quantity: 10 });
  assert.equal(saves, 10);
  assert.equal(account.skills.magic.xp, 0);
  account.position = { x: 29, y: 27 };
  clock += 600;
  assert.equal((await service.tick(account)).active, false);
});

test('erro no vermelho não dobra chance; mochila cheia e chamadas simultâneas não duplicam peixe', async () => {
  let clock = 0,
    release;
  const account = ensureProgress({ position: shorePosition() });
  const service = createFishingService({
    now: () => clock,
    random: () => 0,
    save: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const start = service.start(account);
  clock = 100;
  assert.equal(service.press(account, start.challenge.id).challenge.boosted, false);
  clock = 600;
  const pending = service.tick(account);
  assert.equal((await service.tick(account)).attempted, false);
  assert.equal(account.inventory[0].quantity, 1);
  release();
  await pending;
  service.stop(account);
  account.inventory = Array.from({ length: 12 }, () => ({ id: 'test_item', quantity: 1 }));
  assert.equal(service.start(account).active, false);
  assert.equal(account.skills.fishing.xp, 10);
});

test('conta antiga recebe skills sem perder outfit e pesca persiste após reabrir banco', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-fishing-'));
  try {
    const store = await openAccountStore(directory);
    const legacy = {
      username: 'Antigo',
      outfit: { type: 'mage', head: 1, body: 7, legs: 15, feet: 15 },
      position: shorePosition(),
    };
    store.accounts.antigo = legacy;
    let clock = 0;
    const service = createFishingService({ save: store.save, random: () => 0, now: () => clock });
    service.start(legacy);
    clock = 600;
    await service.tick(legacy);
    const reopened = await openAccountStore(directory);
    assert.deepEqual(reopened.accounts.antigo.outfit, legacy.outfit);
    assert.equal(reopened.accounts.antigo.skills.fishing.xp, 10);
    assert.equal(reopened.accounts.antigo.inventory[0].quantity, 1);
    assert.equal(reopened.accounts.antigo.inventory.length, 12);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
