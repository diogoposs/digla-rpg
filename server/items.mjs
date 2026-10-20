import { randomUUID } from 'node:crypto';
import { ITEMS, EQUIPMENT_SLOT_IDS } from '../public/js/items.js';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { walkable } from '../public/js/world/map.js';
import { floorOf } from '../public/js/world/elevation.js';
import {
  distance,
  ELEMENTS,
  GOLD_PER_SILVER,
  getCorpses,
  mobAt,
} from '../public/js/game/world-rules.js';
import { eatSalmon } from './nutrition.mjs';

// Transferências são validadas inteiras antes de alterar origem/destino.
export function createItemService({ save, now = Date.now }) {
  const response = (account, message) => ({ ...publicProgress(account), message });
  async function transfer(
    account,
    {
      source = 'inventory',
      slot,
      itemId,
      quantity,
      id,
      corpseId,
      target = 'inventory',
      targetSlot,
      equipmentSlot,
      x,
      y,
      z,
    },
  ) {
    ensureProgress(account);
    let item, remove, replace, lootCorpse, originEquipmentSlot;
    if (source === 'ground') {
      const ground = account.groundItems.find((entry) => entry.id === id);
      if (!ground) return response(account, 'O item não está mais no chão.');
      if (distance(account.position, ground) > 1)
        return response(account, 'Fique ao lado do item para arrastar.');
      item = { id: ground.itemId, quantity: ground.quantity };
      remove = () => account.groundItems.splice(account.groundItems.indexOf(ground), 1);
    } else if (source === 'loot') {
      lootCorpse = getCorpses(account).find((corpse) => corpse.id === corpseId);
      if (!lootCorpse || distance(account.position, lootCorpse) > 1)
        return response(account, 'Fique ao lado do corpo para pegar o loot.');
      if (!Number.isInteger(slot)) return response(account, 'Espaço de loot inválido.');
      item = lootCorpse.slots[slot];
      remove = () => {
        lootCorpse.slots[slot] = null;
      };
    } else if (source === 'equipment') {
      originEquipmentSlot = slot ?? 'weapon';
      if (!EQUIPMENT_SLOT_IDS.includes(originEquipmentSlot))
        return response(account, 'Espaço de equipamento inválido.');
      item = account.equipment[originEquipmentSlot];
      remove = () => {
        account.equipment[originEquipmentSlot] = null;
      };
      replace = (value) => {
        account.equipment[originEquipmentSlot] = value;
      };
    } else if (source === 'inventory' && Number.isInteger(slot)) {
      item = account.inventory[slot];
      remove = () => {
        account.inventory[slot].quantity -= quantity;
        if (!account.inventory[slot].quantity) account.inventory[slot] = null;
      };
      replace = (value) => {
        account.inventory[slot] = value;
      };
    }
    if (!item || !ITEMS[item.id] || (source !== 'ground' && item.id !== itemId))
      return response(account, 'Este item mudou. Arraste novamente.');
    quantity ??= item.quantity;
    if (source !== 'inventory' && quantity !== item.quantity)
      return response(account, 'Arraste a pilha inteira.');
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > item.quantity ||
      (ITEMS[item.id].stackable === false && quantity !== 1)
    )
      return response(account, 'Quantidade inválida.');
    const moved = { id: item.id, quantity };
    if (target === 'ground') {
      const destinationFloor = z ?? floorOf(account.position);
      if (
        destinationFloor !== floorOf(account.position) ||
        !walkable(x, y, destinationFloor) ||
        mobAt(account, x, y, destinationFloor)
      )
        return response(account, 'Você só pode largar itens em um quadrado onde pode andar.');
      if (source === 'ground') {
        const origin = account.groundItems.find((entry) => entry.id === id);
        if (origin.x === x && origin.y === y) return publicProgress(account);
      }
      const pile =
        ITEMS[item.id].stackable !== false &&
        account.groundItems.find(
          (entry) =>
            entry.id !== id &&
            entry.itemId === item.id &&
            entry.x === x &&
            entry.y === y &&
            floorOf(entry) === destinationFloor,
        );
      if (source === 'ground' && !pile) {
        Object.assign(
          account.groundItems.find((entry) => entry.id === id),
          { x, y, z: destinationFloor },
        );
      } else {
        remove();
        if (pile) pile.quantity += quantity;
        else
          account.groundItems.push({
            id: source === 'ground' ? id : randomUUID(),
            itemId: item.id,
            quantity,
            x,
            y,
            z: destinationFloor,
          });
      }
    } else if (target === 'equipment') {
      const destination =
        equipmentSlot ??
        (typeof targetSlot === 'string' ? targetSlot : ITEMS[item.id].equipmentSlot);
      if (!EQUIPMENT_SLOT_IDS.includes(destination) || ITEMS[item.id].equipmentSlot !== destination)
        return response(account, 'Este item não pode ocupar esse espaço de equipamento.');
      if (source === 'equipment' && originEquipmentSlot === destination)
        return publicProgress(account);
      const equipped = account.equipment[destination];
      if (equipped?.id === item.id && ITEMS[item.id].stackable !== false) {
        remove();
        account.equipment[destination] = { id: item.id, quantity: equipped.quantity + quantity };
      } else {
        if (equipped && (!replace || quantity !== item.quantity))
          return response(account, 'Guarde o equipamento atual na mochila antes de equipar.');
        remove();
        if (equipped) replace(equipped);
        account.equipment[destination] = moved;
      }
    } else if (target === 'inventory') {
      if (targetSlot === undefined) {
        targetSlot =
          ITEMS[item.id].stackable !== false
            ? account.inventory.findIndex((entry) => entry?.id === item.id)
            : -1;
        if (targetSlot < 0) targetSlot = account.inventory.indexOf(null);
      }
      if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= account.inventory.length)
        return response(account, 'Sua mochila está cheia.');
      if (source === 'inventory' && targetSlot === slot) return publicProgress(account);
      const previous = account.inventory[targetSlot];
      if (previous && (previous.id !== item.id || ITEMS[item.id].stackable === false)) {
        if (!replace || quantity !== item.quantity)
          return response(account, 'Esse espaço da mochila está ocupado.');
        if (source === 'equipment' && ITEMS[previous.id]?.equipmentSlot !== originEquipmentSlot)
          return response(account, 'A troca exige um item para o mesmo espaço de equipamento.');
        remove();
        replace(previous);
        account.inventory[targetSlot] = moved;
      } else {
        remove();
        account.inventory[targetSlot] = {
          id: item.id,
          quantity: quantity + (previous?.quantity || 0),
        };
      }
    } else return response(account, 'Destino inválido.');
    account.worldRevision++;
    await save();
    return {
      ...publicProgress(account),
      transferred: true,
      message: 'Item transferido.',
      ...(source === 'loot' ? { loot: lootCorpse } : {}),
    };
  }
  return {
    transfer,
    async drop(account, data) {
      const result = await transfer(account, { ...data, source: 'inventory', target: 'ground' });
      return { ...result, dropped: result.transferred };
    },
    async move(account, data) {
      const result = await transfer(account, { ...data, source: 'ground', target: 'ground' });
      return { ...result, moved: result.transferred };
    },
    async pickup(account, data) {
      const result = await transfer(account, { ...data, source: 'ground', target: 'inventory' });
      return { ...result, pickedUp: result.transferred };
    },
    async element(account, { element }) {
      ensureProgress(account);
      if (
        !ELEMENTS.includes(element) ||
        !(
          account.equipment.weapon?.id === 'staff' ||
          account.inventory.some((item) => item?.id === 'staff')
        )
      )
        return response(
          account,
          'Escolha um elemento válido com um cajado na mochila ou equipado.',
        );
      account.attackElement = element;
      account.worldRevision++;
      await save();
      return publicProgress(account);
    },
    async use(account, { slot, itemId }) {
      ensureProgress(account);
      const item = account.inventory[slot];
      if (!Number.isInteger(slot) || !item || item.id !== itemId)
        return response(account, 'Este item não está mais nesse espaço.');
      if (ITEMS[item.id]?.equipmentSlot)
        return transfer(account, { slot, itemId, target: 'equipment' });
      if (item.id === 'gold_coin') {
        if (item.quantity < GOLD_PER_SILVER)
          return response(
            account,
            `Junte ${GOLD_PER_SILVER} moedas douradas para trocar por uma moeda cinza.`,
          );
        let target = account.inventory.findIndex((entry) => entry?.id === 'silver_coin');
        if (target < 0)
          target = item.quantity === GOLD_PER_SILVER ? slot : account.inventory.indexOf(null);
        if (target < 0) return response(account, 'Libere um espaço na mochila para a moeda cinza.');
        const previous = target === slot ? 0 : account.inventory[target]?.quantity || 0;
        item.quantity -= GOLD_PER_SILVER;
        if (!item.quantity) account.inventory[slot] = null;
        account.inventory[target] = { id: 'silver_coin', quantity: previous + 1 };
        account.worldRevision++;
        await save();
        return {
          ...publicProgress(account),
          converted: true,
          message: `${GOLD_PER_SILVER} moedas douradas viraram uma moeda cinza.`,
        };
      }
      if (item.id === 'silver_coin')
        return response(account, 'Cada moeda cinza vale 100 moedas douradas.');
      if (ITEMS[item.id]?.category === 'potion') {
        const definition = ITEMS[item.id],
          vital = definition.restores;
        const max = vital === 'health' ? account.vitals.maxHealth : account.vitals.maxMana;
        if (account.vitals[vital] >= max)
          return response(
            account,
            `${vital === 'health' ? 'Sua vida' : 'Sua mana'} está cheia. A poção não foi consumida.`,
          );
        const restored = Math.min(definition.amount, max - account.vitals[vital]);
        account.vitals[vital] += restored;
        if (!--item.quantity) account.inventory[slot] = null;
        account.worldRevision++;
        await save();
        return {
          ...publicProgress(account),
          consumed: true,
          restored,
          message: `Você recuperou ${restored} de ${vital === 'health' ? 'vida' : 'mana'}.`,
        };
      }
      if (item.id !== 'roasted_salmon')
        return response(
          account,
          'Somente o salmão assado pode ser comido. Cru e queimado não podem.',
        );
      if (
        account.vitals.health >= account.vitals.maxHealth &&
        account.vitals.mana >= account.vitals.maxMana
      )
        return response(account, 'Sua vida e mana estão cheias. O salmão não foi consumido.');
      eatSalmon(account, now());
      if (!--item.quantity) account.inventory[slot] = null;
      account.worldRevision++;
      await save();
      return {
        ...publicProgress(account),
        consumed: true,
        message:
          'Salmão assado: +20 de vida e +15 de mana a cada 3 segundos por 1 minuto. Novos salmões acrescentam tempo.',
      };
    },
  };
}
