import { CONFIG } from './config.js';
import { ASSETS } from './assets.js';
import { buildZonesForMap, canBuildAt } from './building.js';
function createRenderer(getState, mousePos) {
  function prepareContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(CONFIG.RENDER_SCALE, 0, 0, CONFIG.RENDER_SCALE, 0, 0);
  }

  function renderSide(ctx, side, isPlayerSide) {
    prepareContext(ctx);

    if (side.map.image.complete && side.map.image.naturalWidth > 0) {
      ctx.drawImage(
        side.map.image,
        0,
        side.map.hudCrop,
        side.map.image.naturalWidth,
        side.map.image.naturalHeight - side.map.hudCrop,
        0,
        0,
        CONFIG.CANVAS_WIDTH,
        CONFIG.CANVAS_HEIGHT
      );
    } else {
      ctx.fillStyle = '#222831';
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    if (isPlayerSide && getState().selectedTowerType) {
      ctx.save();
      ctx.strokeStyle = 'rgba(143, 242, 194, 0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      buildZonesForMap(side.map).forEach((zone) => ctx.strokeRect(zone.x, zone.y, zone.w, zone.h));
      ctx.restore();
    }

    side.towers.forEach((tower) => drawTower(ctx, tower));

    side.projectiles.forEach((projectile) => {
      ctx.strokeStyle = projectile.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(projectile.x, projectile.y);
      ctx.lineTo(projectile.targetX, projectile.targetY);
      ctx.stroke();
    });

    side.balloons.forEach((balloon) => {
      if (balloon.type === 'boss') drawBossSprite(ctx, balloon.x, balloon.y, balloon.renderSize);
      else drawBalloonSprite(ctx, balloon.type, 0, balloon.x, balloon.y, balloon.renderSize);
    });

    side.pops.forEach((pop) => {
      const progress = pop.age / pop.duration;
      const count = ASSETS.balloons[pop.type].length;
      const frame = Math.min(count - 1, 1 + Math.floor(progress * (count - 1)));
      drawBalloonSprite(ctx, pop.type, frame, pop.x, pop.y, pop.size);
    });

    if (isPlayerSide && getState().selectedTowerType && mousePos.onCanvas) {
      renderBuildPreview(ctx);
    }
    if (isPlayerSide && getState().selectedTowerType && getState().buildCursor.active) renderKeyboardBuildCursor(ctx);
  }

  function drawBossSprite(ctx, x, y, size) {
    const image = ASSETS.boss;
    if (!image.naturalWidth) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    ctx.drawImage(image, x - (size * ratio) / 2, y - size / 2, size * ratio, size);
  }

  function drawBalloonSprite(ctx, type, frame, x, y, size) {
    const frames = ASSETS.balloons[type];
    if (!frames) return;
    const image = frames[frame];
    // All phases use the intact balloon's scale, so fragments never grow to fill a cell.
    const scale = size / frames[0].naturalHeight;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, x - width / 2, y - size / 2, width, height);
  }

  function drawTower(ctx, tower, alpha = 1) {
    const frames = ASSETS.characters[tower.type];
    const image = frames[tower.frameIndex] || frames[0];
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return;
    const renderHeight = CONFIG.CHARACTER_RENDER.HEIGHT;
    const renderWidth = Math.min(
      CONFIG.CHARACTER_RENDER.MAX_WIDTH,
      renderHeight * (imageWidth / imageHeight)
    );

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      tower.x - renderWidth / 2,
      tower.y - renderHeight / 2 - 4,
      renderWidth,
      renderHeight
    );
    ctx.restore();
  }

  function renderBuildPreview(ctx) {
    const type = getState().selectedTowerType;
    const towerData = CONFIG.TOWERS[type];
    const allowed = canBuildAt(getState().player, type, mousePos.x, mousePos.y) === true;
    ctx.strokeStyle = allowed ? 'rgba(143, 242, 194, 0.95)' : 'rgba(239, 102, 107, 0.95)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, towerData.range, 0, Math.PI * 2);
    ctx.stroke();
    drawTower(ctx, { type, frameIndex: 0, x: mousePos.x, y: mousePos.y }, 0.58);
  }

  function renderKeyboardBuildCursor(ctx) {
    const { x, y } = getState().buildCursor;
    const type = getState().selectedTowerType;
    const allowed = canBuildAt(getState().player, type, x, y) === true;
    ctx.save();
    ctx.strokeStyle = allowed ? '#8ff2c2' : '#ef666b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 6, 12, 12);
    ctx.restore();
    drawTower(ctx, { type, frameIndex: 0, x, y }, 0.7);
  }

  function renderTowerPortraits() {
    document.querySelectorAll('[data-portrait]').forEach((canvas) => {
      const type = canvas.dataset.portrait;
      const image = ASSETS.characters[type][0];
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      if (!imageWidth || !imageHeight) return;

      const ctx = canvas.getContext('2d');
      const scale = Math.min(canvas.width / imageWidth, canvas.height / imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height
      );
    });
  }

  function renderBalloonPortraits() {
    document.querySelectorAll('[data-balloon-portrait]').forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBalloonSprite(ctx, canvas.dataset.balloonPortrait, 0,
        canvas.width / 2, canvas.height / 2, canvas.height - 4);
    });
  }

  return { renderSide, renderTowerPortraits, renderBalloonPortraits };
}

export { createRenderer };
