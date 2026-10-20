import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItemService } from '../server/items.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { ITEMS, EQUIPMENT_SLOT_IDS } from '../public/js/items.js';
import { SPAWN } from '../public/js/config.js';

const account = (inventory = []) => ensureProgress({ position: { ...SPAWN }, inventory });
const service = () => createItemService({ save: async () => {} });

test('todos os modelos equipam no espaço correspondente e voltam à mochila sem perda', async () => {
  const items = service();
  for (const [id, definition] of Object.entries(ITEMS)) {
    if (!definition.equipmentSlot) continue;
    assert.ok(EQUIPMENT_SLOT_IDS.includes(definition.equipmentSlot));
    assert.equal(definition.category, 'equipment');
    assert.match(definition.icon, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    const quantity = definition.stackable ? 25 : 1;
    const a = account([{ id, quantity }]);
    a.skills.combat.xp = 1500;
    const result = await items.use(a, { slot: 0, itemId: id });
    assert.equal(result.transferred, true, id);
    assert.deepEqual(a.equipment[definition.equipmentSlot], { id, quantity });
    assert.equal(a.inventory[0], null);
    assert.equal(
      (
        await items.transfer(a, {
          source: 'equipment',
          slot: definition.equipmentSlot,
          itemId: id,
          target: 'inventory',
        })
      ).transferred,
      true,
    );
    assert.equal(a.equipment[definition.equipmentSlot], null);
    assert.deepEqual(a.inventory[0], { id, quantity });
  }
});

test('equipamento recusa espaço incompatível ou origem falsa sem alterar inventário', async () => {
  const items = service();
  const a = account([
    { id: 'iron_helmet', quantity: 1 },
    { id: 'raw_salmon', quantity: 3 },
  ]);
  const before = structuredClone(a.inventory);
  for (const equipmentSlot of ['boots', 'weapon', 'backpack', 'invalid']) {
    const result = await items.transfer(a, {
      slot: 0,
      itemId: 'iron_helmet',
      target: 'equipment',
      equipmentSlot,
    });
    assert.equal(result.transferred, undefined);
    assert.deepEqual(a.inventory, before);
  }
  assert.equal(
    (
      await items.transfer(a, {
        slot: 1,
        itemId: 'raw_salmon',
        target: 'equipment',
        equipmentSlot: 'helmet',
      })
    ).transferred,
    undefined,
  );
  assert.equal(
    (
      await items.transfer(a, {
        source: 'equipment',
        slot: '__proto__',
        itemId: 'iron_helmet',
        target: 'inventory',
      })
    ).transferred,
    undefined,
  );
  assert.deepEqual(a.inventory, before);
});

test('troca armadura mesmo com mochila cheia e recusa troca por item de outro espaço', async () => {
  const a = account(Array.from({ length: 12 }, () => ({ id: 'sword', quantity: 1 })));
  a.inventory[5] = { id: 'iron_armor', quantity: 1 };
  a.equipment.armor = { id: 'leather_armor', quantity: 1 };
  const items = service();
  assert.equal(
    (
      await items.transfer(a, {
        slot: 5,
        itemId: 'iron_armor',
        target: 'equipment',
        equipmentSlot: 'armor',
      })
    ).transferred,
    true,
  );
  assert.deepEqual(a.equipment.armor, { id: 'iron_armor', quantity: 1 });
  assert.deepEqual(a.inventory[5], { id: 'leather_armor', quantity: 1 });
  const before = structuredClone({ inventory: a.inventory, equipment: a.equipment });
  assert.equal(
    (
      await items.transfer(a, {
        source: 'equipment',
        slot: 'armor',
        itemId: 'iron_armor',
        target: 'inventory',
        targetSlot: 0,
      })
    ).transferred,
    undefined,
  );
  assert.deepEqual({ inventory: a.inventory, equipment: a.equipment }, before);
  assert.equal(
    (
      await items.transfer(a, {
        source: 'equipment',
        slot: 'armor',
        itemId: 'iron_armor',
        target: 'inventory',
        targetSlot: 5,
      })
    ).transferred,
    true,
  );
  assert.deepEqual(a.equipment.armor, { id: 'leather_armor', quantity: 1 });
  assert.deepEqual(a.inventory[5], { id: 'iron_armor', quantity: 1 });
});

test('flechas juntam no equipamento e retornam à pilha sem multiplicar quantidades', async () => {
  const a = account([{ id: 'arrows', quantity: 20 }]);
  const items = service();
  await items.transfer(a, {
    slot: 0,
    itemId: 'arrows',
    quantity: 5,
    target: 'equipment',
    equipmentSlot: 'arrows',
  });
  assert.equal(a.inventory[0].quantity, 15);
  assert.equal(a.equipment.arrows.quantity, 5);
  await items.transfer(a, {
    slot: 0,
    itemId: 'arrows',
    quantity: 10,
    target: 'equipment',
    equipmentSlot: 'arrows',
  });
  assert.equal(a.inventory[0].quantity, 5);
  assert.equal(a.equipment.arrows.quantity, 15);
  const result = await items.transfer(a, {
    source: 'equipment',
    slot: 'arrows',
    itemId: 'arrows',
    target: 'inventory',
    targetSlot: 0,
  });
  assert.equal(result.transferred, true);
  assert.equal(a.inventory[0].quantity, 20);
  assert.equal(a.equipment.arrows, null);
});

test('equipar do chão com espaço ocupado recusa sem perder nenhum dos dois itens', async () => {
  const a = account();
  a.equipment.helmet = { id: 'leather_helmet', quantity: 1 };
  a.groundItems.push({ id: 'helmet-ground', itemId: 'iron_helmet', quantity: 1, ...SPAWN });
  const items = service();
  const result = await items.transfer(a, {
    source: 'ground',
    id: 'helmet-ground',
    target: 'equipment',
    equipmentSlot: 'helmet',
  });
  assert.equal(result.transferred, undefined);
  assert.equal(a.equipment.helmet.id, 'leather_helmet');
  assert.equal(a.groundItems[0].itemId, 'iron_helmet');
});
