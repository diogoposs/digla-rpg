import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroundCleanup } from '../server/ground-cleanup.mjs';
import { createWorldService } from '../server/world.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { GROUND_CLEANUP_INTERVAL_MS as INTERVAL } from '../public/js/game/world-rules.js';

test('ciclo de 15 minutos remove só itens soltos e não é adiado ao movê-los', async () => {
  let time = 1000,
    saves = 0;
  const account = ensureProgress({
    position: { x: 29, y: 27 },
    inventory: [{ id: 'raw_salmon', quantity: 2 }],
    equipment: { helmet: { id: 'iron_helmet', quantity: 1 } },
    bank: [{ id: 'gold_coin', quantity: 50 }],
    groundItems: [{ id: 'fish', itemId: 'raw_salmon', quantity: 3, x: 28, y: 27 }],
    corpse: { id: 'body', x: 29, y: 14, slots: [{ id: 'gold_coin', quantity: 7 }] },
  });
  const safe = JSON.stringify([account.inventory, account.equipment, account.bank, account.corpse]);
  const cleanup = createGroundCleanup({
    now: () => time,
    save: async () => {
      saves++;
    },
  });
  assert.equal(await cleanup.sweep(account), 0);
  assert.equal(account.nextGroundCleanupAt, 1000 + INTERVAL);
  time += INTERVAL - 1;
  account.groundItems[0].x = 30;
  assert.equal(await cleanup.sweep(account), 0);
  assert.equal(account.groundItems.length, 1);
  time++;
  assert.equal(await cleanup.sweep(account), 1);
  assert.deepEqual(account.groundItems, []);
  assert.equal(account.nextGroundCleanupAt, 1000 + 2 * INTERVAL);
  assert.equal(
    JSON.stringify([account.inventory, account.equipment, account.bank, account.corpse]),
    safe,
  );
  assert.equal(saves, 2);
  assert.equal(account.worldRevision, 1);
});

test('reabrir uma conta aplica ciclos vencidos e mantém a próxima data persistida', async () => {
  let time = 1000;
  const cleanup = createGroundCleanup({ now: () => time, save: async () => {} });
  const account = { groundItems: [{ id: 'a' }] };
  await cleanup.sweep(account);
  const reopened = JSON.parse(JSON.stringify(account));
  time += 3 * INTERVAL + 123;
  await cleanup.sweep(reopened);
  assert.deepEqual(reopened.groundItems, []);
  assert.equal(reopened.nextGroundCleanupAt, 1000 + 4 * INTERVAL);
  reopened.groundItems.push({ id: 'new' });
  await cleanup.sweep(reopened);
  assert.equal(reopened.groundItems.length, 1);
});

test('limpeza periódica alcança todas as contas sem depender de um jogador conectado', async () => {
  const accounts = {
    first: { nextGroundCleanupAt: 100, groundItems: [{ id: 'a' }] },
    second: { nextGroundCleanupAt: 100, groundItems: [{ id: 'b' }, { id: 'c' }] },
    later: { nextGroundCleanupAt: 200, groundItems: [{ id: 'd' }] },
  };
  await createGroundCleanup({ now: () => 100, save: async () => {} }).sweepAll(accounts);
  assert.deepEqual(accounts.first.groundItems, []);
  assert.deepEqual(accounts.second.groundItems, []);
  assert.equal(accounts.later.groundItems.length, 1);
});

test('tick do mundo publica o chão limpo e preserva inventário e banco', async () => {
  const account = ensureProgress({
    position: { x: 29, y: 27 },
    nextGroundCleanupAt: 100,
    inventory: [{ id: 'sword', quantity: 1 }],
    bank: [{ id: 'roasted_salmon', quantity: 9 }],
    groundItems: [{ id: 'coin', itemId: 'gold_coin', quantity: 8, x: 28, y: 27 }],
  });
  const service = createWorldService({ now: () => 100, save: async () => {} });
  const result = await service.tick(account);
  assert.deepEqual(result.groundItems, []);
  assert.ok(result.events.some((event) => event.type === 'ground-cleanup' && event.count === 1));
  assert.equal(account.inventory[0].id, 'sword');
  assert.equal(account.bank[0].quantity, 9);
});
