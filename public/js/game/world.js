import { api } from '../api.js';
import { $ } from '../ui/dom.js';
import { walkable, tileAt, propAt, houseAt, templeObstacle } from '../world/map.js';
import { WELL, STOVE } from '../config.js';
import { WORLD_POLL_MS, distance } from './world-rules.js';
import { createDamageNumbers } from '../ui/damage-numbers.js';
import { createGroundItems } from '../ui/ground-items.js';
import { createLoot } from '../ui/loot.js';
import { createStaff } from '../ui/staff.js';
import { createElementEffects } from '../ui/element-effects.js';
import { createMobLabels } from '../ui/mobs.js';
import { createTown } from '../ui/town.js';
import { TOWN_POINTS } from './town-rules.js';
import { floorOf, sameFloor, isSafeZone } from '../world/elevation.js';
import { createInspection } from '../ui/inspection.js';
import { lookItem, TERRAIN_NAMES, PROP_NAMES } from './look-rules.js';
import { decorationAt, DECORATION_NAMES } from '../world/decorations.js';
import { treeStyleAt } from '../world/vegetation.js';
import { createLightningAbilities } from '../ui/lightning-abilities.js';

// Combate, comida e transferências de itens. Todas as alterações são validadas pelo servidor.
export function createWorld({
  getPosition,
  getRenderer,
  walkTo,
  cancelWalk,
  onInteract,
  prepare,
  onProgress,
  onRespawn,
  onSessionExpired,
}) {
  const damageNumbers = createDamageNumbers(),
    mobLabels = createMobLabels(),
    effects = createElementEffects(),
    groundItems = createGroundItems({ onDragStart: approachItem }),
    loot = createLoot({ onTransfer: transfer, onDragStart: approachItem }),
    townPanel = createTown({ onAction: (route, data) => action(route, data) }),
    staffPanel = createStaff({
      onElement: (element) => action('items/element', { element }),
      onTransfer: transfer,
    });
  const surface = $('world').parentElement;
  const abilities = createLightningAbilities({ onCast: (key) => action('world/cast', { key }) });
  let running = false,
    timer,
    version = 0,
    state = { mobs: [], corpses: [], groundItems: [] },
    revision = -1;
  let transitions = new Map(),
    busy = false,
    dropPreview = null,
    activeTown = null;
  const notify = (text) => {
    if (text) $('fishing-message').textContent = text;
  };
  const inspection = createInspection({
    isRunning: () => running,
    describeWorld(event) {
      if (
        !surface.contains(event.target) ||
        event.target.closest(
          '#loot-panel, #town-panel, #staff-panel, #cooking-panel, #world-zoom, #lightning-abilities',
        )
      )
        return null;
      const point = tile(event);
      if (!point) return null;
      const ground =
        state.groundItems.find(
          (item) => item.id === event.target.closest('[data-ground-id]')?.dataset.groundId,
        ) || groundAt(point);
      if (ground) return lookItem(ground.itemId, ground.quantity);
      const mob = state.mobs.find(
        (mob) =>
          mob.health > 0 &&
          sameFloor(mob, point) &&
          (mob.id === event.target.closest('[data-mob-id]')?.dataset.mobId ||
            (mob.x === point.x && mob.y === point.y)),
      );
      if (mob) return `You see ${mob.name}. Health: ${mob.health} / ${mob.maxHealth}.`;
      const corpse = state.corpses.find(
        (corpse) => sameFloor(corpse, point) && corpse.x === point.x && corpse.y === point.y,
      );
      if (corpse) return `You see the remains of ${corpse.name || 'an orc'}.`;
      const object = getRenderer()?.objectAt(event.clientX, event.clientY);
      const town =
        floorOf(point) === 0 &&
        Object.values(TOWN_POINTS).find(
          (entry) =>
            event.target.closest('[data-town-id]')?.dataset.townId === entry.id ||
            object === `town:${entry.id}` ||
            (point.x === entry.x && point.y === entry.y),
        );
      if (town) return `You see ${town.name}.`;
      if (
        floorOf(point) === 0 &&
        (object === 'fountain' || (point.x === WELL.x && point.y === WELL.y))
      )
        return 'You see a healing fountain. It restores your health and mana.';
      if (
        floorOf(point) === 0 &&
        (object === 'stove' || (point.x === STOVE.x && point.y === STOVE.y))
      )
        return 'You see a stove. You can cook fish here.';
      const decoration = decorationAt(point.x, point.y, floorOf(point));
      if (decoration) return `You see ${DECORATION_NAMES[decoration]}.`;
      const prop = propAt(point.x, point.y, floorOf(point));
      if (prop === 'tree' || prop === 'pine') {
        const trees = {
          oak: 'an oak tree',
          pine: 'a pine tree',
          charred: 'a burnt tree',
          palm: 'a palm tree',
        };
        return `You see ${trees[treeStyleAt(point.x, point.y)]}.`;
      }
      if (prop) return `You see ${PROP_NAMES[prop] || prop}.`;
      if (floorOf(point) === 0 && templeObstacle(point.x, point.y))
        return 'You see a temple pillar.';
      const house = floorOf(point) === 0 && houseAt(point.x, point.y);
      if (
        house?.shop &&
        point.x === house.x + Math.floor(house.w / 2) - 1 &&
        point.y === house.y + house.h - 1
      )
        return `You see a ${house.shop === 'food' ? 'food' : 'equipment'} shop sign.`;
      if (house) return `You see ${house.name}.`;
      return `You see ${TERRAIN_NAMES[tileAt(point.x, point.y, floorOf(point))] || 'the ground'}.`;
    },
  });
  function handle(result) {
    onProgress(result);
    if (result.loot) loot.open(result.loot);
    if (result.message) notify(result.message);
    if (result.playerRespawned) onRespawn(result.position);
    const messages = [];
    for (const event of result.events || []) {
      if (event.damage && !sameFloor(event, getPosition())) continue;
      damageNumbers.add(event);
      effects.add(event);
      if (event.type === 'player-hit')
        messages.push(
          `Você acertou ${event.damage} de dano em ${event.mobName || 'Orc'}.${event.weakness ? ' Fraqueza elemental!' : ''}`,
        );
      if (event.type === 'orc-hit' || event.type === 'mob-hit')
        messages.push(`${event.mobName || 'Orc'} causou ${event.damage} de dano em você.`);
      if (event.type === 'orc-defeated' || event.type === 'mob-defeated')
        messages.push(`${event.mobName || 'Orc'} derrotado! Retorna em 15 segundos.`);
      if (event.type === 'player-respawn')
        messages.push('Você foi derrotado e retornou ao spawn com vida cheia.');
      if (event.type === 'ground-cleanup')
        messages.push(`Limpeza do mundo: ${event.count} pilhas removidas do chão.`);
    }
    if (messages.length) notify(messages.join(' '));
  }
  function failed(error) {
    if (error.status === 401) onSessionExpired();
    else notify(error.message);
  }
  function schedule(currentVersion) {
    clearTimeout(timer);
    if (!running || currentVersion !== version) return;
    timer = setTimeout(async () => {
      try {
        const result = await api('world/tick', {});
        if (version !== currentVersion) return;
        handle(result);
      } catch (error) {
        if (version === currentVersion) failed(error);
      }
      schedule(currentVersion);
    }, WORLD_POLL_MS);
  }
  async function action(route, data) {
    if (!running || busy) return;
    busy = true;
    const currentVersion = version;
    try {
      if (!(await prepare()) || version !== currentVersion) return;
      const result = await api(route, data);
      if (version === currentVersion) {
        handle(result);
        if (route === 'town/open') {
          activeTown = result.town?.available ? result.town : null;
          townPanel.open(result.town);
        }
      }
      return result;
    } catch (error) {
      if (version === currentVersion) failed(error);
    } finally {
      busy = false;
    }
  }
  function tile(event) {
    return getRenderer()?.screenToTile(event.clientX, event.clientY);
  }
  function sourcePoint(payload) {
    return payload.source === 'ground'
      ? state.groundItems.find((item) => item.id === payload.id)
      : payload.source === 'loot'
        ? state.corpses.find((corpse) => corpse.id === payload.corpseId)
        : null;
  }
  function approachItem(payload) {
    const point = sourcePoint(payload);
    if (point && distance(getPosition(), point) > 1) void walkTo(() => sourcePoint(payload), 1);
  }
  async function transfer(payload) {
    const currentVersion = version,
      point = sourcePoint(payload);
    if (point && distance(getPosition(), point) > 1) {
      notify('Caminhando até o item…');
      if (!(await walkTo(() => sourcePoint(payload), 1)) || version !== currentVersion) return;
    }
    return action('items/transfer', payload);
  }
  function nearbyMob() {
    return state.mobs
      .filter(
        (mob) =>
          mob.health > 0 &&
          getPosition() &&
          !isSafeZone(getPosition()) &&
          sameFloor(getPosition(), mob),
      )
      .sort((a, b) => distance(getPosition(), a) - distance(getPosition(), b))[0];
  }
  async function attack(mobId = nearbyMob()?.id || 'orc') {
    const result = await action('world/attack', { mobId });
    if (!result) return;
    const mob = state.mobs.find((mob) => mob.id === mobId);
    if (!mob?.targeted) {
      cancelWalk();
      return;
    }
  }
  async function interactAt(point, kind) {
    if (distance(getPosition(), point) > 1) {
      notify('Aproxime-se para usar.');
      return;
    }
    if (kind.startsWith('town:')) await action('town/open', { id: kind.slice(5) });
    else if (kind === 'fountain') await action('world/heal', {});
    else await onInteract(kind);
  }
  function groundAt(point) {
    return [...state.groundItems]
      .reverse()
      .find((item) => item.x === point.x && item.y === point.y && sameFloor(item, point));
  }
  function canWalk(x, y, z = floorOf(getPosition())) {
    return (
      walkable(x, y, z) &&
      !state.mobs.some((mob) => mob.health > 0 && mob.x === x && mob.y === y && floorOf(mob) === z)
    );
  }
  surface.addEventListener('dragover', (event) => {
    if (!running || !Array.from(event.dataTransfer.types).includes('application/x-digla-item'))
      return;
    if (
      event.target.closest(
        '#loot-panel, #cooking-panel, #staff-panel, #town-panel, #world-zoom, #lightning-abilities',
      )
    ) {
      dropPreview = null;
      return;
    }
    event.preventDefault();
    const point = tile(event);
    if (!point) return;
    dropPreview = { ...point, valid: canWalk(point.x, point.y) };
    event.dataTransfer.dropEffect = dropPreview.valid ? 'move' : 'none';
  });
  surface.addEventListener('dragleave', () => {
    dropPreview = null;
  });
  surface.addEventListener('dragend', () => {
    dropPreview = null;
  });
  surface.addEventListener('drop', (event) => {
    event.preventDefault();
    dropPreview = null;
    if (
      event.target.closest(
        '#loot-panel, #cooking-panel, #staff-panel, #town-panel, #world-zoom, #lightning-abilities',
      )
    )
      return;
    const point = tile(event);
    if (!point) return;
    if (!canWalk(point.x, point.y)) {
      notify('Você só pode largar itens em um quadrado onde pode andar.');
      return;
    }
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/x-digla-item'));
      void transfer({
        ...payload,
        target: 'ground',
        ...point,
      });
    } catch {
      notify('Arraste um item da mochila para o mapa.');
    }
  });
  surface.addEventListener('contextmenu', (event) => {
    if (!running) return;
    if (
      event.target.closest(
        '#loot-panel, #cooking-panel, #staff-panel, #town-panel, #world-zoom, #lightning-abilities',
      )
    )
      return;
    const point = tile(event);
    if (!point) return;
    const labelId = event.target.closest('[data-mob-id]')?.dataset.mobId;
    const mob = state.mobs.find(
      (mob) =>
        mob.health > 0 &&
        sameFloor(mob, point) &&
        (labelId === mob.id || (point.x === mob.x && point.y === mob.y)),
    );
    if (mob) {
      event.preventDefault();
      void attack(mob.id);
      return;
    }
    const object = getRenderer()?.objectAt(event.clientX, event.clientY);
    const townPoint =
      floorOf(point) === 0 &&
      Object.values(TOWN_POINTS).find(
        (entry) =>
          event.target.closest('[data-town-id]')?.dataset.townId === entry.id ||
          object === `town:${entry.id}` ||
          (point.x === entry.x && point.y === entry.y),
      );
    if (townPoint) {
      void interactAt(townPoint, `town:${townPoint.id}`);
      return;
    }
    if (
      floorOf(point) === 0 &&
      (object === 'fountain' || (point.x === WELL.x && point.y === WELL.y))
    ) {
      void interactAt(WELL, 'fountain');
      return;
    }
    if (
      floorOf(point) === 0 &&
      (object === 'stove' || (point.x === STOVE.x && point.y === STOVE.y))
    ) {
      void interactAt(STOVE, 'stove');
      return;
    }
    if (tileAt(point.x, point.y, floorOf(point)) === 'water') {
      void interactAt(point, 'water');
      return;
    }
    const item = groundAt(point);
    const corpse = [...state.corpses]
      .reverse()
      .find((corpse) => corpse.x === point.x && corpse.y === point.y && sameFloor(corpse, point));
    if (item) {
      event.preventDefault();
      if (distance(getPosition(), item) > 1) {
        notify('Aproxime-se para recolher o item.');
        return;
      }
      void transfer({ source: 'ground', id: item.id, target: 'inventory' });
    } else if (corpse) {
      event.preventDefault();
      const corpseId = corpse.id;
      void (async () => {
        if (distance(getPosition(), corpse) > 1) {
          notify('Aproxime-se para abrir o corpo.');
          return;
        }
        await action('world/loot', { id: corpseId });
      })();
    }
  });
  surface.addEventListener('click', (event) => {
    if (!running) return;
    if (event.target !== $('world') && !event.target.closest('.ground-item-handle')) return;
    const point = tile(event);
    if (!point) return;
    const object = getRenderer()?.objectAt(event.clientX, event.clientY);
    const bank =
      floorOf(point) === 0 &&
      Object.values(TOWN_POINTS).find(
        (entry) =>
          entry.kind === 'bank' &&
          (object === `town:${entry.id}` || (point.x === entry.x && point.y === entry.y)),
      );
    if (bank) {
      void (async () => {
        if (await walkTo(bank, 1)) await interactAt(bank, `town:${bank.id}`);
      })();
      return;
    }
    if (canWalk(point.x, point.y)) void walkTo(point, 0);
  });
  return {
    changeFloor() {
      inspection.clear();
      damageNumbers.clear();
      effects.clear();
      loot.close();
      staffPanel.close();
      townPanel.close();
      groundItems.clear();
      activeTown = null;
      dropPreview = null;
      transitions.clear();
    },
    canWalk,
    nearMob() {
      return !!nearbyMob();
    },
    nearbyMobName() {
      return nearbyMob()?.name.toLowerCase() || 'inimigo';
    },
    attack() {
      return action('world/attack', { nearest: true, toggle: false });
    },
    cast(key) {
      return action('world/cast', { key });
    },
    use(payload) {
      return action('items/use', payload);
    },
    depositItem(payload) {
      return townPanel.depositItem(payload);
    },
    transfer,
    staff(payload) {
      staffPanel.open(payload);
    },
    clearDrag() {
      dropPreview = null;
    },
    accept(data) {
      if (data.worldRevision !== undefined && data.worldRevision < revision) return;
      if (data.worldRevision !== undefined) revision = data.worldRevision;
      abilities.sync(data);
      if (!running) abilities.hide();
      if (data.mobs || data.orc) {
        const updates = (data.mobs || [data.orc]).filter((mob) => !isSafeZone(mob));
        state.mobs = updates.map((mob) => {
          const previous = state.mobs.find((old) => old.id === mob.id);
          if (
            previous &&
            previous.health > 0 &&
            mob.health > 0 &&
            Math.max(Math.abs(previous.x - mob.x), Math.abs(previous.y - mob.y)) <= 1 &&
            (previous.x !== mob.x || previous.y !== mob.y)
          )
            transitions.set(mob.id, { from: { ...previous }, started: performance.now() });
          else if (
            !previous ||
            previous.health <= 0 ||
            mob.health <= 0 ||
            Math.max(Math.abs(previous.x - mob.x), Math.abs(previous.y - mob.y)) > 1
          )
            transitions.delete(mob.id);
          return { targeted: previous?.targeted, ...mob };
        });
        mobLabels.render(state.mobs);
      }
      if (data.groundItems) state.groundItems = data.groundItems;
      if (data.corpses) state.corpses = data.corpses;
      else if ('corpse' in data) state.corpses = data.corpse ? [data.corpse] : [];
      if (data.equipment) state.equipment = data.equipment;
      if (data.attackElement) {
        state.attackElement = data.attackElement;
        staffPanel.sync(data.attackElement, data.skills?.magic?.level);
      }
      loot.sync(state.corpses, getPosition());
      townPanel.sync(data);
    },
    scene(time) {
      const mobs = state.mobs.map((mob) => {
        const transition = transitions.get(mob.id);
        if (!transition) return mob;
        const progress = Math.min(1, (time - transition.started) / 180),
          from = transition.from,
          dx = mob.x - from.x,
          dy = mob.y - from.y;
        return {
          ...mob,
          x: from.x + dx * progress,
          y: from.y + dy * progress,
          moving: progress < 1,
          direction:
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
        };
      });
      return {
        mobs: mobs.filter((mob) => sameFloor(mob, getPosition())),
        corpses: state.corpses.filter((item) => sameFloor(item, getPosition())),
        groundItems: state.groundItems.filter((item) => sameFloor(item, getPosition())),
        dropPreview,
      };
    },
    positionLabel(position) {
      const renderer = getRenderer();
      if (renderer) townPanel.position(renderer, running);
      if (renderer && running) {
        damageNumbers.update(renderer, performance.now());
        effects.update(renderer, performance.now());
        groundItems.update(
          state.groundItems.filter((item) => sameFloor(item, getPosition())),
          renderer,
        );
        loot.sync(state.corpses, getPosition());
        if (activeTown && distance(getPosition(), activeTown) > 1) {
          townPanel.close();
          activeTown = null;
        }
      }
      mobLabels.position(position, running);
    },
    start(data) {
      version++;
      revision = -1;
      state = { mobs: [], corpses: [], groundItems: [] };
      transitions.clear();
      damageNumbers.clear();
      effects.clear();
      staffPanel.close();
      townPanel.close();
      activeTown = null;
      groundItems.clear();
      loot.close();
      running = true;
      this.accept(data);
      schedule(version);
    },
    pause() {
      abilities.hide();
      inspection.clear();
      townPanel.close();
      activeTown = null;
      running = false;
      version++;
      clearTimeout(timer);
      dropPreview = null;
      mobLabels.hide();
      damageNumbers.clear();
      effects.clear();
      void api('world/stop', { disengage: true })
        .then(onProgress)
        .catch(() => {});
    },
    resume() {
      if (running) return;
      running = true;
      const currentVersion = ++version;
      void api('session')
        .then((data) => {
          if (running && version === currentVersion) onProgress(data);
        })
        .catch(failed);
      schedule(version);
    },
    stopAttack() {
      cancelWalk();
      townPanel.close();
      activeTown = null;
      staffPanel.close();
      loot.close();
      return api('world/stop', {}).then(handle).catch(failed);
    },
    reset() {
      abilities.hide();
      inspection.clear();
      townPanel.close();
      activeTown = null;
      effects.clear();
      staffPanel.close();
      damageNumbers.clear();
      groundItems.clear();
      loot.close();
      running = false;
      version++;
      clearTimeout(timer);
      dropPreview = null;
      revision = -1;
      mobLabels.hide();
    },
  };
}
