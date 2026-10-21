import { randomUUID } from 'node:crypto';
import { createWorldService } from './world.mjs';
import { createGroundCleanup } from './ground-cleanup.mjs';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { SPAWN, STEP_DURATION_MS } from '../public/js/config.js';
import { distance, getMobs, getCorpses } from '../public/js/game/world-rules.js';
import { floorOf, sameFloor, isSafeZone, validFloorMove } from '../public/js/world/elevation.js';
import { walkable } from '../public/js/world/map.js';
import { gainVitalityXp } from '../public/js/game/vitality-rules.js';
import { recordKill } from '../public/js/game/adventure-rules.js';
import { clone, add } from './inventory.mjs';

const SHARED = [
  'orc',
  'elementals',
  'groundItems',
  'corpse',
  'elementalCorpses',
  'extraCorpses',
  'nextGroundCleanupAt',
  'miningNodes',
  'worldLayoutVersion',
  'gameSettings',
  'worldRevision',
];
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
export function createMultiplayer({
  accounts,
  sharedWorld,
  save,
  now = Date.now,
  testMode = false,
  autoStart = true,
}) {
  const seed = ensureProgress({ position: { ...SPAWN }, gameSettings: { testMode } });
  for (const key of SHARED) if (sharedWorld[key] === undefined) sharedWorld[key] = seed[key];
  sharedWorld.gameSettings = { testMode };
  const members = new Map(),
    buffers = new Map(),
    parties = new Map(),
    invites = new Map(),
    trades = new Map(),
    chat = [],
    contributions = new Map();
  let chain = Promise.resolve(),
    queued = 0,
    pulsing = false,
    eventNumber = 0;
  const online = () => [...members.values()].map((m) => m.account);
  function bind(a) {
    if (!a.id) a.id = randomUUID();
    if (a.multiplayerBound) return;
    for (const key of SHARED) {
      delete a[key];
      Object.defineProperty(a, key, {
        configurable: true,
        enumerable: false,
        get: () => sharedWorld[key],
        set: (value) => {
          sharedWorld[key] = value;
        },
      });
    }
    Object.defineProperty(a, 'multiplayerBound', { value: true });
    ensureProgress(a);
  }
  for (const a of Object.values(accounts)) bind(a);
  const byId = (id) => online().find((a) => a.id === id);
  const groupOf = (a) => [...parties.values()].find((p) => p.members.has(a.id));
  function companions(a, radius = 8) {
    const g = groupOf(a);
    return online().filter(
      (p) =>
        p.vitals.health > 0 &&
        distance(p.position, a.position) <= radius &&
        (p === a || (g && g.members.has(p.id))),
    );
  }
  function buffer(a) {
    let b = buffers.get(a.id);
    if (!b) {
      b = { events: [], status: {} };
      buffers.set(a.id, b);
    }
    return b;
  }
  function canLoot(a, corpse) {
    return (
      !corpse.reservedUntil || now() >= corpse.reservedUntil || corpse.ownerIds?.includes(a.id)
    );
  }
  const engine = createWorldService({
    save,
    now,
    multiplayer: {
      players: online,
      onReset(mob) {
        contributions.delete(mob.id);
      },
      awardDamage(a, mob, damage, { magic, sword }) {
        let ledger = contributions.get(mob.id);
        if (!ledger) {
          ledger = new Map();
          contributions.set(mob.id, ledger);
        }
        ledger.set(a.id, (ledger.get(a.id) || 0) + damage);
        const peers = companions(a);
        if (!peers.includes(a)) peers.push(a);
        const shift = (mob.x + mob.y + Math.floor(mob.health)) % peers.length;
        for (let i = 0; i < peers.length; i++) {
          const n =
            Math.floor(damage / peers.length) +
            ((i + shift) % peers.length < damage % peers.length ? 1 : 0);
          gainVitalityXp(peers[i], n);
          if (magic || sword) peers[i].skills[magic ? 'magic' : 'combat'].xp += n * 0.5;
        }
      },
      onDeath(a, mob, corpse) {
        const ledger = contributions.get(mob.id) || new Map([[a.id, 1]]);
        const owner = byId([...ledger].sort((x, y) => y[1] - x[1])[0]?.[0]) || a;
        corpse.ownerIds = companions(owner).map((p) => p.id);
        if (!corpse.ownerIds.includes(owner.id)) corpse.ownerIds.push(owner.id);
        corpse.reservedUntil = now() + 60000;
        const credit = new Set([...ledger.keys(), ...companions(a).map((p) => p.id)]);
        for (const id of credit) {
          const p = byId(id);
          if (p && p !== a && distance(p.position, mob) <= 8) recordKill(p, mob);
        }
        contributions.delete(mob.id);
      },
    },
  });
  const cleanup = createGroundCleanup({ save, now });
  function run(fn) {
    if (queued >= 100) return Promise.reject(fail('Servidor ocupado. Tente novamente.', 429));
    queued++;
    const result = chain.then(fn);
    chain = result
      .catch(() => {})
      .finally(() => {
        queued--;
      });
    return result;
  }
  function capture(a, result = {}) {
    const own = buffer(a);
    for (const key of ['inventory', 'bank', 'message', 'playerRespawned', 'teleported', 'position'])
      if (
        result[key] !== undefined &&
        (!['playerRespawned', 'teleported'].includes(key) || result[key])
      )
        own.status[key] = result[key];
    for (const raw of result.events || []) {
      const event = {
        ...raw,
        eventId: ++eventNumber,
        ...(raw.type === 'player-hit' ? { attackerId: a.id, attackerName: a.username } : {}),
      };
      if (raw.type === 'player-respawn') {
        const victim = byId(raw.victimId) || a;
        Object.assign(buffer(victim).status, {
          playerRespawned: true,
          position: { ...victim.position },
        });
      }
      for (const viewer of online()) {
        if (
          (raw.type === 'player-respawn' ||
            raw.type === 'recall-cancelled' ||
            raw.type === 'gathering-cancelled') &&
          viewer.id !== (raw.victimId || a.id)
        )
          continue;
        if (Number.isFinite(raw.x) && distance(viewer.position, raw) > 30) continue;
        const b = buffer(viewer);
        b.events.push(event);
        if (b.events.length > 200) b.events.shift();
      }
    }
  }
  function visiblePlayers(a) {
    return online()
      .filter((p) => p !== a && distance(a.position, p.position) <= 30)
      .map((p) => ({
        id: p.id,
        username: p.username,
        outfit: p.outfit,
        ...p.position,
        health: p.vitals.health,
        maxHealth: p.vitals.maxHealth,
        direction: members.get(p.id)?.direction || 'down',
      }));
  }
  function socialView(a) {
    const group = groupOf(a),
      trade = [...trades.values()].find((t) => t.members.includes(a.id));
    return {
      online: online().map((p) => ({ id: p.id, username: p.username })),
      chat: chat.slice(-40),
      party: group ? { leader: group.leader, members: [...group.members] } : null,
      invites: [...(invites.get(a.id) || [])]
        .filter((id) => byId(id))
        .map((id) => ({ id, name: byId(id).username })),
      trade: trade
        ? {
            id: trade.id,
            revision: trade.revision,
            members: trade.members,
            accepted: [...trade.accepted],
            confirmed: [...trade.confirmed],
            offers: trade.offers,
          }
        : null,
    };
  }
  function snapshot(a, extra = {}, consume = true) {
    bind(a);
    const b = buffer(a),
      status = consume ? b.status : {};
    const result = {
      ...engine.view(a),
      ...extra,
      ...status,
      worldRevision: sharedWorld.worldRevision,
      serverNow: now(),
      multiplayer: true,
      playerId: a.id,
      players: visiblePlayers(a),
      social: socialView(a),
      events: consume ? b.events.splice(0) : [],
    };
    if (consume) b.status = {};
    result.corpses = getCorpses(a).map((c) => {
      const allowed = canLoot(a, c);
      return {
        id: c.id,
        mobId: c.mobId,
        name: c.name,
        kind: c.kind,
        x: c.x,
        y: c.y,
        z: c.z,
        expiresAt: c.expiresAt,
        reservedUntil: c.reservedUntil,
        canLoot: allowed,
        slots: allowed ? c.slots : Array(6).fill(null),
      };
    });
    result.corpse = result.corpses.find((c) => c.id === a.corpse?.id) || null;
    return result;
  }
  function cancelTrade(t, message) {
    trades.delete(t.id);
    for (const id of t.members) {
      const p = byId(id);
      if (p) buffer(p).status.message = message;
    }
  }
  function leave(a) {
    if (!members.has(a.id)) return;
    engine.stop(a, { disengage: true });
    members.delete(a.id);
    const group = groupOf(a);
    if (group) {
      group.members.delete(a.id);
      if (!group.members.size) parties.delete(group.id);
      else if (group.leader === a.id) group.leader = [...group.members][0];
    }
    for (const t of trades.values())
      if (t.members.includes(a.id)) cancelTrade(t, 'Troca cancelada: jogador desconectado.');
  }
  function join(a) {
    bind(a);
    if (members.size >= 32 && !members.has(a.id))
      throw fail('Servidor cheio. Tente novamente.', 503);
    if (!members.has(a.id))
      members.set(a.id, {
        account: a,
        lastSeen: now(),
        credit: STEP_DURATION_MS * 2,
        lastMove: now(),
        direction: 'down',
        requests: [],
      });
    members.get(a.id).lastSeen = now();
  }
  function touch(a) {
    join(a);
    const m = members.get(a.id);
    m.requests = m.requests.filter((t) => now() - t < 1000);
    if (m.requests.length >= 60) throw fail('Muitas ações. Aguarde um instante.', 429);
    m.requests.push(now());
  }
  function occupied(a, p) {
    return (
      !isSafeZone(p) &&
      online().some(
        (other) => other !== a && other.vitals.health > 0 && distance(other.position, p) === 0,
      )
    );
  }
  function validateMove(a, p) {
    const from = a.position,
      m = members.get(a.id);
    if (distance(from, p) === 0) return true;
    if (!validFloorMove(from, p) || !walkable(p.x, p.y, floorOf(p)) || occupied(a, p)) return false;
    if (sameFloor(from, p) && Math.abs(from.x - p.x) + Math.abs(from.y - p.y) !== 1) return false;
    const duration = STEP_DURATION_MS / (now() < (a.utility?.hasteUntil || 0) ? 1.5 : 1);
    m.credit = Math.min(duration * 2, m.credit + Math.max(0, now() - m.lastMove));
    m.lastMove = now();
    if (m.credit + 5 < duration) return false;
    m.credit = Math.max(0, m.credit - duration);
    m.direction =
      Math.abs(p.x - from.x) > Math.abs(p.y - from.y)
        ? p.x > from.x
          ? 'right'
          : 'left'
        : p.y > from.y
          ? 'down'
          : 'up';
    return true;
  }
  async function pulse() {
    for (const m of [...members.values()]) if (now() - m.lastSeen > 10000) leave(m.account);
    await cleanup.sweep(sharedWorld);
    for (const a of online()) capture(a, await engine.tick(a));
    for (const t of [...trades.values()])
      if (
        now() > t.expires ||
        t.members.some((id) => !byId(id)) ||
        distance(byId(t.members[0]).position, byId(t.members[1]).position) > 1
      )
        cancelTrade(t, 'Troca cancelada por distância ou tempo.');
  }
  const world = new Proxy(engine, {
    get(target, key) {
      if (key === 'tick') return async (a) => snapshot(a);
      if (key === 'moved')
        return (a, p) => {
          sharedWorld.worldRevision++;
          return target.moved(a, p);
        };
      if (key === 'canMove')
        return (a, x, y, z) => !occupied(a, { x, y, z }) && target.canMove(a, x, y, z);
      if (key === 'stop')
        return (a, p) => {
          const result = target.stop(a, p);
          capture(a, result);
          return snapshot(a, result);
        };
      if (key === 'loot')
        return (a, p) => {
          const c = getCorpses(a).find((c) => c.id === p.id);
          if (c && !canLoot(a, c))
            return snapshot(a, { message: 'Loot reservado por 60 segundos.' });
          const result = target.loot(a, p);
          capture(a, result);
          return snapshot(a, result);
        };
      if (typeof target[key] !== 'function') return target[key];
      return async (a, payload = {}) => {
        if (key === 'adventure' && payload.action === 'settings')
          return snapshot(a, {
            message: 'No multiplayer, o modo de teste é definido pelo dono do servidor.',
          });
        if (['loot', 'transfer', 'pickup', 'move', 'drop'].includes(key)) {
          const id =
            key === 'loot'
              ? payload.id
              : payload.source === 'corpse'
                ? payload.id
                : payload.corpseId;
          const corpse = getCorpses(a).find((c) => c.id === id);
          if (corpse && !canLoot(a, corpse))
            return snapshot(a, {
              message: 'Loot reservado por 60 segundos para quem causou mais dano e seu grupo.',
            });
          if (
            (payload.target === 'ground' || ['drop', 'move'].includes(key)) &&
            occupied(a, payload)
          )
            return snapshot(a, { message: 'Este quadrado está ocupado por outro jogador.' });
        }
        const result = await target[key](a, payload);
        capture(a, result);
        return snapshot(a, result, true);
      };
    },
  });
  async function social(a, { action, targetId, fromId, tradeId, revision, items, text } = {}) {
    if (typeof action !== 'string') throw fail('Ação inválida.', 400);
    const target = byId(targetId),
      m = members.get(a.id);
    if (action === 'chat') {
      if (typeof text !== 'string' || !text.trim() || text.length > 200)
        throw fail('Mensagem deve ter de 1 a 200 caracteres.', 400);
      if (now() - (m.lastChat || 0) < 800)
        throw fail('Aguarde antes de enviar outra mensagem.', 429);
      m.lastChat = now();
      chat.push({
        id: randomUUID(),
        playerId: a.id,
        username: a.username,
        text: text.replace(/[\u0000-\u001f\u007f]/g, '').trim(),
        time: now(),
      });
      if (chat.length > 40) chat.shift();
    } else if (action === 'partyInvite') {
      if (!target || target === a) throw fail('Jogador indisponível.');
      const g = groupOf(a);
      if (g && g.leader !== a.id) throw fail('Somente o líder pode convidar.');
      if (g?.members.size >= 5 || groupOf(target))
        throw fail('Grupo cheio ou jogador já está em um grupo.');
      const set = invites.get(target.id) || new Set();
      set.add(a.id);
      invites.set(target.id, set);
    } else if (action === 'partyAccept') {
      const inviter = byId(fromId);
      if (!inviter || !invites.get(a.id)?.has(fromId) || groupOf(a))
        throw fail('Convite inválido.');
      let g = groupOf(inviter);
      if (!g) {
        g = { id: randomUUID(), leader: inviter.id, members: new Set([inviter.id]) };
        parties.set(g.id, g);
      }
      if (g.members.size >= 5 || g.leader !== inviter.id) throw fail('Convite expirou.');
      g.members.add(a.id);
      invites.delete(a.id);
    } else if (action === 'partyLeave') {
      const g = groupOf(a);
      if (g) {
        g.members.delete(a.id);
        if (!g.members.size) parties.delete(g.id);
        else if (g.leader === a.id) g.leader = [...g.members][0];
      }
    } else if (action === 'tradeInvite') {
      if (!target || target === a || distance(a.position, target.position) > 1)
        throw fail('Fique ao lado do jogador para trocar.');
      if (
        [...trades.values()].some((t) => t.members.includes(a.id) || t.members.includes(target.id))
      )
        throw fail('Um dos jogadores já está negociando.');
      const t = {
        id: randomUUID(),
        members: [a.id, target.id],
        accepted: new Set([a.id]),
        confirmed: new Set(),
        offers: { [a.id]: [], [target.id]: [] },
        revision: 0,
        expires: now() + 120000,
      };
      trades.set(t.id, t);
    } else if (action?.startsWith('trade')) {
      const t = trades.get(tradeId);
      if (!t || !t.members.includes(a.id)) throw fail('Troca indisponível.');
      if (now() > t.expires) {
        cancelTrade(t, 'Troca expirada. Nenhum item foi transferido.');
        throw fail('Troca expirada.');
      }
      if (action === 'tradeCancel') cancelTrade(t, 'Troca cancelada.');
      else if (action === 'tradeAccept') t.accepted.add(a.id);
      else if (action === 'tradeOffer') {
        if (t.accepted.size !== 2 || !Array.isArray(items) || items.length > 12)
          throw fail('Aceite a troca e selecione até 12 itens.', 400);
        const seen = new Set();
        for (const item of items) {
          const entry = a.inventory[item.slot];
          if (
            !Number.isInteger(item.slot) ||
            seen.has(item.slot) ||
            !entry ||
            entry.id !== item.itemId ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > entry.quantity
          )
            throw fail('Oferta inválida.', 400);
          seen.add(item.slot);
        }
        t.offers[a.id] = items.map((i) => ({
          slot: i.slot,
          itemId: i.itemId,
          quantity: i.quantity,
        }));
        t.revision++;
        t.confirmed.clear();
        t.expires = now() + 120000;
      } else if (action === 'tradeConfirm') {
        if (t.accepted.size !== 2 || revision !== t.revision)
          throw fail('A oferta mudou. Confira os itens novamente.');
        t.confirmed.add(a.id);
        if (t.confirmed.size === 2) {
          const peers = t.members.map(byId);
          if (peers.some((p) => !p) || distance(peers[0].position, peers[1].position) > 1) {
            cancelTrade(t, 'Troca cancelada por distância.');
            throw fail('Aproxime-se novamente.');
          }
          const bags = peers.map((p) => clone(p.inventory));
          for (let i = 0; i < 2; i++)
            for (const offer of t.offers[peers[i].id]) {
              const item = bags[i][offer.slot];
              if (!item || item.id !== offer.itemId || item.quantity < offer.quantity) {
                t.confirmed.clear();
                throw fail('Um item da oferta mudou. Atualize a oferta.');
              }
              item.quantity -= offer.quantity;
              if (!item.quantity) bags[i][offer.slot] = null;
            }
          for (let i = 0; i < 2; i++)
            for (const offer of t.offers[peers[i].id])
              if (!add(bags[1 - i], offer.itemId, offer.quantity)) {
                t.confirmed.clear();
                throw fail('Uma mochila não tem espaço. Nenhum item foi transferido.');
              }
          for (let i = 0; i < 2; i++) {
            peers[i].inventory = bags[i];
            buffer(peers[i]).status.inventory = bags[i];
            buffer(peers[i]).status.message = 'Troca concluída.';
          }
          trades.delete(t.id);
          sharedWorld.worldRevision++;
          await save();
        }
      } else throw fail('Ação de troca desconhecida.', 400);
    } else throw fail('Ação social desconhecida.', 400);
    sharedWorld.worldRevision++;
    return snapshot(a);
  }
  let timer;
  if (autoStart)
    timer = setInterval(() => {
      if (pulsing || queued > 20) return;
      pulsing = true;
      void run(() => (save.background ? save.background(pulse) : pulse()))
        .catch((e) => console.error('Falha no tick multiplayer:', e.message))
        .finally(() => {
          pulsing = false;
        });
    }, 100).unref();
  return {
    world,
    run,
    join,
    touch,
    leave,
    validateMove,
    social,
    snapshot,
    bind,
    pulse,
    close() {
      clearInterval(timer);
    },
    initial: (a) => {
      const p = publicProgress(a);
      return { ...p, ...snapshot(a, {}, false), skills: p.skills };
    },
  };
}
