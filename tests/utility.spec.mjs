import { test, expect } from '@playwright/test';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { STOVE } from '../public/js/config.js';
import { nearWater } from '../public/js/game/fishing-rules.js';

test('barra compacta, três poções configuráveis e H para todos os outfits', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { account } = await setup(page, { x: 29, y: 28 }, 70, () => 0, {
    isolateMobs: [],
    inventory: [
      { id: 'health_potion', quantity: 2 },
      { id: 'mana_potion', quantity: 2 },
    ],
    equipment: { weapon: { id: 'lightning_staff', quantity: 1 } },
  });
  await expect(page.locator('#utility-bar [data-quick]')).toHaveCount(3);
  const skill = await page.locator('#lightning-abilities button').first().boundingBox();
  expect(skill.width).toBeLessThanOrEqual(36);
  await page.keyboard.press('1');
  await expect(page.locator('#health-value')).toHaveText('100 / 100');
  expect(account.inventory[0].quantity).toBe(1);
  await page.keyboard.press('h');
  await expect(page.locator('#mana-value')).toHaveText('90 / 100');
  await expect(page.locator('[data-utility="h"]')).toBeDisabled();
  await page.keyboard.press('h');
  expect(account.vitals.mana).toBe(90);
  await page.locator('[data-quick="2"]').click({ button: 'right' });
  await expect(page.locator('#quick-config')).toBeVisible();
  await page.locator('[data-potion="mana_potion"]').click();
  await expect(page.locator('#quick-config')).toBeHidden();
  await page.keyboard.press('3');
  await expect(page.locator('#mana-value')).toHaveText('100 / 100');
  expect(account.quickSlots[2]).toBe('mana_potion');
  expect(account.inventory[1].quantity).toBe(1);
  await page.screenshot({
    path: 'test-results/screenshots/compact-action-bars.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('B tem animação, cancela ao andar, retorna em 10s e mantém recarga ao recarregar', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 29, y: 28 }, 100, () => 0, { isolateMobs: [] });
  await page.keyboard.press('b');
  await expect(page.locator('#recall-panel')).toBeVisible();
  await expect(page.locator('#recall-effect')).toBeVisible();
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#coordinates')).toHaveText('X: 29 · Y: 29');
  await page.keyboard.up('ArrowDown');
  await expect(page.locator('#recall-panel')).toBeHidden();
  expect(account.utility.recallCooldownUntil).toBe(0);
  await page.keyboard.press('b');
  await expect(page.locator('#recall-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/temple-recall.png', fullPage: true });
  await expect(page.locator('#coordinates')).toHaveText('X: 29 · Y: 27', { timeout: 13000 });
  await expect(page.locator('#recall-panel')).toBeHidden();
  await expect(page.locator('[data-utility="b"]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('[data-utility="b"]')).toBeDisabled();
});

test('qualquer dano interrompe o retorno', async ({ page }) => {
  const { account } = await setupCombat(page, orcPoint(), 100, () => 0);
  await page.keyboard.press('b');
  await expect(page.locator('#recall-panel')).toBeVisible();
  await expect(page.locator('#recall-panel')).toBeHidden();
  expect(account.vitals.health).toBeLessThan(100);
  expect(account.utility.recallCooldownUntil).toBe(0);
  await expect(page.locator('#fishing-message')).toContainText('cancelado');
});

test('corpo arrasta para chão livre preservando loot e prazo de desaparecimento', async ({
  page,
}) => {
  const { account } = await setupCombat(page, orcPoint(), 100, () => 0);
  account.orc.health = 1;
  await page.keyboard.press('f');
  const body = page.locator('[data-corpse-id]');
  await expect(body).toBeVisible();
  const expires = account.corpse.expiresAt,
    loot = JSON.stringify(account.corpse.slots);
  const box = await page.locator('#world').boundingBox();
  await body.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + box.height / 2 + 64, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => account.corpse.x).toBe(87);
  expect(account.corpse.y).toBe(28);
  expect(account.corpse.expiresAt).toBe(expires);
  expect(JSON.stringify(account.corpse.slots)).toBe(loot);
  account.corpse.expiresAt = Date.now() - 1;
  await expect(body).toHaveCount(0);
});

for (const kind of ['fishing', 'cooking'])
  test(`${kind} fica no centro e não sobrepõe a barra do cajado`, async ({ page }) => {
    let position = { x: STOVE.x - 1, y: STOVE.y };
    if (kind === 'fishing') {
      position = null;
      for (let y = 15; y < 44 && !position; y++)
        for (let x = 30; x < 65; x++)
          if (nearWater({ x, y })) {
            position = { x, y };
            break;
          }
    }
    await setup(page, position, 100, () => 0, {
      isolateMobs: [],
      equipment: { weapon: { id: 'lightning_staff', quantity: 1 } },
    });
    await page.keyboard.press('f');
    const panel = page.locator(`#${kind}-panel`);
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox(),
      frame = await page.locator('.world-frame').boundingBox(),
      bar = await page.locator('#action-bars').boundingBox();
    expect(Math.abs(bounds.y + bounds.height / 2 - frame.y - frame.height / 2)).toBeLessThan(5);
    expect(bounds.y + bounds.height).toBeLessThan(bar.y);
    await page.screenshot({
      path: `test-results/screenshots/${kind}-centered.png`,
      fullPage: true,
    });
  });
