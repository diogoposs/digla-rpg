import { ITEMS } from '../public/js/items.js';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { distance } from '../public/js/game/world-rules.js';
import { TOWN_POINTS, ensureTown, shopStock } from '../public/js/game/town-rules.js';
import { randomInt } from 'node:crypto';

const clone = (slots) => slots.map((item) => (item ? { ...item } : null));
const count = (slots, id) =>
  slots.reduce((total, item) => total + (item?.id === id ? item.quantity : 0), 0);
const validQuantity = (quantity) => Number.isSafeInteger(quantity) && quantity > 0;

// Planeja a transferência numa cópia. Nenhum pagamento ou item é removido se faltar espaço.
function add(slots, id, quantity) {
  if (ITEMS[id].stackable !== false) {
    const existing = slots.find((item) => item?.id === id);
    if (existing) {
      if (!Number.isSafeInteger(existing.quantity + quantity)) return false;
      existing.quantity += quantity;
      return true;
    }
    const index = slots.indexOf(null);
    if (index < 0) return false;
    slots[index] = { id, quantity };
    return true;
  }
  if (slots.filter((item) => !item).length < quantity) return false;
  for (let i = 0; i < quantity; i++) slots[slots.indexOf(null)] = { id, quantity: 1 };
  return true;
}

function remove(slots, slot, quantity) {
  slots[slot].quantity -= quantity;
  if (!slots[slot].quantity) slots[slot] = null;
}

function spendGold(slots, quantity) {
  for (let slot = 0; quantity > 0 && slot < slots.length; slot++) {
    if (slots[slot]?.id !== 'gold_coin') continue;
    const amount = Math.min(quantity, slots[slot].quantity);
    remove(slots, slot, amount);
    quantity -= amount;
  }
}

export function createTownService({ save, random }) {
  function prepare(account) {
    ensureProgress(account);
    ensureTown(account);
  }
  function response(account, id, message = '', changed = false) {
    const point = TOWN_POINTS[id];
    return {
      ...publicProgress(account),
      bank: account.bank,
      changed,
      message,
      town: point
        ? {
            ...point,
            available: distance(account.position, point) <= 1,
            stock: point.kind === 'shop' ? shopStock(id) : [],
            bank: account.bank,
            inventory: account.inventory,
            balance: count(account.inventory, 'gold_coin'),
            diceResult: point.kind === 'dice' ? account.diceHistory.at(-1) || null : null,
          }
        : null,
    };
  }
  function nearby(account, id, kind) {
    const point = TOWN_POINTS[id];
    return point && point.kind === kind && distance(account.position, point) <= 1;
  }
  async function commit(account, id, message, inventory, bank) {
    if (inventory) account.inventory = inventory;
    if (bank) account.bank = bank;
    account.worldRevision++;
    await save();
    return response(account, id, message, true);
  }
  return {
    async bet(account, { id = 'dice', choice, amount, requestId } = {}) {
      prepare(account);
      if (!nearby(account, id, 'dice'))
        return response(account, id, 'Fique ao lado de Dário para apostar.');
      if (
        !['low', 'high'].includes(choice) ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > Math.floor(Number.MAX_SAFE_INTEGER / 2)
      )
        return response(account, id, 'Escolha baixo ou alto e uma quantidade inteira de ouro.');
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
        return response(account, id, 'Atualize a janela dos dados e tente novamente.');
      const previous = account.diceHistory.find((entry) => entry.requestId === requestId);
      if (previous)
        return { ...response(account, id, 'Essa aposta já foi concluída.'), dice: previous };
      if (count(account.inventory, 'gold_coin') < amount)
        return response(account, id, 'Moedas douradas insuficientes na mochila.');
      const inventory = clone(account.inventory);
      spendGold(inventory, amount);
      const possibleWin = clone(inventory);
      if (!add(possibleWin, 'gold_coin', amount * 2))
        return response(account, id, 'Não há espaço para receber o prêmio.');
      const roll = random ? 1 + Math.min(5, Math.floor(random() * 6)) : randomInt(1, 7);
      const won = choice === 'low' ? roll <= 3 : roll >= 4;
      const result = { requestId, choice, amount, roll, won, payout: won ? amount * 2 : 0 };
      account.diceHistory = [...account.diceHistory.slice(-19), result];
      const message = won
        ? `Dado ${roll}! Você ganhou ${amount * 2} moedas douradas (${amount} de lucro).`
        : `Dado ${roll}. Você perdeu ${amount} moedas douradas.`;
      const progress = await commit(account, id, message, won ? possibleWin : inventory);
      return { ...progress, dice: result };
    },
    async open(account, { id } = {}) {
      prepare(account);
      if (!TOWN_POINTS[id]) return response(account, id, 'Local desconhecido.');
      if (distance(account.position, TOWN_POINTS[id]) > 1)
        return response(account, id, 'Aproxime-se para conversar.');
      return response(account, id);
    },
    async buy(account, { id, itemId, quantity = 1 } = {}) {
      prepare(account);
      if (!nearby(account, id, 'shop')) return response(account, id, 'Fique ao lado do vendedor.');
      if (!shopStock(id).some((item) => item.id === itemId))
        return response(account, id, 'Este vendedor não vende esse item.');
      if (!validQuantity(quantity)) return response(account, id, 'Quantidade inválida.');
      if (count(account.inventory, 'gold_coin') < quantity)
        return response(account, id, 'Moedas douradas insuficientes na mochila.');
      const inventory = clone(account.inventory);
      spendGold(inventory, quantity);
      if (!add(inventory, itemId, quantity)) return response(account, id, 'A mochila está cheia.');
      return commit(account, id, `Comprou ${quantity} × ${ITEMS[itemId].name}.`, inventory);
    },
    async sell(account, { id, slot, itemId, quantity = 1 } = {}) {
      prepare(account);
      if (!nearby(account, id, 'shop')) return response(account, id, 'Fique ao lado do vendedor.');
      const item = Number.isInteger(slot) && account.inventory[slot];
      if (!item || item.id !== itemId || !shopStock(id).some((entry) => entry.id === itemId))
        return response(account, id, 'Este vendedor não compra esse item.');
      if (!validQuantity(quantity) || quantity > item.quantity)
        return response(account, id, 'Quantidade inválida.');
      const inventory = clone(account.inventory);
      remove(inventory, slot, quantity);
      if (!add(inventory, 'gold_coin', quantity))
        return response(account, id, 'Libere um espaço para receber as moedas.');
      return commit(account, id, `Vendeu ${quantity} × ${ITEMS[itemId].name}.`, inventory);
    },
    async deposit(account, { id = 'bank', slot, itemId, quantity = 1 } = {}) {
      prepare(account);
      if (!nearby(account, id, 'bank')) return response(account, id, 'Fique ao lado do banco.');
      const item = Number.isInteger(slot) && account.inventory[slot];
      if (!item || item.id !== itemId || !validQuantity(quantity) || quantity > item.quantity)
        return response(account, id, 'Selecione um item e uma quantidade válida da mochila.');
      const inventory = clone(account.inventory),
        bank = clone(account.bank);
      if (!add(bank, itemId, quantity)) return response(account, id, 'O banco está cheio.');
      remove(inventory, slot, quantity);
      return commit(account, id, `Guardou ${quantity} × ${ITEMS[itemId].name}.`, inventory, bank);
    },
    async depositAll(account, { id = 'bank' } = {}) {
      prepare(account);
      if (!nearby(account, id, 'bank')) return response(account, id, 'Fique ao lado do banco.');
      const bank = clone(account.bank);
      let stacks = 0;
      for (const item of account.inventory) {
        if (!item) continue;
        if (!add(bank, item.id, item.quantity))
          return response(
            account,
            id,
            'O banco não tem espaço para toda a mochila. Nenhum item foi movido.',
          );
        stacks++;
      }
      if (!stacks) return response(account, id, 'A mochila já está vazia.');
      return commit(
        account,
        id,
        'Todo o inventário foi guardado no banco.',
        account.inventory.map(() => null),
        bank,
      );
    },
    async withdraw(account, { id = 'bank', slot, itemId, quantity = 1 } = {}) {
      prepare(account);
      if (!nearby(account, id, 'bank')) return response(account, id, 'Fique ao lado do banco.');
      const item = Number.isInteger(slot) && account.bank[slot];
      if (!item || item.id !== itemId || !validQuantity(quantity) || quantity > item.quantity)
        return response(account, id, 'Selecione um item e uma quantidade válida do banco.');
      const inventory = clone(account.inventory),
        bank = clone(account.bank);
      if (!add(inventory, itemId, quantity)) return response(account, id, 'A mochila está cheia.');
      remove(bank, slot, quantity);
      return commit(account, id, `Retirou ${quantity} × ${ITEMS[itemId].name}.`, inventory, bank);
    },
  };
}
