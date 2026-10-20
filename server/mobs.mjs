import { randomUUID } from 'node:crypto';
import { ITEMS } from '../public/js/items.js';
import { SPAWN, WELL, WIDTH, HEIGHT } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';
import { ensureProgress, publicProgress, skillProgress } from '../public/js/game/progression.js';
import { combatStats, recordKill, mobMaximum } from '../public/js/game/adventure-rules.js';
import { gainVitalityXp } from '../public/js/game/vitality-rules.js';
import { cancelRecall } from '../public/js/game/utility-rules.js';
import {
  LIGHTNING_STAFF,
  LIGHTNING_AUTO_INTERVAL_MS,
  ABILITY_GLOBAL_COOLDOWN_MS,
  LIGHTNING_ABILITIES,
  lightningDamage,
} from '../public/js/game/lightning-rules.js';
import { lineOfSight } from '../public/js/game/pathfinding.js';
import { floorOf, sameFloor, transitionAt, isSafeZone } from '../public/js/world/elevation.js';
import {
  MOB_DEFINITIONS,
  getMobs,
  getCorpses,
  mobAt,
  WEAKNESS_MULTIPLIER,
  ORC_LOOT_CAPACITY,
  ORC_DROP_CHANCE,
  WEAPON_XP_FACTOR,
  DAMAGE_MIN,
  DAMAGE_MAX,
  staffDamage,
  COIN_DROP_MIN,
  COIN_DROP_MAX,
  ATTACK_INTERVAL_MS,
  ORC_MOVE_INTERVAL_MS,
  ORC_RESPAWN_MS,
  CORPSE_LIFETIME_MS,
  weaponRange,
  distance,
} from '../public/js/game/world-rules.js';

// Todas as criaturas usam as mesmas regras de seleção, perseguição e combate.
export function createMobService({ save, random = Math.random, now = Date.now, multiplayer }) {
  const runtimes = new WeakMap();
  let sharedCreatures;
  function runtime(account) {
    ensureProgress(account);
    let state = runtimes.get(account);
    if (!state) {
      state = {
        lastTick: now(),
        targetId: null,
        nextPlayerAttack: 0,
        respawnUntil: 0,
        poisons: new Map(),
        creatures:
          sharedCreatures ||
          Object.fromEntries(
            getMobs(account).map((mob) => [
              mob.id,
              {
                aggro: false,
                nextMove: now() + ORC_MOVE_INTERVAL_MS,
                nextAttack:
                  now() + (MOB_DEFINITIONS[mob.id].attackIntervalMs ?? ATTACK_INTERVAL_MS),
              },
            ]),
          ),
      };
      if (multiplayer) sharedCreatures = state.creatures;
      runtimes.set(account, state);
    }
    return state;
  }
  const roll = (min = DAMAGE_MIN, max = DAMAGE_MAX) =>
    min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
  function snapshot(account, extra = {}) {
    const state = runtime(account),
      progress = publicProgress(account),
      mobs = getMobs(account).map((mob) => ({
        ...mob,
        targeted: state.targetId === mob.id,
        chasing: state.creatures[mob.id].aggro,
      }));
    return {
      quests: progress.quests,
      gameSettings: progress.gameSettings,
      combatStats: progress.combatStats,
      gathering: progress.gathering,
      miningNodes: progress.miningNodes,
      worldRevision: account.worldRevision,
      nextGroundCleanupAt: account.nextGroundCleanupAt,
      vitals: account.vitals,
      groundItems: account.groundItems,
      corpse: account.corpse,
      corpses: getCorpses(account),
      mobs,
      orc: mobs.find((mob) => mob.id === 'orc'),
      equipment: account.equipment,
      attackElement: account.attackElement,
      abilityCooldowns: account.abilityCooldowns || {},
      utility: account.utility,
      quickSlots: account.quickSlots,
      hazards: Object.values(state.creatures).flatMap((c) => (c.special ? [c.special] : [])),
      serverNow: now(),
      skills: {
        mining: progress.skills.mining,
        smithing: progress.skills.smithing,
        combat: skillProgress(account.skills.combat.xp),
        magic: skillProgress(account.skills.magic.xp),
        vitality: skillProgress(account.skills.vitality.xp),
      },
      ...extra,
    };
  }
  function resetEncounter(account, state, events) {
    account.position = { ...SPAWN };
    account.vitals.health = account.vitals.maxHealth;
    state.targetId = null;
    state.poisons.clear();
    state.respawnUntil = now() + 750;
    for (const mob of getMobs(account)) {
      if (multiplayer) {
        const c = state.creatures[mob.id];
        if (c.targetPlayerId === account.id) {
          c.targetPlayerId = null;
          c.aggro = false;
          c.special = null;
        }
        continue;
      }
      state.creatures[mob.id].aggro = false;
      state.creatures[mob.id].special = null;
      Object.assign(mob, MOB_DEFINITIONS[mob.id].spawn);
    }
    events.push({ type: 'player-respawn', ...(multiplayer ? { victimId: account.id } : {}) });
  }
  function makeCorpse(account, mob) {
    const corpse = {
      id: randomUUID(),
      mobId: mob.id,
      kind: mob.kind,
      name: mob.name,
      x: mob.x,
      y: mob.y,
      z: floorOf(mob),
      createdAt: now(),
      expiresAt: now() + CORPSE_LIFETIME_MS,
      slots: Array(ORC_LOOT_CAPACITY).fill(null),
    };
    if (mob.kind === 'orc' && random() < (account.gameSettings.testMode ? ORC_DROP_CHANCE : 1 / 3))
      corpse.slots[0] = { id: random() < 0.5 ? 'sword' : 'staff', quantity: 1 };
    corpse.slots[1] = { id: 'gold_coin', quantity: roll(COIN_DROP_MIN, COIN_DROP_MAX) };
    if (mob.id === 'orc_commander') {
      corpse.slots[1].quantity = roll(40, 80);
      if (random() < 0.25) corpse.slots[2] = { id: 'commander_blade', quantity: 1 };
    }
    const previous = mob.id === 'orc' ? account.corpse : account.elementalCorpses[mob.id];
    if (previous) (account.extraCorpses ??= []).push(previous);
    if (mob.id === 'orc') account.corpse = corpse;
    else account.elementalCorpses[mob.id] = corpse;
    multiplayer?.onDeath?.(account, mob, corpse);
  }
  function damageMob(
    account,
    state,
    mob,
    events,
    { base, element, magic = false, sword = false, criticalMax, ability },
  ) {
    if (mob.health <= 0) return false;
    const weak = !!element && element === mob.weakness;
    const multiplier = weak ? WEAKNESS_MULTIPLIER : 1;
    const mitigation = element ? 1 : 1 - (MOB_DEFINITIONS[mob.id].physicalReduction || 0);
    const dealt = Math.min(Math.max(1, Math.round(base * multiplier * mitigation)), mob.health);
    mob.health -= dealt;
    if (multiplayer?.awardDamage) multiplayer.awardDamage(account, mob, dealt, { magic, sword });
    else gainVitalityXp(account, dealt);
    state.creatures[mob.id].aggro = true;
    if (multiplayer && !state.creatures[mob.id].targetPlayerId)
      state.creatures[mob.id].targetPlayerId = account.id;
    if (!multiplayer?.awardDamage && (magic || sword))
      account.skills[magic ? 'magic' : 'combat'].xp += dealt * WEAPON_XP_FACTOR;
    events.push({
      type: 'player-hit',
      mobId: mob.id,
      mobName: mob.name,
      damage: dealt,
      critical:
        criticalMax !== undefined &&
        dealt === Math.max(1, Math.round(criticalMax * multiplier * mitigation)),
      weakness: weak,
      x: mob.x,
      y: mob.y,
      z: floorOf(mob),
      ...(element
        ? {
            element,
            fromX: ability === 'w' ? mob.x : account.position.x,
            fromY: ability === 'w' ? mob.y : account.position.y,
          }
        : {}),
      ...(ability ? { ability } : {}),
    });
    if (!mob.health) {
      mob.respawnAt = now() + (MOB_DEFINITIONS[mob.id].respawnMs || ORC_RESPAWN_MS);
      recordKill(account, mob);
      makeCorpse(account, mob);
      if (state.targetId === mob.id) state.targetId = null;
      state.poisons.delete(mob.id);
      state.creatures[mob.id].aggro = false;
      if (multiplayer) state.creatures[mob.id].targetPlayerId = null;
      state.creatures[mob.id].special = null;
      events.push({
        type: mob.id === 'orc' ? 'orc-defeated' : 'mob-defeated',
        mobId: mob.id,
        mobName: mob.name,
      });
    }
    return true;
  }
  function visibleFrom(account, target) {
    return (
      sameFloor(account.position, target) &&
      !isSafeZone(target) &&
      lineOfSight(account.position, target, (x, y) => walkable(x, y, floorOf(target)))
    );
  }
  function hitMob(account, state, mob, events) {
    if (
      state.targetId !== mob.id ||
      isSafeZone(account.position) ||
      mob.health <= 0 ||
      distance(account.position, mob) > weaponRange(account) ||
      !visibleFrom(account, mob) ||
      now() < state.nextPlayerAttack
    )
      return false;
    const weapon = account.equipment.weapon?.id,
      lightning = weapon === LIGHTNING_STAFF;
    const base = lightning ? lightningDamage(skillProgress(account.skills.magic.xp).level) : null;
    const limits = lightning
      ? { min: base, max: base }
      : weapon === 'staff'
        ? staffDamage(skillProgress(account.skills.magic.xp).level)
        : combatStats(account);
    state.nextPlayerAttack = now() + (lightning ? LIGHTNING_AUTO_INTERVAL_MS : ATTACK_INTERVAL_MS);
    return damageMob(account, state, mob, events, {
      base: lightning ? base : roll(limits.min, limits.max),
      element: lightning ? 'lightning' : weapon === 'staff' ? account.attackElement : null,
      magic: lightning || weapon === 'staff',
      sword: weapon === 'sword' || ITEMS[weapon]?.melee,
      criticalMax: lightning ? undefined : limits.max,
    });
  }
  function nextStep(account, mob, target, adjacent) {
    if (!sameFloor(mob, target)) return null;
    if (distance(mob, target) <= (adjacent ? 1 : 0)) return null;
    const queue = [{ x: mob.x, y: mob.y, first: null }],
      seen = new Set([`${mob.x},${mob.y}`]);
    for (let i = 0; i < queue.length && i < WIDTH * HEIGHT; i++) {
      const point = queue[i];
      if (point.first && distance(point, target) <= (adjacent ? 1 : 0)) return point.first;
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ]) {
        const step = { x: point.x + dx, y: point.y + dy, z: floorOf(mob) },
          key = `${step.x},${step.y}`;
        if (
          seen.has(key) ||
          !walkable(step.x, step.y, floorOf(mob)) ||
          transitionAt(step.x, step.y, floorOf(mob)) ||
          isSafeZone(step) ||
          (MOB_DEFINITIONS[mob.id].boss && !inBossRoom(step)) ||
          (multiplayer
            ? multiplayer.players().some((p) => distance(step, p.position) === 0)
            : distance(step, account.position) === 0) ||
          getMobs(account).some(
            (other) => other.id !== mob.id && other.health > 0 && distance(other, step) === 0,
          )
        )
          continue;
        seen.add(key);
        queue.push({ ...step, first: point.first || step });
      }
    }
    return null;
  }
  const inBossRoom = (p) => floorOf(p) === -1 && p.x >= 80 && p.x <= 94 && p.y >= 13 && p.y <= 20;
  function hurtPlayer(account, mob, raw, events, { element, critical = false } = {}) {
    const damage = Math.max(
      1,
      Math.round(raw * (element ? 1 : 1 - combatStats(account).reduction)),
    );
    account.vitals.health = Math.max(0, account.vitals.health - damage);
    if (cancelRecall(account))
      events.push({ type: 'recall-cancelled', ...(multiplayer ? { victimId: account.id } : {}) });
    if (account.gathering) {
      account.gathering = null;
      events.push({ type: 'gathering-cancelled' });
    }
    if (mob.variant === 'archer')
      events.push({
        type: 'enemy-projectile',
        element: 'physical',
        x: account.position.x,
        y: account.position.y,
        z: floorOf(account.position),
        fromX: mob.x,
        fromY: mob.y,
      });
    events.push({
      type: mob.id === 'orc' ? 'orc-hit' : 'mob-hit',
      ...(multiplayer ? { victimId: account.id } : {}),
      mobId: mob.id,
      mobName: mob.name,
      damage,
      critical,
      x: account.position.x,
      y: account.position.y,
      z: floorOf(account.position),
      ...(element ? { element, fromX: mob.x, fromY: mob.y } : {}),
    });
  }
  function prepareSpecial(account, mob, creature, time) {
    const shaman = mob.variant === 'shaman',
      cycle = (creature.cycle || 0) % 3;
    creature.cycle = (creature.cycle || 0) + 1;
    let tiles = [],
      kind = shaman ? 'spell' : cycle === 0 ? 'frontal' : cycle === 1 ? 'slam' : 'charge';
    const dx = account.position.x - mob.x,
      dy = account.position.y - mob.y;
    const step =
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx) || 1, y: 0 }
        : { x: 0, y: Math.sign(dy) || 1 };
    if (shaman || kind === 'slam') {
      const center = shaman ? account.position : mob;
      for (let y = -1; y <= 1; y++)
        for (let x = -1; x <= 1; x++)
          tiles.push({ x: center.x + x, y: center.y + y, z: floorOf(mob) });
    } else
      for (let i = 1; i <= (kind === 'charge' ? 4 : 3); i++)
        tiles.push({ x: mob.x + step.x * i, y: mob.y + step.y * i, z: floorOf(mob) });
    tiles = tiles.filter(
      (p) =>
        walkable(p.x, p.y, p.z) &&
        !isSafeZone(p) &&
        lineOfSight(mob, p, (x, y) => walkable(x, y, p.z)) &&
        (!MOB_DEFINITIONS[mob.id].boss || inBossRoom(p)),
    );
    creature.special = {
      id: randomUUID(),
      mobId: mob.id,
      kind,
      tiles,
      z: floorOf(mob),
      endsAt: time + (kind === 'slam' ? 1500 : shaman ? 1200 : 1000),
    };
    creature.nextSpecial = time + (shaman ? 3000 : mob.health < mob.maxHealth / 2 ? 4000 : 6000);
  }
  async function tick(account) {
    const state = runtime(account),
      time = now(),
      events = [];
    if (time - state.lastTick > 2000) {
      state.targetId = null;
      state.poisons.clear();
      if (!multiplayer)
        for (const [id, creature] of Object.entries(state.creatures))
          Object.assign(creature, {
            aggro: false,
            special: null,
            nextMove: time + ORC_MOVE_INTERVAL_MS,
            nextAttack: time + (MOB_DEFINITIONS[id].attackIntervalMs ?? ATTACK_INTERVAL_MS),
          });
    }
    state.lastTick = time;
    let changed = false,
      playerRespawned = false;
    if (account.vitals.health <= 0) {
      resetEncounter(account, state, events);
      changed = true;
      playerRespawned = true;
    }
    for (const mob of getMobs(account)) {
      const creature = state.creatures[mob.id],
        definition = MOB_DEFINITIONS[mob.id];
      if (multiplayer) {
        const players = multiplayer.players();
        const eligible = (p) =>
          p.vitals.health > 0 &&
          !isSafeZone(p.position) &&
          sameFloor(p.position, mob) &&
          (!definition.boss || inBossRoom(p.position));
        let owner = players.find((p) => p.id === creature.targetPlayerId && eligible(p));
        if (!owner) {
          owner = players
            .filter((p) => eligible(p) && distance(p.position, mob) <= 5)
            .sort(
              (a, b) =>
                distance(a.position, mob) - distance(b.position, mob) || a.id.localeCompare(b.id),
            )[0];
          if (creature.targetPlayerId !== owner?.id) creature.special = null;
          creature.targetPlayerId = owner?.id || null;
        }
        creature.aggro = !!owner;
      }
      if (mob.health <= 0 && time >= mob.respawnAt) {
        // Se o spawn estiver ocupado, usa um quadrado livre ao redor.
        let spawn = definition.spawn;
        if (
          (multiplayer
            ? multiplayer.players().some((p) => distance(p.position, spawn) === 0)
            : distance(account.position, spawn) === 0) ||
          getMobs(account).some(
            (other) => other.id !== mob.id && other.health > 0 && distance(other, spawn) === 0,
          )
        )
          spawn =
            [
              [0, 1],
              [1, 0],
              [-1, 0],
              [0, -1],
            ]
              .map(([dx, dy]) => ({ x: spawn.x + dx, y: spawn.y + dy, z: floorOf(spawn) }))
              .find(
                (point) =>
                  walkable(point.x, point.y, floorOf(point)) &&
                  (multiplayer
                    ? multiplayer.players().every((p) => distance(point, p.position) > 0)
                    : distance(point, account.position) > 0) &&
                  !mobAt(account, point.x, point.y, floorOf(point)),
              ) || null;
        if (spawn) {
          Object.assign(mob, spawn, { health: mobMaximum(account, definition), respawnAt: 0 });
          creature.aggro = false;
          changed = true;
        }
      }
      if (mob.health <= 0 || playerRespawned) continue;
      if (
        definition.boss &&
        !inBossRoom(account.position) &&
        (!multiplayer || !creature.targetPlayerId)
      ) {
        creature.aggro = false;
        creature.special = null;
        creature.nextSpecial = time + 1000;
        state.poisons.delete(mob.id);
        if (state.targetId === mob.id) state.targetId = null;
        if (distance(mob, definition.spawn) !== 0 || mob.health !== mob.maxHealth) {
          Object.assign(mob, definition.spawn, { health: mob.maxHealth });
          multiplayer?.onReset?.(mob);
          changed = true;
        }
        continue;
      }
      if (isSafeZone(account.position)) {
        if (!multiplayer) creature.aggro = false;
        state.targetId = null;
      }
      if (!sameFloor(account.position, mob)) {
        if (!multiplayer) creature.aggro = false;
        state.poisons.delete(mob.id);
        if (state.targetId === mob.id) state.targetId = null;
        continue;
      }
      const poison = state.poisons.get(mob.id);
      if (poison && (isSafeZone(account.position) || !sameFloor(poison, account.position)))
        state.poisons.delete(mob.id);
      else if (poison && time >= poison.nextTickAt) {
        const ticks = Math.min(poison.remaining, Math.floor((time - poison.nextTickAt) / 1000) + 1);
        poison.nextTickAt += ticks * 1000;
        poison.remaining -= ticks;
        for (let i = 0; i < ticks && mob.health > 0; i++)
          damageMob(account, state, mob, events, {
            base: poison.damage,
            element: 'lightning',
            magic: true,
            ability: 'w',
          });
        if (!poison.remaining) state.poisons.delete(mob.id);
        changed = true;
      }
      if (mob.health <= 0) continue;
      if (multiplayer && hitMob(account, state, mob, events)) changed = true;
      if (multiplayer && creature.targetPlayerId && creature.targetPlayerId !== account.id)
        continue;
      if (!multiplayer && !isSafeZone(account.position) && distance(account.position, mob) <= 5)
        creature.aggro = true;
      if (creature.special && time >= creature.special.endsAt) {
        const special = creature.special;
        creature.special = null;
        const victims = multiplayer ? multiplayer.players() : [account];
        for (const victim of victims)
          if (
            special.tiles.some((p) => distance(p, victim.position) === 0) &&
            !isSafeZone(victim.position)
          ) {
            hurtPlayer(
              victim,
              mob,
              roll(definition.boss ? 12 : 3, definition.boss ? 18 : 6),
              events,
              { element: definition.boss ? undefined : 'fire' },
            );
            if (!victim.vitals.health) {
              resetEncounter(victim, runtime(victim), events);
              if (victim === account) playerRespawned = true;
            }
          }
        if (special.kind === 'charge') {
          const landing = [...special.tiles]
            .reverse()
            .find(
              (p) =>
                (multiplayer
                  ? multiplayer.players().every((v) => distance(p, v.position) > 0)
                  : distance(p, account.position) > 0) && !mobAt(account, p.x, p.y, p.z),
            );
          if (landing) Object.assign(mob, landing);
        }
        changed = true;
        if (playerRespawned) continue;
        if (!account.vitals.health) {
          resetEncounter(account, state, events);
          playerRespawned = true;
          continue;
        }
      }
      if (
        (definition.boss || mob.variant === 'shaman') &&
        creature.aggro &&
        !creature.special &&
        time >= (creature.nextSpecial || 0) &&
        visibleFrom(account, mob)
      ) {
        prepareSpecial(account, mob, creature, time);
        changed = true;
      }
      if (!creature.special && time >= creature.nextMove && distance(account.position, mob) > 1) {
        creature.nextMove = time + (definition.moveIntervalMs || ORC_MOVE_INTERVAL_MS);
        const step =
          creature.aggro && definition.range && distance(account.position, mob) <= definition.range
            ? null
            : nextStep(
                account,
                mob,
                creature.aggro ? account.position : definition.spawn,
                creature.aggro,
              );
        if (step) {
          Object.assign(mob, step);
          changed = true;
        }
      }
      if (
        mob.variant === 'archer' &&
        creature.aggro &&
        distance(mob, account.position) <= 2 &&
        time >= (creature.nextRetreat || 0)
      ) {
        creature.nextRetreat = time + ORC_MOVE_INTERVAL_MS;
        const retreat = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([x, y]) => ({ x: mob.x + x, y: mob.y + y, z: floorOf(mob) }))
          .filter(
            (p) =>
              walkable(p.x, p.y, p.z) &&
              !isSafeZone(p) &&
              !mobAt(account, p.x, p.y, p.z) &&
              distance(p, account.position) > distance(mob, account.position),
          )
          .sort((a, b) => distance(b, account.position) - distance(a, account.position))[0];
        if (retreat) {
          Object.assign(mob, retreat);
          changed = true;
        }
      }
      if (!multiplayer && hitMob(account, state, mob, events)) changed = true;
      if (
        !isSafeZone(account.position) &&
        mob.health > 0 &&
        mob.variant !== 'shaman' &&
        distance(account.position, mob) <= (definition.range || 1) &&
        visibleFrom(account, mob) &&
        time >= creature.nextAttack
      ) {
        const damage = roll(definition.damageMin || DAMAGE_MIN, definition.damageMax || DAMAGE_MAX);
        creature.nextAttack = time + (definition.attackIntervalMs ?? ATTACK_INTERVAL_MS);
        hurtPlayer(account, mob, damage, events, {
          critical: damage === (definition.damageMax || DAMAGE_MAX),
        });
        changed = true;
        if (!account.vitals.health) {
          resetEncounter(account, state, events);
          playerRespawned = true;
        }
      }
    }
    if (changed) {
      account.worldRevision++;
      await save();
    }
    return snapshot(account, {
      events,
      playerRespawned,
      ...(playerRespawned ? { position: { ...SPAWN } } : {}),
    });
  }
  return {
    tick,
    view: (account) => snapshot(account),
    canMove(account, x, y, z = floorOf(account.position)) {
      const state = runtime(account);
      return now() >= state.respawnUntil && !mobAt(account, x, y, z);
    },
    stop(account, { disengage = false } = {}) {
      const state = runtime(account);
      state.targetId = null;
      if (disengage) {
        cancelRecall(account);
        state.poisons.clear();
        for (const creature of Object.values(state.creatures)) {
          if (multiplayer && creature.targetPlayerId !== account.id) continue;
          if (multiplayer) creature.targetPlayerId = null;
          creature.aggro = false;
          creature.special = null;
        }
      }
      account.worldRevision++;
      return snapshot(account);
    },
    async attack(account, { toggle = true, mobId = 'orc', nearest = false } = {}) {
      const state = runtime(account),
        mob = nearest
          ? getMobs(account)
              .filter((m) => m.health > 0 && sameFloor(m, account.position) && !isSafeZone(m))
              .sort((a, b) => distance(a, account.position) - distance(b, account.position))[0]
          : getMobs(account).find((mob) => mob.id === mobId);
      if (isSafeZone(account.position))
        return snapshot(account, {
          message: 'Você está na área protegida. Saia dela para combater.',
        });
      if (!mob || mob.health <= 0 || !sameFloor(account.position, mob))
        return snapshot(account, { message: 'Esse inimigo não está disponível.' });
      if (toggle && !nearest && state.targetId === mob.id) {
        state.targetId = null;
        account.worldRevision++;
        return snapshot(account, { message: 'Ataque interrompido.' });
      }
      state.targetId = mob.id;
      if (now() - state.lastTick > 2000) state.poisons.clear();
      state.lastTick = now();
      account.worldRevision++;
      return tick(account);
    },
    async cast(account, { key, x, y, z } = {}) {
      const state = runtime(account),
        time = now(),
        ability =
          typeof key === 'string' && Object.hasOwn(LIGHTNING_ABILITIES, key)
            ? LIGHTNING_ABILITIES[key]
            : null;
      const reject = (message) => snapshot(account, { message, cast: false });
      if (!ability || account.equipment.weapon?.id !== LIGHTNING_STAFF)
        return reject('Equipe o Cajado de raio para usar Q, W, E e R.');
      if (account.vitals.health <= 0 || time < state.respawnUntil || isSafeZone(account.position))
        return reject('Você não pode usar habilidades aqui.');
      account.abilityCooldowns ??= {};
      if (time < (account.abilityCooldowns.global || 0))
        return reject('Aguarde 0,5 segundo entre habilidades.');
      if (time < (account.abilityCooldowns[key] || 0))
        return reject('Esta habilidade está em recarga.');
      if (account.vitals.mana < ability.mana) return reject('Mana insuficiente.');
      const target = getMobs(account).find((m) => m.id === state.targetId && m.health > 0);
      const aimed =
        key === 'e' && (x !== undefined || y !== undefined)
          ? { x, y, z: z ?? floorOf(account.position) }
          : target;
      if (
        key === 'e' &&
        (!aimed ||
          !Number.isInteger(aimed.x) ||
          !Number.isInteger(aimed.y) ||
          distance(account.position, aimed) > 3 ||
          !walkable(aimed.x, aimed.y, floorOf(aimed)) ||
          !visibleFrom(account, aimed))
      )
        return reject('Escolha uma área visível a até 3 quadrados no mesmo andar.');
      if (
        key !== 'r' &&
        key !== 'e' &&
        (!target || distance(account.position, target) > 3 || !visibleFrom(account, target))
      )
        return reject('Selecione um inimigo visível a até 3 quadrados.');
      const base = lightningDamage(skillProgress(account.skills.magic.xp).level),
        events = [];
      account.vitals.mana -= ability.mana;
      state.lastTick = time;
      account.abilityCooldowns[key] = time + ability.cooldown;
      account.abilityCooldowns.global = time + ABILITY_GLOBAL_COOLDOWN_MS;
      if (key === 'w') {
        state.poisons.set(target.id, {
          damage: base * ability.multiplier,
          nextTickAt: time + 1000,
          remaining: 5,
          z: floorOf(target),
        });
        state.creatures[target.id].aggro = true;
        events.push({
          type: 'poison-applied',
          ability: key,
          element: 'lightning',
          x: target.x,
          y: target.y,
          z: floorOf(target),
          fromX: account.position.x,
          fromY: account.position.y,
        });
      } else {
        const center =
          key === 'r' ? { ...account.position } : key === 'e' ? { ...aimed } : { ...target };
        const victims = ability.size
          ? getMobs(account).filter(
              (m) =>
                m.health > 0 &&
                distance(m, center) <= Math.floor(ability.size / 2) &&
                visibleFrom(account, m),
            )
          : [target];
        if (ability.size)
          events.push({
            type: 'ability-area',
            ability: key,
            element: 'lightning',
            areaSize: ability.size,
            x: center.x,
            y: center.y,
            z: floorOf(center),
          });
        const healing = key === 'r' ? Math.round(account.vitals.maxHealth * 0.25) : 0;
        for (const victim of victims)
          damageMob(account, state, victim, events, {
            base: base * ability.multiplier,
            element: 'lightning',
            magic: true,
            ability: key,
          });
        if (healing)
          account.vitals.health = Math.min(
            account.vitals.maxHealth,
            account.vitals.health + healing,
          );
      }
      account.worldRevision++;
      await save();
      return snapshot(account, { cast: true, events, message: `${ability.name}!` });
    },
    async heal(account) {
      const state = runtime(account);
      if (distance(account.position, WELL) > 1 || !walkable(account.position.x, account.position.y))
        return snapshot(account, {
          message: 'Aproxime-se da fonte do templo para restaurar vida e mana.',
        });
      account.vitals.health = account.vitals.maxHealth;
      account.vitals.mana = account.vitals.maxMana;
      state.targetId = null;
      account.worldRevision++;
      await save();
      return snapshot(account, {
        healed: true,
        message: 'A fonte do templo restaurou toda a sua vida e mana.',
      });
    },
    loot(account, { id }) {
      runtime(account);
      const corpse = getCorpses(account).find((corpse) => corpse.id === id);
      if (!corpse || (Number.isFinite(corpse.expiresAt) && now() >= corpse.expiresAt))
        return snapshot(account, { message: 'Esse corpo não está mais aqui.' });
      if (distance(account.position, corpse) > 1)
        return snapshot(account, { message: 'Aproxime-se do corpo para abrir o loot.' });
      return snapshot(account, { loot: { ...corpse } });
    },
  };
}
