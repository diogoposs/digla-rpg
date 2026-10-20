import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { setup, setupCombat } from './helpers/world.mjs';
import { orcPoint } from './helpers/combat.mjs';
import { WELL, SPAWN } from '../public/js/config.js';

test('comer por botão direito, impedir consumo indevido, arrastar e recolher no mapa', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { account } = await setup(page, { x: 29, y: 27 });
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await page
    .getByRole('listitem', { name: 'Salmão assado × 2', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#health-value')).toHaveText('100 / 100', { timeout: 5000 });
  const roasted = page.getByRole('listitem', { name: 'Salmão assado × 1', exact: true });
  await roasted.click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#fishing-message')).toContainText('vida e mana estão cheias');
  await expect(roasted).toBeVisible();
  const raw = page.getByRole('listitem', { name: 'Salmão cru × 3', exact: true });
  await page
    .getByRole('listitem', { name: 'Salmão cru × 3', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#fishing-message')).toContainText('Somente o salmão assado');
  const box = await page.locator('#world').boundingBox();
  await raw.dragTo(page.locator('#world'), {
    targetPosition: { x: box.width / 2 + 64, y: box.height / 2 },
  });
  await expect(page.locator('[data-item="raw_salmon"]')).toHaveCount(0);
  expect(account.groundItems).toHaveLength(1);
  expect(account.groundItems[0].quantity).toBe(3);
  await expect
    .poll(() =>
      page.locator('#world').evaluate((canvas) => {
        const box = canvas.getBoundingClientRect(),
          scale = canvas.width / box.width;
        const ctx = canvas.getContext('2d'),
          data = ctx.getImageData(
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
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/ground-items.png', fullPage: true });
  const floorItem = page.getByRole('img', { name: 'Salmão cru × 3 no chão', exact: true });
  await floorItem.dragTo(page.locator('#world'), {
    targetPosition: { x: box.width / 2 + 64, y: box.height / 2 + 64 },
  });
  await expect.poll(() => account.groundItems[0]?.y).toBe(28);
  expect(account.groundItems[0].quantity).toBe(3);
  await floorItem.dragTo(page.locator('#world'), {
    targetPosition: { x: box.width / 2 + (WELL.x - SPAWN.x) * 64, y: box.height / 2 - 128 },
  });
  expect(account.groundItems[0].y).toBe(28);
  await floorItem.click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(raw).toBeVisible();
  expect(account.groundItems).toHaveLength(0);
  await raw.dragTo(page.locator('#world'), {
    targetPosition: { x: box.width / 2 + (WELL.x - SPAWN.x) * 64, y: box.height / 2 - 128 },
  });
  await expect(raw).toBeVisible();
  expect(account.groundItems).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('orc verde visível, selecionar combate, receber dano e derrotar o inimigo', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { account, events } = await setupCombat(page, orcPoint(), 100);
  await expect(page.getByRole('button', { name: 'Atacar orc', exact: true })).toBeVisible();
  await expect(page.locator('#orc-hp')).toHaveText('300 / 300');
  await page.getByRole('button', { name: 'Atacar orc', exact: true }).click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.locator('#orc-hp')).toHaveText('294 / 300');
  await expect.poll(() => account.vitals.health).toBeLessThan(100);
  await expect(page.locator('.damage-number[data-target="player"].critical').last()).toHaveText(
    '6',
  );
  await expect(page.locator('.damage-number[data-target="orc"].critical').last()).toHaveText('6');
  await page.screenshot({ path: 'test-results/screenshots/orc-combat.png', fullPage: true });
  account.orc.health = 6; // Wound the enemy so the corpse check stays quick.
  await expect.poll(() => account.orc.health, { timeout: 8000 }).toBe(0);
  await expect(page.locator('#orc-label')).toBeHidden();
  expect(account.corpse).toBeTruthy();
  await page.locator(`[data-corpse-id="${account.corpse.id}"]`).click({ button: 'right' });
  await expect(page.locator('#loot-panel')).toBeVisible();
  await expect(page.locator('#loot-grid [role="listitem"]')).toHaveCount(6);
  await expect(page.locator('#loot-grid [aria-label$="— vazio"]')).toHaveCount(
    6 - account.corpse.slots.filter(Boolean).length,
  );
  await expect(page.locator('#loot-grid [data-item="gold_coin"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/orc-corpse-loot.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar loot', exact: true }).click();
  await expect(page.locator('#loot-panel')).toBeHidden();
  expect(events.some((event) => event.type === 'orc-defeated')).toBe(true);
  expect(
    events.filter((event) => event.damage).every((event) => event.damage >= 3 && event.damage <= 6),
  ).toBe(true);
  expect(account.vitals.health).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('golpes comuns sobem em vermelho sem destaque de crítico', async ({ page }) => {
  await setupCombat(page, orcPoint(), 100, () => 0);
  const box = await page.locator('#world').boundingBox();
  await page
    .locator('#world')
    .click({ button: 'right', position: { x: box.width / 2, y: box.height / 2 - 64 } });
  const number = page.locator('.damage-number[data-target="orc"]').first();
  await expect(number).toHaveText('3');
  await expect(number).not.toHaveClass(/critical/);
  await expect(number).toHaveCSS('color', 'rgb(255, 72, 72)');
  // The HTTP response creates the number; the next animation frame positions it.
  await expect
    .poll(() => number.evaluate((element) => Number.isFinite(parseFloat(element.style.top))))
    .toBe(true);
  const firstTop = await number.evaluate((element) => parseFloat(element.style.top));
  await expect
    .poll(() => number.evaluate((element) => parseFloat(element.style.top)))
    .toBeLessThan(firstTop - 5);
});

test('derrota retorna o jogador ao spawn com vida cheia e preserva os itens', async ({ page }) => {
  await setupCombat(page, orcPoint(), 3);
  await expect(page.locator('#coordinates')).toHaveText('X: 29 · Y: 27', { timeout: 5000 });
  await expect(page.locator('#health-value')).toHaveText('100 / 100');
  await expect(page.locator('#fishing-message')).toContainText('retornou ao spawn');
  await page
    .getByRole('button', { name: 'Mochila — botão direito para abrir', exact: true })
    .click({ button: 'right' });
  if (await page.locator('#item-context-menu').isVisible())
    await page.locator('#item-context-use').click();
  await expect(page.getByRole('listitem', { name: 'Salmão cru × 3', exact: true })).toBeVisible();
});
