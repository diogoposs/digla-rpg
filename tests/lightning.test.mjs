import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureProgress } from '../public/js/game/progression.js';
import { createWorldService } from '../server/world.mjs';
import { getMobs } from '../public/js/game/world-rules.js';
import { LIGHTNING_STAFF, lightningDamage } from '../public/js/game/lightning-rules.js';
import { ITEMS } from '../public/js/items.js';
import { shopStock } from '../public/js/game/town-rules.js';
import { isolateMobs } from './helpers/combat.mjs';

function arena(ids = ['orc_captain']) {
  const a = isolateMobs(
    ensureProgress({
      position: { x: 86, y: 30 },
      equipment: { weapon: { id: LIGHTNING_STAFF, quantity: 1 } },
    }),
    ids,
  );
  const captain = a.elementals.orc_captain;
  Object.assign(captain, { x: 86, y: 26, z: 0 });
  return a;
}
async function selected(a, service) {
  await service.attack(a, { mobId: 'orc_captain', toggle: false });
  a.position = { x: 86, y: 27 };
}
test('cajado tem ATK 3, custa 1, usa base 3+5×magia, alcance 3 e auto a cada 3 segundos', async () => {
  assert.equal(ITEMS[LIGHTNING_STAFF].atk, 3);
  assert.equal(shopStock('gear').find((i) => i.id === LIGHTNING_STAFF).price, 1);
  assert.equal(lightningDamage(1), 8);
  assert.equal(lightningDamage(3), 18);
  let time = 0;
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await selected(a, service);
  const first = await service.tick(a);
  assert.equal(first.events.find((e) => e.type === 'player-hit').damage, 12); // fraqueza +50%
  time = 1000;
  assert.equal((await service.tick(a)).events.filter((e) => e.type === 'player-hit').length, 0);
  time = 2000;
  await service.tick(a);
  time = 2999;
  assert.equal((await service.tick(a)).events.filter((e) => e.type === 'player-hit').length, 0);
  time = 3000;
  assert.equal((await service.tick(a)).events.find((e) => e.type === 'player-hit').damage, 12);
});
test('F seleciona o mais próximo fora do alcance, mantém seleção e troca para um mais próximo', async () => {
  const a = arena(['orc_captain', 'orc_guard_west']);
  Object.assign(a.elementals.orc_guard_west, { x: 84, y: 25 });
  const service = createWorldService({ save: async () => {}, now: () => 0, random: () => 0 });
  const first = await service.attack(a, { nearest: true, toggle: false });
  assert.equal(first.mobs.find((m) => m.targeted).id, 'orc_captain');
  assert.equal(first.events.length, 0);
  assert.equal(
    (await service.attack(a, { nearest: true, toggle: false })).mobs.find((m) => m.targeted).id,
    'orc_captain',
  );
  a.elementals.orc_guard_west.x = 85;
  a.elementals.orc_guard_west.y = 29;
  assert.equal(
    (await service.attack(a, { nearest: true, toggle: false })).mobs.find((m) => m.targeted).id,
    'orc_guard_west',
  );
});
test('Q causa 2× com uma única fraqueza, concede XP real e cooldown/global impedem spam simultâneo', async () => {
  let time = 0;
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await selected(a, service);
  const [first, duplicate] = await Promise.all([
    service.cast(a, { key: 'q' }),
    service.cast(a, { key: 'q' }),
  ]);
  assert.equal(first.cast, true);
  assert.equal(duplicate.cast, false);
  assert.equal(first.events[0].damage, 24);
  assert.equal(a.vitals.mana, 95);
  assert.equal(a.skills.magic.xp, 12);
  assert.equal(a.skills.vitality.xp, 8);
  time = 499;
  assert.equal((await service.cast(a, { key: 'w' })).cast, false);
  time = 500;
  assert.equal((await service.cast(a, { key: 'w' })).cast, true);
  assert.equal(a.vitals.mana, 85);
  time = 1000;
  assert.equal((await service.cast(a, { key: 'q' })).cast, false);
  time = 2000;
  assert.equal((await service.cast(a, { key: 'q' })).cast, true);
});
test('W dá cinco pulsos de 0,5× um por segundo e continua sem auto-ataque ou alcance', async () => {
  let time = 0;
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await selected(a, service);
  assert.equal((await service.cast(a, { key: 'w' })).cast, true);
  assert.equal(a.elementals.orc_captain.health, 800);
  service.stop(a);
  a.position = { x: 86, y: 31 };
  const hits = [];
  for (time = 1000; time <= 6000; time += 1000)
    hits.push(...(await service.tick(a)).events.filter((e) => e.ability === 'w' && e.damage));
  assert.deepEqual(
    hits.map((e) => e.damage),
    [6, 6, 6, 6, 6],
  );
  assert.equal(a.elementals.orc_captain.health, 770);
  assert.equal(a.skills.magic.xp, 15);
});
test('E atinge apenas o 3×3 no andar atual, não atinge jogador e aplica XP por vítima', async () => {
  const a = arena(['orc_captain', 'orc_guard_west', 'orc_guard_east', 'orc_rampart']);
  Object.assign(a.elementals.orc_guard_west, { x: 85, y: 25, z: 0 });
  Object.assign(a.elementals.orc_guard_east, { x: 88, y: 26, z: 0 });
  Object.assign(a.elementals.orc_rampart, { x: 86, y: 26, z: 1 });
  const service = createWorldService({ save: async () => {}, now: () => 0, random: () => 0 });
  await selected(a, service);
  a.vitals.health = 50;
  const result = await service.cast(a, { key: 'e' });
  assert.equal(result.cast, true);
  assert.equal(result.events[0].areaSize, 3);
  assert.deepEqual(
    result.events.filter((e) => e.damage).map((e) => e.damage),
    [18, 18],
  );
  assert.equal(a.elementals.orc_guard_east.health, 500);
  assert.equal(a.elementals.orc_rampart.health, 400);
  assert.equal(a.vitals.health, 50);
  assert.equal(a.vitals.mana, 90);
  assert.equal(a.skills.magic.xp, 18);
});
test('R usa área 5×5, dano 5×, cura 25% sem exceder máximo e mantém loot/XP dos mortos', async () => {
  let time = 0;
  const a = arena(['orc_captain', 'orc_guard_west', 'orc_guard_east']);
  a.position = { x: 86, y: 27 };
  Object.assign(a.elementals.orc_guard_west, { x: 85, y: 26, health: 40 });
  Object.assign(a.elementals.orc_guard_east, { x: 89, y: 27 });
  a.vitals.health = 50;
  const service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  const result = await service.cast(a, { key: 'r' });
  assert.equal(result.events[0].areaSize, 5);
  assert.equal(a.vitals.health, 75);
  assert.equal(a.vitals.mana, 60);
  assert.equal(a.elementals.orc_captain.health, 740);
  assert.equal(a.elementals.orc_guard_west.health, 0);
  assert.equal(a.elementals.orc_guard_east.health, 500);
  assert.ok(a.elementalCorpses.orc_guard_west.slots.some((i) => i?.id === 'gold_coin'));
  assert.equal(a.skills.magic.xp, 50);
  assert.equal(a.skills.vitality.xp, 100 / 3);
  assert.equal((await service.cast(a, { key: 'r' })).cast, false);
  time = 15000;
  a.vitals.health = 99;
  assert.equal((await service.cast(a, { key: 'r' })).cast, true);
  assert.equal(a.vitals.health, 100);
});
test('recargas individuais são exatas, persistem ao recarregar e custo só ocorre na habilidade aceita', async () => {
  let time = 0;
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await selected(a, service);
  for (const [key, at, until] of [
    ['q', 0, 2000],
    ['w', 500, 6500],
    ['e', 1000, 5000],
    ['r', 1500, 16500],
  ]) {
    time = at;
    assert.equal((await service.cast(a, { key })).cast, true);
    assert.equal(a.abilityCooldowns[key], until);
  }
  assert.equal(a.vitals.mana, 35);
  const loaded = JSON.parse(JSON.stringify(a));
  const restarted = createWorldService({ save: async () => {}, now: () => 2000 });
  assert.equal((await restarted.cast(loaded, { key: 'r' })).cast, false);
  assert.equal(loaded.vitals.mana, 35);
});
test('cast rejeita arma errada, mana, alcance, piso, paredes, zona segura e chaves forjadas', async () => {
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => 0, random: () => 0 });
  await selected(a, service);
  for (const key of ['__proto__', 'constructor', 'x', null])
    assert.equal((await service.cast(a, { key })).cast, false);
  a.vitals.mana = 4;
  assert.equal((await service.cast(a, { key: 'q' })).cast, false);
  assert.equal(a.vitals.mana, 4);
  a.vitals.mana = 100;
  a.equipment.weapon = { id: 'staff', quantity: 1 };
  assert.equal((await service.cast(a, { key: 'r' })).cast, false);
  a.equipment.weapon = { id: LIGHTNING_STAFF, quantity: 1 };
  a.position = { x: 86, y: 31 };
  assert.equal((await service.cast(a, { key: 'q' })).cast, false);
  a.position = { x: 86, y: 27, z: 1 };
  assert.equal((await service.cast(a, { key: 'q' })).cast, false);
  a.position = { x: 29, y: 27 };
  assert.equal((await service.cast(a, { key: 'r' })).cast, false);
  assert.equal(a.vitals.mana, 100);
  a.position = { x: 86, y: 31 };
  a.elementals.orc_captain.x = 85;
  a.elementals.orc_captain.y = 28;
  assert.equal((await service.cast(a, { key: 'q' })).cast, false);
});
test('sair/pausar cancela os pulsos pendentes para não aplicar dano offline', async () => {
  let time = 0;
  const a = arena(),
    service = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await selected(a, service);
  await service.cast(a, { key: 'w' });
  service.stop(a, { disengage: true });
  time = 1000;
  assert.equal((await service.tick(a)).events.filter((e) => e.ability === 'w').length, 0);
});
