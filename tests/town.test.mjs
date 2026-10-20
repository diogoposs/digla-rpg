import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTownService } from '../server/town.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { ensureTown, BANK_CAPACITY, TOWN_POINTS, shopStock } from '../public/js/game/town-rules.js';
import { openAccountStore } from '../server/storage.mjs';

function account(id = 'food', inventory = []) {
  return ensureTown(
    ensureProgress({ position: { x: TOWN_POINTS[id].x, y: TOWN_POINTS[id].y + 1 }, inventory }),
  );
}
const service = () => createTownService({ save: async () => {} });

test('guardar toda a mochila empilha itens e preserva equipamento; chamadas repetidas não duplicam', async () => {
  const a = account('bank', [
    { id: 'gold_coin', quantity: 12 },
    { id: 'raw_salmon', quantity: 7 },
    { id: 'sword', quantity: 1 },
  ]);
  a.bank[0] = { id: 'raw_salmon', quantity: 3 };
  a.equipment.helmet = { id: 'iron_helmet', quantity: 1 };
  const town = service();
  assert.equal((await town.depositAll(a)).changed, true);
  assert.ok(a.inventory.every((item) => item === null));
  assert.equal(a.bank.find((item) => item?.id === 'raw_salmon').quantity, 10);
  assert.equal(a.bank.find((item) => item?.id === 'gold_coin').quantity, 12);
  assert.equal(a.equipment.helmet.id, 'iron_helmet');
  const bank = structuredClone(a.bank);
  assert.equal((await town.depositAll(a)).changed, false);
  assert.deepEqual(a.bank, bank);
});

test('guardar tudo recusa sem mover nada se faltar espaço ou distância', async () => {
  const a = account('bank', [
    { id: 'raw_salmon', quantity: 2 },
    { id: 'gold_coin', quantity: 3 },
  ]);
  a.bank = Array.from({ length: BANK_CAPACITY }, () => ({ id: 'sword', quantity: 1 }));
  a.bank[0] = { id: 'raw_salmon', quantity: 4 };
  const town = service(),
    before = structuredClone({ inventory: a.inventory, bank: a.bank });
  assert.equal((await town.depositAll(a)).changed, false);
  assert.deepEqual({ inventory: a.inventory, bank: a.bank }, before);
  a.bank = Array(BANK_CAPACITY).fill(null);
  a.position = { x: 29, y: 27 };
  assert.equal((await town.depositAll(a)).changed, false);
  assert.deepEqual(a.inventory, before.inventory);
  assert.ok(a.bank.every((item) => item === null));
});

test('vendedores separam alimentos/equipamentos, cobram um ouro e não negociam moedas', async () => {
  const food = shopStock('food'),
    gear = shopStock('gear');
  assert(food.some((item) => item.id === 'roasted_salmon'));
  assert(gear.some((item) => item.id === 'sword'));
  assert(!food.some((item) => ['sword', 'gold_coin', 'silver_coin'].includes(item.id)));
  assert(!gear.some((item) => ['raw_salmon', 'gold_coin', 'silver_coin'].includes(item.id)));
  assert([...food, ...gear].every((item) => item.price === 1));
  const a = account('food', [{ id: 'gold_coin', quantity: 5 }]),
    town = service();
  assert.equal((await town.open(a, { id: 'food' })).town.available, true);
  assert.equal(
    (await town.buy(a, { id: 'food', itemId: 'roasted_salmon', quantity: 3 })).changed,
    true,
  );
  assert.deepEqual(a.inventory.slice(0, 2), [
    { id: 'gold_coin', quantity: 2 },
    { id: 'roasted_salmon', quantity: 3 },
  ]);
  assert.equal(
    (await town.sell(a, { id: 'food', slot: 1, itemId: 'roasted_salmon', quantity: 2 })).changed,
    true,
  );
  assert.equal(a.inventory[0].quantity, 4);
  assert.equal(a.inventory[1].quantity, 1);
  assert.equal((await town.sell(a, { id: 'food', slot: 0, itemId: 'gold_coin' })).changed, false);
  assert.equal((await town.buy(a, { id: 'food', itemId: 'gold_coin' })).changed, false);
  assert.equal((await town.buy(a, { id: 'food', itemId: 'sword' })).changed, false);
});

test('compra valida saldo, quantidades, mochila e proximidade antes de pagar', async () => {
  const a = account('gear', [
      { id: 'gold_coin', quantity: 5 },
      ...Array.from({ length: 11 }, () => ({ id: 'sword', quantity: 1 })),
    ]),
    town = service();
  const original = structuredClone(a.inventory);
  for (const quantity of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, 6])
    assert.equal((await town.buy(a, { id: 'gear', itemId: 'sword', quantity })).changed, false);
  assert.equal((await town.buy(a, { id: 'gear', itemId: 'sword', quantity: 2 })).changed, false);
  assert.deepEqual(a.inventory, original);
  a.position = { x: 1, y: 1 };
  assert.equal((await town.open(a, { id: 'gear' })).town.available, false);
  assert.equal((await town.buy(a, { id: 'gear', itemId: 'staff' })).changed, false);
  assert.deepEqual(a.inventory, original);
  a.position = { x: TOWN_POINTS.gear.x, y: TOWN_POINTS.gear.y + 1 };
  a.inventory[0].quantity = 1;
  assert.equal((await town.buy(a, { id: 'gear', itemId: 'staff' })).changed, true);
  assert.deepEqual(a.inventory[0], { id: 'staff', quantity: 1 });
});

test('venda só altera origem se houver espaço para receber ouro, usando espaço liberado', async () => {
  const a = account(
      'food',
      Array.from({ length: 12 }, () => ({ id: 'raw_salmon', quantity: 2 })),
    ),
    town = service();
  assert.equal(
    (await town.sell(a, { id: 'food', slot: 0, itemId: 'raw_salmon', quantity: 1 })).changed,
    false,
  );
  assert.equal(a.inventory[0].quantity, 2);
  assert.equal(
    (await town.sell(a, { id: 'food', slot: 0, itemId: 'raw_salmon', quantity: 2 })).changed,
    true,
  );
  assert.deepEqual(a.inventory[0], { id: 'gold_coin', quantity: 2 });
  assert.equal(
    (await town.sell(a, { id: 'food', slot: 1, itemId: 'roasted_salmon' })).changed,
    false,
  );
  assert.equal(a.inventory[1].quantity, 2);
});

test('banco guarda pilhas e equipamentos em 48 espaços sem alterar outros inventários', async () => {
  const a = account('bank', [
      { id: 'raw_salmon', quantity: 8 },
      { id: 'sword', quantity: 1 },
    ]),
    town = service();
  assert.equal(a.bank.length, BANK_CAPACITY);
  assert.equal(
    (await town.deposit(a, { slot: 0, itemId: 'raw_salmon', quantity: 5 })).changed,
    true,
  );
  assert.equal(a.inventory[0].quantity, 3);
  assert.deepEqual(a.bank[0], { id: 'raw_salmon', quantity: 5 });
  assert.equal((await town.deposit(a, { slot: 1, itemId: 'sword', quantity: 1 })).changed, true);
  assert.equal(a.inventory[1], null);
  assert.deepEqual(a.bank[1], { id: 'sword', quantity: 1 });
  assert.equal(
    (await town.withdraw(a, { slot: 0, itemId: 'raw_salmon', quantity: 2 })).changed,
    true,
  );
  assert.equal(a.bank[0].quantity, 3);
  assert.equal(a.inventory[0].quantity, 5);
  assert.equal(account('bank').bank.filter(Boolean).length, 0);
});

test('banco cheio, mochila cheia, item desatualizado e distância não perdem itens', async () => {
  const a = account('bank', [{ id: 'staff', quantity: 1 }]),
    town = service();
  a.bank = Array.from({ length: BANK_CAPACITY }, () => ({ id: 'sword', quantity: 1 }));
  assert.equal((await town.deposit(a, { slot: 0, itemId: 'staff', quantity: 1 })).changed, false);
  assert.equal(a.inventory[0].id, 'staff');
  a.inventory = Array.from({ length: 12 }, () => ({ id: 'staff', quantity: 1 }));
  const beforeBank = structuredClone(a.bank),
    beforeBag = structuredClone(a.inventory);
  assert.equal((await town.withdraw(a, { slot: 0, itemId: 'sword', quantity: 1 })).changed, false);
  assert.equal((await town.withdraw(a, { slot: 0, itemId: 'staff', quantity: 1 })).changed, false);
  assert.deepEqual(a.bank, beforeBank);
  assert.deepEqual(a.inventory, beforeBag);
  a.position = { x: 1, y: 1 };
  assert.equal((await town.withdraw(a, { slot: 0, itemId: 'sword' })).changed, false);
  assert.equal((await town.deposit(a, { slot: 0, itemId: 'staff' })).changed, false);
  assert.deepEqual(a.bank, beforeBank);
  assert.deepEqual(a.inventory, beforeBag);
});

test('comprar vários equipamentos cria slots separados e ouro no banco não paga a compra', async () => {
  const a = account('gear', [{ id: 'gold_coin', quantity: 2 }]),
    town = service();
  a.bank[0] = { id: 'gold_coin', quantity: 100 };
  assert.equal((await town.buy(a, { id: 'gear', itemId: 'sword', quantity: 3 })).changed, false);
  assert.equal((await town.buy(a, { id: 'gear', itemId: 'sword', quantity: 2 })).changed, true);
  assert.deepEqual(a.inventory.slice(0, 2), [
    { id: 'sword', quantity: 1 },
    { id: 'sword', quantity: 1 },
  ]);
  assert.equal(a.bank[0].quantity, 100);
});

test('itens do banco são persistidos e recuperados ao abrir as contas novamente', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-town-'));
  try {
    const store = await openAccountStore(directory);
    store.accounts.tester = account('bank', [{ id: 'roasted_salmon', quantity: 7 }]);
    const town = createTownService({ save: store.save });
    await town.deposit(store.accounts.tester, { slot: 0, itemId: 'roasted_salmon', quantity: 4 });
    const reloaded = await openAccountStore(directory);
    assert.deepEqual(reloaded.accounts.tester.bank[0], { id: 'roasted_salmon', quantity: 4 });
    assert.equal(reloaded.accounts.tester.inventory[0].quantity, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
