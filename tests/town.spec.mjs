import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup } from './helpers/world.mjs';
import { BANK_CAPACITY, TOWN_POINTS, shopStock } from '../public/js/game/town-rules.js';
import { distance } from '../public/js/game/world-rules.js';
import { houseAt } from '../public/js/world/map.js';

async function openTown(page, account, id) {
  const point = TOWN_POINTS[id];
  const box = await page.locator('#world').boundingBox();
  if (distance(account.position, point) > 1) {
    await page.locator('#world').click({
      position: {
        x: box.width / 2 + (point.x - account.position.x) * 64,
        y: box.height / 2 + (point.y + 1 - account.position.y) * 64,
      },
    });
    await expect.poll(() => distance(account.position, point)).toBeLessThanOrEqual(1);
  }
  await page.locator('#world').click({
    button: 'right',
    position: {
      x: box.width / 2 + (point.x - account.position.x) * 64,
      y: box.height / 2 + (point.y - account.position.y) * 64,
    },
  });
  await expect(page.locator('#town-panel')).toBeVisible();
  await expect(page.locator('#town-title')).toHaveText(point.name);
  expect(distance(account.position, point)).toBeLessThanOrEqual(1);
}

test('Rafhi atende dentro da casa e personagem entra pela porta ao conversar', async ({ page }) => {
  const { account } = await setup(page, { x: 26, y: 23 }, 100, () => 0, { inventory: [] });
  await expect(page.locator('[data-town-id="food"]')).toHaveText('Rafhi');
  const box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ position: { x: box.width / 2 - 64, y: box.height / 2 - 192 } });
  await expect.poll(() => distance(account.position, TOWN_POINTS.food)).toBeLessThanOrEqual(1);
  await page.locator('[data-town-id="food"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-title')).toHaveText('Rafhi — Alimentos');
  expect(houseAt(account.position.x, account.position.y)?.name).toContain('Rafhi');
  await page.locator('#town-close').click();
  await page.screenshot({ path: 'test-results/screenshots/rafhi-house.png', fullPage: true });
});

test('banco guarda pilhas com botão direito na janela e na mochila; guardar tudo persiste', async ({
  page,
}) => {
  const point = TOWN_POINTS.bank;
  const { account } = await setup(page, { x: point.x - 1, y: point.y }, 100, () => 0, {
    inventory: [
      { id: 'raw_salmon', quantity: 7 },
      { id: 'staff', quantity: 1 },
      { id: 'gold_coin', quantity: 12 },
      { id: 'iron_armor', quantity: 1 },
    ],
    equipment: { helmet: { id: 'iron_helmet', quantity: 1 } },
  });
  await openTown(page, account, 'bank');
  await page.locator('#town-bag [data-item="raw_salmon"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-bank [data-item="raw_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão cru × 7',
  );
  await page.locator('#town-bank [data-item="raw_salmon"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-bag [data-item="raw_salmon"]')).toBeVisible();
  await page.locator('#backpack-slot').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page.locator('#inventory-grid [data-item="staff"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-bank [data-item="staff"]')).toBeVisible();
  await expect(page.locator('#staff-panel')).toBeHidden();
  await page.locator('#town-deposit-all').click();
  await expect(page.locator('#town-message')).toContainText('Todo o inventário');
  expect(account.inventory.every((item) => !item)).toBe(true);
  expect(account.bank.find((item) => item?.id === 'gold_coin')?.quantity).toBe(12);
  expect(account.equipment.helmet.id).toBe('iron_helmet');
  await expect(page.locator('#town-deposit-all')).toBeDisabled();
  await page.reload();
  await openTown(page, account, 'bank');
  await expect(page.locator('#town-bank [data-item="raw_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão cru × 7',
  );
  await page.screenshot({ path: 'test-results/screenshots/bank-deposit-all.png', fullPage: true });
});

test('banco cheio recusa guardar tudo sem perder a mochila', async ({ page }) => {
  const point = TOWN_POINTS.bank;
  const { account } = await setup(page, { x: point.x - 1, y: point.y }, 100, () => 0, {
    inventory: [{ id: 'raw_salmon', quantity: 3 }],
    bank: Array.from({ length: BANK_CAPACITY }, () => ({ id: 'sword', quantity: 1 })),
  });
  await openTown(page, account, 'bank');
  await page.locator('#town-deposit-all').click();
  await expect(page.locator('#town-message')).toContainText('Nenhum item foi movido');
  expect(account.inventory[0]).toEqual({ id: 'raw_salmon', quantity: 3 });
  expect(account.bank.filter(Boolean)).toHaveLength(BANK_CAPACITY);
});

test('alimentos compram e vendem por 1 ouro, e falta de ouro bloqueia nova compra', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const point = TOWN_POINTS.food;
  const { account } = await setup(page, { x: point.x + 2, y: point.y }, 100, () => 0, {
    inventory: [{ id: 'gold_coin', quantity: 4 }],
  });
  await openTown(page, account, 'food');
  await expect(page.locator('#town-stock [data-item]')).toHaveCount(shopStock('food').length);
  await page.locator('#town-stock [data-item="roasted_salmon"]').click();
  await page.locator('#town-quantity').fill('2');
  await page.locator('#town-buy').click();
  await expect(page.locator('#town-message')).toContainText('Comprou 2');
  await expect(page.locator('#town-gold')).toHaveText('2');
  await expect(page.locator('#town-bag [data-item="roasted_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão assado × 2',
  );
  await page.locator('#town-bag [data-item="roasted_salmon"]').click();
  await page.locator('#town-sell').click();
  await expect(page.locator('#town-message')).toContainText('Vendeu 1');
  await expect(page.locator('#town-gold')).toHaveText('3');
  await expect(page.locator('#town-bag [data-item="roasted_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão assado × 1',
  );
  const inventory = structuredClone(account.inventory);
  await page.locator('#town-stock [data-item="roasted_salmon"]').click();
  await page.locator('#town-quantity').fill('4');
  await expect(page.locator('#town-buy')).toBeDisabled();
  expect(account.inventory).toEqual(inventory);
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/town-food.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('vendedor de equipamentos oferece catálogo completo e devolve 1 ouro ao vender', async ({
  page,
}) => {
  const point = TOWN_POINTS.gear;
  const { account } = await setup(page, { x: point.x, y: point.y + 2 }, 100, () => 0, {
    inventory: [{ id: 'gold_coin', quantity: 2 }],
  });
  await openTown(page, account, 'gear');
  await expect(page.locator('#town-stock [data-item]')).toHaveCount(shopStock('gear').length);
  await expect(page.locator('#town-stock [data-item="gold_coin"]')).toHaveCount(0);
  await page.locator('#town-stock [data-item="iron_helmet"]').click();
  await page.locator('#town-buy').click();
  await expect(page.locator('#town-gold')).toHaveText('1');
  await expect(page.locator('#town-bag [data-item="iron_helmet"]')).toBeVisible();
  await page.locator('#town-bag [data-item="iron_helmet"]').click();
  await page.locator('#town-sell').click();
  await expect(page.locator('#town-message')).toContainText('Vendeu 1');
  await expect(page.locator('#town-gold')).toHaveText('2');
  await expect(page.locator('#town-bag [data-item="iron_helmet"]')).toHaveCount(0);
  expect(account.inventory.filter(Boolean)).toEqual([{ id: 'gold_coin', quantity: 2 }]);
  await page.screenshot({ path: 'test-results/screenshots/town-gear.png', fullPage: true });
});

test('banco abre 48 espaços, guarda e retira pilhas/armadura, mantendo depósito ao atualizar', async ({
  page,
}) => {
  const point = TOWN_POINTS.bank;
  const { account } = await setup(page, { x: point.x, y: point.y + 2 }, 100, () => 0, {
    inventory: [
      { id: 'roasted_salmon', quantity: 7 },
      { id: 'iron_armor', quantity: 1 },
    ],
  });
  await openTown(page, account, 'bank');
  await expect(page.locator('#town-bank button')).toHaveCount(BANK_CAPACITY);
  await page.locator('#town-bag [data-item="roasted_salmon"]').click();
  await expect(page.locator('#town-message')).toContainText('Guardou 7');
  await expect(page.locator('#town-bank [data-item="roasted_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão assado × 7',
  );
  await page.locator('#town-bag [data-item="iron_armor"]').click();
  await expect(page.locator('#town-bank [data-item="iron_armor"]')).toBeVisible();
  await page.locator('#town-bank [data-item="roasted_salmon"]').click();
  await expect(page.locator('#town-message')).toContainText('Retirou 7');
  await expect(page.locator('#town-bag [data-item="roasted_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão assado × 7',
  );
  await page.locator('#backpack-slot').click({ button: 'right' });
  await page.locator('#inventory-grid [data-item="roasted_salmon"]').click();
  await expect(page.locator('#town-bank [data-item="roasted_salmon"]')).toBeVisible();
  expect(account.bank.filter(Boolean)).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#game')).toBeVisible();
  await openTown(page, account, 'bank');
  await expect(page.locator('#town-bank button')).toHaveCount(BANK_CAPACITY);
  await expect(page.locator('#town-bank [data-item="roasted_salmon"]')).toHaveAttribute(
    'aria-label',
    'Salmão assado × 7',
  );
  await page.screenshot({ path: 'test-results/screenshots/town-bank.png', fullPage: true });
});
