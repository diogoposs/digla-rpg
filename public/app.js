// Ponto de entrada: conecta menu e jogo e mantém o ciclo de animação.
import { DEFAULT_OUTFIT } from './js/config.js';
import { api } from './js/api.js';
import { $, errorAt } from './js/ui/dom.js';
import { createAuth } from './js/ui/auth.js';
import { createGame } from './js/game/game.js';
import { WorldRenderer } from './js/game/renderer.js';

const landscape = new WorldRenderer($('landscape'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const game = createGame({
  onExit(message) {
    landscape.resize();
    auth.showLogin(message);
  },
});
const auth = createAuth({ onEnter: (account) => game.enter(account) });
let lastTime = 0;

function tick(time) {
  const delta = Math.min(time - lastTime, 50);
  lastTime = time;
  if (game.isPlaying) game.update(time, delta);
  else {
    landscape.render(
      {
        x: 29 + (reducedMotion ? 0 : Math.sin(time / 35000) * 2),
        y: 26 + (reducedMotion ? 0 : Math.cos(time / 42000) * 1.3),
      },
      { x: 29, y: 27, outfit: DEFAULT_OUTFIT, direction: 'down', step: 0 },
      time,
    );
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
api('session')
  .then(auth.openWorld)
  .catch((error) => {
    if (error.status !== 401) errorAt('auth-error', error.message);
  });
