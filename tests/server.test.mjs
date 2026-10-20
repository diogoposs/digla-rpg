import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_OUTFIT, SPAWN, WIDTH, HEIGHT, STOVE, WELL } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';
import { nearWater } from '../public/js/game/fishing-rules.js';
import { MOB_DEFINITIONS } from '../public/js/game/world-rules.js';
import { TOWN_POINTS } from '../public/js/game/town-rules.js';
import { FLOOR_LINKS } from '../public/js/world/elevation.js';

test('contas, autenticação, colisão e persistência local', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'digla-test-'));
  let child;
  async function start() {
    child = spawn(process.execPath, ['tests/helpers/legacy-server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, PORT: '0', DIGLA_DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Servidor não iniciou.')), 10000);
      child.once('error', reject);
      child.stdout.on('data', (data) => {
        const match = /localhost:(\d+)/.exec(data.toString());
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Servidor encerrou: ${code}`));
      });
    });
  }
  async function stop() {
    if (child && child.exitCode === null)
      await new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
      });
  }
  try {
    let base = await start();
    let cookie = '';
    async function request(route, data, withCookie = true) {
      const response = await fetch(base + '/api/' + route, {
        method: data === undefined ? 'GET' : 'POST',
        headers: {
          ...(withCookie ? { cookie } : {}),
          ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get('set-cookie'),
      };
    }
    const credentials = {
      username: 'Aventureiro',
      password: 'senha-segura',
      outfit: { ...DEFAULT_OUTFIT, type: 'mage', body: 7 },
    };
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base + '/data/accounts.json')).status, 404);
    const moduleResponse = await fetch(base + '/js/graphics/character.js');
    assert.equal(moduleResponse.status, 200);
    assert.match(moduleResponse.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(base + '/styles/game.css')).status, 200);
    assert.equal((await fetch(base + '/server/storage.mjs')).status, 404);
    assert.equal((await fetch(base + '/js/%2e%2e%2f%2e%2e%2fdata/accounts.json')).status, 404);
    assert.equal((await request('session')).status, 401);
    assert.equal((await request('register', { ...credentials, password: 'abc' })).status, 400);
    assert.equal(
      (await request('register', { ...credentials, outfit: { ...DEFAULT_OUTFIT, head: 999 } }))
        .status,
      400,
    );
    const registered = await request('register', credentials);
    assert.equal(registered.status, 201);
    assert.equal(registered.body.username, 'Aventureiro');
    assert.equal(registered.body.outfit.type, 'mage');
    assert.deepEqual(registered.body.position, SPAWN);
    assert.match(registered.cookie, /HttpOnly/);
    assert.match(registered.cookie, /SameSite=Strict/);
    assert.equal(registered.body.digest, undefined);
    cookie = registered.cookie.split(';')[0];
    assert.equal((await request('session')).status, 200);
    const invalidCast = await request('world/cast', { key: 'q' });
    assert.equal(invalidCast.status, 200);
    assert.equal(invalidCast.body.cast, false);
    assert.equal((await request('fishing/start', {})).body.active, false);
    assert.equal((await request('session')).body.skills.fishing.level, 1);
    assert.equal((await request('session')).body.inventory.length, 12);
    assert.equal((await request('session')).body.skills.cooking.level, 1);
    assert.equal((await request('world/tick', {})).body.orc.maxHealth, 30);
    const sandbox = await request('world/adventure', { action: 'settings', enabled: true });
    assert.equal(sandbox.body.gameSettings.testMode, true);
    assert.equal(sandbox.body.orc.maxHealth, 300);
    assert.equal(
      (await request('world/adventure', { action: 'settings', enabled: false })).body.orc.maxHealth,
      30,
    );
    assert.equal(
      (await request('world/adventure', { action: 'accept', id: 'kitchen' })).body.quests.kitchen,
      undefined,
    );
    const initialMobs = (await request('session')).body.mobs;
    assert.equal(initialMobs.length, Object.keys(MOB_DEFINITIONS).length);
    assert.equal(initialMobs.find((mob) => mob.id === 'fire_elemental').health, 50);
    assert.equal(initialMobs.find((mob) => mob.id === 'fire_elemental').weakness, 'water');
    assert.equal(initialMobs.find((mob) => mob.id === 'water_elemental').weakness, 'lightning');
    assert.equal(initialMobs.find((mob) => mob.id === 'orc').weakness, 'lightning');
    assert.equal((await request('position', MOB_DEFINITIONS.fire_elemental.spawn)).status, 409);
    assert.equal((await request('session')).body.skills.combat.level, 1);
    assert.equal(
      (
        await request('items/transfer', {
          source: 'loot',
          corpseId: 'missing',
          slot: 0,
          itemId: 'staff',
          target: 'equipment',
        })
      ).body.transferred,
      undefined,
    );
    assert.equal((await request('items/element', { element: 'water' })).body.attackElement, 'fire');
    assert.equal(
      (await request('items/use', { slot: 0, itemId: 'raw_salmon' })).body.consumed,
      undefined,
    );
    assert.equal((await request('position', MOB_DEFINITIONS.orc.spawn)).status, 409);
    assert.equal((await request('cooking/open', {})).body.available, false);
    assert.equal((await request('position', { x: STOVE.x - 1, y: STOVE.y })).status, 200);
    assert.equal((await request('cooking/open', {})).body.available, true);
    assert.equal(
      (await request('cooking/start', { recipe: 'salmon', quantity: 1 })).body.active,
      false,
    );
    assert.equal((await request('position', STOVE)).status, 400);
    assert.equal((await request('position', SPAWN)).status, 200);
    assert.equal((await request('world/heal', {})).body.healed, undefined);
    assert.equal((await request('position', { x: WELL.x - 1, y: WELL.y + 1 })).status, 200);
    assert.equal((await request('world/heal', {})).body.healed, true);
    assert.equal((await request('position', SPAWN)).status, 200);
    assert.equal(
      (await request('register', { ...credentials, username: 'AVENTUREIRO' })).status,
      409,
    );
    assert.equal(
      (await request('login', { username: credentials.username, password: 'errada-123' })).status,
      401,
    );
    assert.equal((await request('position', { x: 44, y: 31 })).status, 400);
    assert.equal((await request('position', { x: 23, y: 18 })).status, 400);
    assert.equal((await request('position', WELL)).status, 400);
    assert.equal((await request('position', { x: -1, y: 0 })).status, 400);
    assert.equal((await request('position', { x: 29.2, y: 27 })).status, 400);
    let shore;
    for (let y = 20; y < 40 && !shore; y++)
      for (let x = 35; x < 50; x++) {
        if (walkable(x, y) && nearWater({ x, y })) {
          shore = { x, y };
          break;
        }
      }
    assert.equal((await request('position', shore)).status, 200);
    const cast = await request('fishing/start', {});
    assert.equal(cast.status, 200);
    assert.equal(cast.body.active, true);
    assert.equal((await request('fishing/tick', {})).body.attempted, false);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const fishingTick = await request('fishing/tick', {});
    assert.equal(fishingTick.body.attempted, true);
    const fishingXp = fishingTick.body.caught ? 10 : 0;
    assert.equal(fishingTick.body.skills.fishing.totalXp, fishingXp);
    assert.equal((await request('session')).body.skills.fishing.totalXp, fishingXp);
    assert.equal((await request('fishing/tick', {})).body.attempted, false);
    assert.equal((await request('position', { x: 28, y: 27 })).status, 200);
    assert.deepEqual((await request('session')).body.position, { x: 28, y: 27 });
    assert.equal((await request('fishing/tick', {})).body.active, false);
    const database = JSON.parse(await readFile(path.join(dataDir, 'accounts.json'), 'utf8'));
    assert.ok(database.aventureiro.salt);
    assert.equal(database.aventureiro.digest.length, 128);
    assert.ok(!JSON.stringify(database).includes(credentials.password));
    const forbidden = await fetch(base + '/api/logout', {
      method: 'POST',
      headers: { origin: 'http://malicious.example', cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await request('logout', {})).status, 200);
    assert.equal((await request('session')).status, 401);
    assert.equal((await request('position', { x: 28, y: 27 })).status, 401);
    // Special object keys must remain ordinary account names, including after JSON persistence.
    assert.equal(
      (await request('register', { ...credentials, username: '__proto__' })).status,
      201,
    );
    await stop();
    // Seed only the isolated test database to exercise commerce through real HTTP routes.
    const saved = JSON.parse(await readFile(path.join(dataDir, 'accounts.json'), 'utf8'));
    saved.aventureiro.inventory = [
      { id: 'gold_coin', quantity: 10 },
      { id: 'raw_salmon', quantity: 2 },
      { id: 'iron_helmet', quantity: 1 },
    ];
    saved.aventureiro.bank = [{ id: 'roasted_salmon', quantity: 9 }];
    saved.aventureiro.groundItems = [
      { id: 'expired', itemId: 'gold_coin', quantity: 5, x: 28, y: 27 },
    ];
    saved.aventureiro.nextGroundCleanupAt = Date.now() - 100;
    await writeFile(path.join(dataDir, 'accounts.json'), JSON.stringify(saved));
    base = await start();
    const login = await request('login', {
      username: 'aventureiro',
      password: credentials.password,
    });
    assert.equal(login.status, 200);
    assert.deepEqual(login.body.position, { x: 28, y: 27 });
    assert.deepEqual(login.body.outfit, credentials.outfit);
    assert.equal(login.body.skills.fishing.totalXp, fishingXp);
    cookie = login.cookie.split(';')[0];
    assert.deepEqual(login.body.groundItems, []);
    assert.ok(login.body.nextGroundCleanupAt > Date.now());
    assert.equal(login.body.bank.length, 48);
    assert.equal(login.body.bank[0].quantity, 9);
    assert.equal((await request('town/open', { id: 'food' })).body.town.available, false);
    const food = TOWN_POINTS.food;
    assert.equal((await request('position', { x: food.x + 1, y: food.y })).status, 200);
    assert.equal((await request('town/open', { id: 'food' })).body.town.available, true);
    assert.equal(
      (await request('town/buy', { id: 'food', itemId: 'raw_salmon' })).body.changed,
      true,
    );
    assert.equal(
      (await request('town/sell', { id: 'food', slot: 1, itemId: 'raw_salmon' })).body.changed,
      true,
    );
    const dice = TOWN_POINTS.dice;
    assert.equal((await request('position', { x: dice.x + 1, y: dice.y })).status, 200);
    assert.equal((await request('town/open', { id: 'dice' })).body.town.available, true);
    const bet = { id: 'dice', choice: 'low', amount: 3, requestId: 'http-dice-001' };
    const beforeBet = (await request('session')).body.inventory.find(
      (item) => item?.id === 'gold_coin',
    ).quantity;
    const wager = await request('town/bet', bet);
    assert.equal(wager.status, 200);
    assert.ok(wager.body.dice.roll >= 1 && wager.body.dice.roll <= 6);
    assert.equal(wager.body.dice.won, wager.body.dice.roll <= 3);
    const afterBet = wager.body.inventory.find((item) => item?.id === 'gold_coin').quantity;
    assert.equal(afterBet, beforeBet + (wager.body.dice.won ? 3 : -3));
    const duplicateBet = await request('town/bet', bet);
    assert.deepEqual(duplicateBet.body.dice, wager.body.dice);
    assert.equal(
      duplicateBet.body.inventory.find((item) => item?.id === 'gold_coin').quantity,
      afterBet,
    );
    const bank = TOWN_POINTS.bank;
    assert.equal((await request('position', { x: bank.x - 1, y: bank.y })).status, 200);
    assert.equal(
      (await request('town/deposit', { slot: 2, itemId: 'iron_helmet' })).body.changed,
      true,
    );
    assert.equal(
      (await request('town/withdraw', { slot: 0, itemId: 'roasted_salmon', quantity: 3 })).body
        .changed,
      true,
    );
    assert.equal((await request('town/depositAll', {})).body.changed, true);
    assert.ok((await request('session')).body.inventory.every((item) => item === null));
    const storedBank = (await request('session')).body.bank;
    assert.equal(storedBank.find((item) => item?.id === 'roasted_salmon').quantity, 9);
    assert.ok(storedBank.some((item) => item?.id === 'iron_helmet'));
    const persisted = JSON.parse(await readFile(path.join(dataDir, 'accounts.json'), 'utf8'));
    assert.deepEqual(persisted.aventureiro.bank, storedBank);
    const mountain = FLOOR_LINKS.find((link) => link.id === 'orc-mountain-in'),
      back = FLOOR_LINKS.find((link) => link.id === 'orc-mountain-out');
    assert.equal((await request('position', back.to)).status, 200);
    assert.equal((await request('position', mountain.to)).status, 200);
    assert.equal((await request('session')).body.position.z, 1);
    assert.equal((await request('position', { x: 29, y: 27, z: 0 })).status, 409);
    assert.equal((await request('position', { ...mountain.to, z: 99 })).status, 400);
    assert.equal((await request('position', back.to)).status, 200);
    assert.equal((await request('position', mountain.to)).status, 200);
    persisted.aventureiro.position = mountain.to;
    // The server also runs cleanup without a connected player or a world/tick request.
    await stop();
    persisted.aventureiro.groundItems = [
      { id: 'background', itemId: 'raw_salmon', quantity: 2, x: 28, y: 27 },
    ];
    persisted.aventureiro.nextGroundCleanupAt = Date.now() + 350;
    await writeFile(path.join(dataDir, 'accounts.json'), JSON.stringify(persisted));
    base = await start();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const background = JSON.parse(await readFile(path.join(dataDir, 'accounts.json'), 'utf8'));
    assert.deepEqual(background.aventureiro.groundItems, []);
    assert.deepEqual(background.aventureiro.bank, storedBank);
    const elevatedLogin = await request('login', {
      username: 'aventureiro',
      password: credentials.password,
    });
    assert.deepEqual(elevatedLogin.body.position, mountain.to);
    assert.equal(
      (await request('login', { username: '__proto__', password: credentials.password })).status,
      200,
    );
  } finally {
    await stop();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('o ponto inicial tem acesso à área explorável sem atravessar obstáculos', () => {
  assert.ok(walkable(SPAWN.x, SPAWN.y));
  const visited = new Set([`${SPAWN.x},${SPAWN.y}`]),
    queue = [SPAWN];
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${x},${y}`;
      if (!visited.has(key) && walkable(x, y)) {
        visited.add(key);
        queue.push({ x, y });
      }
    }
  }
  assert.ok(visited.size > 1500, `Só ${visited.size} tiles acessíveis`);
  for (let x = 0; x < WIDTH; x++) {
    assert.ok(!walkable(x, 0));
    assert.ok(!walkable(x, HEIGHT - 1));
  }
});
