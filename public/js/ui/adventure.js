import { QUESTS, RECIPES, ORE_NODES, FORGE } from '../game/adventure-rules.js';
import { ITEMS } from '../items.js';
import { TOWN_POINTS } from '../game/town-rules.js';
import { distance } from '../game/world-rules.js';
import { floorOf } from '../world/elevation.js';

const rock =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#27323b" stroke="#99abb1" d="m3 28 2-15 8-9 12 4 5 16-4 6Z"/><path fill="#b18c65" d="m9 13 6-5 3 10-7 3Zm10 8 7-7 1 10-8 4Z"/><path fill="#e0c395" d="m11 12 3-2 1 4-3 2Zm10 8 3-2 1 3-4 2Z"/></svg>';
const anvil =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#34414d" stroke="#a7b6bd" d="M2 8h26v7l-9 4 3 8H8l4-10-7-3Z"/><path fill="#d6b46f" d="M5 6h22v4H5Z"/><path fill="#bd6239" d="M6 27h19v4H6Z"/></svg>';
export function createAdventure({ onAction, onApproach, onOpen, getPosition }) {
  const frame = document.querySelector('.world-frame');
  const button = document.createElement('button');
  button.id = 'adventure-toggle';
  button.className = 'skills-button';
  button.textContent = 'Diário e profissões ↗';
  document.getElementById('toggle-skills').after(button);
  const stats = document.createElement('p');
  stats.id = 'combat-summary';
  button.after(stats);
  const panel = document.createElement('section');
  panel.id = 'adventure-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Diário e profissões');
  panel.innerHTML =
    '<header><div><small>BRUMAVALE · SUA JORNADA</small><h2>Diário e profissões</h2></div><button data-close aria-label="Fechar diário">×</button></header><nav><button data-tab="quests">Missões</button><button data-tab="professions">Mineração e ferraria</button><button data-tab="settings">Modo de jogo</button></nav><div id="adventure-content"></div><p id="adventure-message" role="status"></p>';
  frame.append(panel);
  const mineStatus = document.createElement('p');
  mineStatus.id = 'mining-status';
  mineStatus.hidden = true;
  frame.append(mineStatus);
  let data = { quests: {}, inventory: [], skills: {}, miningNodes: {} },
    tab = 'quests',
    npc = null,
    signature = '',
    busy = false;
  const content = panel.querySelector('#adventure-content');
  function itemList(items) {
    return Object.entries(items)
      .map(([id, n]) => `${n} × ${ITEMS[id].name}`)
      .join(', ');
  }
  function amount(id) {
    return (data.inventory || []).reduce((n, i) => n + (i?.id === id ? i.quantity : 0), 0);
  }
  function render(force = false) {
    const pos = getPosition();
    if (!pos) return;
    if (data.combatStats) {
      const s = data.combatStats;
      stats.textContent = `Físico ${s.min}–${s.max} · ARM ${s.arm} · Defesa ${Math.round(s.reduction * 100)}%`;
    }
    mineStatus.hidden = !data.gathering;
    mineStatus.textContent = '⛏ Minerando ferro · Esc ou caminhar para parar';
    if (panel.hidden) return;
    const next = JSON.stringify([
      tab,
      npc,
      data.quests,
      data.inventory,
      data.skills,
      data.gameSettings,
      distance(pos, FORGE) <= 1,
      Object.values(TOWN_POINTS)
        .filter((n) => distance(pos, n) <= 1)
        .map((n) => n.id),
    ]);
    if (!force && signature === next) return;
    signature = next;
    panel
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (tab === 'settings') {
      content.innerHTML = `<article><h3>Progressão normal ou testes</h3><p>Normal: orcs com 30–80 de vida, comandante 400, preços próprios e venda a 30% do valor.</p><p>Teste: orcs com vida 10× e compras/vendas por 1 moeda.</p>${data.multiplayer ? '<p>Mundo compartilhado: o modo é definido pelo dono do servidor para todos os jogadores.</p>' : ''}<label><input id="test-mode" type="checkbox" ${data.gameSettings?.testMode ? 'checked' : ''} ${data.multiplayer ? 'disabled' : ''}> Modo de teste</label></article>`;
    } else if (tab === 'professions') {
      content.innerHTML =
        `<article><h3>Mineração · nível ${data.skills?.mining?.level || 1}</h3><p>Extraia ferro nos veios das montanhas e cavernas. Cada minério rende 10 XP. Veios têm 5 cargas e recuperam em 60s; caminhar, dano ou sair interrompe.</p><p>Veio acessível: montanha dos orcs (85,14), piso +1. Outros aparecem no minimapa e nas cavernas.</p><h3>Ferraria · nível ${data.skills?.smithing?.level || 1}</h3><p>Use a forja de Matlo em (35,22), piso 0. Materiais são consumidos apenas se houver espaço para o resultado.</p></article>` +
        Object.entries(RECIPES)
          .map(
            ([id, r]) =>
              `<article class="recipe-card">${ITEMS[r.output].icon}<div><h3>${r.name}</h3><p>${itemList(r.materials)} · Ferraria ${r.level} · ${r.xp} XP</p><small>Na mochila: ${Object.keys(
                r.materials,
              )
                .map((id) => `${ITEMS[id].name}: ${amount(id)}`)
                .join(
                  ' · ',
                )}</small></div><button data-craft="${id}" ${distance(pos, FORGE) > 1 || (data.skills?.smithing?.level || 1) < r.level ? 'disabled' : ''}>Fabricar</button></article>`,
          )
          .join('');
    } else {
      content.innerHTML =
        '<p>Converse com Rafhi, Pang e Matlo para aceitar missões e receber recompensas. Abates contam depois de aceitar; entregas usam itens da mochila.</p>' +
        (npc ? `<button data-all-quests>Mostrar todas</button>` : '') +
        Object.entries(QUESTS)
          .filter(([, q]) => !npc || q.npc === npc)
          .map(([id, q]) => {
            const s = data.quests?.[id],
              locked = q.requires && data.quests?.[q.requires]?.status !== 'completed',
              near = distance(pos, TOWN_POINTS[q.npc]) <= 1;
            const objective = q.kills
              ? `${s?.kills || 0}/${q.kills} abates`
              : Object.entries(q.deliver)
                  .map(([id, n]) => `${ITEMS[id].name}: ${Math.min(amount(id), n)}/${n}`)
                  .join(' · ');
            return `<article data-quest="${id}"><small>${TOWN_POINTS[q.npc].name.split(' — ')[0]} · ${s?.status === 'completed' ? 'CONCLUÍDA' : locked ? 'BLOQUEADA' : s ? 'EM ANDAMENTO' : 'DISPONÍVEL'}</small><h3>${q.name}</h3><p>${q.description}</p><p>${objective}</p><p class="quest-reward">Recompensa: ${itemList(q.rewards)}</p>${locked ? `<small>Requer: ${QUESTS[q.requires].name}</small>` : s?.status === 'completed' ? '' : `<button data-quest-action="${s ? 'claim' : 'accept'}" data-id="${id}" ${!near ? 'disabled' : ''}>${s ? 'Concluir / receber' : 'Aceitar missão'}</button>${!near ? '<small> Aproxime-se do NPC responsável.</small>' : ''}`}</article>`;
          })
          .join('');
    }
  }
  async function act(payload) {
    if (busy) return;
    busy = true;
    try {
      const r = await onAction(payload);
      if (r) {
        sync(r);
        panel.querySelector('#adventure-message').textContent = r.message || '';
      }
    } finally {
      busy = false;
    }
  }
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) panel.hidden = true;
    else if (b.dataset.tab) {
      tab = b.dataset.tab;
      npc = null;
      render(true);
    } else if (b.hasAttribute('data-all-quests')) {
      npc = null;
      render(true);
    } else if (b.dataset.craft) void act({ action: 'craft', id: b.dataset.craft });
    else if (b.dataset.questAction) void act({ action: b.dataset.questAction, id: b.dataset.id });
  });
  panel.addEventListener('change', (e) => {
    if (e.target.id === 'test-mode') void act({ action: 'settings', enabled: e.target.checked });
  });
  panel.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') panel.hidden = true;
  });
  function open(nextTab = 'quests', id = null) {
    onOpen?.();
    tab = nextTab;
    npc = id;
    panel.hidden = false;
    render(true);
  }
  button.onclick = () => (panel.hidden ? open() : (panel.hidden = true));
  function sync(update) {
    data = { ...data, ...update, skills: { ...data.skills, ...update.skills } };
    render();
  }
  const labels = [...ORE_NODES, FORGE].map((point) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'resource-handle';
    el.dataset.resourceId = point.id;
    el.innerHTML = point === FORGE ? anvil : rock;
    el.hidden = true;
    el.setAttribute('aria-label', point.name);
    el.title = point.name + ' — esquerdo: aproximar; direito: usar';
    frame.append(el);
    el.onclick = (e) => {
      e.stopPropagation();
      void onApproach(point);
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (point === FORGE) open('professions');
      else void act({ action: 'mine', id: point.id });
    };
    return { el, point };
  });
  return {
    sync,
    open,
    close() {
      panel.hidden = true;
    },
    hide() {
      panel.hidden = mineStatus.hidden = true;
      for (const { el } of labels) el.hidden = true;
    },
    position(renderer, running) {
      const pos = getPosition();
      for (const { el, point } of labels) {
        el.hidden = !running || !pos || floorOf(pos) !== floorOf(point);
        if (el.hidden) continue;
        const p = renderer.worldToScreen(point.x, point.y);
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
        el.style.width = el.style.height = 30 * renderer.scale + 'px';
        el.classList.toggle(
          'exhausted',
          point !== FORGE && data.miningNodes?.[point.id]?.remaining === 0,
        );
      }
      if (running) render();
    },
  };
}
