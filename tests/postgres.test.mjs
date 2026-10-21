import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { postgresConfig } from '../server/postgres.mjs';
import { openGameStore } from '../server/storage.mjs';
import { createMultiplayer } from '../server/multiplayer.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { DEFAULT_OUTFIT, SPAWN } from '../public/js/config.js';
import { databaseFixture } from './helpers/database.mjs';

test('PostgreSQL valida URL e exige verificação TLS em conexões remotas, inclusive pooler Neon', () => {
  const remote = postgresConfig(
    'postgresql://test:fixture-only@ep-test-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  );
  assert.equal(new URL(remote.connectionString).searchParams.get('sslmode'), 'verify-full');
  assert.equal(remote.enableChannelBinding, true);
  assert.equal(remote.max, 2);
  assert.equal(
    new URL(
      postgresConfig('postgres://test:fixture@127.0.0.1:5432/digla_test').connectionString,
    ).searchParams.get('sslmode'),
    'disable',
  );
  assert.throws(() => postgresConfig('https://private:fixture@example.com/db'), /DATABASE_URL/);
  assert.throws(() => postgresConfig('invalid-private-connection'), /DATABASE_URL/);
});

test('PostgreSQL migra JSON privado uma vez, preserva arquivo e relê o banco após reiniciar', async (t) => {
  const db = await databaseFixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'digla-pg-migration-'));
  const doc = {
    schema: 1,
    accounts: {
      hero: {
        username: 'Hero',
        salt: 'fixture-salt',
        digest: 'fixture-digest',
        inventory: [{ id: 'gold_coin', quantity: 7 }],
        bank: [{ id: 'sword', quantity: 1 }],
        skills: { magic: { xp: 123 } },
      },
    },
    world: {
      groundItems: [{ id: 'test-ground', itemId: 'raw_salmon', quantity: 2, x: 29, y: 27 }],
    },
  };
  try {
    const filename = path.join(directory, 'game.json');
    await writeFile(filename, JSON.stringify(doc));
    const first = await db.open({ directory });
    assert.equal(first.backend, 'postgres');
    first.accounts.hero.inventory[0].quantity = 11;
    await first.save();
    await first.close();
    // A stale file must never overwrite a previously initialized database.
    const second = await db.open({ directory });
    assert.equal(second.accounts.hero.inventory[0].quantity, 11);
    assert.equal(second.accounts.hero.bank[0].id, 'sword');
    assert.equal(second.accounts.hero.skills.magic.xp, 123);
    assert.equal(second.sharedWorld.groundItems[0].quantity, 2);
    assert.equal(Object.getPrototypeOf(second.accounts), null);
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), doc);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('PostgreSQL agrupa movimento/ticks e evita regravar contas sem mudanças', async (t) => {
  const db = await databaseFixture(t),
    store = await db.open();
  store.accounts.hero = { username: 'Hero', position: { x: 29, y: 27 } };
  await store.save();
  db.statements.length = 0;
  for (let i = 0; i < 10; i++) {
    store.accounts.hero.position.x = 30 + i;
    await store.save({ defer: true });
  }
  assert.equal(db.statements.length, 0);
  await store.flush();
  assert.equal(db.statements.filter((s) => s.startsWith('INSERT INTO digla_accounts')).length, 1);
  assert.equal(
    (await db.pool.query('SELECT data FROM digla_accounts')).rows[0].data.position.x,
    39,
  );
  db.statements.length = 0;
  store.sharedWorld.worldRevision = 999;
  await store.save();
  assert.equal(db.statements.length, 0);
  await store.save.background(async () => {
    store.accounts.hero.position.y = 30;
    await store.save();
  });
  assert.equal(db.statements.length, 0);
  await store.close();
  const restored = await db.open();
  assert.equal(restored.accounts.hero.position.y, 30);
});

test('PostgreSQL confirma oferta de troca e mundo em uma única transação durável', async (t) => {
  const db = await databaseFixture(t),
    store = await db.open();
  for (const name of ['alpha', 'beta'])
    store.accounts[name] = ensureProgress({
      username: name,
      outfit: DEFAULT_OUTFIT,
      position: { ...SPAWN },
      inventory: [
        { id: name === 'alpha' ? 'sword' : 'gold_coin', quantity: name === 'alpha' ? 1 : 10 },
      ],
    });
  const mp = createMultiplayer({ ...store, autoStart: false });
  const { alpha: a, beta: b } = store.accounts;
  mp.join(a);
  mp.join(b);
  await store.save();
  await mp.social(a, { action: 'tradeInvite', targetId: b.id });
  const tradeId = mp.initial(a).social.trade.id;
  await mp.social(b, { action: 'tradeAccept', tradeId });
  for (const p of [a, b])
    await mp.social(p, {
      action: 'tradeOffer',
      tradeId,
      items: [{ slot: 0, itemId: p.inventory[0].id, quantity: p.inventory[0].quantity }],
    });
  const revision = mp.initial(a).social.trade.revision;
  await mp.social(a, { action: 'tradeConfirm', tradeId, revision });
  assert.equal(
    (await db.pool.query('SELECT data FROM digla_accounts WHERE account_key = $1', ['alpha']))
      .rows[0].data.inventory[0].id,
    'sword',
  );
  db.statements.length = 0;
  await mp.social(b, { action: 'tradeConfirm', tradeId, revision });
  assert.equal(db.statements.filter((s) => s === 'COMMIT').length, 1);
  assert.equal(db.statements.filter((s) => s.startsWith('INSERT INTO digla_accounts')).length, 2);
  const rows = (await db.pool.query('SELECT account_key, data FROM digla_accounts')).rows;
  assert.equal(
    rows.find((r) => r.account_key === 'alpha').data.inventory.find((i) => i?.id === 'gold_coin')
      .quantity,
    10,
  );
  assert.ok(
    rows.find((r) => r.account_key === 'beta').data.inventory.some((i) => i?.id === 'sword'),
  );
  mp.close();
  await store.close();
  const reloaded = await db.open();
  assert.equal(reloaded.accounts.alpha.inventory.find((i) => i?.id === 'gold_coin').quantity, 10);
});

test('PostgreSQL faz rollback dos dois inventários e do mundo se o commit falhar', async (t) => {
  const db = await databaseFixture(t);
  let fatal = 0;
  const store = await db.open({ onFatal: () => fatal++ });
  store.accounts.a = { inventory: [{ id: 'sword', quantity: 1 }] };
  store.accounts.b = { inventory: [{ id: 'gold_coin', quantity: 7 }] };
  store.sharedWorld.groundItems = [];
  await store.save();
  store.accounts.a.inventory = [{ id: 'gold_coin', quantity: 7 }];
  store.accounts.b.inventory = [{ id: 'sword', quantity: 1 }];
  store.sharedWorld.groundItems = [{ id: 'test' }];
  db.hook((sql, values) => {
    if (sql.startsWith('INSERT INTO digla_accounts') && values[0] === 'b')
      throw new Error('fixture failure; never expose connection credentials');
  });
  await assert.rejects(
    store.save(),
    (error) => error.status === 503 && !error.message.includes('fixture failure'),
  );
  db.hook(null);
  assert.equal(store.healthy, false);
  assert.equal(fatal, 1);
  assert.throws(store.assertWritable, (error) => error.status === 503);
  assert.equal(
    (await db.pool.query('SELECT data FROM digla_accounts WHERE account_key = $1', ['a'])).rows[0]
      .data.inventory[0].id,
    'sword',
  );
  assert.deepEqual(
    (await db.pool.query('SELECT state FROM digla_world')).rows[0].state.groundItems,
    [],
  );
});

test('PostgreSQL impede servidor antigo de sobrescrever o mundo após uma nova implantação', async (t) => {
  const db = await databaseFixture(t),
    old = await db.open();
  old.accounts.hero = { username: 'Hero', inventory: [{ id: 'gold_coin', quantity: 1 }] };
  await old.save();
  const current = await db.open();
  current.accounts.hero.inventory[0].quantity = 2;
  await current.save();
  old.accounts.hero.inventory[0].quantity = 99;
  await assert.rejects(old.save(), /Outra instância/);
  assert.equal(
    (await db.pool.query('SELECT data FROM digla_accounts')).rows[0].data.inventory[0].quantity,
    2,
  );
});

test('PostgreSQL preserva o salvamento mais recente quando um commit está em andamento', async (t) => {
  const db = await databaseFixture(t),
    store = await db.open();
  store.accounts.hero = { gold: 1 };
  await store.save();
  let release, entered;
  const waiting = new Promise((r) => {
      entered = r;
    }),
    gate = new Promise((r) => {
      release = r;
    });
  let first = true;
  db.hook(async (sql) => {
    if (first && sql === 'BEGIN') {
      first = false;
      entered();
      await gate;
    }
  });
  store.accounts.hero.gold = 2;
  const p1 = store.save();
  await waiting;
  store.accounts.hero.gold = 3;
  const p2 = store.save();
  release();
  await Promise.all([p1, p2]);
  assert.equal((await db.pool.query('SELECT data FROM digla_accounts')).rows[0].data.gold, 3);
});

test('DATABASE_URL inválida nunca produz fallback para JSON nem expõe a credencial', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-pg-no-fallback-'));
  try {
    await assert.rejects(
      openGameStore({ directory, connectionString: 'invalid-secret-url' }),
      (error) => !error.message.includes('invalid-secret-url'),
    );
    await assert.rejects(readFile(path.join(directory, 'game.json')), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
