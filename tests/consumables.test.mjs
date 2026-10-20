import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { gainVitalityXp } from '../public/js/game/vitality-rules.js';
import { createWorldService } from '../server/world.mjs';
import { createTownService } from '../server/town.mjs';
import { TOWN_POINTS, shopStock } from '../public/js/game/town-rules.js';
import { combatAccount } from './helpers/combat.mjs';

const player = (extra = {}) => ensureProgress({ position: { x: 29, y: 27 }, ...extra });

test('poções restauram imediatamente 35/50, respeitam máximos e não consomem com recurso cheio', async () => {
  const a = player({
    inventory: [
      { id: 'health_potion', quantity: 3 },
      { id: 'mana_potion', quantity: 3 },
    ],
  });
  const service = createWorldService({ save: async () => {} });
  a.vitals.health = 40;
  a.vitals.mana = 30;
  assert.equal((await service.use(a, { slot: 0, itemId: 'health_potion' })).restored, 35);
  assert.equal(a.vitals.health, 75);
  assert.equal((await service.use(a, { slot: 0, itemId: 'health_potion' })).restored, 25);
  assert.equal((await service.use(a, { slot: 0, itemId: 'health_potion' })).consumed, undefined);
  assert.equal(a.inventory[0].quantity, 1);
  assert.equal((await service.use(a, { slot: 1, itemId: 'mana_potion' })).restored, 50);
  assert.equal((await service.use(a, { slot: 1, itemId: 'mana_potion' })).restored, 20);
  assert.equal((await service.use(a, { slot: 1, itemId: 'mana_potion' })).consumed, undefined);
  assert.equal(a.inventory[1].quantity, 1);
});

test('salmão dá 20/15 a cada 3 segundos por exatamente 20 intervalos, sem duplicação ou excesso', async () => {
  let time = 0;
  const a = player({
    skills: { vitality: { xp: 1500 } },
    inventory: [{ id: 'roasted_salmon', quantity: 1 }],
  });
  const service = createWorldService({ save: async () => {}, now: () => time });
  a.vitals.health = 10;
  a.vitals.mana = 0;
  assert.equal((await service.use(a, { slot: 0, itemId: 'roasted_salmon' })).consumed, true);
  assert.equal(a.vitals.health, 10);
  time = 2999;
  await service.tick(a);
  assert.equal(a.vitals.health, 10);
  time = 3000;
  await Promise.all([service.tick(a), service.tick(a)]);
  assert.equal(a.vitals.health, 30);
  assert.equal(a.vitals.mana, 15);
  assert.equal(a.foodEffect.remainingTicks, 19);
  time = 60000;
  await service.tick(a);
  assert.equal(a.vitals.health, a.vitals.maxHealth);
  assert.equal(a.vitals.mana, a.vitals.maxMana);
  assert.equal(a.foodEffect, null);
  a.vitals.health = 50;
  a.vitals.mana = 50;
  time = 63000;
  await service.tick(a);
  assert.equal(a.vitals.health, 50);
  assert.equal(a.vitals.mana, 50);
});

test('novos salmões acrescentam 1 minuto sem multiplicar a recuperação e efeito persiste ao reabrir', async () => {
  let time = 0;
  const a = player({ inventory: [{ id: 'roasted_salmon', quantity: 2 }] });
  const service = createWorldService({ save: async () => {}, now: () => time });
  a.vitals.health = 10;
  a.vitals.mana = 0;
  await service.use(a, { slot: 0, itemId: 'roasted_salmon' });
  await service.use(a, { slot: 0, itemId: 'roasted_salmon' });
  assert.equal(a.foodEffect.remainingTicks, 40);
  const loaded = ensureProgress(JSON.parse(JSON.stringify(a)));
  time = 3000;
  await service.tick(loaded);
  assert.equal(loaded.vitals.health, 30);
  assert.equal(loaded.vitals.mana, 15);
  time = 120000;
  await service.tick(loaded);
  assert.equal(loaded.foodEffect, null);
});

test('Vitalidade soma terços sem perder precisão e máximos crescem uma vez por nível, inclusive ao reabrir', () => {
  const a = player();
  for (let i = 0; i < 300; i++) gainVitalityXp(a, 1);
  assert.equal(a.skills.vitality.xp, 100);
  assert.equal(publicProgress(a).skills.vitality.level, 2);
  assert.equal(a.vitals.maxHealth, 130);
  assert.equal(a.vitals.maxMana, 115);
  a.vitals.health = 125;
  a.vitals.mana = 110;
  const loaded = ensureProgress(JSON.parse(JSON.stringify(a)));
  for (let i = 0; i < 5; i++) ensureProgress(loaded);
  assert.equal(loaded.vitals.health, 125);
  assert.equal(loaded.vitals.maxHealth, 130);
  gainVitalityXp(loaded, 600);
  assert.equal(publicProgress(loaded).skills.vitality.level, 3);
  assert.equal(loaded.vitals.maxHealth, 160);
  assert.equal(loaded.vitals.maxMana, 130);
});

test('Vitalidade recebe um terço do dano real com mãos, espada e todos os elementos, sem XP por spam', async () => {
  for (const [weapon, element] of [
    [null, 'fire'],
    ['sword', 'fire'],
    ['staff', 'fire'],
    ['staff', 'water'],
    ['staff', 'lightning'],
  ]) {
    const a = combatAccount({
      equipment: { weapon: weapon ? { id: weapon, quantity: 1 } : null },
      attackElement: element,
    });
    const service = createWorldService({ save: async () => {}, random: () => 0, now: () => 0 });
    const result = await service.attack(a);
    const damage = result.events.find((e) => e.type === 'player-hit').damage;
    assert.equal(a.skills.vitality.xp, damage / 3);
    await service.attack(a, { toggle: false });
    assert.equal(a.skills.vitality.xp, damage / 3);
  }
  const a = combatAccount();
  a.orc.health = 1;
  const result = await createWorldService({ save: async () => {}, random: () => 0.999 }).attack(a);
  assert.equal(result.events[0].damage, 1);
  assert.equal(a.skills.vitality.xp, 1 / 3);
});

test('Pang só negocia poções por 1 ouro, separado das lojas de comida e equipamento', async () => {
  assert.deepEqual(
    shopStock('potions')
      .map((i) => i.id)
      .sort(),
    ['health_potion', 'mana_potion'],
  );
  assert.ok(shopStock('potions').every((i) => i.price === 1));
  assert.ok(!shopStock('gear').some((i) => i.id.endsWith('_potion')));
  assert.ok(!shopStock('food').some((i) => i.id.endsWith('_potion')));
  const a = player({
    position: { x: TOWN_POINTS.potions.x, y: TOWN_POINTS.potions.y + 1 },
    inventory: [{ id: 'gold_coin', quantity: 2 }],
  });
  const service = createTownService({ save: async () => {} });
  assert.equal((await service.buy(a, { id: 'potions', itemId: 'health_potion' })).changed, true);
  assert.equal(a.inventory[0].quantity, 1);
  assert.equal((await service.buy(a, { id: 'potions', itemId: 'mana_potion' })).changed, true);
  assert.equal((await service.buy(a, { id: 'potions', itemId: 'sword' })).changed, false);
  const slot = a.inventory.findIndex((i) => i?.id === 'health_potion');
  assert.equal(
    (await service.sell(a, { id: 'potions', itemId: 'health_potion', slot })).changed,
    true,
  );
  assert.ok(a.inventory.some((i) => i?.id === 'gold_coin' && i.quantity === 1));
});
