import { test, expect } from '@playwright/test';
import { setup } from './helpers/world.mjs';

test('servidor antigo mostra orientação para reiniciar em vez de carregar regras antigas', async ({
  page,
}) => {
  await page.route('**/api/session', (route) => route.fulfill({ json: { gameVersion: 'antiga' } }));
  await page.goto('/');
  await expect(page.locator('#auth-error')).toContainText('servidor está desatualizado');
  await expect(page.locator('#game')).toBeHidden();
});

test('zoom do mundo e minimapa preservam o destino dos cliques', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { account } = await setup(page, { x: 29, y: 27 }, 100, () => 0, {
    isolateMobs: [],
    groundItems: [{ id: 'zoom-item', itemId: 'sword', quantity: 1, x: 31, y: 27 }],
  });
  await page.locator('#world-zoom-in').click();
  await expect(page.locator('#world-zoom-reset')).toHaveText('150%');
  await expect(page.locator('[data-ground-id="zoom-item"]')).toHaveCSS('width', '66px');
  const box = await page.locator('#world').boundingBox();
  await page.locator('#world').click({ position: { x: box.width / 2 + 96, y: box.height / 2 } });
  await expect.poll(() => account.position.x).toBe(30);
  await page.locator('#world-zoom-reset').click();
  await expect(page.locator('#world-zoom-reset')).toHaveText('100%');
  await expect(page.locator('[data-ground-id="zoom-item"]')).toHaveCSS('width', '44px');
  for (let i = 0; i < 3; i++) await page.locator('#minimap-zoom-in').click();
  await expect(page.locator('#minimap-zoom-reset')).toHaveText('8×');
  const point = await page.locator('#minimap').evaluate((canvas) => {
    const view = JSON.parse(canvas.dataset.view),
      box = canvas.getBoundingClientRect();
    return {
      x: ((30.5 - view.left) / view.width) * box.width,
      y: ((29.5 - view.top) / view.height) * box.height,
    };
  });
  await page.locator('#minimap').click({ position: point });
  await expect.poll(() => account.position.y).toBe(29);
  expect(account.position.x).toBe(30);
  expect(errors).toEqual([]);
});

test('Dário paga o dobro ao acertar e desconta a aposta ao errar', async ({ page }) => {
  const { account } = await setup(page, { x: 37, y: 36 }, 100, () => 0, {
    inventory: [{ id: 'gold_coin', quantity: 10 }],
    isolateMobs: [],
  });
  await page.locator('[data-town-id="dice"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-dice')).toBeVisible();
  await page.locator('#town-bet-amount').fill('3');
  await page.locator('#town-bet-low').click();
  await expect(page.locator('#town-message')).toContainText('ganhou 6');
  expect(account.inventory.find((item) => item?.id === 'gold_coin').quantity).toBe(13);
  await page.locator('#town-bet-amount').fill('2');
  await page.locator('#town-bet-high').click();
  await expect
    .poll(() => account.inventory.find((item) => item?.id === 'gold_coin').quantity)
    .toBe(11);
  await page.locator('#town-bet-amount').fill('12');
  await expect(page.locator('#town-bet-low')).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/dice.png', fullPage: true });
});

test('quatro bancos compartilham depósito', async ({ page }) => {
  const { account } = await setup(page, { x: 32, y: 37 }, 100, () => 0, {
    inventory: [{ id: 'raw_salmon', quantity: 7 }],
    isolateMobs: [],
  });
  const box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ button: 'left', position: { x: box.width / 2 + 64, y: box.height / 2 - 64 } });
  await expect(page.locator('#town-panel')).toBeVisible();
  await page.locator('#town-bag [data-item="raw_salmon"]').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#town-bank [data-item="raw_salmon"]')).toBeVisible();
  await page.locator('#town-close').click();
  await page.locator('#world').click({
    position: {
      x: box.width / 2 + (40 - account.position.x) * 64,
      y: box.height / 2 + (37 - account.position.y) * 64,
    },
  });
  await expect.poll(() => account.position.x).toBe(40);
  await page.locator('#world').click({
    button: 'right',
    position: {
      x: box.width / 2 + (41 - account.position.x) * 64,
      y: box.height / 2 + (36 - account.position.y) * 64,
    },
  });
  await expect(page.locator('#town-panel')).toBeVisible();
  await expect(page.locator('#town-bank [data-item="raw_salmon"]')).toBeVisible();
  await page.locator('#town-close').click();
  await page.screenshot({ path: 'test-results/screenshots/bank-hall.png', fullPage: true });
});

test('itens largados no banco ficam visíveis sobre o piso comum sem placa de doação', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 33, y: 38 }, 100, () => 0, {
    inventory: [{ id: 'raw_salmon', quantity: 3 }],
    isolateMobs: [],
  });
  await expect(page.locator('#bank-donation-label')).toHaveCount(0);
  await page.locator('#backpack-slot').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  const box = await page.locator('#world').boundingBox();
  await page.locator('#inventory-grid [data-item="raw_salmon"]').dragTo(page.locator('#world'), {
    targetPosition: { x: box.width / 2 + 64, y: box.height / 2 },
  });
  await expect.poll(() => account.groundItems[0]?.x).toBe(34);
  expect(account.groundItems[0].y).toBe(38);
  await expect
    .poll(() =>
      page.locator('#world').evaluate((canvas) => {
        const box = canvas.getBoundingClientRect(),
          scale = canvas.width / box.width;
        const data = canvas
          .getContext('2d')
          .getImageData(
            Math.floor((box.width / 2 + 40) * scale),
            Math.floor((box.height / 2 - 20) * scale),
            Math.floor(48 * scale),
            Math.floor(48 * scale),
          ).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] === 223 && data[i + 1] === 162 && data[i + 2] === 142) count++;
        return count;
      }),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/screenshots/bank-donation.png', fullPage: true });
});
