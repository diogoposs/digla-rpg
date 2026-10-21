import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { scryptSync } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import { openMultiplayerStore } from '../server/storage.mjs';
import { createMultiplayer } from '../server/multiplayer.mjs';
import { getMobs } from '../public/js/game/world-rules.js';
import { DEFAULT_OUTFIT, GAME_VERSION } from '../public/js/config.js';
import { databaseFixture } from './helpers/database.mjs';

for (const backend of ['json', ...(process.env.TEST_DATABASE_URL ? ['postgres'] : [])])
  test(`servidor de produção (${backend}): mundo compartilhado, tick independente, privacidade e reinício`, async (t) => {
    const database = backend === 'postgres' ? await databaseFixture(t) : null;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'digla-http-multiplayer-'));
    let child, base;
    const cookies = {};
    async function start(hostingEnv = {}) {
      child = spawn(process.execPath, ['server.mjs'], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          PORT: '0',
          HOST: '127.0.0.1',
          DIGLA_DATA_DIR: directory,
          DIGLA_TEST_MODE: '0',
          PUBLIC_ORIGIN: '',
          RENDER_EXTERNAL_URL: '',
          DIGLA_TEMPORARY_SAVES: '0',
          DATABASE_URL: database?.connectionString || '',
          ...hostingEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      base = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Servidor não iniciou.')), 10000);
        child.once('error', reject);
        child.stdout.on('data', (chunk) => {
          const port = /localhost:(\d+)/.exec(chunk.toString())?.[1];
          if (port) {
            clearTimeout(timer);
            resolve('http://127.0.0.1:' + port);
          }
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error('Servidor encerrou: ' + code));
        });
      });
    }
    async function stop() {
      if (child?.exitCode === null) {
        const done = once(child, 'exit');
        child.kill();
        await done;
      }
    }
    async function api(name, route, data, headers = {}) {
      const response = await fetch(base + '/api/' + route, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { cookie: cookies[name] || '', 'Content-Type': 'application/json', ...headers },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const cookie = response.headers.get('set-cookie');
      if (cookie) cookies[name] = cookie.split(';')[0];
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    const login = (name) => api(name, 'login', { username: name, password: 'test-http-only' });
    try {
      const store = database ? await database.open() : await openMultiplayerStore(directory);
      for (const [i, name] of ['Alpha', 'Beta'].entries())
        store.accounts[name.toLowerCase()] = {
          username: name,
          salt: 'fixture-only-salt',
          digest: scryptSync('test-http-only', 'fixture-only-salt', 64).toString('hex'),
          outfit: DEFAULT_OUTFIT,
          position: { x: 86 + i, y: 27 },
          inventory: i ? [] : [{ id: 'gold_coin', quantity: 7 }],
        };
      const seed = createMultiplayer({ ...store, autoStart: false });
      for (const mob of getMobs(store.accounts.alpha))
        if (mob.id !== 'orc') {
          mob.health = 0;
          mob.respawnAt = Number.MAX_SAFE_INTEGER;
        }
      await store.save();
      seed.close();
      await store.close();
      await start();
      assert.deepEqual(await (await fetch(base + '/healthz')).json(), {
        status: 'ok',
        gameVersion: GAME_VERSION,
      });
      assert.equal((await api('', 'server-info')).body.temporarySaves, false);
      assert.equal((await api('', 'server-info')).body.storage, backend);
      assert.equal((await api('', 'session')).status, 401);
      for (const name of ['Alpha', 'Beta']) {
        const r = await login(name);
        assert.equal(r.status, 200);
        assert.equal(r.body.multiplayer, true);
        assert.equal(r.body.digest, undefined);
        assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
      }
      const b = (await api('Beta', 'world/tick', {})).body;
      assert.equal(b.players[0].username, 'Alpha');
      for (const privateKey of ['salt', 'digest', 'inventory', 'bank', 'quests'])
        assert.equal(privateKey in b.players[0], false);
      assert.equal((await api('Alpha', 'position', { x: 100, y: 100 })).status, 409);
      assert.equal(
        (await api('Alpha', 'world/adventure', { action: 'settings', testMode: true })).body
          .gameSettings.testMode,
        false,
      );
      assert.equal(
        (
          await api(
            'Alpha',
            'social',
            { action: 'chat', text: 'forbidden' },
            { origin: 'https://other.example' },
          )
        ).status,
        403,
      );
      for (const resource of [
        '/data/game.json',
        '/data/accounts.json',
        '/.git/config',
        '/server/api.mjs',
        '/.env',
      ])
        assert.equal((await fetch(base + resource)).status, 404);
      assert.match((await fetch(base)).headers.get('content-security-policy'), /script-src 'self'/);

      // An unfinished upload must not hold the shared simulation/request queue.
      const slow = httpRequest(base + '/api/social', {
        method: 'POST',
        headers: { 'Content-Length': '100', cookie: cookies.Alpha },
      });
      slow.on('error', () => {});
      slow.write('{');
      try {
        const response = await fetch(base + '/api/session', {
          headers: { cookie: cookies.Beta },
          signal: AbortSignal.timeout(2000),
        });
        assert.equal(response.status, 200);
      } finally {
        slow.destroy();
      }

      const attack = (await api('Alpha', 'world/attack', { mobId: 'orc', toggle: false })).body;
      await delay(1250);
      const observer = (await api('Beta', 'world/tick', {})).body;
      assert.ok(
        observer.orc.health < attack.orc.health,
        'auto-attack advances without attacker polling',
      );
      assert.ok(observer.events.some((e) => e.type === 'player-hit' && e.attackerId));
      await api('Alpha', 'world/stop', {});
      await api('Alpha', 'items/drop', { slot: 0, itemId: 'gold_coin', quantity: 7, x: 86, y: 28 });
      const pile = (await api('Beta', 'world/tick', {})).body.groundItems[0];
      assert.ok(pile);
      await Promise.all(
        ['Alpha', 'Beta'].map((name) => api(name, 'items/pickup', { id: pile.id })),
      );
      const bags = await Promise.all(
        ['Alpha', 'Beta'].map(async (name) => (await api(name, 'session')).body.inventory),
      );
      assert.equal(
        bags.flat().reduce((sum, i) => sum + (i?.id === 'gold_coin' ? i.quantity : 0), 0),
        7,
      );
      const previousCookie = cookies.Alpha;
      await login('Alpha');
      assert.equal(
        (await api('Alpha', 'session', undefined, { cookie: previousCookie })).status,
        401,
      );
      await stop();
      await start();
      assert.equal((await api('Beta', 'session')).status, 401);
      await login('Alpha');
      await login('Beta');
      const reloaded = await Promise.all(
        ['Alpha', 'Beta'].map(async (name) => (await api(name, 'session')).body),
      );
      assert.equal(
        reloaded
          .flatMap((p) => p.inventory)
          .reduce((sum, i) => sum + (i?.id === 'gold_coin' ? i.quantity : 0), 0),
        7,
      );
      assert.equal(reloaded[0].groundItems.length, 0);
      assert.equal(reloaded[0].orc.health, reloaded[1].orc.health);

      // Render terminates TLS before forwarding HTTP to Node. Simulate its trusted
      // configured origin, rather than trusting arbitrary X-Forwarded-* headers.
      await stop();
      await start({
        RENDER_EXTERNAL_URL: 'https://digla-test.onrender.com',
        DIGLA_TEMPORARY_SAVES: '1',
      });
      const hostedLogin = await api(
        'Alpha',
        'login',
        { username: 'Alpha', password: 'test-http-only' },
        { origin: 'https://digla-test.onrender.com' },
      );
      assert.equal(hostedLogin.status, 200);
      assert.match(hostedLogin.headers.get('set-cookie'), /; Secure/);
      assert.equal((await api('', 'server-info')).body.temporarySaves, backend !== 'postgres');
      assert.equal(
        (
          await api(
            'Alpha',
            'social',
            { action: 'chat', text: 'blocked' },
            {
              origin: 'https://evil.example',
              'x-forwarded-proto': 'https',
              'x-forwarded-host': 'evil.example',
            },
          )
        ).status,
        403,
      );
      const logout = await api(
        'Alpha',
        'logout',
        {},
        { origin: 'https://digla-test.onrender.com' },
      );
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get('set-cookie'), /Max-Age=0; Secure/);
    } finally {
      await stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
