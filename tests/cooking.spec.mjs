import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { STOVE } from '../public/js/config.js';
import { setup } from './helpers/world.mjs';

test('F abre fogão, cozinha um ou todos e mostra assado/queimado com Culinária', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Serviço de produção com sorteios determinísticos para verificar os dois resultados.
  const rolls = [0.99, 0, 0];
  const { account } = await setup(
    page,
    { x: STOVE.x - 2, y: STOVE.y },
    100,
    () => rolls.shift() ?? 0,
    { inventory: [{ id: 'raw_salmon', quantity: 3 }], isolateMobs: [] },
  );
  await expect(page.locator('#game')).toBeVisible();
  await page.getByRole('button', { name: 'Skills e níveis' }).click();
  await expect(page.locator('#cooking-level')).toHaveText('1');
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.getByRole('listitem', { name: 'Salmão cru × 3', exact: true })).toBeVisible();
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#coordinates')).toHaveText(`X: ${STOVE.x - 1} · Y: ${STOVE.y}`);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(180);
  await expect(page.locator('#action-prompt')).toHaveText('F · Usar fogão');
  await page.keyboard.press('f');
  await expect(page.locator('#cooking-panel')).toBeVisible();
  await expect(page.locator('#fishing-panel')).toBeHidden();
  await expect(page.locator('#cooking-chance')).toHaveText('25% de sucesso');
  await page.getByRole('button', { name: 'Cozinhar 1', exact: true }).click();
  await expect(
    page.getByRole('listitem', { name: 'Salmão queimado × 1', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Salmão cru × 2', exact: true })).toBeVisible();
  await expect(page.locator('#cooking-xp')).toHaveText('0 / 100 XP');
  await page.getByRole('button', { name: 'Cozinhar todos (2)', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Salmão assado × 2', exact: true })).toBeVisible({
    timeout: 6000,
  });
  await expect(page.locator('[data-item="raw_salmon"]')).toHaveCount(0);
  await expect(page.locator('#cooking-xp')).toHaveText('20 / 100 XP');
  await expect(page.locator('.inventory-slot.has-item')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Cozinhar 1', exact: true })).toBeDisabled();
  await expect(page.locator('#fishing-level')).toHaveText('1');
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/cooking.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#cooking-panel')).toBeHidden();
  await page.keyboard.press('f');
  await expect(page.locator('#cooking-panel')).toBeVisible();
  await page.keyboard.down('ArrowLeft');
  await expect(page.locator('#coordinates')).toHaveText(`X: ${STOVE.x - 2} · Y: ${STOVE.y}`);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('#cooking-panel')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#coordinates')).toHaveText(`X: ${STOVE.x - 1} · Y: ${STOVE.y}`);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.press('f');
  await expect(page.locator('#cooking-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/cooking-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
