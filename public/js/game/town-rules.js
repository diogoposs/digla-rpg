import { ITEMS } from '../items.js';

// Posições compartilhadas por mapa, minimapa, servidor e interação do mouse.
export const BANK_CAPACITY = 48;
export const BANK_HALL = {
  x: 31,
  y: 34,
  w: 13,
  h: 8,
  roof: 'blue',
  interior: true,
  bank: true,
  name: 'Banco de Brumavale',
};
export const DICE_ALCOVE = { x: 38, y: 35, w: 2, h: 3 };
export const TOWN_POINTS = {
  food: { id: 'food', kind: 'shop', name: 'Rafhi — Alimentos', x: 25, y: 19 },
  gear: { id: 'gear', kind: 'shop', name: 'Matlo — Equipamentos', x: 36, y: 22 },
  potions: { id: 'potions', kind: 'shop', name: 'Pang — Poções', x: 17, y: 21 },
  bank: { id: 'bank', kind: 'bank', name: 'Banco de Brumavale', x: 33, y: 36 },
  bank_east: { id: 'bank_east', kind: 'bank', name: 'Banco de Brumavale — Leste', x: 41, y: 36 },
  bank_southwest: {
    id: 'bank_southwest',
    kind: 'bank',
    name: 'Banco de Brumavale — Sudoeste',
    x: 33,
    y: 39,
  },
  bank_southeast: {
    id: 'bank_southeast',
    kind: 'bank',
    name: 'Banco de Brumavale — Sudeste',
    x: 41,
    y: 39,
  },
  dice: { id: 'dice', kind: 'dice', name: 'Dário — Dados', x: 38, y: 36 },
};

export function ensureTown(account) {
  if (!Array.isArray(account.diceHistory)) account.diceHistory = [];
  account.bank = Array.from({ length: BANK_CAPACITY }, (_, index) => {
    const item = account.bank?.[index];
    return ITEMS[item?.id] && Number.isSafeInteger(item.quantity) && item.quantity > 0
      ? { id: item.id, quantity: item.quantity }
      : null;
  });
  return account;
}

export function shopStock(id) {
  return Object.entries(ITEMS)
    .filter(([itemId, item]) => {
      if (item.category === 'currency' || ['gold_coin', 'silver_coin'].includes(itemId))
        return false;
      const food = item.category === 'food' || itemId.endsWith('_salmon');
      return id === 'food'
        ? food
        : id === 'potions'
          ? item.category === 'potion'
          : id === 'gear' && item.category === 'equipment';
    })
    .map(([id, item]) => ({ id, name: item.name, price: 1 }));
}
