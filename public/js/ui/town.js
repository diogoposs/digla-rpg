import { ITEMS } from '../items.js';
import { BANK_CAPACITY, TOWN_POINTS } from '../game/town-rules.js';

// Painel comum aos vendedores e ao banco. Regras e validação pertencem ao servidor.
export function createTown({ onAction, onQuests }) {
  const labels = Object.values(TOWN_POINTS)
    .filter((point) => point.kind === 'shop' || point.kind === 'dice')
    .map((point) => {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'town-map-label';
      label.dataset.townId = point.id;
      label.textContent = point.name.split(' — ')[0];
      label.title = point.name + ' — botão direito para conversar';
      label.hidden = true;
      document.querySelector('.world-frame').append(label);
      return { point, label };
    });
  const panel = document.createElement('section');
  panel.id = 'town-panel';
  panel.className = 'town-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'town-title');
  panel.innerHTML = `
    <div class="town-heading"><div><p class="town-eyebrow">BRUMAVALE</p><h2 id="town-title"></h2></div><button id="town-close" type="button" aria-label="Fechar loja ou banco">×</button></div>
    <p id="town-description" class="town-description"></p>
    <div id="town-trade"><div class="town-columns">
      <section><div class="town-section-heading"><h3 id="town-storage-title"></h3><span id="town-storage-count"></span></div><div id="town-stock" class="town-stock" role="list" aria-label="Itens à venda"></div><div id="town-bank" class="town-slot-grid town-bank-grid" role="list" aria-label="Itens guardados no banco"></div></section>
      <section><div class="town-section-heading"><h3>Sua mochila</h3><span id="town-bag-count"></span></div><div id="town-bag" class="town-slot-grid" role="list" aria-label="Itens da mochila para negociar ou guardar"></div><p class="town-balance">Ouro na mochila <strong id="town-gold">0</strong></p><p class="town-hint">Selecione um item para vender ou guardar.</p></section>
    </div>
    <div class="town-quantity"><label for="town-quantity">Quantidade</label><input id="town-quantity" type="number" min="1" step="1" value="1" inputmode="numeric" /><button id="town-all" type="button">Máximo</button></div>
    <div id="town-shop-actions" class="town-actions"><button id="town-buy" type="button">Comprar · 1 ouro/un.</button><button id="town-sell" type="button">Vender · 1 ouro/un.</button></div>
    <div id="town-bank-actions" class="town-actions"><button id="town-deposit" type="button">Guardar no banco →</button><button id="town-withdraw" type="button">← Retirar para mochila</button><button id="town-deposit-all" type="button">Guardar toda a mochila</button></div>
    </div><div id="town-dice" hidden>
      <p>Baixo: <strong>1 a 3</strong> · Alto: <strong>4 a 6</strong></p>
      <div id="town-die-face" class="town-die-face" role="img" aria-label="Dado aguardando aposta">?</div>
      <p>Acertou: recebe <strong>2× a aposta</strong>, incluindo o valor apostado. Errou: perde a aposta.</p>
      <p class="town-balance">Ouro na mochila <strong id="town-dice-gold">0</strong></p>
      <label for="town-bet-amount">Aposta em moedas douradas</label><input id="town-bet-amount" type="number" min="1" step="1" value="1" inputmode="numeric" />
      <div class="town-actions"><button id="town-bet-low" type="button">Apostar baixo · 1–3</button><button id="town-bet-high" type="button">Apostar alto · 4–6</button></div>
    </div><p id="town-message" class="town-message" role="status" aria-live="polite"></p>`;
  document.querySelector('.world-frame').append(panel);
  const $ = (id) => panel.querySelector('#town-' + id);
  const quests = document.createElement('button');
  quests.id = 'town-quests';
  quests.className = 'skills-button';
  quests.textContent = 'Conversar sobre missões';
  $('description').after(quests);
  quests.onclick = () => {
    const id = state?.id;
    close();
    onQuests?.(id);
  };
  let state = null,
    busy = false,
    version = 0;
  let stockItem = null,
    bagSlot = null,
    bankSlot = null,
    lastSelection = 'stock';

  panel.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  panel.addEventListener('click', (event) => event.stopPropagation());
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') close();
  });

  function gold() {
    return (state?.inventory || []).reduce(
      (total, item) => total + (item?.id === 'gold_coin' ? item.quantity : 0),
      0,
    );
  }
  function quantity() {
    return Number($('quantity').value);
  }
  function maximum() {
    if (lastSelection === 'bag') return state?.inventory?.[bagSlot]?.quantity || 1;
    if (lastSelection === 'bank') return state?.bank?.[bankSlot]?.quantity || 1;
    const item = ITEMS[stockItem];
    const price = state?.stock?.find((i) => i.id === stockItem)?.price || 1;
    const emptySlots = (state?.inventory || []).filter((entry) => !entry).length;
    return item?.stackable === false
      ? Math.max(1, Math.min(Math.floor(gold() / price), emptySlots))
      : Math.max(1, Math.floor(gold() / price));
  }
  function select(source, value) {
    lastSelection = source;
    if (source === 'stock') stockItem = value;
    else if (source === 'bag') bagSlot = value;
    else bankSlot = value;
    $('quantity').value = '1';
    render();
  }
  function renderSlots(id, items, selected, source) {
    const container = $(id);
    const signature = JSON.stringify(items);
    if (container.dataset.signature !== signature) {
      container.replaceChildren();
      items.forEach((item, index) => {
        const definition = ITEMS[item?.id];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'town-slot' + (definition ? ' has-item' : '');
        button.dataset.slot = index;
        button.dataset.item = item?.id || '';
        button.dataset.quantity = item?.quantity || 0;
        button.disabled = !definition;
        button.title = definition
          ? `${definition.name} × ${item.quantity}`
          : `Espaço ${index + 1} vazio`;
        button.setAttribute('aria-label', button.title);
        if (definition) button.innerHTML = definition.icon + `<span>${item.quantity}</span>`;
        button.onclick = () => {
          if (busy || !item) return;
          select(source, index);
          if (state?.kind === 'bank') {
            $('quantity').value = String(item.quantity);
            void act(source === 'bank' ? 'withdraw' : 'deposit');
          }
        };
        button.oncontextmenu = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (state?.kind !== 'bank' || !item || busy) return;
          select(source, index);
          $('quantity').value = String(item.quantity);
          void act(source === 'bank' ? 'withdraw' : 'deposit');
        };
        container.append(button);
      });
      container.dataset.signature = signature;
    }
    for (const button of container.children) {
      const active = Number(button.dataset.slot) === selected && !!button.dataset.item;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function renderStock() {
    const stock = state.stock || [];
    const signature = JSON.stringify(stock);
    if ($('stock').dataset.signature !== signature) {
      $('stock').replaceChildren();
      for (const item of stock) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.item = item.id;
        button.className = 'town-stock-item';
        const icon = document.createElement('span');
        icon.className = 'town-stock-icon';
        icon.innerHTML = ITEMS[item.id]?.icon || '';
        const name = document.createElement('strong');
        name.textContent = item.name;
        const price = document.createElement('span');
        price.className = 'town-price';
        price.textContent = `${item.price} ouro`;
        button.append(icon, name, price);
        button.onclick = () => select('stock', item.id);
        $('stock').append(button);
      }
      $('stock').dataset.signature = signature;
    }
    for (const button of $('stock').children) {
      button.classList.toggle('selected', button.dataset.item === stockItem);
      button.setAttribute('aria-pressed', String(button.dataset.item === stockItem));
    }
  }
  function render() {
    if (!state || panel.hidden) return;
    const isBank = state.kind === 'bank';
    panel.querySelector('.town-quantity').hidden = isBank;
    $('deposit').hidden = isBank;
    $('withdraw').hidden = isBank;
    panel.querySelector('.town-hint').textContent = isBank
      ? 'Clique no item para transferir a pilha inteira.'
      : 'Selecione um item para vender ou guardar.';
    const isDice = state.kind === 'dice';
    $('trade').hidden = isDice;
    $('dice').hidden = !isDice;
    if (!state.inventory?.[bagSlot]) bagSlot = null;
    if (!state.bank?.[bankSlot]) bankSlot = null;
    $('title').textContent = state.name;
    $('description').textContent = isDice
      ? 'Escolha o lado do dado e faça sua aposta com ouro do jogo.'
      : isBank
        ? 'Clique esquerdo: guarda ou retira a pilha inteira. Botão direito: ações e Olhar.'
        : state.testMode
          ? 'Modo de teste: compra e venda por 1 ouro.'
          : 'Preços de progressão. Venda por 30% do valor de compra.';
    quests.hidden = isBank || isDice;
    $('storage-title').textContent = isBank ? 'Seu depósito' : 'À venda';
    $('storage-count').textContent = isBank
      ? `${(state.bank || []).filter(Boolean).length} / ${BANK_CAPACITY}`
      : `${state.stock?.length || 0} itens`;
    $('stock').hidden = isBank;
    $('bank').hidden = !isBank;
    $('shop-actions').hidden = isBank;
    $('bank-actions').hidden = !isBank;
    renderStock();
    renderSlots('bag', state.inventory || [], bagSlot, 'bag');
    if (isBank) renderSlots('bank', state.bank || [], bankSlot, 'bank');
    $('bag-count').textContent =
      `${(state.inventory || []).filter(Boolean).length} / ${(state.inventory || []).length}`;
    $('gold').textContent = gold();
    $('dice-gold').textContent = gold();
    const wager = Number($('bet-amount').value);
    for (const choice of ['low', 'high'])
      $('bet-' + choice).disabled =
        busy || !Number.isSafeInteger(wager) || wager < 1 || wager > gold();
    const die = state.diceResult;
    $('die-face').textContent = die ? ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die.roll] : '?';
    $('die-face').setAttribute(
      'aria-label',
      die ? `Resultado do dado: ${die.roll}` : 'Dado aguardando aposta',
    );
    $('die-face').classList.toggle('won', !!die?.won);
    const qty = quantity(),
      valid = Number.isSafeInteger(qty) && qty > 0;
    const bagItem = state.inventory?.[bagSlot],
      storedItem = state.bank?.[bankSlot];
    const buying = state.stock?.find((i) => i.id === stockItem),
      selling = state.stock?.find((i) => i.id === bagItem?.id);
    $('buy').textContent = `Comprar · ${buying?.price || 1} ouro/un.`;
    $('sell').textContent = `Vender · ${selling?.sellPrice || 1} ouro/un.`;
    $('buy').disabled = busy || !valid || !stockItem || gold() < qty * (buying?.price || 1);
    $('sell').disabled =
      busy ||
      !valid ||
      !bagItem ||
      qty > bagItem.quantity ||
      !state.stock?.some((item) => item.id === bagItem.id);
    $('deposit').disabled = busy || !valid || !bagItem || qty > bagItem.quantity;
    $('withdraw').disabled = busy || !valid || !storedItem || qty > storedItem.quantity;
    $('deposit-all').disabled = busy || !(state.inventory || []).some(Boolean);
    $('all').disabled = busy;
  }
  async function act(route) {
    if (busy || !state) return;
    const currentVersion = version;
    const payload = { id: state.id, quantity: quantity() };
    if (route === 'buy') payload.itemId = stockItem;
    else if (route !== 'depositAll') {
      payload.slot = route === 'withdraw' ? bankSlot : bagSlot;
      payload.itemId = (route === 'withdraw' ? state.bank : state.inventory)?.[payload.slot]?.id;
    }
    busy = true;
    render();
    try {
      const result = await onAction('town/' + route, payload);
      if (currentVersion !== version || !result) return;
      sync(result);
      $('message').textContent = result.message || '';
    } catch (error) {
      if (currentVersion === version) $('message').textContent = error.message;
    } finally {
      if (currentVersion === version) {
        busy = false;
        render();
      }
    }
  }
  async function bet(choice) {
    if (busy || state?.kind !== 'dice') return;
    const currentVersion = version;
    busy = true;
    render();
    try {
      const result = await onAction('town/bet', {
        id: state.id,
        choice,
        amount: Number($('bet-amount').value),
        requestId: crypto.randomUUID(),
      });
      if (currentVersion !== version || !result) return;
      sync(result);
      $('message').textContent = result.message || '';
    } finally {
      if (currentVersion === version) {
        busy = false;
        render();
      }
    }
  }
  function close() {
    version++;
    busy = false;
    panel.hidden = true;
    state = null;
  }
  function sync(data) {
    if (!state || panel.hidden) return;
    if (data.town?.id === state.id) state = { ...state, ...data.town };
    if (data.inventory) state.inventory = data.inventory;
    if (data.bank) state.bank = data.bank;
    render();
  }
  $('close').onclick = close;
  $('quantity').oninput = render;
  $('bet-amount').oninput = render;
  $('bet-low').onclick = () => void bet('low');
  $('bet-high').onclick = () => void bet('high');
  $('all').onclick = () => {
    $('quantity').value = maximum();
    render();
  };
  for (const route of ['buy', 'sell', 'deposit', 'withdraw'])
    $(route).onclick = () => void act(route);
  $('deposit-all').onclick = () => void act('depositAll');
  return {
    position(renderer, running) {
      for (const { point, label } of labels) {
        const screen = renderer.worldToScreen(point.x, point.y);
        label.hidden =
          renderer.floor !== 0 ||
          !running ||
          screen.x < 0 ||
          screen.x > renderer.cssWidth ||
          screen.y < 55 ||
          screen.y > renderer.cssHeight;
        label.style.left = screen.x + 'px';
        label.style.top = screen.y - 44 * renderer.scale + 'px';
      }
    },
    depositItem(payload) {
      if (panel.hidden || state?.kind !== 'bank') return false;
      const item = state.inventory?.[payload.slot];
      if (busy || !item || item.id !== payload.itemId) return true;
      select('bag', payload.slot);
      $('quantity').value = String(item.quantity);
      void act('deposit');
      return true;
    },
    open(town) {
      if (!town?.available) return;
      version++;
      busy = false;
      state = { ...town };
      stockItem = town.stock?.[0]?.id || null;
      bagSlot = bankSlot = null;
      lastSelection = town.kind === 'bank' ? 'bag' : 'stock';
      $('quantity').value = '1';
      $('message').textContent = '';
      panel.hidden = false;
      render();
      $('close').focus({ preventScroll: true });
    },
    sync,
    close,
  };
}
