import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup } from './helpers/world.mjs';
import { ITEMS } from '../public/js/items.js';
import { SPAWN } from '../public/js/config.js';

test('equipa conjunto completo, empilha flechas e restaura todos os espaços ao atualizar', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ids = [
    'sword',
    'iron_helmet',
    'iron_armor',
    'iron_legs',
    'iron_boots',
    'iron_shield',
    'silver_necklace',
    'silver_ring',
    'arrows',
  ];
  const { account } = await setup(page, { ...SPAWN }, 100, () => 0, {
    inventory: ids.map((id) => ({ id, quantity: id === 'arrows' ? 25 : 1 })),
  });
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  for (const [index, id] of ids.entries()) {
    const slot = ITEMS[id].equipmentSlot;
    const target = page.locator(`[data-equipment="${slot === 'weapon' ? 'sword' : slot}"]`);
    const source = page.locator(`#inventory-grid [data-slot="${index}"]`);
    if (id === 'iron_helmet' || id === 'arrows') await source.dragTo(target);
    else await source.click({ button: 'right' });
    if (await page.locator('#item-context-menu').isVisible())
      await page.locator('#item-context-use').click();
    await expect(target).toHaveAttribute('aria-label', `${ITEMS[id].name} — equipado`);
    expect(account.equipment[slot]).toEqual({ id, quantity: id === 'arrows' ? 25 : 1 });
    await expect(source).toHaveAttribute('data-item', '');
  }
  await expect(page.locator('[data-equipment="arrows"] .item-quantity')).toHaveText('25');
  await page.reload();
  await expect(page.locator('#game')).toBeVisible();
  for (const id of ids) {
    const slot = ITEMS[id].equipmentSlot;
    await expect(
      page.locator(`[data-equipment="${slot === 'weapon' ? 'sword' : slot}"]`),
    ).toHaveAttribute('aria-label', `${ITEMS[id].name} — equipado`);
  }
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page.locator('[data-equipment="armor"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('[data-equipment="armor"]')).toHaveAttribute(
    'aria-label',
    'Armadura — espaço vazio',
  );
  await expect(page.locator('#inventory-grid [data-item="iron_armor"]')).toBeVisible();
  await page.locator('[data-equipment="arrows"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#inventory-grid [data-item="arrows"]')).toHaveAttribute(
    'data-quantity',
    '25',
  );
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({
    path: 'test-results/screenshots/equipment-complete.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
