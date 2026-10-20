import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup } from './helpers/world.mjs';
import { FLOOR_LINKS, ORC_CASTLE } from '../public/js/world/elevation.js';
import { SPAWN } from '../public/js/config.js';
import { walkable } from '../public/js/world/map.js';

for (const id of [
  'orc-mountain',
  'fire-mountain',
  'water-mountain',
  'castle',
  'orc-cave',
  'fire-cave',
  'water-cave',
]) {
  test(`${id}: atravessa piso, vê apenas o andar atual, atualiza e retorna`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const link = FLOOR_LINKS.find((link) => link.id === id + '-in'),
      back = FLOOR_LINKS.find((link) => link.id === id + '-out');
    const start = { x: link.from.x, y: link.from.y + 1, z: 0 };
    expect(walkable(start.x, start.y, 0)).toBe(true);
    const { account } = await setup(page, start, 100, () => 0, {
      isolateMobs: [],
      inventory: [],
      groundItems: [
        { id: 'surface-item', itemId: 'gold_coin', quantity: 5, ...start },
        { id: 'other-floor-item', itemId: 'raw_salmon', quantity: 3, ...link.to },
      ],
    });
    await expect(page.locator('[data-ground-id="surface-item"]')).toBeVisible();
    await expect(page.locator('[data-ground-id="other-floor-item"]')).toHaveCount(0);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#minimap')).toHaveAttribute('data-floor', String(link.to.z));
    await page.keyboard.up('ArrowUp');
    await expect.poll(() => account.position.z).toBe(link.to.z);
    await expect(page.locator('[data-ground-id="surface-item"]')).toHaveCount(0);
    await expect(page.locator('[data-ground-id="other-floor-item"]')).toBeVisible();
    await expect(page.locator('.town-map-label:visible')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#minimap')).toHaveAttribute('data-floor', String(link.to.z));
    await page.locator('#welcome').evaluate((element) => (element.style.opacity = '0'));
    await mkdir('test-results/screenshots', { recursive: true });
    await page.screenshot({ path: `test-results/screenshots/floor-${id}.png`, fullPage: true });
    const box = await page.locator('#world').boundingBox();
    await page.locator('#world').click({
      position: {
        x: box.width / 2 + (back.from.x - account.position.x) * 64,
        y: box.height / 2 + (back.from.y - account.position.y) * 64,
      },
    });
    await expect(page.locator('#minimap')).toHaveAttribute('data-floor', '0');
    await expect.poll(() => account.position.z).toBe(0);
    await expect(page.locator('[data-ground-id="surface-item"]')).toBeVisible();
    await expect(page.locator('[data-ground-id="other-floor-item"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('fortaleza distante tem muralhas e grupo de orcs; vila inicial fica sem monstros', async ({
  page,
}) => {
  const { account } = await setup(page, { x: ORC_CASTLE.x + 6, y: ORC_CASTLE.y + 4 }, 100, () => 0);
  for (const id of ['orc', 'orc_guard_west', 'orc_guard_east', 'orc_captain'])
    await expect(page.locator(`[data-mob-id="${id}"]`)).toBeVisible();
  await expect(page.locator('#region-name')).toHaveText('DOMÍNIO DOS ORCS');
  await expect(page.locator('[data-mob-id="orc_rampart"]')).toBeHidden();
  await page.locator('#welcome').evaluate((element) => (element.style.opacity = '0'));
  await page.screenshot({ path: 'test-results/screenshots/orc-castle.png', fullPage: true });
});

test('spawn mostra área protegida e permanece sem mobs ou dano', async ({ page }) => {
  const { account, events } = await setup(page, { ...SPAWN }, 100, () => 0);
  await expect(page.locator('#floor-label')).toContainText('Área inicial protegida');
  await expect(page.locator('.orc-label:visible')).toHaveCount(0);
  await page.waitForTimeout(1200);
  expect(account.vitals.health).toBe(100);
  expect(events.filter((event) => event.damage)).toHaveLength(0);
});
