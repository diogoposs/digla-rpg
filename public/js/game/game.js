import { AUTOSAVE_INTERVAL_MS, SPAWN } from '../config.js';
import { walkable, regionAt } from '../world/map.js';
import { api } from '../api.js';
import { $ } from '../ui/dom.js';
import { createInventory } from '../ui/inventory.js';
import { WorldRenderer } from './renderer.js';
import { drawMinimap, MINIMAP_LEGEND, minimapTile } from './minimap.js';
import { Movement } from './movement.js';
import { createInput } from './input.js';
import { createSkills } from '../ui/skills.js';
import { createFishing } from './fishing.js';
import { createCooking } from './cooking.js';
import { createActions } from './actions.js';
import { createWorld } from './world.js';
import { createNavigation } from './navigation.js';
import { floorOf, floorName } from '../world/elevation.js';

// Coordena uma sessão de jogo: entrar/sair, HUD, caminhada e salvamento.
export function createGame({ onExit }) {
  $('minimap-legend').textContent = MINIMAP_LEGEND;
  const inventory = createInventory({
    onUse: (payload) => world.use(payload),
    onDeposit: (payload) => world.depositItem(payload),
    onDragEnd: () => world.clearDrag(),
    onTransfer: (payload) => world.transfer(payload),
    onStaff: (payload) => world.staff(payload),
  });
  const skills = createSkills();
  let account = null,
    movement = null,
    renderer = null,
    welcomeTimer;
  let minimapZoom = 1,
    mapDestination = null;
  let lastSaved = '',
    saving = null,
    saveAgain = false;
  function applyProgress(data) {
    if (!account) return;
    if (data.inventory) {
      account.inventory = data.inventory;
      inventory.render(data.inventory);
    }
    if (data.skills) {
      account.skills = { ...account.skills, ...data.skills };
      skills.render(account.skills);
    }
    if (data.worldRevision === undefined || data.worldRevision >= (account.worldRevision || 0)) {
      if (data.utility) account.utility = data.utility;
      if (data.serverNow !== undefined) account.serverOffset = data.serverNow - Date.now();
      if (data.vitals) {
        account.vitals = data.vitals;
        inventory.renderVitals(data.vitals);
      }
      if (data.worldRevision !== undefined) account.worldRevision = data.worldRevision;
      world.accept(data);
      if (data.equipment) inventory.renderEquipment(data.equipment);
    }
  }
  async function prepareActivity() {
    if (!account || movement.travel) return false;
    if (saving) await saving;
    return account ? await savePosition() : false;
  }
  const fishing = createFishing({
    getPosition: () => movement?.target,
    prepare: prepareActivity,
    onProgress: applyProgress,
    onSessionExpired: () => exit('Sua sessão terminou. Entre novamente para continuar.'),
  });
  const cooking = createCooking({
    prepare: prepareActivity,
    onProgress: applyProgress,
    onSessionExpired: () => exit('Sua sessão terminou. Entre novamente para continuar.'),
  });
  const world = createWorld({
    getPosition: () => movement?.target,
    getRenderer: () => renderer,
    walkTo: (target, range) => navigation.goTo(target, range),
    cancelWalk: () => navigation.cancel(),
    stopMovement: () => {
      navigation.cancel();
      input.clear();
      movement.finishStep();
    },
    onInteract: (kind) => actions.interact(kind),
    prepare: async () => {
      await cooking.close();
      await fishing.stop();
      if (!account) return false;
      if (saving) await saving;
      return account ? savePosition() : false;
    },
    onProgress: applyProgress,
    onRespawn: (position) => {
      navigation.cancel();
      input.clear();
      movement = new Movement(
        position,
        { username: account.username, outfit: account.outfit },
        world.canWalk,
      );
      lastSaved = `${position.x},${position.y},${floorOf(position)}`;
      updatePosition();
      void cooking.close();
      void fishing.stop();
    },
    onSessionExpired: () => exit('Sua sessão terminou. Entre novamente para continuar.'),
  });
  const navigation = createNavigation({
    getMovement: () => movement,
    canWalk: world.canWalk,
    notify: (message) => {
      $('fishing-message').textContent = message;
    },
  });
  const actions = createActions({ getPosition: () => movement?.target, fishing, cooking, world });
  $('game').addEventListener('contextmenu', (event) => event.preventDefault());
  const input = createInput({
    isPlaying: () => !!account,
    onPause() {
      navigation.cancel();
      world.pause();
      void cooking.close('Culinária pausada. Aperte F junto ao fogão para retomar.');
      void fishing.stop('Pesca pausada. Aperte F perto da água para retomar.');
      movement.finishStep();
      $('paused').hidden = false;
      void savePosition();
    },
    onResume() {
      world.resume();
      $('paused').hidden = true;
    },
    onAction(key) {
      if (key === 'escape') navigation.cancel();
      void actions.press(key);
    },
    onHide() {
      if (account)
        navigator.sendBeacon(
          '/api/position',
          new Blob([JSON.stringify(movement.target)], { type: 'application/json' }),
        );
    },
  });
  $('world').addEventListener('pointerdown', () => {
    input.resume();
    $('world').focus();
  });
  setInterval(() => void savePosition(), AUTOSAVE_INTERVAL_MS);

  function refreshMinimap() {
    if (!movement) return;
    drawMinimap($('minimap'), movement.target, minimapZoom, mapDestination);
    $('minimap-zoom-reset').textContent = minimapZoom + '×';
    $('minimap-zoom-in').disabled = minimapZoom === 8;
    $('minimap-zoom-out').disabled = minimapZoom === 1;
  }
  function zoomMinimap(direction) {
    minimapZoom = Math.max(1, Math.min(8, minimapZoom * (direction > 0 ? 2 : 0.5)));
    refreshMinimap();
  }
  function zoomWorld(value) {
    if (!renderer) return;
    renderer.setZoom(value);
    $('world-zoom-reset').textContent = (renderer.scale / 2) * 100 + '%';
    $('world-zoom-in').disabled = renderer.scale === 4;
    $('world-zoom-out').disabled = renderer.scale === 1;
    $('world').focus({ preventScroll: true });
  }
  $('minimap-zoom-in').onclick = () => zoomMinimap(1);
  $('minimap-zoom-out').onclick = () => zoomMinimap(-1);
  $('minimap-zoom-reset').onclick = () => {
    minimapZoom = 1;
    refreshMinimap();
  };
  $('world-zoom-in').onclick = () => zoomWorld(renderer?.scale + 1);
  $('world-zoom-out').onclick = () => zoomWorld(renderer?.scale - 1);
  $('world-zoom-reset').onclick = () => zoomWorld(2);
  for (const id of ['world', 'minimap'])
    $(id).addEventListener(
      'wheel',
      (event) => {
        if (!account || event.ctrlKey) return;
        event.preventDefault();
        if (id === 'world') zoomWorld(renderer.scale + (event.deltaY < 0 ? 1 : -1));
        else zoomMinimap(event.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
  function walkFromMinimap(event) {
    if (!account) return;
    if (event.shiftKey) return;
    event.preventDefault();
    const point = minimapTile(
      $('minimap'),
      event.clientX,
      event.clientY,
      movement.target,
      minimapZoom,
    );
    mapDestination = point;
    refreshMinimap();
    input.resume();
    $('world').focus({ preventScroll: true });
    void navigation.goTo(point, world.canWalk(point.x, point.y, point.z) ? 0 : 1).finally(() => {
      if (mapDestination === point) {
        mapDestination = null;
        if (account) refreshMinimap();
      }
    });
  }
  $('minimap').addEventListener('click', walkFromMinimap);
  $('minimap').addEventListener('contextmenu', (event) => event.preventDefault());

  function setSaveStatus(message, failed = false) {
    $('save-status').textContent = message;
    $('save-status').classList.toggle('failed', failed);
  }

  function updatePosition() {
    const { x, y } = movement.target;
    $('coordinates').textContent = `X: ${x} · Y: ${y}`;
    $('floor-label').textContent = floorName(movement.target);
    $('minimap').dataset.floor = floorOf(movement.target);
    $('region-name').textContent =
      { fire: 'TERRAS DE BRASAS', water: 'COSTA DAS MARÉS', orc: 'DOMÍNIO DOS ORCS' }[
        regionAt(x, y)
      ] || 'BRUMAVALE';
    $('world-area-name').textContent = $('region-name').textContent;
    refreshMinimap();
  }

  function exit(message = '') {
    navigation.cancel();
    world.reset();
    cooking.reset();
    fishing.reset();
    skills.reset();
    inventory.reset();
    input.setActive(false);
    account = null;
    movement = null;
    $('game').hidden = true;
    $('menu').hidden = false;
    onExit(message);
  }

  async function savePosition() {
    if (!account) return true;
    if (saving) {
      saveAgain = true;
      return saving;
    }
    const position = { ...movement.target },
      key = `${position.x},${position.y},${floorOf(position)}`;
    if (key === lastSaved) return true;
    saving = (async () => {
      try {
        const result = await api('position', position);
        applyProgress(result);
        if (result.message) $('fishing-message').textContent = result.message;
        lastSaved = key;
        setSaveStatus('Seu progresso está salvo no servidor.');
        return true;
      } catch (error) {
        if (error.status === 409 && error.data?.position) {
          input.clear();
          movement = new Movement(
            error.data.position,
            { username: account.username, outfit: account.outfit },
            world.canWalk,
          );
          lastSaved = `${movement.target.x},${movement.target.y},${floorOf(movement.target)}`;
          applyProgress(error.data);
          updatePosition();
          return false;
        }
        if (error.status === 401) exit('Sua sessão terminou. Entre novamente para continuar.');
        else setSaveStatus('Não foi possível salvar. Tentando novamente…', true);
        return false;
      } finally {
        saving = null;
        if (saveAgain) {
          saveAgain = false;
          void savePosition();
        }
      }
    })();
    return saving;
  }

  $('logout').onclick = async () => {
    $('logout').disabled = true;
    input.setActive(false);
    movement.finishStep();
    try {
      world.pause();
      await cooking.close();
      await fishing.stop();
      if (saving) await saving;
      if (!account) return;
      const saved = await savePosition();
      if (!saved) {
        input.setActive(!!account);
        if (account) world.resume();
        return;
      }
      await api('logout', {});
      exit();
    } catch (error) {
      if (error.status === 401) exit('Sua sessão terminou. Entre novamente para continuar.');
      else {
        setSaveStatus(error.message, true);
        input.setActive(true);
        world.resume();
      }
    } finally {
      $('logout').disabled = false;
    }
  };

  return {
    get isPlaying() {
      return !!account;
    },
    enter(data) {
      navigation.cancel();
      account = data;
      const position = walkable(data.position?.x, data.position?.y, floorOf(data.position))
        ? data.position
        : SPAWN;
      movement = new Movement(
        position,
        { username: data.username, outfit: data.outfit },
        world.canWalk,
      );
      lastSaved = `${position.x},${position.y},${floorOf(position)}`;
      $('menu').hidden = true;
      $('game').hidden = false;
      renderer ??= new WorldRenderer($('world'));
      renderer.resize();
      $('player-label').textContent = data.username;
      inventory.reset();
      fishing.reset();
      cooking.reset();
      skills.reset();
      world.start(data);
      applyProgress(data);
      updatePosition();
      input.setActive(true);
      $('paused').hidden = true;
      $('world').focus({ preventScroll: true });
      $('welcome').style.opacity = '1';
      clearTimeout(welcomeTimer);
      welcomeTimer = setTimeout(() => {
        $('welcome').style.opacity = '0';
      }, 6000);
      setSaveStatus('Seu progresso é salvo automaticamente.');
    },
    update(time, delta) {
      if (!account) return;
      const manual = input.key;
      movement.speedMultiplier =
        Date.now() + (account.serverOffset || 0) < (account.utility?.hasteUntil || 0) ? 1.5 : 1;
      const previousFloor = floorOf(movement.target);
      if (manual) navigation.cancel();
      if (movement.update(time, delta, manual || navigation.key())) {
        if (previousFloor !== floorOf(movement.target)) {
          navigation.cancel();
          world.changeFloor();
          $('fishing-message').textContent = floorName(movement.target);
        }
        void cooking.close('Culinária interrompida ao caminhar.');
        void fishing.stop('Pesca interrompida ao caminhar.');
        updatePosition();
        void savePosition();
      }
      fishing.update(time);
      cooking.update(time);
      actions.update();
      const position = renderer.render(movement.player, movement.player, time, world.scene(time));
      world.positionLabel(position.mobs);
      // Texto em resolução nativa: ele não vira parte dos pixels ampliados do cenário.
      $('player-label').style.left = position.x + 'px';
      $('player-label').style.top = position.y + 'px';
    },
  };
}
