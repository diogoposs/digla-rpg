export function drawAdventureGround(ctx, camera, floor) {
  if (floor !== -1) return;
  const x = 84 * 32 - camera.x,
    y = 14 * 32 - camera.y;
  ctx.fillStyle = '#4c2d2d';
  ctx.fillRect(x, y, 160, 160);
  ctx.strokeStyle = '#bd9652';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, 154, 154);
  ctx.strokeStyle = '#825c38';
  ctx.strokeRect(x + 10, y + 10, 140, 140);
  ctx.fillStyle = '#aa8246';
  ctx.fillRect(x + 65, y + 50, 30, 50);
  ctx.fillRect(x + 50, y + 65, 60, 20);
}
export function decorateOrc(ctx, mob, x, y) {
  if (mob.variant === 'commander') {
    ctx.fillStyle = '#b58f43';
    ctx.fillRect(x - 12, y - 23, 24, 8);
    ctx.fillStyle = '#e4c971';
    ctx.fillRect(x - 8, y - 34, 16, 5);
    ctx.fillRect(x - 8, y - 38, 3, 5);
    ctx.fillRect(x - 1, y - 40, 3, 7);
    ctx.fillRect(x + 5, y - 38, 3, 5);
    ctx.fillStyle = '#c75039';
    ctx.fillRect(x - 14, y - 18, 5, 15);
    ctx.fillRect(x + 9, y - 18, 5, 15);
  } else if (mob.variant === 'archer') {
    ctx.strokeStyle = '#c29b61';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 12, y - 14, 5, 12, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = '#d8d6ac';
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 26);
    ctx.lineTo(x + 12, y - 2);
    ctx.stroke();
  } else if (mob.variant === 'shaman') {
    ctx.fillStyle = '#62528d';
    ctx.fillRect(x - 10, y - 32, 20, 8);
    ctx.fillStyle = '#97764a';
    ctx.fillRect(x + 13, y - 29, 2, 28);
    ctx.fillStyle = '#bc80ed';
    ctx.fillRect(x + 11, y - 34, 6, 6);
  } else if (mob.variant === 'defender') {
    ctx.fillStyle = '#344452';
    ctx.fillRect(x + 7, y - 23, 13, 18);
    ctx.strokeStyle = '#aec3ce';
    ctx.strokeRect(x + 7, y - 23, 13, 18);
    ctx.fillStyle = '#c7a75e';
    ctx.fillRect(x + 12, y - 20, 3, 12);
  }
}
