import { ITEMS } from '../items.js';
export function createMultiplayerUI({ onAction }) {
  const toggle = document.createElement('button');
  toggle.id = 'online-toggle';
  toggle.className = 'skills-button';
  toggle.hidden = true;
  document.getElementById('adventure-toggle').after(toggle);
  const panel = document.createElement('section');
  panel.id = 'online-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Jogadores, conversa e trocas');
  panel.innerHTML =
    '<header><strong>Jogadores online</strong><button id="online-close" aria-label="Fechar jogadores">×</button></header><p id="party-info"></p><div id="party-invites"></div><div class="online-actions"><select id="online-target" aria-label="Selecionar jogador"></select><button id="party-invite">Convidar para grupo</button><button id="party-leave">Sair do grupo</button><button id="trade-invite">Trocar itens</button></div><ol id="chat-messages" aria-live="polite"></ol><form id="chat-form"><input id="chat-input" maxlength="200" autocomplete="off" placeholder="Converse com os jogadores…" aria-label="Mensagem"><button>Enviar</button></form><p id="online-message" role="status"></p>';
  document.querySelector('.world-frame').append(panel);
  const trade = document.createElement('section');
  trade.id = 'trade-panel';
  trade.hidden = true;
  trade.setAttribute('role', 'dialog');
  trade.setAttribute('aria-label', 'Troca entre jogadores');
  trade.innerHTML =
    '<header><strong>Troca de itens</strong><button id="trade-cancel">Cancelar</button></header><p id="trade-info"></p><button id="trade-accept">Aceitar negociação</button><div id="trade-contents"><p>Selecione os itens e quantidades. Alterar a oferta cancela as confirmações anteriores.</p><div id="trade-bag"></div><button id="trade-offer">Atualizar minha oferta</button><div id="trade-offers"></div><button id="trade-confirm">Confirmar as ofertas acima</button></div><p id="trade-message" role="status"></p>';
  document.querySelector('.world-frame').append(trade);
  const labels = new Map();
  let self = null,
    social = {},
    inventory = [],
    active = false,
    busy = false,
    lastChat = '',
    lastPeers = '',
    lastOffers = '',
    lastBag = '',
    lastInvites = '';
  const $ = (id) => document.getElementById(id);
  async function act(data) {
    if (busy) return;
    busy = true;
    try {
      const r = await onAction(data);
      if (r) sync(r);
    } finally {
      busy = false;
    }
  }
  function message(text) {
    $('online-message').textContent = text || '';
    $('trade-message').textContent = text || '';
  }
  function render() {
    if (!active) return;
    const peers = (social.online || []).filter((p) => p.id !== self),
      signature = JSON.stringify(peers);
    toggle.textContent = `Online: ${social.online?.length || 1} · Conversar ↗`;
    if (signature !== lastPeers) {
      lastPeers = signature;
      const selected = $('online-target').value;
      $('online-target').replaceChildren();
      for (const p of peers) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.username;
        $('online-target').append(o);
      }
      $('online-target').value = peers.some((p) => p.id === selected)
        ? selected
        : peers[0]?.id || '';
    }
    $('party-invite').disabled = $('trade-invite').disabled = peers.length === 0;
    $('party-info').textContent = social.party
      ? `Grupo: ${social.party.members.map((id) => social.online.find((p) => p.id === id)?.username || 'Jogador').join(', ')} · XP compartilhada a até 8 quadrados.`
      : 'Sem grupo. Convide até quatro companheiros.';
    $('party-leave').hidden = !social.party;
    const invitation = JSON.stringify(social.invites || []);
    if (invitation !== lastInvites) {
      lastInvites = invitation;
      $('party-invites').replaceChildren();
      for (const p of social.invites || []) {
        const b = document.createElement('button');
        b.textContent = `Entrar no grupo de ${p.name}`;
        b.onclick = () => void act({ action: 'partyAccept', fromId: p.id });
        $('party-invites').append(b);
      }
    }
    const chats = JSON.stringify(social.chat || []);
    if (chats !== lastChat) {
      lastChat = chats;
      const list = $('chat-messages');
      list.replaceChildren();
      for (const m of social.chat || []) {
        const li = document.createElement('li'),
          name = document.createElement('strong');
        name.textContent = m.username + ': ';
        li.append(name, document.createTextNode(m.text));
        list.append(li);
      }
      list.scrollTop = list.scrollHeight;
    }
    const t = social.trade;
    trade.hidden = !t;
    if (!t) return;
    const other = t.members.find((id) => id !== self),
      name = social.online.find((p) => p.id === other)?.username || 'Jogador';
    $('trade-info').textContent =
      `Negociação com ${name}. Os itens só saem da mochila quando os dois confirmam.`;
    $('trade-accept').hidden = t.accepted.includes(self);
    $('trade-contents').hidden = t.accepted.length !== 2;
    const bag = JSON.stringify([inventory, t.id]);
    if (bag !== lastBag) {
      lastBag = bag;
      const root = $('trade-bag');
      root.replaceChildren();
      inventory.forEach((item, index) => {
        if (!ITEMS[item?.id]) return;
        const row = document.createElement('label');
        row.className = 'trade-item';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.dataset.slot = index;
        const icon = document.createElement('span');
        icon.innerHTML = ITEMS[item.id].icon;
        const text = document.createElement('span');
        text.textContent = `${ITEMS[item.id].name} × ${item.quantity}`;
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 1;
        qty.max = item.quantity;
        qty.value = item.quantity;
        qty.dataset.quantity = index;
        qty.setAttribute('aria-label', 'Quantidade de ' + ITEMS[item.id].name);
        row.append(check, icon, text, qty);
        root.append(row);
      });
    }
    const offers = JSON.stringify([t.offers, t.confirmed, t.revision]);
    if (offers !== lastOffers) {
      lastOffers = offers;
      $('trade-offers').replaceChildren();
      for (const id of t.members) {
        const p = document.createElement('p');
        const who = id === self ? 'Você' : name;
        const list =
          t.offers[id]
            .map((i) => `${ITEMS[i.itemId]?.name || 'Item'} × ${i.quantity}`)
            .join(', ') || 'Nada';
        p.textContent = `${who}: ${list}${t.confirmed.includes(id) ? ' ✓ confirmado' : ''}`;
        $('trade-offers').append(p);
      }
    }
    $('trade-confirm').disabled = t.confirmed.includes(self);
    $('trade-confirm').textContent = t.confirmed.includes(self)
      ? 'Confirmado · aguardando jogador'
      : 'Confirmar as ofertas acima';
  }
  function sync(data) {
    if (data.playerId) self = data.playerId;
    if (data.social) social = data.social;
    if (data.inventory) inventory = data.inventory;
    if (data.multiplayer) {
      active = true;
      toggle.hidden = false;
    }
    if (data.message) message(data.message);
    render();
  }
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
  };
  $('online-close').onclick = () => (panel.hidden = true);
  $('party-invite').onclick = () =>
    void act({ action: 'partyInvite', targetId: $('online-target').value });
  $('party-leave').onclick = () => void act({ action: 'partyLeave' });
  $('trade-invite').onclick = () =>
    void act({ action: 'tradeInvite', targetId: $('online-target').value });
  $('trade-accept').onclick = () => void act({ action: 'tradeAccept', tradeId: social.trade.id });
  $('trade-cancel').onclick = () => void act({ action: 'tradeCancel', tradeId: social.trade.id });
  $('trade-offer').onclick = () => {
    const items = [...$('trade-bag').querySelectorAll('input[type=checkbox]:checked')].map((b) => ({
      slot: Number(b.dataset.slot),
      itemId: inventory[Number(b.dataset.slot)].id,
      quantity: Number($('trade-bag').querySelector(`[data-quantity="${b.dataset.slot}"]`).value),
    }));
    void act({ action: 'tradeOffer', tradeId: social.trade.id, items });
  };
  $('trade-confirm').onclick = () =>
    void act({ action: 'tradeConfirm', tradeId: social.trade.id, revision: social.trade.revision });
  $('chat-form').onsubmit = (e) => {
    e.preventDefault();
    const text = $('chat-input').value;
    if (text.trim()) {
      void act({ action: 'chat', text });
      $('chat-input').value = '';
    }
  };
  for (const el of [panel, trade]) {
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') panel.hidden = true;
    });
  }
  return {
    sync,
    message,
    hide() {
      active = false;
      toggle.hidden = panel.hidden = trade.hidden = true;
      for (const el of labels.values()) el.remove();
      labels.clear();
    },
    position(players, renderer) {
      const ids = new Set();
      for (const p of players) {
        ids.add(p.id);
        let el = labels.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'peer-label';
          el.dataset.playerId = p.id;
          const name = document.createElement('span'),
            hp = document.createElement('i');
          hp.append(document.createElement('b'));
          el.append(name, hp);
          document.querySelector('.world-frame').append(el);
          labels.set(p.id, el);
        }
        const point = renderer.worldToScreen(p.x, p.y);
        el.style.left = point.x + 'px';
        el.style.top = point.y - 35 * renderer.scale + 'px';
        el.firstChild.textContent = p.username;
        el.lastChild.firstChild.style.width = Math.max(0, (p.health / p.maxHealth) * 100) + '%';
        el.title = `${p.username} · ${p.health}/${p.maxHealth}`;
      }
      for (const [id, el] of labels)
        if (!ids.has(id)) {
          el.remove();
          labels.delete(id);
        }
    },
  };
}
