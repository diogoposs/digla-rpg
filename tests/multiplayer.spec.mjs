import { test, expect } from '@playwright/test';

test('duas sessões reais se veem, caminham, conversam e negociam com confirmação dupla', async ({
  browser,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  const a = await c1.newPage(),
    b = await c2.newPage();
  const errors = [];
  a.on('pageerror', (e) => errors.push(e.message));
  b.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const [page, username] of [
      [a, 'Net Alpha'],
      [b, 'Net Beta'],
    ]) {
      await page.request.post('http://127.0.0.1:3001/api/login', {
        data: { username, password: 'test-multiplayer-only' },
      });
      await page.goto('http://127.0.0.1:3001/');
      await expect(page.locator('#game')).toBeVisible();
    }
    await a.bringToFront();
    await expect(a.locator('.peer-label').filter({ hasText: 'Net Beta' })).toBeVisible();
    await a.keyboard.down('ArrowLeft');
    await expect(a.locator('#coordinates')).toHaveText('X: 28 · Y: 27');
    await a.keyboard.up('ArrowLeft');
    await b.bringToFront();
    await expect(b.locator('.peer-label').filter({ hasText: 'Net Alpha' })).toBeVisible();
    await expect
      .poll(async () => {
        const r = await b.request.post('http://127.0.0.1:3001/api/world/tick', { data: {} });
        return (await r.json()).players.find((p) => p.username === 'Net Alpha')?.x;
      })
      .toBe(28);
    await a.bringToFront();
    await a.locator('#online-toggle').click();
    await a.locator('#chat-input').fill('<img src=x onerror=alert(1)>');
    await a.locator('#chat-form button').click();
    await b.bringToFront();
    await b.locator('#online-toggle').click();
    await expect(b.locator('#chat-messages')).toContainText('<img src=x onerror=alert(1)>');
    await expect(b.locator('#chat-messages img')).toHaveCount(0);
    await a.bringToFront();
    await a.locator('#online-target').selectOption({ label: 'Net Beta' });
    await a.locator('#party-invite').click();
    await b.bringToFront();
    await b.getByRole('button', { name: 'Entrar no grupo de Net Alpha' }).click();
    await expect(b.locator('#party-info')).toContainText('Net Alpha');
    await a.bringToFront();
    await a.locator('#trade-invite').click();
    await expect(a.locator('#trade-panel')).toBeVisible();
    await b.bringToFront();
    await expect(b.locator('#trade-panel')).toBeVisible();
    await b.locator('#trade-accept').click();
    await a.bringToFront();
    await a.locator('#trade-bag input[type=checkbox][data-slot="0"]').check();
    await a.locator('#trade-offer').click();
    await expect(a.locator('#trade-offers')).toContainText('Espada × 1');
    await b.bringToFront();
    await b.locator('#trade-bag input[type=checkbox][data-slot="0"]').check();
    await b.locator('#trade-offer').click();
    await expect(b.locator('#trade-offers')).toContainText('Moeda dourada × 10');
    await a.bringToFront();
    await expect(a.locator('#trade-offers')).toContainText('Moeda dourada × 10');
    await a.screenshot({ path: 'test-results/screenshots/multiplayer-trade.png', fullPage: true });
    await a.locator('#trade-confirm').click();
    await expect(a.locator('#trade-panel')).toBeVisible();
    await b.bringToFront();
    await b.locator('#trade-confirm').click();
    await expect(b.locator('#trade-panel')).toBeHidden();
    const [aa, bb] = await Promise.all([
      a.request.get('http://127.0.0.1:3001/api/session'),
      b.request.get('http://127.0.0.1:3001/api/session'),
    ]);
    const aj = await aa.json(),
      bj = await bb.json();
    expect(aj.inventory.find((i) => i?.id === 'gold_coin').quantity).toBe(10);
    expect(bj.inventory.some((i) => i?.id === 'sword')).toBe(true);
    await a.bringToFront();
    await expect(a.locator('#trade-panel')).toBeHidden();
    await a.locator('#online-close').click();
    await a.screenshot({
      path: 'test-results/screenshots/multiplayer-two-players.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await c1.close();
    await c2.close();
  }
});
