import { test, expect } from '@playwright/test';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { MOB_DEFINITIONS, ELEMENT_NAMES } from '../public/js/game/world-rules.js';
import { walkable } from '../public/js/world/map.js';

for (const [id, element] of [
  ['fire_elemental', 'water'],
  ['water_elemental', 'lightning'],
]) {
  test(`${id}: sprite, 50 de vida, fraqueza, combate e loot individual`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const definition = MOB_DEFINITIONS[id],
      position = [
        { x: definition.spawn.x, y: definition.spawn.y - 1 },
        { x: definition.spawn.x - 1, y: definition.spawn.y },
      ].find((point) => walkable(point.x, point.y));
    expect(walkable(position.x, position.y)).toBe(true);
    const { account, events } = await setup(page, position, 100, () => 0, {
      inventory: [],
      isolateMobs: [id],
      equipment: { weapon: { id: 'staff', quantity: 1 } },
      attackElement: element,
    });
    const label = page.locator(`[data-mob-id="${id}"]`);
    await expect(label).toBeVisible();
    await expect(label.locator('small')).toHaveText('50 / 50');
    await expect(label.locator('.mob-weakness')).toHaveText('Fraco a ' + ELEMENT_NAMES[element]);
    await label.click({ button: 'right' });
    if (await page.locator('#item-context-menu').isVisible())
      await page.locator('#item-context-use').click();
    await expect(label.locator('small')).toHaveText('44 / 50');
    const hit = page.locator(`.damage-number[data-target="${id}"].weakness-hit`).first();
    await expect(hit).toHaveText('6');
    await expect(page.locator(`.element-hit.element-${element}`).last()).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/${id}.png`, fullPage: true });
    account.elementals[id].health = 6;
    await expect.poll(() => account.elementals[id].health).toBe(0);
    await expect(label).toBeHidden();
    const corpse = account.elementalCorpses[id],
      box = await page.locator('#world').boundingBox();
    await page.locator('#world').click({
      button: 'right',
      position: {
        x: box.width / 2 + (corpse.x - account.position.x) * 64,
        y: box.height / 2 + (corpse.y - account.position.y) * 64,
      },
    });
    await expect(page.locator('#loot-panel')).toBeVisible();
    await expect(page.locator('#loot-heading')).toContainText(definition.name);
    await page.locator('#loot-grid [data-item="gold_coin"]').click({ button: 'right' });
    if (await page.locator('#item-context-menu').isVisible())
      await page.locator('#item-context-use').click();
    await expect
      .poll(() => account.inventory.find((item) => item?.id === 'gold_coin')?.quantity)
      .toBe(5);
    expect(events.some((event) => event.mobId === id && event.type === 'mob-defeated')).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('orc mostra fraqueza a raio e aplica o bônus ao selecionar', async ({ page }) => {
  const { account } = await setupCombat(page, orcPoint(), 100, () => 0, {
    equipment: { weapon: { id: 'staff', quantity: 1 } },
    attackElement: 'lightning',
  });
  await expect(page.locator('#orc-label .mob-weakness')).toHaveText('Fraco a Raio');
  await page.locator('#orc-label').click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#orc-hp')).toHaveText('294 / 300');
  expect(account.skills.magic.xp).toBe(3);
});
