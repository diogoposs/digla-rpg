import { ITEMS } from '../public/js/items.js';
export const clone = (slots) => slots.map((item) => (item ? { ...item } : null));
export const count = (slots, id) =>
  slots.reduce((n, item) => n + (item?.id === id ? item.quantity : 0), 0);
export function add(slots, id, quantity) {
  if (!ITEMS[id] || !Number.isSafeInteger(quantity) || quantity < 1) return false;
  if (ITEMS[id].stackable !== false) {
    const existing = slots.find((i) => i?.id === id);
    if (existing) {
      if (!Number.isSafeInteger(existing.quantity + quantity)) return false;
      existing.quantity += quantity;
      return true;
    }
    const slot = slots.indexOf(null);
    if (slot < 0) return false;
    slots[slot] = { id, quantity };
    return true;
  }
  if (slots.filter((i) => !i).length < quantity) return false;
  for (let i = 0; i < quantity; i++) slots[slots.indexOf(null)] = { id, quantity: 1 };
  return true;
}
export function take(slots, id, quantity) {
  if (count(slots, id) < quantity) return false;
  for (let i = 0; i < slots.length && quantity > 0; i++)
    if (slots[i]?.id === id) {
      const n = Math.min(quantity, slots[i].quantity);
      slots[i].quantity -= n;
      quantity -= n;
      if (!slots[i].quantity) slots[i] = null;
    }
  return true;
}
