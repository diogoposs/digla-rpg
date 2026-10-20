import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('lateral, slots vazios e mochila com 12 espaços por botão direito', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.request.post('/api/register', {
    data: {
      username: `Mochila ${Date.now().toString().slice(-8)}`,
      password: 'aventura-123',
      outfit: { type: 'citizen', head: 1, body: 10, legs: 15, feet: 15 },
    },
  });
  expect(response.status()).toBe(201);
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.game-sidebar > section').first()).toHaveClass('minimap-card');
  await expect(page.locator('.player-card, .controls-card')).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Vida', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.locator('.equipment-slot')).toHaveCount(10);
  for (const name of [
    'Arma',
    'Armadura',
    'Escudo',
    'Calça',
    'Botas',
    'Elmo',
    'Anel',
    'Colar',
    'Flechas',
  ]) {
    await expect(
      page.getByRole('img', { name: `${name} — espaço vazio`, exact: true }),
    ).toBeVisible();
  }
  const backpack = page.getByRole('button', {
    name: 'Mochila — botão direito para abrir',
    exact: true,
  });
  const panel = page.locator('#backpack-panel');
  await expect(panel).toBeHidden();
  await backpack.click();
  await expect(panel).toBeHidden();
  await backpack.click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(panel).toBeVisible();
  await expect(backpack).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('listitem')).toHaveCount(12);
  await expect(page.locator('#inventory-grid svg, #inventory-grid img')).toHaveCount(0);
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/inventory-open.png', fullPage: true });
  // O inventário lateral não deve bloquear a caminhada pelas setinhas.
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#coordinates')).toHaveText('X: 30 · Y: 27');
  await page.keyboard.up('ArrowRight');
  await page.getByRole('button', { name: 'Fechar mochila' }).click();
  await expect(panel).toBeHidden();
  await expect(backpack).toHaveAttribute('aria-expanded', 'false');
  await backpack.press('Enter');
  await expect(panel).toBeVisible();
  await backpack.click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(panel).toBeHidden();
  await backpack.click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(panel).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/inventory-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Sair do mundo' }).click();
  await page.locator('#password').fill('aventura-123');
  await page.getByRole('button', { name: 'Entrar no mundo', exact: true }).click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});
