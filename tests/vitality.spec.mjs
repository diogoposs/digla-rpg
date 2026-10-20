import { test, expect } from '@playwright/test';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';

test('minimapa sem textos extras; Pang atende em sua casa, vende duas poções e elas restauram instantaneamente', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { account } = await setup(page, { x: 18, y: 25 }, 40, () => 0, {
    isolateMobs: [],
    inventory: [{ id: 'gold_coin', quantity: 3 }],
    vitals: { mana: 30 },
  });
  await expect(page.locator('#floor-label')).toBeHidden();
  await expect(page.locator('#minimap-legend')).toBeHidden();
  const box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ position: { x: box.width / 2 - 64, y: box.height / 2 - 192 } });
  await expect.poll(() => account.position).toMatchObject({ x: 17, y: 22 });
  await page.locator('[data-town-id="potions"]').click({ button: 'right' });
  await expect(page.locator('#town-title')).toHaveText('Pang — Poções');
  await expect(page.locator('#town-stock [data-item]')).toHaveCount(2);
  for (const id of ['health_potion', 'mana_potion']) {
    await page.locator(`#town-stock [data-item="${id}"]`).click();
    await page.locator('#town-buy').click();
    await expect(page.locator(`#town-bag [data-item="${id}"]`)).toBeVisible();
  }
  expect(account.inventory.find((i) => i?.id === 'gold_coin').quantity).toBe(1);
  await page.locator('#town-close').click();
  await page.locator('#backpack-slot').click({ button: 'right' });
  for (const id of ['health_potion', 'mana_potion']) {
    await page.locator(`#inventory-grid [data-item="${id}"]`).click({ button: 'right' });
    await page.locator('#item-context-use').click();
    await expect(page.locator(`#inventory-grid [data-item="${id}"]`)).toHaveCount(0);
  }
  expect(account.vitals.health).toBe(75);
  expect(account.vitals.mana).toBe(80);
  await page.locator('#welcome').evaluate((el) => (el.style.display = 'none'));
  await page.screenshot({ path: 'test-results/screenshots/pang-house.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Vitalidade sobe com magia, atualiza os máximos e mantém o bônus ao atualizar a página', async ({
  page,
}) => {
  const { account } = await setupCombat(page, orcPoint(), 95, () => 0, {
    skills: { vitality: { xp: 99 } },
    equipment: { weapon: { id: 'staff', quantity: 1 } },
    attackElement: 'fire',
  });
  await page.locator('#orc-label').click({ button: 'right' });
  await expect.poll(() => account.skills.vitality.xp).toBeGreaterThanOrEqual(100);
  await page.locator('#orc-label').click({ button: 'right' });
  await expect(page.locator('#health-value')).toContainText('/ 130');
  await expect(page.locator('#mana-value')).toContainText('/ 115');
  await page.locator('#toggle-skills').click();
  await expect(page.locator('#vitality-level')).toHaveText('2');
  await expect(page.locator('#vitality-xp')).toHaveText('0.33 / 200 XP');
  await page.screenshot({ path: 'test-results/screenshots/vitality-level.png', fullPage: true });
  await page.reload();
  await expect(page.locator('#health-value')).toContainText('/ 130');
  await expect(page.locator('#mana-value')).toContainText('/ 115');
});

test('salmão inicia efeito de um minuto e o primeiro intervalo recupera vida e mana no HUD', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 29, y: 27 }, 50, () => 0, {
    isolateMobs: [],
    vitals: { mana: 30 },
    inventory: [{ id: 'roasted_salmon', quantity: 1 }],
  });
  await page.locator('#backpack-slot').click({ button: 'right' });
  await page.locator('#inventory-grid [data-item="roasted_salmon"]').click({ button: 'right' });
  await page.locator('#item-context-use').click();
  await expect(page.locator('#fishing-message')).toContainText('por 1 minuto');
  expect(account.vitals.health).toBe(50);
  expect(account.vitals.mana).toBe(30);
  await expect(page.locator('#health-value')).toHaveText('70 / 100', { timeout: 4500 });
  await expect(page.locator('#mana-value')).toHaveText('45 / 100');
  expect(account.foodEffect.remainingTicks).toBe(19);
});
