import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldService } from '../server/world.mjs';
import { createGroundCleanup } from '../server/ground-cleanup.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { getCorpses } from '../public/js/game/world-rules.js';
import { SPAWN, STEP_DURATION_MS } from '../public/js/config.js';
import { Movement } from '../public/js/game/movement.js';
import { combatAccount, orcPoint } from './helpers/combat.mjs';

const player = (extra) => ensureProgress({ position: { x: 29, y: 28 }, ...extra });
test('H custa 10, dura 5s, recarrega em 10s e spam simultâneo não duplica', async () => {
  let time = 1000;
  const a = player(),
    s = createWorldService({ save: async () => {}, now: () => time });
  await Promise.all([s.utility(a, { key: 'h' }), s.utility(a, { key: 'h' })]);
  assert.equal(a.vitals.mana, 90);
  assert.equal(a.utility.hasteUntil, 6000);
  assert.equal(a.utility.hasteCooldownUntil, 11000);
  const loaded = ensureProgress(JSON.parse(JSON.stringify(a)));
  await s.utility(loaded, { key: 'h' });
  assert.equal(loaded.vitals.mana, 90);
  time = 11000;
  await s.utility(a, { key: 'h' });
  assert.equal(a.vitals.mana, 80);
  time = 21000;
  a.vitals.mana = 9;
  await s.utility(a, { key: 'h' });
  assert.equal(a.utility.hasteCooldownUntil, 21000);
  assert.equal(a.vitals.mana, 9);
  const movement = new Movement({ x: 29, y: 28 }, {}, () => true);
  movement.speedMultiplier = 1.5;
  movement.update(1000, 0, 'ArrowRight');
  movement.update(1001, STEP_DURATION_MS / 1.5, undefined);
  assert.equal(movement.travel, null);
  assert.equal(movement.player.x, 30);
});
test('três atalhos persistem, aceitam só poções e respeitam inventário e limites', async () => {
  const a = player({
      inventory: [
        { id: 'health_potion', quantity: 2 },
        { id: 'mana_potion', quantity: 2 },
      ],
    }),
    s = createWorldService({ save: async () => {} });
  await s.utility(a, { key: 'quick', index: 2, configure: true, itemId: 'mana_potion' });
  assert.deepEqual(ensureProgress(JSON.parse(JSON.stringify(a))).quickSlots, [
    'health_potion',
    'mana_potion',
    'mana_potion',
  ]);
  a.vitals.health = 90;
  a.vitals.mana = 80;
  await s.utility(a, { key: 'quick', index: 0 });
  await s.utility(a, { key: 'quick', index: 2 });
  assert.equal(a.vitals.health, 100);
  assert.equal(a.vitals.mana, 100);
  assert.equal(a.inventory[0].quantity, 1);
  assert.equal(a.inventory[1].quantity, 1);
  await s.utility(a, { key: 'quick', index: 0 });
  assert.equal(a.inventory[0].quantity, 1);
  await s.utility(a, { key: 'quick', index: 2, configure: true, itemId: 'sword' });
  assert.equal(a.quickSlots[2], 'mana_potion');
  await s.utility(a, { key: 'quick', index: 3 });
  assert.equal(a.quickSlots.length, 3);
});
test('B requer 10s parado e conectado, retorna ao spawn e persiste recarga de 10min', async () => {
  let time = 1000;
  const a = player(),
    s = createWorldService({ save: async () => {}, now: () => time });
  await s.utility(a, { key: 'b' });
  assert.equal(a.utility.recall.endsAt, 11000);
  for (time = 1250; time < 11000; time += 250) {
    const r = await s.tick(a);
    assert.equal(r.teleported, undefined);
  }
  const result = await s.tick(a);
  assert.equal(result.teleported, true);
  assert.deepEqual(a.position, SPAWN);
  assert.equal(a.utility.recallCooldownUntil, 611000);
  const loaded = ensureProgress(JSON.parse(JSON.stringify(a)));
  await s.utility(loaded, { key: 'b' });
  assert.equal(loaded.utility.recall, null);
  time = 611000;
  await s.utility(a, { key: 'b' });
  assert.ok(a.utility.recall);
  time += 3000;
  await s.tick(a);
  assert.equal(a.utility.recall, null);
  const b = combatAccount();
  b.orc.health = 0;
  b.orc.respawnAt = Number.MAX_SAFE_INTEGER;
  time = 20000;
  await s.utility(b, { key: 'b' });
  for (time = 20250; time < 30000; time += 250) await s.tick(b);
  b.orc.health = b.orc.maxHealth;
  const boundary = await s.tick(b);
  assert.equal(boundary.teleported, undefined);
  assert.equal(b.utility.recall, null);
  assert.ok(boundary.events.some((e) => e.type === 'recall-cancelled'));
});
test('B cancela ao mover, ao sair/pausar e com qualquer dano, inclusive no último instante', async () => {
  let time = 0;
  const a = combatAccount(),
    s = createWorldService({ save: async () => {}, now: () => time, random: () => 0 });
  await s.utility(a, { key: 'b' });
  s.moved(a, orcPoint(1, 1));
  assert.equal(a.utility.recall, null);
  assert.equal(a.utility.recallCooldownUntil, 0);
  await s.utility(a, { key: 'b' });
  s.stop(a, { disengage: true });
  assert.equal(a.utility.recall, null);
  await s.utility(a, { key: 'b' });
  time = 1000;
  const r = await s.tick(a);
  assert.equal(a.utility.recall, null);
  assert.ok(r.events.some((e) => e.type === 'recall-cancelled'));
  assert.equal(a.vitals.health, 97);
  // A hit on the completion tick wins over teleportation.
  time = 2000;
  await s.utility(a, { key: 'b' });
  for (time = 2250; time < 12000; time += 250) {
    a.position = { x: 86, y: 30 };
    s.moved(a, a.position);
    await s.tick(a);
    if (!a.utility.recall) break;
  }
  // Leaving the original square also invalidates the cast even without a movement API call.
  assert.equal(a.utility.recall, null);
});
test('corpos expiram após 2min sem adiar ao mover; loot e pilhas seguem seus prazos', async () => {
  let time = 1000;
  const a = combatAccount(),
    s = createWorldService({ save: async () => {}, now: () => time, random: () => 0 }),
    cleanup = createGroundCleanup({ save: async () => {}, now: () => time });
  a.orc.health = 1;
  await s.attack(a);
  const first = a.corpse;
  assert.equal(first.expiresAt, 121000);
  await s.transfer(a, { source: 'corpse', id: first.id, target: 'ground', x: 86, y: 28 });
  assert.equal(first.y, 28);
  assert.equal(first.expiresAt, 121000);
  assert.ok(first.slots.some((i) => i?.id === 'gold_coin'));
  const previous = { ...first };
  await s.transfer(a, { source: 'corpse', id: first.id, target: 'ground', x: -1, y: 28 });
  assert.equal(first.x, previous.x);
  a.position = { x: 29, y: 28 };
  assert.equal(
    (await s.transfer(a, { source: 'corpse', id: first.id, target: 'ground', x: 29, y: 29 })).moved,
    undefined,
  );
  a.position = orcPoint();
  time = 16000;
  await s.tick(a);
  a.orc.health = 1;
  await s.attack(a, { toggle: false });
  assert.equal(getCorpses(a).length, 2);
  time = 120999;
  await cleanup.sweep(a);
  assert.equal(getCorpses(a).length, 2);
  time = 121000;
  assert.equal(s.loot(a, { id: first.id }).loot, undefined);
  const remainingLoot = JSON.stringify(first.slots);
  await s.transfer(a, {
    source: 'loot',
    corpseId: first.id,
    slot: 0,
    itemId: 'sword',
    target: 'inventory',
  });
  assert.equal(JSON.stringify(first.slots), remainingLoot);
  await cleanup.sweep(a);
  assert.equal(getCorpses(a).length, 1);
  assert.notEqual(a.corpse.id, first.id);
  time = 136000;
  await cleanup.sweep(a);
  assert.equal(getCorpses(a).length, 0);
});
