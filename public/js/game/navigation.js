import { findPath } from './pathfinding.js';
import { distance } from './world-rules.js';

export function createNavigation({ getMovement, canWalk, notify }) {
  let task = null;
  function cancel() {
    if (task) task.resolve(false);
    task = null;
  }
  return {
    cancel,
    goTo(target, range = 0) {
      cancel();
      return new Promise((resolve) => {
        task = { target, range, resolve };
      });
    },
    key() {
      const movement = getMovement();
      if (!task || !movement || movement.travel) return undefined;
      const target = typeof task.target === 'function' ? task.target() : task.target;
      if (!target) {
        cancel();
        return;
      }
      if (distance(movement.target, target) <= task.range) {
        const done = task;
        task = null;
        done.resolve(true);
        return;
      }
      const path = findPath(movement.target, target, canWalk, task.range);
      if (!path?.length) {
        notify('Não há caminho livre até esse local.');
        cancel();
        return;
      }
      const next = path[0],
        point = movement.target;
      return next.x > point.x
        ? 'ArrowRight'
        : next.x < point.x
          ? 'ArrowLeft'
          : next.y > point.y
            ? 'ArrowDown'
            : 'ArrowUp';
    },
  };
}
