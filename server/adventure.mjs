import { ensureProgress, publicProgress } from '../public/js/game/progression.js';
import { QUESTS, RECIPES, FORGE, ORE_NODES } from '../public/js/game/adventure-rules.js';
import { skillProgress } from '../public/js/game/skill-rules.js';
import { TOWN_POINTS } from '../public/js/game/town-rules.js';
import { distance } from '../public/js/game/world-rules.js';
import { clone, add, take, count } from './inventory.mjs';

export function createAdventureService({ save, now = Date.now }) {
  const lastTicks = new WeakMap();
  const response = (a, message = '', extra = {}) => ({
    ...publicProgress(a),
    serverNow: now(),
    message,
    ...extra,
  });
  function nearby(a, point) {
    return point && distance(a.position, point) <= 1;
  }
  function nodes(a) {
    for (const n of ORE_NODES) {
      let s = a.miningNodes[n.id];
      if (!s) a.miningNodes[n.id] = { remaining: n.capacity, respawnAt: 0 };
      else if (s.remaining <= 0 && now() >= s.respawnAt)
        a.miningNodes[n.id] = { remaining: n.capacity, respawnAt: 0 };
    }
  }
  return {
    stop(a) {
      if (a.gathering) {
        a.gathering = null;
        a.worldRevision++;
      }
    },
    async action(a, { action, id, enabled } = {}) {
      ensureProgress(a);
      nodes(a);
      if (action === 'settings') {
        if (typeof enabled !== 'boolean') return response(a, 'Escolha um modo válido.');
        a.gameSettings.testMode = enabled;
        ensureProgress(a);
        a.worldRevision++;
        await save();
        return response(
          a,
          enabled
            ? 'Modo de teste: preços 1 e vida dos orcs 10×.'
            : 'Modo normal: preços e vida de progressão.',
        );
      }
      if (action === 'mine') {
        const n = ORE_NODES.find((n) => n.id === id);
        if (!nearby(a, n)) return response(a, 'Fique ao lado de um veio de ferro.');
        if (!a.miningNodes[id].remaining)
          return response(a, 'Este veio está esgotado. Aguarde a recuperação.');
        const interval = Math.max(1500, 2500 - (skillProgress(a.skills.mining.xp).level - 1) * 100);
        a.gathering = { id, position: { ...a.position }, nextTickAt: now() + interval, interval };
        lastTicks.set(a, now());
        a.worldRevision++;
        await save();
        return response(a, 'Minerando ferro. Caminhar ou receber dano interrompe.');
      }
      if (action === 'stop') {
        this.stop(a);
        await save();
        return response(a, 'Mineração interrompida.');
      }
      if (action === 'craft') {
        const r = Object.hasOwn(RECIPES, id || '') && RECIPES[id];
        if (!nearby(a, FORGE)) return response(a, 'Aproxime-se da forja ao lado de Matlo.');
        if (!r || skillProgress(a.skills.smithing.xp).level < r.level)
          return response(a, 'Receita inválida ou nível de Ferraria insuficiente.');
        const bag = clone(a.inventory);
        for (const [item, n] of Object.entries(r.materials))
          if (!take(bag, item, n)) return response(a, 'Faltam materiais para esta receita.');
        if (!add(bag, r.output, r.quantity))
          return response(a, 'Libere espaço na mochila. Nenhum material foi gasto.');
        a.inventory = bag;
        a.skills.smithing.xp += r.xp;
        a.worldRevision++;
        await save();
        return response(a, 'Equipamento fabricado com sucesso.');
      }
      const q = Object.hasOwn(QUESTS, id || '') && QUESTS[id];
      if (!q || !nearby(a, TOWN_POINTS[q.npc]))
        return response(a, 'Converse com o NPC responsável por esta missão.');
      if (action === 'accept') {
        if (a.quests[id]) return response(a, 'Esta missão já foi aceita.');
        if (q.requires && a.quests[q.requires]?.status !== 'completed')
          return response(a, 'Conclua a missão anterior primeiro.');
        a.quests[id] = { status: 'active', kills: 0 };
        a.worldRevision++;
        await save();
        return response(a, 'Missão aceita: ' + q.name);
      }
      if (action === 'claim') {
        const state = a.quests[id];
        if (!state || state.status === 'completed')
          return response(a, 'Esta recompensa não está disponível.');
        if (q.kills && state.kills < q.kills)
          return response(a, 'Você ainda não concluiu os objetivos.');
        const bag = clone(a.inventory);
        for (const [item, n] of Object.entries(q.deliver || {}))
          if (!take(bag, item, n)) return response(a, 'Traga os itens pedidos na mochila.');
        for (const [item, n] of Object.entries(q.rewards))
          if (!add(bag, item, n))
            return response(a, 'Recompensa pendente: libere espaço na mochila e volte.');
        state.status = 'completed';
        a.inventory = bag;
        a.worldRevision++;
        await save();
        return response(a, 'Missão concluída! Recompensa recebida.');
      }
      return response(a, 'Ação desconhecida.');
    },
    async tick(a) {
      ensureProgress(a);
      nodes(a);
      const g = a.gathering,
        time = now(),
        last = lastTicks.get(a);
      lastTicks.set(a, time);
      if (!g) return null;
      const n = ORE_NODES.find((n) => n.id === g.id);
      if (
        last === undefined ||
        time - last > 2000 ||
        !nearby(a, n) ||
        distance(a.position, g.position) !== 0
      ) {
        this.stop(a);
        await save();
        return response(a, 'Mineração interrompida.');
      }
      if (time < g.nextTickAt) return null;
      const bag = clone(a.inventory),
        s = a.miningNodes[g.id];
      if (!s.remaining || !add(bag, 'iron_ore', 1)) {
        this.stop(a);
        await save();
        return response(a, 'Mineração interrompida: veio esgotado ou mochila cheia.');
      }
      s.remaining--;
      if (!s.remaining) {
        s.respawnAt = time + n.respawnMs;
        a.gathering = null;
      } else g.nextTickAt = time + g.interval;
      a.inventory = bag;
      a.skills.mining.xp += 10;
      a.worldRevision++;
      await save();
      return response(a, 'Você extraiu um minério de ferro.');
    },
  };
}
