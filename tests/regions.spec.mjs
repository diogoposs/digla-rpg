import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup } from './helpers/world.mjs';
import { MOB_DEFINITIONS } from '../public/js/game/world-rules.js';
import { walkable } from '../public/js/world/map.js';

for (const id of ['ember_guardian', 'fire_drake', 'tide_guardian', 'water_serpent']) {
  test(`${id}: novo território renderiza e permite combate com fraqueza`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const mob = MOB_DEFINITIONS[id];
    const position = [
      { x: mob.spawn.x, y: mob.spawn.y + 1 },
      { x: mob.spawn.x - 1, y: mob.spawn.y },
    ].find((point) => walkable(point.x, point.y));
    const { account } = await setup(page, position, 100, () => 0, {
      inventory: [],
      isolateMobs: [id],
      equipment: { weapon: { id: 'staff', quantity: 1 } },
      attackElement: mob.weakness,
    });
    const label = page.locator(`[data-mob-id="${id}"]`);
    await expect(label).toBeVisible();
    await expect(label.locator('small')).toHaveText(`${mob.maxHealth} / ${mob.maxHealth}`);
    await expect(page.locator('#region-name')).toHaveText(
      mob.kind === 'fire' ? 'TERRAS DE BRASAS' : 'COSTA DAS MARÉS',
    );
    await expect(page.locator('#minimap-legend')).toContainText('Peixe: pesca');
    await label.click({ button: 'right' });
    if (await page.locator('#item-context-menu').isVisible())
      await page.locator('#item-context-use').click();
    await expect.poll(() => account.elementals[id].health).toBe(mob.maxHealth - 6);
    await expect(page.locator(`.element-hit.element-${mob.weakness}`).last()).toBeVisible();
    await mkdir('test-results/screenshots', { recursive: true });
    await page.screenshot({ path: `test-results/screenshots/${id}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('itens somem do chão ao vencer o ciclo e mochila e banco permanecem', async ({ page }) => {
  const { account } = await setup(page, { x: 29, y: 27 }, 100, () => 0, {
    nextGroundCleanupAt: Date.now() + 2500,
    groundItems: [{ id: 'test-cleanup', itemId: 'gold_coin', quantity: 5, x: 28, y: 27 }],
    inventory: [{ id: 'gold_coin', quantity: 7 }],
    bank: [{ id: 'iron_armor', quantity: 1 }],
  });
  await expect(page.locator('.ground-item-handle')).toHaveCount(1);
  await expect(page.locator('.ground-item-handle')).toHaveCount(0, { timeout: 7000 });
  expect(account.inventory[0]).toEqual({ id: 'gold_coin', quantity: 7 });
  expect(account.bank[0]).toEqual({ id: 'iron_armor', quantity: 1 });
  expect(account.nextGroundCleanupAt).toBeGreaterThan(Date.now());
});
