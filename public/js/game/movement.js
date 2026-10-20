import { STEP_DURATION_MS, MOVEMENT } from '../config.js';
import { walkable } from '../world/map.js';
import { transitionAt, floorOf } from '../world/elevation.js';

// Só cuida da caminhada. Não conhece HTML, senhas ou salvamento.
export class Movement {
  constructor(position, character, canWalk = walkable) {
    this.canWalk = canWalk;
    this.player = { ...position, ...character, direction: 'down', step: 0 };
    this.target = { ...position };
    this.travel = null;
    this.lastStep = 0;
    this.speedMultiplier = 1;
  }

  update(time, delta, key) {
    const duration = STEP_DURATION_MS / this.speedMultiplier;
    if (this.travel) {
      const travel = this.travel;
      travel.progress = Math.min(1, travel.progress + delta / duration);
      this.player.x = travel.x + (this.target.x - travel.x) * travel.progress;
      this.player.y = travel.y + (this.target.y - travel.y) * travel.progress;
      this.player.step = travel.progress < 0.5 ? 1 : 2;
      if (travel.progress >= 1) this.finishStep();
    }
    if (this.travel || !key) return false;
    const [dx, dy, direction] = MOVEMENT[key];
    this.player.direction = direction;
    if (time - this.lastStep < duration) return false;
    this.lastStep = time;
    if (!this.canWalk(this.target.x + dx, this.target.y + dy, floorOf(this.target))) return false;
    const transition = transitionAt(this.target.x + dx, this.target.y + dy, floorOf(this.target));
    if (transition) {
      this.target = { ...transition.to };
      this.finishStep();
      return true;
    }
    this.travel = { ...this.target, progress: 0 };
    this.target = { ...this.target, x: this.target.x + dx, y: this.target.y + dy };
    return true;
  }

  finishStep() {
    this.player.z = floorOf(this.target);
    this.player.x = this.target.x;
    this.player.y = this.target.y;
    this.player.step = 0;
    this.travel = null;
  }
}
