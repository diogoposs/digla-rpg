import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { ORC_SPAWN } from '../public/js/game/world-rules.js';
import { WELL, STOVE } from '../public/js/config.js';
import { distance } from '../public/js/game/world-rules.js';

async function rightTile(page, account, point, offsetY = 0, button = 'right') {
  const box = await page.locator('#world').boundingBox();
  await page.locator('#world').click({
    button,
    position: {
      x: box.width / 2 + (point.x - account.position.x) * 64,
      y: box.height / 2 + (point.y - account.position.y) * 64 + offsetY,
    },
  });
}

test('templo restaura vida/mana por botão direito, bloqueia menu nativo e troca moedas', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { account } = await setup(page, { x: 29, y: 26 }, 12, () => 0, {
    vitals: { mana: 7 },
    inventory: [{ id: 'gold_coin', quantity: 115 }],
  });
  await page.evaluate(() =>
    document.addEventListener('contextmenu', (event) => {
      window.contextBlocked = event.defaultPrevented;
    }),
  );
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/temple-spawn.png', fullPage: true });
  await rightTile(page, account, WELL, -60);
  await expect(page.locator('#health-value')).toHaveText('100 / 100');
  await expect(page.locator('#mana-value')).toHaveText('100 / 100');
  expect(distance(account.position, WELL)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.contextBlocked)).toBe(true);
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page
    .getByRole('listitem', { name: 'Moeda dourada × 115', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(
    page.getByRole('listitem', { name: 'Moeda dourada × 15', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Moeda cinza × 1', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/temple-coins.png', fullPage: true });
  await page
    .getByRole('listitem', { name: 'Moeda dourada × 15', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#fishing-message')).toContainText('Junte 100');
  await rightTile(page, account, { x: 30, y: 27 }, 0, 'left');
  await expect(page.locator('#coordinates')).toHaveText('X: 30 · Y: 27');
  expect(errors).toEqual([]);
});

test('botão direito usa o fogão próximo e permite cozinhar', async ({ page }) => {
  const { account } = await setup(page, { x: 21, y: 31 }, 100, () => 0, {
    inventory: [{ id: 'raw_salmon', quantity: 1 }],
  });
  await rightTile(page, account, STOVE);
  await expect(page.locator('#cooking-panel')).toBeVisible();
  expect(distance(account.position, STOVE)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Cozinhar 1', exact: true }).click();
  await expect
    .poll(() => account.inventory.some((item) => item?.id === 'roasted_salmon'))
    .toBe(true);
  await page.screenshot({
    path: 'test-results/screenshots/stove-repositioned.png',
    fullPage: true,
  });
});

test('botão direito na água próxima pesca e também aciona a barra', async ({ page }) => {
  const { account } = await setup(page, { x: 38, y: 31 }, 100, () => 0.99999);
  await rightTile(page, account, { x: 39, y: 31 });
  await expect(page.locator('#fishing-panel')).toBeVisible();
  await rightTile(page, account, { x: 39, y: 31 });
  await expect(page.locator('#fishing-instruction')).not.toContainText('Aperte F');
  await expect(page.locator('#cooking-panel')).toBeHidden();
});

test('repetir botão direito interrompe ataque e orc continua seguindo o jogador', async ({
  page,
}) => {
  const { account, events } = await setupCombat(page, orcPoint(), 100, () => 0);
  await page.locator('#orc-label').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#orc-label')).toHaveClass(/targeted/);
  await page.locator('#orc-label').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#orc-label')).not.toHaveClass(/targeted/);
  await expect(page.locator('#fishing-message')).toContainText('Ataque interrompido');
  await rightTile(page, account, orcPoint(0, 4), 0, 'left');
  await expect(page.locator('#coordinates')).toHaveText(
    `X: ${ORC_SPAWN.x} · Y: ${ORC_SPAWN.y + 4}`,
  );
  await expect.poll(() => account.orc.y).toBeGreaterThanOrEqual(ORC_SPAWN.y + 2);
  expect(events.filter((event) => event.type === 'player-hit')).toHaveLength(1);
  expect(account.orc.health).toBe(297);
});
