import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SPAWN, OUTFITS, COLORS } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';
import { reply, readJSON } from './http.mjs';
import { publicProgress, ensureProgress } from '../public/js/game/progression.js';
import { createFishingService } from './fishing.mjs';
import { createCookingService } from './cooking.mjs';
import { createWorldService } from './world.mjs';
import { createGroundCleanup } from './ground-cleanup.mjs';
import { floorOf, validFloorMove, sameFloor } from '../public/js/world/elevation.js';
const scrypt = promisify(scryptCallback);

// Rotas de cadastro, login, sessão, posição e saída. Senhas usam scrypt + salt.
export function createAccountApi({ accounts, save }) {
  const sessions = new Map();
  const attempts = new Map();
  const fishing = createFishingService({ save });
  const cooking = createCookingService({ save });
  const world = createWorldService({ save });
  const cleanup = createGroundCleanup({ save });
  let sweeping = false;
  async function sweepGround() {
    if (sweeping) return;
    sweeping = true;
    try {
      await cleanup.sweepAll(accounts);
    } catch (error) {
      console.error('Falha ao salvar a limpeza do mundo:', error.message);
    } finally {
      sweeping = false;
    }
  }
  void sweepGround();
  setInterval(sweepGround, 1000).unref();
  function publicAccount(a) {
    if (!walkable(a.position?.x, a.position?.y, floorOf(a.position))) a.position = { ...SPAWN };
    return { username: a.username, outfit: a.outfit, position: a.position, ...publicProgress(a) };
  }
  function auth(req) {
    const token = /(?:^|;\s*)digla_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    return { token, account: accounts[session.key] };
  }
  async function signIn(res, key, status = 200) {
    await cleanup.sweep(accounts[key]);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { key, expires: Date.now() + 7 * 86400000 });
    reply(res, status, publicAccount(accounts[key]), {
      'Set-Cookie': `digla_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
    });
  }

  return async function handleApi(req, res, url) {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
      return reply(res, 403, { error: 'Origem não permitida.' });
    if (req.method === 'GET' && url.pathname === '/api/session') {
      const session = auth(req);
      if (session) await cleanup.sweep(session.account);
      return session
        ? reply(res, 200, publicAccount(session.account))
        : reply(res, 401, { error: 'Entre na sua conta para continuar.' });
    }
    if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
    const data = await readJSON(req);
    if (['/api/register', '/api/login'].includes(url.pathname)) {
      const address = req.socket.remoteAddress;
      const recent = (attempts.get(address) || []).filter((t) => Date.now() - t < 60000);
      attempts.set(address, recent);
      if (recent.length >= 30)
        return reply(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
      recent.push(Date.now());
      const username = typeof data.username === 'string' ? data.username.trim() : '';
      const password = data.password;
      if (
        !/^[\p{L}\p{N}_ -]{3,20}$/u.test(username) ||
        typeof password !== 'string' ||
        password.length < 6 ||
        password.length > 128
      )
        return reply(res, 400, {
          error: 'Use um nome de 3 a 20 letras/números e uma senha de 6 a 128 caracteres.',
        });
      const key = username.toLocaleLowerCase('pt-BR');
      if (url.pathname === '/api/register') {
        if (Object.hasOwn(accounts, key))
          return reply(res, 409, { error: 'Esse nome já está em uso. Escolha outro.' });
        const outfit = data.outfit;
        if (
          !outfit ||
          !OUTFITS.includes(outfit.type) ||
          !['head', 'body', 'legs', 'feet'].every(
            (p) => Number.isInteger(outfit[p]) && outfit[p] >= 0 && outfit[p] < COLORS.length,
          )
        )
          return reply(res, 400, { error: 'Escolha um outfit e cores válidos.' });
        const salt = randomBytes(16).toString('hex');
        const digest = (await scrypt(password, salt, 64)).toString('hex');
        // Recheck after the asynchronous hash to keep simultaneous registrations unique.
        if (Object.hasOwn(accounts, key))
          return reply(res, 409, { error: 'Esse nome já está em uso. Escolha outro.' });
        accounts[key] = {
          username,
          salt,
          digest,
          outfit: {
            type: outfit.type,
            head: outfit.head,
            body: outfit.body,
            legs: outfit.legs,
            feet: outfit.feet,
          },
          position: { ...SPAWN },
          createdAt: new Date().toISOString(),
        };
        ensureProgress(accounts[key]);
        await save();
        return signIn(res, key, 201);
      }
      const account = Object.hasOwn(accounts, key) ? accounts[key] : null;
      const digest = await scrypt(password, account?.salt || 'invalid-account-salt', 64);
      if (!account || !timingSafeEqual(digest, Buffer.from(account.digest, 'hex')))
        return reply(res, 401, { error: 'Nome ou senha incorretos.' });
      return signIn(res, key);
    }
    const session = auth(req);
    if (!session) return reply(res, 401, { error: 'Sua sessão terminou. Entre novamente.' });
    await cleanup.sweep(session.account);
    if (url.pathname === '/api/town/open') {
      fishing.stop(session.account);
      cooking.stop(session.account);
      world.stop(session.account);
      return reply(res, 200, await world.townOpen(session.account, data));
    }
    const townAction = /^\/api\/town\/(buy|sell|deposit|depositAll|withdraw|bet)$/.exec(
      url.pathname,
    )?.[1];
    if (townAction) return reply(res, 200, await world[townAction](session.account, data));
    if (url.pathname === '/api/position') {
      if (!walkable(data.x, data.y, floorOf(data)))
        return reply(res, 400, { error: 'Posição inválida.' });
      if (
        !validFloorMove(session.account.position, data) ||
        !world.canMove(session.account, data.x, data.y, floorOf(data))
      )
        return reply(res, 409, {
          error: 'Esse quadrado está ocupado ou você acabou de renascer.',
          position: session.account.position,
          ...publicProgress(session.account),
        });
      const changedFloor = !sameFloor(session.account.position, data);
      if (
        session.account.position.x !== data.x ||
        session.account.position.y !== data.y ||
        changedFloor
      ) {
        fishing.stop(session.account);
        cooking.stop(session.account);
      }
      if (changedFloor) world.stop(session.account, { disengage: true });
      session.account.position = {
        x: data.x,
        y: data.y,
        ...(data.z === undefined ? {} : { z: data.z }),
      };
      await save();
      return reply(res, 200, { ok: true });
    }
    if (url.pathname === '/api/logout') {
      fishing.stop(session.account);
      cooking.stop(session.account);
      world.stop(session.account, { disengage: true });
      sessions.delete(session.token);
      return reply(
        res,
        200,
        { ok: true },
        { 'Set-Cookie': 'digla_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' },
      );
    }
    if (url.pathname === '/api/fishing/start') {
      cooking.stop(session.account);
      return reply(res, 200, fishing.start(session.account));
    }
    if (url.pathname === '/api/fishing/press')
      return reply(res, 200, fishing.press(session.account, data.challengeId));
    if (url.pathname === '/api/fishing/tick')
      return reply(res, 200, await fishing.tick(session.account));
    if (url.pathname === '/api/fishing/stop') return reply(res, 200, fishing.stop(session.account));
    if (url.pathname === '/api/cooking/open' || url.pathname === '/api/cooking/start') {
      fishing.stop(session.account);
      return reply(
        res,
        200,
        url.pathname.endsWith('/open')
          ? cooking.open(session.account)
          : cooking.start(session.account, data.recipe, data.quantity),
      );
    }
    if (url.pathname === '/api/cooking/tick')
      return reply(res, 200, await cooking.tick(session.account));
    if (url.pathname === '/api/cooking/stop') return reply(res, 200, cooking.stop(session.account));
    if (url.pathname === '/api/world/tick') {
      const result = await world.tick(session.account);
      if (result.playerRespawned) {
        fishing.stop(session.account);
        cooking.stop(session.account);
      }
      return reply(res, 200, result);
    }
    if (url.pathname === '/api/world/attack') {
      fishing.stop(session.account);
      cooking.stop(session.account);
      return reply(res, 200, await world.attack(session.account, data));
    }
    if (url.pathname === '/api/world/cast') {
      fishing.stop(session.account);
      cooking.stop(session.account);
      return reply(res, 200, await world.cast(session.account, data));
    }
    if (url.pathname === '/api/world/stop')
      return reply(res, 200, world.stop(session.account, data));
    if (url.pathname === '/api/world/heal') {
      fishing.stop(session.account);
      cooking.stop(session.account);
      return reply(res, 200, await world.heal(session.account));
    }
    if (url.pathname === '/api/world/loot')
      return reply(res, 200, world.loot(session.account, data));
    if (url.pathname === '/api/items/use')
      return reply(res, 200, await world.use(session.account, data));
    if (url.pathname === '/api/items/drop')
      return reply(res, 200, await world.drop(session.account, data));
    if (url.pathname === '/api/items/move')
      return reply(res, 200, await world.move(session.account, data));
    if (url.pathname === '/api/items/transfer')
      return reply(res, 200, await world.transfer(session.account, data));
    if (url.pathname === '/api/items/element')
      return reply(res, 200, await world.element(session.account, data));
    if (url.pathname === '/api/items/pickup')
      return reply(res, 200, await world.pickup(session.account, data));
    return reply(res, 404, { error: 'Rota não encontrada.' });
  };
}
