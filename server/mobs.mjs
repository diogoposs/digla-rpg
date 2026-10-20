import { randomUUID } from 'node:crypto';
import { SPAWN, WELL, WIDTH, HEIGHT } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';
import { ensureProgress, skillProgress } from '../public/js/game/progression.js';
import { gainVitalityXp } from '../public/js/game/vitality-rules.js';
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
  weaponRange,
  distance,
} from '../public/js/game/world-rules.js';

// Todas as criaturas usam as mesmas regras de seleção, perseguição e combate.
export function createMobService({ save, random = Math.random, now = Date.now }) {
  const runtimes = new WeakMap();
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
        creatures: Object.fromEntries(
          getMobs(account).map((mob) => [
            mob.id,
            {
              aggro: false,
              nextMove: now() + ORC_MOVE_INTERVAL_MS,
              nextAttack: now() + (MOB_DEFINITIONS[mob.id].attackIntervalMs ?? ATTACK_INTERVAL_MS),
            },
          ]),
        ),
      };
      runtimes.set(account, state);
    }
    return state;
  }
  const roll = (min = DAMAGE_MIN, max = DAMAGE_MAX) =>
    min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
  function snapshot(account, extra = {}) {
    const state = runtime(account),
      mobs = getMobs(account).map((mob) => ({
        ...mob,
        targeted: state.targetId === mob.id,
        chasing: state.creatures[mob.id].aggro,
      }));
    return {
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
      serverNow: now(),
      skills: {
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
      state.creatures[mob.id].aggro = false;
      Object.assign(mob, MOB_DEFINITIONS[mob.id].spawn);
    }
    events.push({ type: 'player-respawn' });
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
      slots: Array(ORC_LOOT_CAPACITY).fill(null),
    };
    if (mob.kind === 'orc' && random() < ORC_DROP_CHANCE)
      corpse.slots[0] = { id: random() < 0.5 ? 'sword' : 'staff', quantity: 1 };
    corpse.slots[1] = { id: 'gold_coin', quantity: roll(COIN_DROP_MIN, COIN_DROP_MAX) };
    if (mob.id === 'orc') account.corpse = corpse;
    else account.elementalCorpses[mob.id] = corpse;
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
    const dealt = Math.min(Math.round(base * multiplier), mob.health);
    mob.health -= dealt;
    gainVitalityXp(account, dealt);
    state.creatures[mob.id].aggro = true;
    if (magic || sword) account.skills[magic ? 'magic' : 'combat'].xp += dealt * WEAPON_XP_FACTOR;
    events.push({
      type: 'player-hit',
      mobId: mob.id,
      mobName: mob.name,
      damage: dealt,
      critical: criticalMax !== undefined && dealt === Math.round(criticalMax * multiplier),
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
      mob.respawnAt = now() + ORC_RESPAWN_MS;
      makeCorpse(account, mob);
      if (state.targetId === mob.id) state.targetId = null;
      state.poisons.delete(mob.id);
      state.creatures[mob.id].aggro = false;
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
        : { min: DAMAGE_MIN, max: DAMAGE_MAX };
    state.nextPlayerAttack = now() + (lightning ? LIGHTNING_AUTO_INTERVAL_MS : ATTACK_INTERVAL_MS);
    return damageMob(account, state, mob, events, {
      base: lightning ? base : roll(limits.min, limits.max),
      element: lightning ? 'lightning' : weapon === 'staff' ? account.attackElement : null,
      magic: lightning || weapon === 'staff',
      sword: weapon === 'sword',
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
          distance(step, account.position) === 0 ||
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
  async function tick(account) {
    const state = runtime(account),
      time = now(),
      events = [];
    if (time - state.lastTick > 2000) {
      state.targetId = null;
      state.poisons.clear();
      for (const [id, creature] of Object.entries(state.creatures))
        Object.assign(creature, {
          aggro: false,
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
      if (mob.health <= 0 && time >= mob.respawnAt) {
        // Se o spawn estiver ocupado, usa um quadrado livre ao redor.
        let spawn = definition.spawn;
        if (
          distance(account.position, spawn) === 0 ||
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
                  distance(point, account.position) > 0 &&
                  !mobAt(account, point.x, point.y, floorOf(point)),
              ) || null;
        if (spawn) {
          Object.assign(mob, spawn, { health: definition.maxHealth, respawnAt: 0 });
          creature.aggro = false;
          changed = true;
        }
      }
      if (mob.health <= 0 || playerRespawned) continue;
      if (isSafeZone(account.position)) {
        creature.aggro = false;
        state.targetId = null;
      }
      if (!sameFloor(account.position, mob)) {
        creature.aggro = false;
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
      if (!isSafeZone(account.position) && distance(account.position, mob) <= 5)
        creature.aggro = true;
      if (time >= creature.nextMove && distance(account.position, mob) > 1) {
        creature.nextMove = time + ORC_MOVE_INTERVAL_MS;
        const step = nextStep(
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
      if (hitMob(account, state, mob, events)) changed = true;
      if (
        !isSafeZone(account.position) &&
        mob.health > 0 &&
        distance(account.position, mob) <= 1 &&
        time >= creature.nextAttack
      ) {
        const damage = roll(definition.damageMin || DAMAGE_MIN, definition.damageMax || DAMAGE_MAX);
        creature.nextAttack = time + (definition.attackIntervalMs ?? ATTACK_INTERVAL_MS);
        account.vitals.health = Math.max(0, account.vitals.health - damage);
        changed = true;
        events.push({
          type: mob.id === 'orc' ? 'orc-hit' : 'mob-hit',
          mobId: mob.id,
          mobName: mob.name,
          damage,
          critical: damage === (definition.damageMax || DAMAGE_MAX),
          x: account.position.x,
          y: account.position.y,
          z: floorOf(account.position),
        });
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
    canMove(account, x, y, z = floorOf(account.position)) {
      const state = runtime(account);
      return now() >= state.respawnUntil && !mobAt(account, x, y, z);
    },
    stop(account, { disengage = false } = {}) {
      const state = runtime(account);
      state.targetId = null;
      if (disengage) {
        state.poisons.clear();
        for (const creature of Object.values(state.creatures)) creature.aggro = false;
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
    async cast(account, { key } = {}) {
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
      if (
        key !== 'r' &&
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
        const center = key === 'r' ? { ...account.position } : { ...target };
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
      if (!corpse) return snapshot(account, { message: 'Esse corpo não está mais aqui.' });
      if (distance(account.position, corpse) > 1)
        return snapshot(account, { message: 'Aproxime-se do corpo para abrir o loot.' });
      return snapshot(account, { loot: { ...corpse } });
    },
  };
}
