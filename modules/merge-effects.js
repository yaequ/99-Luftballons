const MERGE_EFFECT_DURATION = 1.05;

function updateMergeEffect(tower, deltaTime) {
  if (tower.mergeEffectAge === undefined) return;
  tower.mergeEffectAge += deltaTime;
  if (tower.mergeEffectAge >= MERGE_EFFECT_DURATION) delete tower.mergeEffectAge;
}

function drawMergeEffect(ctx, tower, reducedMotion = false) {
  if (tower.mergeEffectAge === undefined) return;
  const progress = Math.min(1, tower.mergeEffectAge / MERGE_EFFECT_DURATION);
  const fade = 1 - progress;
  const spread = reducedMotion ? 0 : 1 - Math.pow(fade, 3);
  const color = tower.level === 3 ? '#9df5ff' : '#ffe58a';
  const x = tower.x;
  const y = tower.y - 5;

  ctx.save();
  ctx.globalAlpha = fade;
  // Soft concentric light keeps the character readable without resizing it.
  ctx.fillStyle = color;
  for (let radius = 20; radius >= 8; radius -= 4) {
    ctx.globalAlpha = fade * 0.055;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, tower.y + 7, 8 + spread * 17, 3 + spread * 6, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (!reducedMotion) {
    for (let index = 0; index < 10; index += 1) {
      const angle = index * Math.PI * 2 / 10;
      const radius = 9 + spread * (12 + (index % 3) * 3);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius * 0.65 - progress * 11;
      ctx.fillStyle = index % 2 ? '#ffffff' : color;
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 2, 2, 4);
      ctx.fillRect(Math.round(px) - 2, Math.round(py) - 1, 4, 2);
    }
  }

  ctx.globalAlpha = Math.min(1, fade * 2);
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#183136';
  ctx.fillStyle = '#fff4bd';
  const text = `STUFE ${tower.level}!`;
  const textX = Math.max(24, Math.min(296, x));
  const textY = Math.max(10, tower.y - 22 - (reducedMotion ? 0 : progress * 9));
  ctx.strokeText(text, textX, textY);
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

export { MERGE_EFFECT_DURATION, updateMergeEffect, drawMergeEffect };
