import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createCookingService } from '../server/cooking.mjs';
import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { STOVE } from '../public/js/config.js';

test('F abre fogão, cozinha um ou todos e mostra assado/queimado com Culinária', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const register = await page.request.post('/api/register', {
    data: {
      username: `Chef ${Date.now().toString().slice(-8)}`,
      password: 'aventura-123',
      outfit: { type: 'citizen', head: 1, body: 10, legs: 15, feet: 15 },
    },
  });
  const identity = await register.json();
  const account = ensureProgress({
    position: { x: STOVE.x - 1, y: STOVE.y },
    inventory: [{ id: 'raw_salmon', quantity: 3 }],
  });
  // Serviço de produção com sorteios determinísticos para verificar os dois resultados.
  const rolls = [0.99, 0, 0];
  const service = createCookingService({ random: () => rolls.shift() ?? 0, save: async () => {} });
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { ...identity, position: { x: STOVE.x - 2, y: STOVE.y }, ...publicProgress(account) },
    }),
  );
  await page.route('**/api/cooking/*', async (route) => {
    const action = route.request().url().split('/').at(-1),
      data = route.request().postDataJSON();
    const result =
      action === 'open'
        ? service.open(account)
        : action === 'start'
          ? service.start(account, data.recipe, data.quantity)
          : action === 'tick'
            ? await service.tick(account)
            : service.stop(account);
    await route.fulfill({ json: result });
  });
  await page.goto('/');
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
