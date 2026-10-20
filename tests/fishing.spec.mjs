import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createFishingService } from '../server/fishing.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { nearWater, salmonChance } from '../public/js/game/fishing-rules.js';
import { walkable } from '../public/js/world/map.js';

test('F na margem, bônus verde, captura, mochila, XP e cancelamento', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const username = `Pescador ${Date.now().toString().slice(-8)}`;
  await page.request.post('/api/register', {
    data: {
      username,
      password: 'aventura-123',
      outfit: { type: 'citizen', head: 1, body: 10, legs: 15, feet: 15 },
    },
  });
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  await page.getByRole('button', { name: 'Skills e níveis' }).click();
  await expect(page.locator('#fishing-level')).toHaveText('1');
  await expect(page.locator('#magic-xp')).toHaveText('0 / 100 XP');
  await page.keyboard.press('f');
  await expect(page.locator('#fishing-message')).toContainText('um quadrado da água');
  await expect(page.locator('#fishing-panel')).toBeHidden();
  let shore;
  for (let y = 20; y < 40 && !shore; y++)
    for (let x = 35; x < 50; x++)
      if (walkable(x, y) && nearWater({ x, y })) {
        shore = { x, y };
        break;
      }
  await page.getByRole('button', { name: 'Sair do mundo' }).click();
  await page.request.post('/api/login', { data: { username, password: 'aventura-123' } });
  expect((await page.request.post('/api/position', { data: shore })).status()).toBe(200);
  await page.reload();
  await expect(page.locator('#game')).toBeVisible();

  // Usa RNG entre a chance normal e a dobrada: falha sem bônus e captura ao acertar.
  // Persistência real em arquivo é verificada no teste de servidor, sem alterar contas de jogo.
  const account = ensureProgress({ position: shore });
  const service = createFishingService({
    random: () => (salmonChance(1) + salmonChance(1, true)) / 2,
    save: async () => {},
  });
  await page.route('**/api/fishing/*', async (route) => {
    const action = route.request().url().split('/').at(-1);
    const data = route.request().postDataJSON();
    const result =
      action === 'start'
        ? service.start(account)
        : action === 'press'
          ? service.press(account, data.challengeId)
          : action === 'tick'
            ? await service.tick(account)
            : service.stop(account);
    await route.fulfill({ json: result });
  });
  await page.getByRole('button', { name: 'Skills e níveis' }).click();
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page.keyboard.press('f');
  await expect(page.locator('#fishing-panel')).toBeVisible();
  async function greenHit() {
    await page.waitForFunction(
      () => {
        const cursor = document.getElementById('fishing-cursor');
        const position = parseFloat(cursor.style.left);
        return position >= 42 && position <= 46;
      },
      null,
      { polling: 'raf' },
    );
    await page.keyboard.press('f');
  }
  await greenHit();
  await expect(page.locator('#fishing-xp')).toHaveText('10 / 100 XP');
  await expect(page.getByRole('listitem', { name: 'Salmão cru × 1', exact: true })).toBeVisible();
  await expect(page.locator('#fishing-instruction')).toContainText('Aperte F no centro verde');
  await greenHit();
  await expect(page.getByRole('listitem', { name: 'Salmão cru × 2', exact: true })).toBeVisible();
  await expect(page.locator('.inventory-slot.has-item')).toHaveCount(1);
  await expect(page.locator('#fishing-xp')).toHaveText('20 / 100 XP');
  await expect(page.locator('#magic-level')).toHaveText('1');
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/fishing.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#fishing-panel')).toBeHidden();
  await page.keyboard.press('f');
  await expect(page.locator('#fishing-panel')).toBeVisible();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('#fishing-panel')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/skills-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
