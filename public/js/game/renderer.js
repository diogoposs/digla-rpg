import { TILE, WORLD_SCALE, WELL, STOVE } from '../config.js';
import { houses, propAt, tileAt } from '../world/map.js';
import { hash } from '../world/random.js';
import { canvas, ellipse, rect } from '../graphics/drawing.js';
import { terrain } from '../graphics/terrain.js';
import { makeProp, houseSprite } from '../graphics/scenery.js';
import { drawAvatar } from '../graphics/character.js';
import { drawStove } from '../graphics/stove.js';
import { drawOrc, drawOrcCorpse } from '../graphics/orc.js';
import { drawGroundItem } from '../graphics/ground-items.js';
import { drawTempleFloor, templeObjects, drawFountain } from '../graphics/temple.js';
import { drawElemental, drawElementalCorpse } from '../graphics/elemental.js';
import { townObjects } from '../graphics/town.js';
import { TOWN_POINTS } from './town-rules.js';
import { floorOf } from '../world/elevation.js';
import { elevationObjects } from '../graphics/elevation.js';
import { decorationAt } from '../world/decorations.js';
import { drawDecoration } from '../graphics/decorations.js';
import { treeStyleAt } from '../world/vegetation.js';

// Desenha o mundo em pixels inteiros e só depois o apresenta no canvas visível.
// Textos de interface NÃO passam por esta ampliação; o nome usa HTML/CSS.
export class WorldRenderer {
  constructor(target) {
    this.canvas = target;
    this.output = target.getContext('2d', { alpha: false });
    this.scene = canvas(1, 1);
    this.ctx = this.scene.getContext('2d', { alpha: false });
    this.camera = { x: 0, y: 0 };
    this.floor = 0;
    this.scale = WORLD_SCALE;
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(target);
  }

  setZoom(scale) {
    this.scale = Math.max(1, Math.min(4, Math.round(scale)));
    this.resize();
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = box.width;
    this.cssHeight = box.height;
    this.canvas.width = Math.max(1, Math.round(box.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(box.height * this.dpr));
    this.width = this.scene.width = Math.max(1, Math.ceil(box.width / this.scale));
    this.height = this.scene.height = Math.max(1, Math.ceil(box.height / this.scale));
    this.ctx.imageSmoothingEnabled = false;
    this.output.imageSmoothingEnabled = false;
  }

  drawTerrain(time) {
    const { ctx, camera, bounds } = this;
    for (let y = bounds.top; y <= bounds.bottom; y++)
      for (let x = bounds.left; x <= bounds.right; x++) {
        const px = x * TILE - camera.x,
          py = y * TILE - camera.y;
        ctx.drawImage(terrain(x, y, this.floor), px, py);
        if (this.floor === 1 && tileAt(x, y, 1) !== 'void') {
          if (tileAt(x, y - 1, 1) === 'void') rect(ctx, '#bbb28b', px, py, 32, 2);
          if (tileAt(x, y + 1, 1) === 'void') rect(ctx, '#444c45', px, py + 29, 32, 3);
          if (tileAt(x - 1, y, 1) === 'void') rect(ctx, '#9b9e83', px, py, 2, 32);
          if (tileAt(x + 1, y, 1) === 'void') rect(ctx, '#444c45', px + 29, py, 3, 32);
        }
        if (tileAt(x, y, this.floor) === 'water' && hash(x, y, 71) > 0.65) {
          rect(ctx, '#87b5a455', px + 5 + (Math.floor(time / 800 + x + y) % 6), py + 11, 7, 1);
        }
      }
    if (this.floor === 0)
      for (const house of houses.filter((house) => house.interior))
        ctx.drawImage(
          houseSprite(house),
          house.x * TILE - camera.x - 8,
          house.y * TILE - camera.y - 40,
        );
  }

  sceneryObjects(time) {
    if (this.floor !== 0) return [];
    const { ctx, camera, bounds } = this,
      objects = [];
    for (let y = bounds.top; y <= bounds.bottom; y++)
      for (let x = bounds.left; x <= bounds.right; x++) {
        const type = propAt(x, y);
        if (!type) continue;
        objects.push({
          depth: y * TILE + 29,
          draw: () => {
            const px = x * TILE - camera.x - 24,
              py = y * TILE - camera.y - 58;
            ctx.drawImage(makeProp(type, Math.floor(hash(x, y, 9) * 3), treeStyleAt(x, y)), px, py);
            if (type === 'lamp') {
              const glow = ctx.createRadialGradient(px + 40, py + 53, 0, px + 40, py + 53, 29);
              glow.addColorStop(0, '#edd17830');
              glow.addColorStop(1, '#edd17800');
              ctx.fillStyle = glow;
              ctx.fillRect(px + 10, py + 24, 60, 60);
            }
          },
        });
      }
    for (const house of houses.filter((house) => !house.interior))
      objects.push({
        depth: house.interior ? house.y * TILE - 1 : (house.y + house.h) * TILE,
        draw: () => {
          ctx.drawImage(
            houseSprite(house),
            house.x * TILE - camera.x - 8,
            house.y * TILE - camera.y - 40,
          );
          if (house.interior) return;
          const smokeX = (house.x + house.w) * TILE - 32 - camera.x,
            smokeY = house.y * TILE - camera.y - 42;
          for (let i = 0; i < 3; i++) {
            const phase = (time / 1100 + i * 0.8) % 3;
            ellipse(
              ctx,
              `rgba(193,192,161,${0.11 * (1 - phase / 3)})`,
              smokeX + Math.sin(phase + i) * 5,
              smokeY - phase * 14,
              3 + phase * 2,
              2 + phase,
            );
          }
        },
      });
    objects.push(...templeObjects(ctx, camera));
    objects.push(...elevationObjects(ctx, camera, time, this.floor));
    objects.push(...townObjects(ctx, camera, time));
    objects.push({
      depth: WELL.y * TILE + 27,
      draw: () => drawFountain(ctx, WELL.x * TILE - camera.x, WELL.y * TILE - camera.y, time),
    });
    objects.push({
      depth: STOVE.y * TILE + 29,
      draw: () => drawStove(ctx, STOVE.x * TILE - camera.x, STOVE.y * TILE - camera.y, time),
    });
    return objects;
  }

  screenToTile(clientX, clientY) {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - box.left) / this.scale + this.camera.x) / TILE),
      y: Math.floor(((clientY - box.top) / this.scale + this.camera.y) / TILE),
      z: this.floor,
    };
  }

  worldToScreen(x, y) {
    return {
      x: (x * TILE + 16 - this.camera.x) * this.scale,
      y: (y * TILE + 16 - this.camera.y) * this.scale,
    };
  }

  objectAt(clientX, clientY) {
    if (this.floor !== 0) return null;
    const box = this.canvas.getBoundingClientRect(),
      x = clientX - box.left,
      y = clientY - box.top;
    for (const [name, position, halfWidth, above] of [
      ['fountain', WELL, 44, 116],
      ['stove', STOVE, 32, 92],
      ...Object.values(TOWN_POINTS).map((point) => [`town:${point.id}`, point, 30, 76]),
    ]) {
      const point = this.worldToScreen(position.x, position.y);
      const factor = this.scale / WORLD_SCALE;
      if (
        Math.abs(x - point.x) <= halfWidth * factor &&
        y >= point.y - above * factor &&
        y <= point.y + 30 * factor
      )
        return name;
    }
    return null;
  }

  render(center, player, time = 0, world = {}) {
    this.floor = floorOf(center);
    if (this.dpr !== (window.devicePixelRatio || 1)) this.resize();
    const { ctx, width, height } = this;
    this.camera = {
      x: Math.round(center.x * TILE + TILE / 2 - this.cssWidth / this.scale / 2),
      y: Math.round(center.y * TILE + TILE / 2 - this.cssHeight / this.scale / 2),
    };
    const { x: cx, y: cy } = this.camera;
    this.bounds = {
      left: Math.floor(cx / TILE) - 2,
      top: Math.floor(cy / TILE) - 3,
      right: Math.ceil((cx + width) / TILE) + 2,
      bottom: Math.ceil((cy + height) / TILE) + 3,
    };
    this.drawTerrain(time);
    if (this.floor === 0) drawTempleFloor(ctx, this.camera);
    for (const corpse of world.corpses || (world.corpse ? [world.corpse] : [])) {
      if (floorOf(corpse) !== this.floor) continue;
      const draw = corpse.kind === 'fire' || corpse.kind === 'water' ? drawElementalCorpse : null;
      if (draw) draw(ctx, corpse, corpse.x * TILE + 16 - cx, corpse.y * TILE + 25 - cy);
      else drawOrcCorpse(ctx, corpse.x * TILE + 16 - cx, corpse.y * TILE + 25 - cy);
    }
    for (const item of world.groundItems || [])
      if (floorOf(item) === this.floor)
        drawGroundItem(ctx, item, item.x * TILE + 16 - cx, item.y * TILE + 25 - cy);
    const objects = this.sceneryObjects(time);
    for (let y = this.bounds.top; y <= this.bounds.bottom; y++)
      for (let x = this.bounds.left; x <= this.bounds.right; x++) {
        const decoration = decorationAt(x, y, this.floor);
        if (decoration)
          objects.push({
            depth: y * TILE + 26,
            draw: () => drawDecoration(ctx, decoration, x * TILE - cx, y * TILE - cy, time),
          });
      }
    let playerScreen = null;
    if (player) {
      const x = Math.round(player.x * TILE + 16 - cx),
        y = Math.round(player.y * TILE + 27 - cy);
      playerScreen = { x: x * this.scale, y: (y - 40) * this.scale };
      objects.push({
        depth: player.y * TILE + 27,
        draw: () => {
          ellipse(ctx, '#15201e77', x, y + 1, 9, 3);
          drawAvatar(ctx, player.outfit, player.direction, x, y, 1, player.step);
        },
      });
    }
    if (playerScreen) playerScreen.mobs = {};
    for (const orc of world.mobs || (world.orc ? [world.orc] : [])) {
      if (orc.health <= 0 || floorOf(orc) !== this.floor) continue;
      const x = Math.round(orc.x * TILE + 16 - cx),
        y = Math.round(orc.y * TILE + 27 - cy);
      objects.push({
        depth: orc.y * TILE + 27,
        draw: () => {
          if (orc.targeted) {
            ctx.strokeStyle = '#db6753';
            ctx.strokeRect(
              Math.round(orc.x * TILE - cx) + 1,
              Math.round(orc.y * TILE - cy) + 1,
              30,
              30,
            );
          }
          if (orc.kind === 'fire' || orc.kind === 'water') drawElemental(ctx, orc, x, y, time);
          else drawOrc(ctx, orc, x, y, time);
        },
      });
      if (playerScreen)
        playerScreen.mobs[orc.id || 'orc'] = {
          x:
            x * this.scale +
            (player &&
            Math.abs(orc.x - player.x) < 0.75 &&
            orc.y - player.y > 0.25 &&
            orc.y - player.y < 1.6
              ? 120
              : 0),
          y: (y - 43) * this.scale,
          visible: x > -20 && x < width + 20 && y > 0 && y < height + 50,
        };
    }
    if (world.dropPreview) {
      const point = world.dropPreview;
      ctx.fillStyle = point.valid ? '#7ab66d66' : '#da4f4f66';
      ctx.fillRect(point.x * TILE - cx, point.y * TILE - cy, TILE, TILE);
    }
    // Objetos abaixo do jogador são desenhados na frente dele (profundidade).
    objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.draw());
    const scale = this.scale * this.dpr;
    this.output.drawImage(this.scene, 0, 0, this.width * scale, this.height * scale);
    return playerScreen;
  }
}
