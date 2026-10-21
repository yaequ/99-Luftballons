import { CONFIG } from './ai-config.js';
import { ASSETS, towerImage } from './ai-assets.js';
import { buildZonesForMap } from './ai-building.js';
import { canMergeTowers } from './towers.js';
import { drawMergeEffect } from './merge-effects.js';
function createRenderer(getState, mousePos, getTowerInteraction = () => ({})) {
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

    const interaction = isPlayerSide ? getTowerInteraction() : {};
    const drag = interaction.drag?.active ? interaction.drag : null;
    if (isPlayerSide && (getState().selectedTowerType || drag)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(143, 242, 194, 0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      buildZonesForMap(side.map).forEach((zone) => ctx.strokeRect(zone.x, zone.y, zone.w, zone.h));
      ctx.restore();
    }

    side.towers.forEach((tower) => {
      drawTower(ctx, tower, drag?.source === tower ? 0.3 : 1);
      if (isPlayerSide) drawLevel(ctx, tower);
    });

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

    if (isPlayerSide && interaction.placement) renderPlacementPreview(ctx, interaction.placement);
    if (isPlayerSide) renderTowerInteraction(ctx, side, interaction, drag);
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    side.towers.forEach((tower) => drawMergeEffect(ctx, tower, reducedMotion));
  }

  function drawLevel(ctx, tower) {
    ctx.save();
    ctx.fillStyle = '#183136';
    ctx.fillRect(tower.x + 3, tower.y + 3, 10, 10);
    ctx.fillStyle = '#fff8dc';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tower.level), tower.x + 8, tower.y + 8);
    ctx.restore();
  }

  function renderTowerInteraction(ctx, side, interaction, drag) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const tower of side.towers) {
      const compatible = drag && canMergeTowers(drag.source, tower);
      if (!compatible && tower !== interaction.selected && tower !== interaction.hovered && tower !== drag?.target) continue;
      ctx.strokeStyle = tower === drag?.target && !compatible ? '#f25656' : compatible ? '#8ff2c2'
        : tower === interaction.hovered ? '#7edcff' : '#ffe7a3';
      ctx.lineWidth = tower === drag?.target ? 2 : 1;
      ctx.strokeRect(tower.x - 13, tower.y - 20, 26, 34);
      if (compatible) {
        ctx.fillStyle = '#183136';
        ctx.fillRect(tower.x - 12, tower.y - 20, 9, 9);
        ctx.fillStyle = '#8ff2c2';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('+', tower.x - 10, tower.y - 12);
      }
    }
    if (drag) {
      const allowed = drag.result === 'move' || drag.result === 'merge';
      ctx.strokeStyle = allowed ? '#8ff2c2' : '#f25656';
      const x = drag.result === 'merge' ? drag.target.x : drag.x;
      const y = drag.result === 'merge' ? drag.target.y : drag.y;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 7, y - 7, 14, 14);
      const ghost = { ...drag.source, x, y, level: drag.result === 'merge' ? drag.source.level + 1 : drag.source.level };
      drawTower(ctx, ghost, 0.65);
      drawLevel(ctx, ghost);
    }
    ctx.restore();
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
    const image = towerImage(tower);
    const [sourceX, sourceY, imageWidth, imageHeight] = image.spriteBounds
      || [0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height];
    if (!imageWidth || !imageHeight) return;
    const layout = tower.level >= 2 ? CONFIG.CHARACTER_RENDER.UPGRADE_LAYOUT[tower.type] : null;
    const renderHeight = CONFIG.CHARACTER_RENDER.HEIGHT * (layout?.height ?? 1);
    const offsetY = CONFIG.CHARACTER_RENDER.HEIGHT * (layout?.centerY ?? 0);
    const renderWidth = Math.min(
      CONFIG.CHARACTER_RENDER.MAX_WIDTH,
      renderHeight * (imageWidth / imageHeight)
    );

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      sourceX, sourceY, imageWidth, imageHeight,
      tower.x - renderWidth / 2,
      tower.y - renderHeight / 2 - 4 + offsetY,
      renderWidth,
      renderHeight
    );
    ctx.restore();
  }

  function renderPlacementPreview(ctx, placement) {
    const { type, target, result } = placement;
    const merging = result === 'merge';
    const allowed = merging || result === 'build';
    const x = target ? target.x : placement.x;
    const y = target ? target.y : placement.y;
    ctx.save();
    ctx.strokeStyle = allowed ? '#8ff2c2' : '#ef666b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.TOWERS[type].range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    if (target) ctx.strokeRect(x - 13, y - 20, 26, 34);
    else ctx.strokeRect(x - 6, y - 6, 12, 12);
    const ghost = { type, frameIndex: target?.frameIndex || 0, x, y, level: merging ? target.level + 1 : 1 };
    drawTower(ctx, ghost, 0.65);
    drawLevel(ctx, ghost);
    if (merging) {
      const text = `Zu Stufe ${target.level + 1} verschmelzen`;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const width = ctx.measureText(text).width + 8;
      const left = Math.max(1, Math.min(CONFIG.CANVAS_WIDTH - width - 1, x - width / 2));
      const top = Math.max(1, y - 34);
      ctx.fillStyle = '#183136';
      ctx.fillRect(left, top, width, 12);
      ctx.fillStyle = '#8ff2c2';
      ctx.fillText(text, left + 4, top + 2);
    }
    ctx.restore();
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
