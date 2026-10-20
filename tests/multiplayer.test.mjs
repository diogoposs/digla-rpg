import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMultiplayer } from '../server/multiplayer.mjs';
import { openMultiplayerStore } from '../server/storage.mjs';
import { ensureProgress } from '../public/js/game/progression.js';
import { getMobs, getCorpses } from '../public/js/game/world-rules.js';
import { DEFAULT_OUTFIT } from '../public/js/config.js';

function arena() {
  let time = 10000,
    saves = 0;
  const accounts = Object.fromEntries(
    ['A', 'B', 'C'].map((id, i) => [
      id,
      ensureProgress({
        id,
        username: 'Hero ' + id,
        outfit: DEFAULT_OUTFIT,
        position: { x: 86 + (i === 1 ? 1 : i === 2 ? -1 : 0), y: 27 },
        inventory: [],
      }),
    ]),
  );
  const sharedWorld = {},
    mp = createMultiplayer({
      accounts,
      sharedWorld,
      now: () => time,
      save: async () => {
        saves++;
      },
      autoStart: false,
    });
  for (const mob of getMobs(accounts.A))
    if (mob.id !== 'orc') {
      mob.health = 0;
      mob.respawnAt = Number.MAX_SAFE_INTEGER;
    }
  for (const a of Object.values(accounts)) mp.join(a);
  return {
    accounts,
    sharedWorld,
    mp,
    setTime: (t) => (time = t),
    get saves() {
      return saves;
    },
  };
}
test('jogadores compartilham monstros/chão/cargas, mantendo inventário e banco privados', async () => {
  const {
    accounts: { A, B },
    mp,
  } = arena();
  A.inventory[0] = { id: 'raw_salmon', quantity: 2 };
  await mp.run(() =>
    mp.world.drop(A, { slot: 0, itemId: 'raw_salmon', quantity: 2, x: 86, y: 28 }),
  );
  const a = mp.initial(A),
    b = mp.initial(B);
  assert.equal(a.groundItems[0].id, b.groundItems[0].id);
  assert.equal(a.orc.health, b.orc.health);
  assert.equal(b.players.find((p) => p.id === A.id).username, A.username);
  assert.deepEqual(
    Object.keys(b.players[0]).sort(),
    ['direction', 'health', 'id', 'maxHealth', 'outfit', 'username', 'x', 'y'].sort(),
  );
  assert.equal('inventory' in b.players[0], false);
  assert.equal('salt' in b.players[0], false);
  assert.equal(Object.keys(A).includes('groundItems'), false);
  assert.equal(A.miningNodes, B.miningNodes);
});
test('concorrência não duplica uma pilha; reserva impede roubo de loot e libera depois de 60s', async () => {
  const {
    accounts: { A, B, C },
    mp,
    setTime,
  } = arena();
  A.orc.health = 1;
  await mp.run(() => mp.world.attack(A, { mobId: 'orc', toggle: false }));
  const corpse = A.corpse;
  assert.equal(getCorpses(A).length, 1);
  assert.equal(mp.initial(B).corpse.canLoot, false);
  assert.equal((await mp.world.loot(B, { id: corpse.id })).loot, undefined);
  const coins = corpse.slots[1].quantity;
  const results = await Promise.all([
    mp.run(() =>
      mp.world.transfer(A, {
        source: 'loot',
        corpseId: corpse.id,
        slot: 1,
        itemId: 'gold_coin',
        target: 'inventory',
      }),
    ),
    mp.run(() =>
      mp.world.transfer(A, {
        source: 'loot',
        corpseId: corpse.id,
        slot: 1,
        itemId: 'gold_coin',
        target: 'inventory',
      }),
    ),
  ]);
  assert.equal(
    A.inventory.filter(Boolean).reduce((n, i) => n + (i.id === 'gold_coin' ? i.quantity : 0), 0),
    coins,
  );
  assert.equal(corpse.slots[1], null);
  setTime(71000);
  assert.ok((await mp.world.loot(C, { id: corpse.id })).loot);
  A.inventory[1] = { id: 'raw_salmon', quantity: 1 };
  await mp.world.drop(A, { slot: 1, itemId: 'raw_salmon', x: 86, y: 28 });
  const ground = A.groundItems[0];
  B.position = { x: 87, y: 28 };
  C.position = { x: 85, y: 28 };
  await Promise.all([
    mp.run(() => mp.world.pickup(B, { id: ground.id })),
    mp.run(() => mp.world.pickup(C, { id: ground.id })),
  ]);
  assert.equal([...B.inventory, ...C.inventory].filter((i) => i?.id === 'raw_salmon').length, 1);
});
test('alvo do monstro e cooldown são únicos; abates e XP de grupo são distribuídos sem multiplicar dano', async () => {
  const {
    accounts: { A, B, C },
    mp,
    setTime,
  } = arena();
  await mp.social(A, { action: 'partyInvite', targetId: B.id });
  await mp.social(B, { action: 'partyAccept', fromId: A.id });
  A.equipment.weapon = { id: 'sword', quantity: 1 };
  A.orc.health = 30;
  await mp.world.attack(A, { mobId: 'orc', toggle: false });
  assert.ok(
    Math.abs(A.skills.vitality.xp + B.skills.vitality.xp - (30 - A.orc.health) / 3) < 1e-10,
  );
  assert.equal(C.skills.vitality.xp, 0);
  assert.equal(A.skills.combat.xp + B.skills.combat.xp, (30 - A.orc.health) / 2);
  mp.world.stop(A);
  setTime(11000);
  await mp.pulse();
  const lost = 300 - (A.vitals.health + B.vitals.health + C.vitals.health);
  assert.ok(lost >= 3 && lost <= 6);
  // A bystander's pulse cannot reset a boss fought by somebody else on another floor.
  const boss = A.elementals.orc_commander;
  boss.health = 400;
  boss.respawnAt = 0;
  A.position = { x: 86, y: 17, z: -1 };
  B.position = { x: 29, y: 27 };
  C.position = { x: 30, y: 27 };
  await mp.world.attack(A, { mobId: boss.id, toggle: false });
  const hp = boss.health;
  assert.ok(hp < 400);
  setTime(11200);
  await mp.pulse();
  assert.ok(boss.health <= hp);
});
test('movimento rejeita teleporte, diagonal, excesso de velocidade e colisão fora da área segura', () => {
  const {
    accounts: { A, B },
    mp,
    setTime,
  } = arena();
  assert.equal(mp.validateMove(A, { x: 100, y: 27 }), false);
  assert.equal(mp.validateMove(A, { x: 87, y: 28 }), false);
  assert.equal(mp.validateMove(A, B.position), false);
  A.position = { x: 29, y: 27 };
  B.position = { x: 30, y: 27 };
  assert.equal(mp.validateMove(A, B.position), true);
  A.position = { x: 30, y: 27 };
  assert.equal(mp.validateMove(A, { x: 31, y: 27 }), true);
  A.position = { x: 31, y: 27 };
  assert.equal(mp.validateMove(A, { x: 32, y: 27 }), false);
  setTime(10200);
  assert.equal(mp.validateMove(A, { x: 32, y: 27 }), true);
});

test('renascimento pendente chega só à vítima e não é apagado por outra ação antes do polling', async () => {
  const {
    accounts: { A, B },
    mp,
    setTime,
  } = arena();
  A.vitals.health = 1;
  await mp.world.attack(A, { mobId: 'orc', toggle: false });
  setTime(11000);
  await mp.pulse();
  assert.equal(A.position.x, 29);
  assert.equal(A.position.y, 27);
  const result = await mp.world.attack(A, { mobId: 'orc', toggle: false });
  assert.equal(result.playerRespawned, true);
  assert.deepEqual(result.position, A.position);
  assert.equal(mp.snapshot(B).playerRespawned, undefined);
  assert.equal(mp.snapshot(A).playerRespawned, undefined);
});
test('trocas exigem aceite, revisão atual e duas confirmações; commit é atômico', async () => {
  const {
    accounts: { A, B },
    mp,
  } = arena();
  A.inventory[0] = { id: 'sword', quantity: 1 };
  B.inventory[0] = { id: 'gold_coin', quantity: 10 };
  await mp.social(A, { action: 'tradeInvite', targetId: B.id });
  let t = mp.initial(A).social.trade;
  await mp.social(B, { action: 'tradeAccept', tradeId: t.id });
  await mp.social(A, {
    action: 'tradeOffer',
    tradeId: t.id,
    items: [{ slot: 0, itemId: 'sword', quantity: 1 }],
  });
  t = mp.initial(A).social.trade;
  await mp.social(A, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision });
  const oldRevision = t.revision;
  await mp.social(B, {
    action: 'tradeOffer',
    tradeId: t.id,
    items: [{ slot: 0, itemId: 'gold_coin', quantity: 10 }],
  });
  assert.equal(mp.initial(A).social.trade.confirmed.length, 0);
  await assert.rejects(() =>
    mp.social(A, { action: 'tradeConfirm', tradeId: t.id, revision: oldRevision }),
  );
  t = mp.initial(A).social.trade;
  await mp.social(A, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision });
  assert.equal(A.inventory[0].id, 'sword');
  await mp.social(B, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision });
  assert.equal(A.inventory.find((i) => i?.id === 'gold_coin').quantity, 10);
  assert.equal(B.inventory.find((i) => i?.id === 'sword').quantity, 1);
  assert.equal(mp.initial(A).social.trade, null);
  await assert.rejects(() =>
    mp.social(A, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision }),
  );
});
test('mochila cheia ou item alterado cancela confirmação sem perder itens; desconexão cancela troca', async () => {
  const {
    accounts: { A, B },
    mp,
  } = arena();
  A.inventory[0] = { id: 'gold_coin', quantity: 10 };
  B.inventory = Array.from({ length: 12 }, () => ({ id: 'sword', quantity: 1 }));
  await mp.social(A, { action: 'tradeInvite', targetId: B.id });
  let t = mp.initial(A).social.trade;
  await mp.social(B, { action: 'tradeAccept', tradeId: t.id });
  await mp.social(A, {
    action: 'tradeOffer',
    tradeId: t.id,
    items: [{ slot: 0, itemId: 'gold_coin', quantity: 5 }],
  });
  t = mp.initial(A).social.trade;
  const before = JSON.stringify([A.inventory, B.inventory]);
  await mp.social(A, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision });
  await assert.rejects(() =>
    mp.social(B, { action: 'tradeConfirm', tradeId: t.id, revision: t.revision }),
  );
  assert.equal(JSON.stringify([A.inventory, B.inventory]), before);
  mp.leave(B);
  assert.equal(mp.initial(A).social.trade, null);
});
test('chat tem limite e dados públicos não carregam credenciais; jogadores ausentes saem', async () => {
  const {
    accounts: { A, B },
    mp,
    setTime,
  } = arena();
  A.salt = 'private-salt';
  A.digest = 'private-digest';
  await mp.social(A, { action: 'chat', text: '<img src=x onerror=alert(1)>' });
  assert.equal(mp.initial(B).social.chat.at(-1).text, '<img src=x onerror=alert(1)>');
  await assert.rejects(() => mp.social(A, { action: 'chat', text: 'spam' }));
  const publicJson = JSON.stringify(mp.initial(B));
  assert.equal(publicJson.includes('private-salt'), false);
  assert.equal(publicJson.includes('private-digest'), false);
  setTime(21000);
  await mp.pulse();
  assert.equal(mp.initial(B).social.online.length, 0);
});
test('migração guarda backup privado e salva contas/mundo em um único documento atômico', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'digla-multiplayer-'));
  try {
    const legacy = { hero: { username: 'Hero', inventory: [{ id: 'gold_coin', quantity: 7 }] } };
    await writeFile(path.join(dir, 'accounts.json'), JSON.stringify(legacy));
    const store = await openMultiplayerStore(dir);
    const mp = createMultiplayer({ ...store, autoStart: false });
    mp.join(store.accounts.hero);
    await store.save();
    const doc = JSON.parse(await readFile(path.join(dir, 'game.json'), 'utf8'));
    assert.equal(doc.accounts.hero.inventory[0].quantity, 7);
    assert.ok(doc.world.orc);
    assert.equal(doc.accounts.hero.orc, undefined);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'accounts.json'), 'utf8')), legacy);
    const loaded = await openMultiplayerStore(dir);
    assert.equal(loaded.sharedWorld.orc.health, 30);
    mp.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
