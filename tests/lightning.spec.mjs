import { test, expect } from '@playwright/test';
import { setup } from './helpers/world.mjs';

test('Matlo vende Cajado de raio por um ouro; equipar libera QWER e guardar esconde a barra', async ({
  page,
}) => {
  const { account } = await setup(page, { x: 36, y: 23 }, 100, () => 0, {
    inventory: [{ id: 'gold_coin', quantity: 1 }],
    isolateMobs: [],
  });
  await page.locator('[data-town-id="gear"]').click({ button: 'right' });
  await page.locator('#town-stock [data-item="lightning_staff"]').click();
  await page.locator('#town-buy').click();
  await expect(page.locator('#town-bag [data-item="lightning_staff"]')).toBeVisible();
  expect(account.inventory.some((i) => i?.id === 'gold_coin')).toBe(false);
  await page.locator('#town-close').click();
  await page.locator('#backpack-slot').click({ button: 'right' });
  await page
    .locator('#inventory-grid [data-item="lightning_staff"]')
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('#look-message')).toContainText('ATK: 3');
  await expect(page.locator('#look-message')).not.toContainText('3 + 5');
  await page.locator('#inventory-grid [data-item="lightning_staff"]').click({ button: 'right' });
  await page.locator('#item-context-use').click();
  await expect(page.locator('#lightning-abilities')).toBeVisible();
  await expect(page.locator('#lightning-abilities button')).toHaveCount(4);
  await expect(page.locator('#lightning-abilities button svg')).toHaveCount(4);
  await expect(
    page.locator('#lightning-abilities button span, #lightning-abilities button small'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Q: Raio', exact: true })).toHaveAttribute(
    'title',
    /Mana: 5/,
  );
  await page.locator('[data-equipment="sword"]').click({ button: 'right' });
  await page.locator('#item-context-use').click();
  await expect(page.locator('#lightning-abilities')).toBeHidden();
});

test('F seleciona fora dos 3 quadrados, repetir não desliga e andar até o alcance dispara auto', async ({
  page,
}) => {
  const { account, events } = await setup(page, { x: 86, y: 30 }, 100, () => 0, {
    isolateMobs: ['orc'],
    equipment: { weapon: { id: 'lightning_staff', quantity: 1 } },
  });
  await page.keyboard.press('f');
  await expect(page.locator('#orc-label')).toHaveClass(/targeted/);
  expect(account.orc.health).toBe(300);
  expect(account.position).toMatchObject({ x: 86, y: 30 });
  await page.keyboard.press('f');
  await expect(page.locator('#orc-label')).toHaveClass(/targeted/);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(() => events.some((e) => e.type === 'player-hit' && e.element === 'lightning'))
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#orc-label')).toHaveClass(/targeted/);
});

test('QWER funcionam no teclado com mana, recargas, veneno e áreas visíveis; R cura e recarga persiste', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { account, events } = await setup(page, { x: 86, y: 24 }, 50, () => 0, {
    isolateMobs: ['orc_captain'],
    equipment: { weapon: { id: 'lightning_staff', quantity: 1 } },
  });
  await page.keyboard.press('f');
  await expect(page.locator('#orc_captain-label')).toHaveClass(/targeted/);
  await page.keyboard.press('q');
  await expect(page.locator('#mana-value')).toHaveText('95 / 100');
  await expect(page.locator('button[data-ability="q"]')).toBeDisabled();
  await page.keyboard.press('w');
  await expect(page.locator('#fishing-message')).toContainText('0,5');
  expect(account.vitals.mana).toBe(95);
  await expect(page.locator('button[data-ability="w"]')).toBeEnabled();
  await page.keyboard.press('w');
  await expect(page.locator('#mana-value')).toHaveText('85 / 100');
  expect(events.some((e) => e.type === 'poison-applied')).toBe(true);
  await expect(page.locator('button[data-ability="e"]')).toBeEnabled();
  await page.keyboard.press('e');
  await expect(page.locator('.lightning-area-effect[data-ability="e"]')).toBeVisible();
  await expect(page.locator('#mana-value')).toHaveText('75 / 100');
  await expect(page.locator('button[data-ability="r"]')).toBeEnabled();
  const health = account.vitals.health;
  await page.keyboard.press('r');
  await expect(page.locator('#mana-value')).toHaveText('35 / 100');
  await expect(page.locator('.lightning-area-effect[data-ability="r"]')).toBeVisible();
  expect(account.vitals.health).toBeGreaterThan(health);
  await page.screenshot({
    path: 'test-results/screenshots/lightning-shockwave.png',
    fullPage: true,
  });
  await expect(page.locator('button[data-ability="r"]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#lightning-abilities')).toBeVisible();
  await expect(page.locator('button[data-ability="r"]')).toBeDisabled();
  await expect(page.locator('#mana-value')).toHaveText('35 / 100');
  expect(errors).toEqual([]);
});
