import { test, expect } from '@playwright/test';
import { setup } from './helpers/world.mjs';
import { ORE_NODES } from '../public/js/game/adventure-rules.js';
import { walkable } from '../public/js/world/map.js';

test('Rafhi aceita entrega, recompensa uma vez e diário persiste', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { account } = await setup(page, { x: 25, y: 20 }, 100, () => 0, {
    inventory: [{ id: 'roasted_salmon', quantity: 5 }],
    isolateMobs: [],
  });
  await page.locator('[data-town-id="food"]').click({ button: 'right' });
  await page.locator('#town-quests').click();
  await page.locator('[data-quest="kitchen"] [data-quest-action="accept"]').click();
  await expect(page.locator('[data-quest="kitchen"] [data-quest-action="claim"]')).toBeVisible();
  await page.locator('[data-quest="kitchen"] [data-quest-action="claim"]').click();
  await expect(page.locator('#adventure-message')).toContainText('Recompensa recebida');
  expect(account.inventory.find((i) => i?.id === 'gold_coin').quantity).toBe(20);
  await page.reload();
  await page.locator('#adventure-toggle').click();
  await expect(page.locator('[data-quest="kitchen"]')).toContainText('CONCLUÍDA');
  expect(errors).toEqual([]);
});
test('forja fabrica materiais e espada com requisitos visíveis', async ({ page }) => {
  const { account } = await setup(page, { x: 36, y: 23 }, 100, () => 0, {
    inventory: [
      { id: 'iron_ore', quantity: 2 },
      { id: 'iron_bar', quantity: 3 },
    ],
    isolateMobs: [],
  });
  await page.locator('[data-resource-id="forge"]').click({ button: 'right' });
  await page.locator('[data-craft="iron_bar"]').click();
  await expect.poll(() => account.inventory.some((i) => i?.id === 'iron_ore')).toBe(false);
  await page.locator('[data-craft="iron_sword"]').click();
  await expect.poll(() => account.inventory.some((i) => i?.id === 'iron_sword')).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/forge-recipes.png', fullPage: true });
});
test('veio extrai ferro, rende XP e interrompe ao caminhar', async ({ page }) => {
  const n = ORE_NODES[0],
    position = [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]
      .map(([x, y]) => ({ x: n.x + x, y: n.y + y, z: n.z }))
      .find((p) => walkable(p.x, p.y, p.z));
  const { account } = await setup(page, position, 100, () => 0, { inventory: [], isolateMobs: [] });
  await page.locator(`[data-resource-id="${n.id}"]`).click({ button: 'right' });
  await expect(page.locator('#mining-status')).toBeVisible();
  await expect
    .poll(() => account.inventory.find((i) => i?.id === 'iron_ore')?.quantity, { timeout: 5000 })
    .toBe(1);
  expect(account.skills.mining.xp).toBe(10);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mining-status')).toBeHidden();
});
test('E mira no chão sem alvo, só gasta ao confirmar e não caminha', async ({ page }) => {
  const { account } = await setup(page, { x: 86, y: 28 }, 100, () => 0, {
    isolateMobs: ['orc'],
    equipment: { weapon: { id: 'lightning_staff', quantity: 1 } },
  });
  await page.keyboard.press('e');
  await expect(page.locator('#spell-aim')).toBeVisible();
  expect(account.vitals.mana).toBe(100);
  await page.keyboard.press('Escape');
  await expect(page.locator('#spell-aim')).toBeHidden();
  expect(account.vitals.mana).toBe(100);
  await page.keyboard.press('e');
  const box = await page.locator('#world').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 128);
  await expect(page.locator('#mana-value')).toHaveText('90 / 100');
  expect(account.position).toMatchObject({ x: 86, y: 28 });
  await expect(page.locator('#spell-aim')).toBeHidden();
});
test('comandante e avisos visuais na sala norte; modo de teste é opcional', async ({ page }) => {
  const { account } = await setup(page, { x: 86, y: 19, z: -1 }, 100, () => 0, {
    isolateMobs: ['orc_commander'],
    gameSettings: { testMode: false },
  });
  await expect(page.locator('[data-mob-id="orc_commander"]')).toBeVisible();
  expect(account.elementals.orc_commander.maxHealth).toBe(400);
  await expect(page.locator('.monster-warning').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/orc-commander.png', fullPage: true });
  await page.locator('#adventure-toggle').click();
  await page.locator('[data-tab="settings"]').click();
  await page.locator('#test-mode').check();
  await expect.poll(() => account.elementals.orc_commander.maxHealth).toBe(4000);
});
