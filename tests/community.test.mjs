import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MOB_DEFINITIONS, getMobs } from '../public/js/game/world-rules.js';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { GAME_VERSION } from '../public/js/config.js';
import { createWorldService } from '../server/world.mjs';
import { createTownService } from '../server/town.mjs';
import { TOWN_POINTS, BANK_HALL } from '../public/js/game/town-rules.js';
import { floorOf, isSafeZone } from '../public/js/world/elevation.js';
import { walkable, houseAt, houseDoor, tileAt } from '../public/js/world/map.js';
import { ITEMS } from '../public/js/items.js';
import { lookItem } from '../public/js/game/look-rules.js';
import { minimapView, minimapTile } from '../public/js/game/minimap.js';
import { isolateMobs } from './helpers/combat.mjs';
import { openAccountStore } from '../server/storage.mjs';

const diceAccount = (inventory = [{ id: 'gold_coin', quantity: 10 }]) =>
  ensureProgress({ position: { x: TOWN_POINTS.dice.x + 1, y: TOWN_POINTS.dice.y }, inventory });

test('banco deixa estrada livre, Dário fica dentro e cozinha abre para o norte', () => {
  assert.equal(walkable(29, 36), true);
  assert.equal(tileAt(29, 36), 'cobble');
  assert.equal(houseAt(TOWN_POINTS.dice.x, TOWN_POINTS.dice.y), BANK_HALL);
  assert.equal(walkable(37, 34), true);
  assert.equal(tileAt(37, 33), 'cobble');
  const kitchen = houseAt(21, 30);
  assert.deepEqual(houseDoor(kitchen), { x: 20, y: 29 });
  assert.equal(walkable(20, 29), true);
  assert.equal(walkable(20, 32), false);
  assert.equal(tileAt(20, 28), 'cobble');
});

test('Olhar usa ATK e ARM do catálogo em todos os equipamentos de proteção', () => {
  assert.equal(ITEMS.staff.atk, 1);
  assert.equal(ITEMS.sword.atk, 2);
  assert.match(lookItem('staff'), /ATK: 1/);
  assert.match(lookItem('sword'), /ATK: 2/);
  for (const [id, item] of Object.entries(ITEMS)) {
    if (['helmet', 'armor', 'legs', 'boots', 'shield'].includes(item.equipmentSlot)) {
      assert.equal(item.arm, id === 'reinforced_armor' ? 2 : 1);
      assert.ok(lookItem(id).includes(`ARM: ${item.arm}`));
    }
  }
});
test('dragão e todos os mobs de água causam no máximo 1 a cada 5 segundos, sem dano por spam', async () => {
  for (const [id, definition] of Object.entries(MOB_DEFINITIONS).filter(
    ([id, mob]) => id === 'fire_drake' || mob.kind === 'water',
  )) {
    const spawn = definition.spawn,
      z = floorOf(spawn);
    const position = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: spawn.x + dx, y: spawn.y + dy, z }))
      .find((p) => walkable(p.x, p.y, z));
    const account = isolateMobs(ensureProgress({ position }), [id]);
    let time = 0;
    const service = createWorldService({
      save: async () => {},
      random: () => 0.99999,
      now: () => time,
    });
    await service.tick(account);
    for (time = 250; time < 5000; time += 250) await service.tick(account);
    assert.equal(account.vitals.health, 100, id);
    await service.tick(account);
    assert.equal(account.vitals.health, 99, id);
    for (let i = 0; i < 5; i++) await service.tick(account);
    assert.equal(account.vitals.health, 99, id);
    for (time = 5250; time <= 10000; time += 250) await service.tick(account);
    assert.equal(account.vitals.health, 98, id);
  }
});

test('baixo 1–3 e alto 4–6 pagam 2x a aposta, descontando o valor apostado antes', async () => {
  for (let roll = 1; roll <= 6; roll++)
    for (const choice of ['low', 'high']) {
      const account = diceAccount(),
        service = createTownService({
          save: async () => {},
          random: () => (roll - 1) / 6 + 0.0001,
        });
      const result = await service.bet(account, {
        choice,
        amount: 3,
        requestId: `roll-${choice}-${roll}`,
      });
      const win = choice === 'low' ? roll <= 3 : roll >= 4;
      assert.equal(result.dice.roll, roll);
      assert.equal(result.dice.won, win);
      assert.equal(result.dice.payout, win ? 6 : 0);
      assert.equal(
        account.inventory.filter(Boolean).reduce((sum, item) => sum + item.quantity, 0),
        win ? 13 : 7,
      );
    }
});

test('apostas inválidas, distantes, em outro piso ou sem ouro não removem moedas nem rolam dado', async () => {
  const account = diceAccount(),
    service = createTownService({
      save: async () => {},
      random: () => {
        throw new Error('Não deve rolar');
      },
    });
  const before = JSON.stringify(account.inventory);
  for (const data of [
    { choice: 'other', amount: 1 },
    { choice: 'low', amount: 0 },
    { choice: 'low', amount: -1 },
    { choice: 'low', amount: 1.5 },
    { choice: 'high', amount: 11 },
    { choice: 'low', amount: Number.MAX_SAFE_INTEGER },
  ])
    assert.equal(
      (await service.bet(account, { ...data, requestId: 'invalid-request' })).changed,
      false,
    );
  assert.equal(JSON.stringify(account.inventory), before);
  account.position.z = -1;
  assert.equal(
    (await service.bet(account, { choice: 'low', amount: 1, requestId: 'wrong-floor-1' })).changed,
    false,
  );
  account.position = { x: 29, y: 27 };
  assert.equal(
    (await service.bet(account, { choice: 'low', amount: 1, requestId: 'too-distant-1' })).changed,
    false,
  );
  const silver = diceAccount([{ id: 'silver_coin', quantity: 10 }]);
  silver.bank[0] = { id: 'gold_coin', quantity: 100 };
  assert.equal(
    (await service.bet(silver, { choice: 'low', amount: 1, requestId: 'silver-not-gold' })).changed,
    false,
  );
  assert.equal(silver.inventory[0].quantity, 10);
});

test('a mesma aposta simultânea e após reabrir a conta não cobra nem sorteia duas vezes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'digla-dice-'));
  try {
    const store = await openAccountStore(dir),
      account = (store.accounts.player = diceAccount());
    let rolls = 0;
    const service = createTownService({
      save: store.save,
      random: () => {
        rolls++;
        return 0;
      },
    });
    const wager = { choice: 'low', amount: 3, requestId: 'single-bet-request' };
    const [first, second] = await Promise.all([
      service.bet(account, wager),
      service.bet(account, wager),
    ]);
    assert.deepEqual(first.dice, second.dice);
    assert.equal(rolls, 1);
    assert.equal(account.inventory[0].quantity, 13);
    const loaded = (await openAccountStore(dir)).accounts.player;
    await createTownService({
      save: async () => {},
      random: () => {
        throw new Error('Repetiu RNG');
      },
    }).bet(loaded, wager);
    assert.equal(loaded.inventory[0].quantity, 13);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('quatro bancos acessam o mesmo depósito e o salão é protegido', async () => {
  const banks = Object.values(TOWN_POINTS).filter((point) => point.kind === 'bank');
  assert.equal(banks.length, 4);
  const account = ensureProgress({
    position: { x: banks[0].x + 1, y: banks[0].y },
    inventory: [{ id: 'gold_coin', quantity: 7 }],
  });
  const service = createTownService({ save: async () => {} });
  assert.equal((await service.depositAll(account, { id: banks[0].id })).changed, true);
  account.position = { x: banks[3].x - 1, y: banks[3].y };
  assert.equal(
    (
      await service.withdraw(account, {
        id: banks[3].id,
        slot: 0,
        itemId: 'gold_coin',
        quantity: 7,
      })
    ).changed,
    true,
  );
  assert.equal(account.inventory[0].quantity, 7);
  for (let y = BANK_HALL.y + 1; y < BANK_HALL.y + BANK_HALL.h - 1; y++)
    for (let x = BANK_HALL.x + 1; x < BANK_HALL.x + BANK_HALL.w - 1; x++) {
      assert.equal(isSafeZone({ x, y }), true);
    }
});

test('zoom do minimapa limita a janela e converte cliques para tiles reais', () => {
  const position = { x: 29, y: 27, z: 0 },
    target = {
      width: 256,
      height: 220,
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 512, height: 440 }),
    };
  const full = minimapView(position, 1),
    close = minimapView(position, 8);
  assert.equal(close.width, full.width / 8);
  assert.equal(close.height, full.height / 8);
  const world = { x: 39, y: 27 };
  const clientX = 100 + ((world.x + 0.5 - close.left) / close.width) * 512,
    clientY = 50 + ((world.y + 0.5 - close.top) / close.height) * 440;
  assert.deepEqual(minimapTile(target, clientX, clientY, position, 8), { ...world, z: 0 });
  assert.equal(minimapView({ x: 0, y: 0 }, 8).left, 0);
});

test('versão é publicada e monstros desconhecidos ou salvos perto do templo são removidos/reposicionados', () => {
  const account = ensureProgress({
    position: { x: 29, y: 27 },
    worldLayoutVersion: 1,
    orc: { x: 29, y: 14, health: 30 },
    elementals: { phantom: { id: 'phantom', x: 30, y: 27, health: 100 } },
  });
  assert.equal(publicProgress(account).gameVersion, GAME_VERSION);
  assert.equal(account.elementals.phantom, undefined);
  assert.ok(getMobs(account).every((mob) => !isSafeZone(mob)));
});
