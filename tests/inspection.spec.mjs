import { test, expect } from '@playwright/test';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { STOVE } from '../public/js/config.js';
import { decorationAt } from '../public/js/world/decorations.js';
import { FIRE_REGION, WATER_REGION } from '../public/js/config.js';
import { ORC_REGION } from '../public/js/world/elevation.js';
import { walkable } from '../public/js/world/map.js';

async function tileClick(page, account, point, options = {}) {
  const box = await page.locator('#world').boundingBox();
  await page.locator('#world').click({
    ...options,
    position: {
      x: box.width / 2 + (point.x - account.position.x) * 64,
      y: box.height / 2 + (point.y - account.position.y) * 64,
    },
  });
}

test('Shift olha chão e pilhas sem andar; menu Olhar não consome e Usar mantém a ação', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 29, y: 27 }, 90, () => 0, {
    inventory: [{ id: 'roasted_salmon', quantity: 2 }],
    isolateMobs: [],
    groundItems: [{ id: 'look-sword', itemId: 'sword', quantity: 1, x: 30, y: 27 }],
  });
  await tileClick(page, account, { x: 30, y: 28 }, { modifiers: ['Shift'] });
  await expect(page.locator('#look-message')).toContainText('You see');
  await expect(page.locator('#look-message')).toHaveCSS('color', 'rgb(80, 240, 80)');
  expect(account.position).toMatchObject({ x: 29, y: 27 });
  await page.locator('[data-ground-id="look-sword"]').click({ modifiers: ['Shift'] });
  await expect(page.locator('#look-message')).toHaveText('You see a sword (ATK: 2).');
  await page.locator('#backpack-slot').click({ button: 'right' });
  const fish = page.locator('#inventory-grid [data-item="roasted_salmon"]');
  await fish.click({ button: 'right' });
  await expect(page.locator('#item-context-menu')).toBeVisible();
  expect(account.vitals.health).toBe(90);
  await page.locator('#item-context-look').click();
  await expect(page.locator('#look-message')).toContainText(
    'You see a roasted salmon. Quantity: 2.',
  );
  expect(account.vitals.health).toBe(90);
  expect(account.inventory[0].quantity).toBe(2);
  await fish.click({ modifiers: ['Shift'] });
  expect(account.inventory[0].quantity).toBe(2);
  await fish.click({ button: 'right' });
  await page.locator('#item-context-use').click();
  await expect.poll(() => account.vitals.health, { timeout: 5000 }).toBe(100);
  expect(account.inventory[0].quantity).toBe(1);
});

test('botão direito não caminha até fogão ou chão livre; esquerdo permite chegar e usar', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 29, y: 27 }, 100, () => 0, { isolateMobs: [] });
  await tileClick(page, account, STOVE, { button: 'right' });
  await expect(page.locator('#fishing-message')).toContainText('Aproxime-se');
  await expect(page.locator('#cooking-panel')).toBeHidden();
  await tileClick(page, account, { x: 30, y: 27 }, { button: 'right' });
  await page.waitForTimeout(400);
  expect(account.position).toMatchObject({ x: 29, y: 27 });
  await tileClick(page, account, { x: 21, y: 31 });
  await expect.poll(() => account.position).toMatchObject({ x: 21, y: 31 });
  await tileClick(page, account, STOVE, { button: 'right' });
  await expect(page.locator('#cooking-panel')).toBeVisible();
});

test('olhar monstro não inicia combate e atacar distante não aproxima o jogador', async ({
  page,
}) => {
  const { account, events } = await setupCombat(page, orcPoint(0, 3), 100, () => 0);
  await page.locator('#orc-label').click({ modifiers: ['Shift'] });
  await expect(page.locator('#look-message')).toContainText('You see Orc. Health: 300 / 300.');
  expect(events).toHaveLength(0);
  await page.locator('#orc-label').click({ button: 'right' });
  await expect(page.locator('#orc-label')).toHaveClass(/targeted/);
  await page.waitForTimeout(400);
  expect(account.position).toMatchObject(orcPoint(0, 3));
});

for (const [id, region] of [
  ['fire', FIRE_REGION],
  ['water', WATER_REGION],
  ['orc', ORC_REGION],
]) {
  test(`decoração de ${id} aparece e pode ser inspecionada`, async ({ page }) => {
    let point;
    for (let y = region.y + 2; y < region.y + region.h - 2 && !point; y++)
      for (let x = region.x + 2; x < region.x + region.w - 2; x++)
        if (decorationAt(x, y) && walkable(x, y) && walkable(x, y + 1)) {
          point = { x, y };
          break;
        }
    expect(point).toBeTruthy();
    const { account } = await setup(page, { x: point.x, y: point.y + 1 }, 100, () => 0, {
      isolateMobs: [],
    });
    await tileClick(page, account, point, { modifiers: ['Shift'] });
    await expect(page.locator('#look-message')).toContainText('You see');
    await page.screenshot({
      path: `test-results/screenshots/decoration-${id}.png`,
      fullPage: true,
    });
  });
}

test('vazio superior e subterrâneo tem padrões distintos e continua sem passagem', async ({
  page,
}) => {
  await setup(page, { x: 29, y: 27 }, 100, () => 0, { isolateMobs: [] });
  const results = await page.evaluate(async () => {
    const { terrain } = await import('/js/graphics/terrain.js');
    const { walkable } = await import('/js/world/map.js');
    return [-1, 1].map((z) => {
      const tile = terrain(29, 27, z),
        data = tile.getContext('2d').getImageData(0, 0, 32, 32).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4)
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return { colors: [...colors], walkable: walkable(29, 27, z) };
    });
  });
  for (const result of results) {
    expect(result.walkable).toBe(false);
    expect(result.colors.length).toBeGreaterThan(2);
    expect(result.colors).not.toContain('12,20,27');
  }
  expect(results[0].colors).not.toEqual(results[1].colors);
});
