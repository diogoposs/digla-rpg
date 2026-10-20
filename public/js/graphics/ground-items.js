import { ITEMS } from '../items.js';
const images = new Map();
export function drawGroundItem(ctx, item, x, y) {
  let image = images.get(item.itemId);
  if (!image) {
    image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ITEMS[item.itemId].icon);
    images.set(item.itemId, image);
  }
  if (image.complete && image.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, Math.round(x - 12), Math.round(y - 19), 24, 24);
  }
}
