/* 99 LUFTBALLONS – Vanilla HTML5 Canvas Tower Defense */

function imageAsset(src) {
  const image = new Image();
  image.src = src;
  return image;
}

const ASSETS = {
  maps: {
    frost: imageAsset('Optional/image2.png'),
    woodland: imageAsset('Grafik.png')
  },
  characters: {
    cactus: imageAsset('Charaktere/Kaktus/turnaround.png'),
    fan: imageAsset('Charaktere/Geblaese/turnaround.png'),
    lens: imageAsset('Charaktere/Lupe/turnaround.png')
  },
  balloonSheet: imageAsset('Balloons/balloons-spritesheet.png')
};

const CLEAN_SHEETS = {};
let cleanBalloonSheet = null;

const CONFIG = {
  CANVAS_WIDTH: 320,
  CANVAS_HEIGHT: 240,
  RENDER_SCALE: 3,
  GRID_SIZE: 8,
  FIXED_STEP: 1 / 60,
  MAX_FRAME_DELTA: 0.1,
  WAVES: 15,
  CHAR_SHEET: { COLS: 5, ROWS: 2, RENDER_SIZE: 22 },
  BALLOON_SHEET: { COLS: 8, ROWS: 8, CELL_PADDING: 2, RENDER_SIZE: 18 },
  TOWERS: {
    cactus: { name: 'Kaktus', cost: 25, range: 45, damage: 1, fireRate: 0.58, color: '#43d17d', cropTop: 25 },
    fan: { name: 'Gebläse', cost: 45, range: 55, damage: 0.5, fireRate: 0.34, color: '#70a1ff', cropTop: 0 },
    lens: { name: 'Lupe', cost: 70, range: 65, damage: 3, fireRate: 1, color: '#f1b94d', cropTop: 28 }
  },
  BALLOONS: {
    red: { name: 'Rot', cost: 10, income: 1, hp: 1, speed: 60, spriteColumn: 0, popRow: 2 },
    blue: { name: 'Blau', cost: 25, income: 2, hp: 2, speed: 84, spriteColumn: 1, popRow: 3 },
    green: { name: 'Grün', cost: 45, income: 4, hp: 4, speed: 68, spriteColumn: 2, popRow: 4 },
    yellow: { name: 'Gelb', cost: 70, income: 7, hp: 7, speed: 48, spriteColumn: 3, popRow: 5 }
  }
};

const BUILD_ZONES = [
  { x: 94, y: 31, w: 70, h: 21 },
  { x: 61, y: 76, w: 75, h: 22 },
  { x: 212, y: 76, w: 47, h: 22 },
  { x: 18, y: 108, w: 24, h: 52 },
  { x: 162, y: 120, w: 84, h: 22 },
  { x: 282, y: 81, w: 25, h: 65 },
  { x: 64, y: 165, w: 89, h: 24 },
  { x: 184, y: 162, w: 50, h: 46 }
];

const FROST_PATH = [
  { x: 34, y: 47 }, { x: 34, y: 65 }, { x: 158, y: 65 },
  { x: 168, y: 106 }, { x: 112, y: 111 }, { x: 54, y: 151 },
  { x: 70, y: 192 }, { x: 154, y: 197 }, { x: 190, y: 216 },
  { x: 235, y: 204 }
];

const WOODLAND_PATHS = {
  left: [
    { x: 33, y: 52 }, { x: 33, y: 65 }, { x: 164, y: 65 },
    { x: 164, y: 120 }, { x: 55, y: 120 }, { x: 48, y: 185 },
    { x: 164, y: 185 }, { x: 236, y: 145 }, { x: 236, y: 200 }
  ],
  right: [
    { x: 33, y: 52 }, { x: 33, y: 65 }, { x: 164, y: 65 },
    { x: 204, y: 65 }, { x: 275, y: 75 }, { x: 275, y: 145 },
    { x: 236, y: 145 }, { x: 236, y: 200 }
  ]
};

const MAP_DATA = {
  frost: { id: 'frost', name: 'Frostpfad', image: ASSETS.maps.frost, hudCrop: 53, logicalCrop: 12, paths: [FROST_PATH] },
  woodland: { id: 'woodland', name: 'Waldweg', image: ASSETS.maps.woodland, hudCrop: 38, logicalCrop: 12, paths: [WOODLAND_PATHS.left, WOODLAND_PATHS.right] }
};

const screens = {
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game')
};

const ui = {
  mapName: document.getElementById('map-name'),
  wave: document.getElementById('wave-counter'),
  p1Hp: document.getElementById('p1-hp'),
  p1Gold: document.getElementById('p1-gold'),
  p1Income: document.getElementById('p1-income'),
  p2Hp: document.getElementById('p2-hp'),
  timer: document.getElementById('match-timer'),
  lobbyStatus: document.getElementById('lobby-status'),
  mapTip: document.getElementById('map-tip'),
  toast: document.getElementById('game-toast'),
  modalGameOver: document.getElementById('modal-gameover'),
  gameOverTitle: document.getElementById('gameover-title'),
  gameOverMessage: document.getElementById('gameover-message'),
  viewPlayer: document.getElementById('btn-view-player'),
  viewEnemy: document.getElementById('btn-view-enemy'),
  toggleControls: document.getElementById('btn-toggle-controls')
};

const gameFrame = document.querySelector('.game-frame');
const canvasPlayer = document.getElementById('canvas-player');
const canvasEnemy = document.getElementById('canvas-enemy');
const ctxPlayer = canvasPlayer.getContext('2d');
const ctxEnemy = canvasEnemy.getContext('2d');

let mousePos = { x: 0, y: 0, onCanvas: false };
let animationFrameId = 0;
let lastFrameTime = 0;
let accumulator = 0;
let toastTimer = 0;
let startPending = false;

let gameState = createInitialState();

function createSide(map, includeGold = false) {
  return {
    map,
    hp: 99,
    gold: includeGold ? 100 : 0,
    income: 10,
    towers: [],
    balloons: [],
    projectiles: [],
    pops: []
  };
}

function createInitialState() {
  return {
    active: false,
    secondsElapsed: 0,
    economyClock: 0,
    selectedTowerType: null,
    visibleSide: 'player',
    player: createSide(MAP_DATA.frost, true),
    enemy: createSide(MAP_DATA.woodland, false)
  };
}

function whenImageReady(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
}

const assetsReady = Promise.all([
  ...Object.values(ASSETS.maps),
  ...Object.values(ASSETS.characters),
  ASSETS.balloonSheet
].map(whenImageReady)).then(() => {
  prepareCharacterSheets();
  prepareBalloonSheet();
  renderTowerPortraits();
  renderBalloonPortraits();
});

document.getElementById('btn-quick-match').addEventListener('click', () => startGame());

document.getElementById('btn-create-room').addEventListener('click', () => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  ui.lobbyStatus.textContent = `Raum ${code} erstellt – lokale Vorschau startet …`;
  window.setTimeout(() => startGame(), 800);
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('input-room-code').value.trim().toUpperCase();
  if (code.length < 3) {
    ui.lobbyStatus.textContent = 'Bitte mindestens drei Zeichen als Raumcode eingeben.';
    return;
  }
  ui.lobbyStatus.textContent = `Raum ${code} gefunden – lokale Vorschau startet …`;
  window.setTimeout(() => startGame(), 500);
});

document.getElementById('btn-return-lobby').addEventListener('click', resetToLobby);
ui.viewPlayer.addEventListener('click', () => setMapView('player'));
ui.viewEnemy.addEventListener('click', () => setMapView('enemy'));
ui.toggleControls.addEventListener('click', () => {
  setControlsExpanded(gameFrame.classList.contains('controls-collapsed'));
});

document.querySelectorAll('.build-btn').forEach((button) => {
  button.addEventListener('click', () => selectTower(button.dataset.tower));
});

document.querySelectorAll('.send-btn').forEach((button) => {
  button.addEventListener('click', () => sendBalloonToEnemy(button.dataset.balloon));
});

canvasPlayer.addEventListener('pointermove', (event) => {
  updatePointerPosition(event);
});

canvasPlayer.addEventListener('pointerleave', () => {
  mousePos.onCanvas = false;
});

canvasPlayer.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  updatePointerPosition(event);
  placeSelectedTower();
});

document.addEventListener('visibilitychange', () => {
  lastFrameTime = performance.now();
  accumulator = 0;
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'i' || event.target.matches('input, textarea')) return;
  setControlsExpanded(gameFrame.classList.contains('controls-collapsed'));
});

function updatePointerPosition(event) {
  const rect = canvasPlayer.getBoundingClientRect();
  const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
  const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;
  mousePos.x = Math.floor(((event.clientX - rect.left) * scaleX) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePos.y = Math.floor(((event.clientY - rect.top) * scaleY) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePos.onCanvas = true;
}

async function startGame() {
  if (startPending) return;
  startPending = true;
  ui.lobbyStatus.textContent = 'Karten und Charaktere werden geladen …';
  await assetsReady;

  cancelAnimationFrame(animationFrameId);
  gameState = createInitialState();
  gameState.active = true;

  tryBuildTower(gameState.enemy, 'cactus', 112, 76, true);
  tryBuildTower(gameState.enemy, 'fan', 220, 76, true);

  screens.lobby.classList.remove('active');
  screens.game.classList.add('active');
  ui.modalGameOver.classList.remove('active');
  setMapView('player');
  setControlsExpanded(true);
  clearTowerSelection();
  updateUI();

  lastFrameTime = performance.now();
  accumulator = 0;
  animationFrameId = requestAnimationFrame(gameLoop);
  startPending = false;
}

function resetToLobby() {
  gameState.active = false;
  cancelAnimationFrame(animationFrameId);
  ui.modalGameOver.classList.remove('active');
  screens.game.classList.remove('active');
  screens.lobby.classList.add('active');
  ui.lobbyStatus.textContent = 'Bereit für den Start.';
}

function setMapView(side) {
  gameState.visibleSide = side;
  const playerVisible = side === 'player';
  canvasPlayer.classList.toggle('active', playerVisible);
  canvasEnemy.classList.toggle('active', !playerVisible);
  ui.viewPlayer.classList.toggle('active', playerVisible);
  ui.viewEnemy.classList.toggle('active', !playerVisible);
  ui.viewPlayer.setAttribute('aria-pressed', String(playerVisible));
  ui.viewEnemy.setAttribute('aria-pressed', String(!playerVisible));
  ui.mapTip.hidden = !playerVisible;
  ui.mapName.textContent = playerVisible ? gameState.player.map.name : gameState.enemy.map.name;
}

function setControlsExpanded(expanded) {
  gameFrame.classList.toggle('controls-collapsed', !expanded);
  ui.toggleControls.setAttribute('aria-expanded', String(expanded));
  ui.toggleControls.textContent = expanded ? 'Interface ausblenden' : 'Interface einblenden';
}

function selectTower(type) {
  if (!gameState.active) return;
  if (gameState.visibleSide !== 'player') setMapView('player');
  gameState.selectedTowerType = gameState.selectedTowerType === type ? null : type;

  document.querySelectorAll('.build-btn').forEach((button) => {
    const selected = button.dataset.tower === gameState.selectedTowerType;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  ui.mapTip.querySelector('.map-tip__step').textContent = gameState.selectedTowerType ? '2' : '1';
  ui.mapTip.querySelector('span:last-child').textContent = gameState.selectedTowerType
    ? `${CONFIG.TOWERS[gameState.selectedTowerType].name} auf einer dunklen Baufläche platzieren.`
    : 'Turm wählen und auf einer dunklen Baufläche platzieren.';
}

function clearTowerSelection() {
  gameState.selectedTowerType = null;
  document.querySelectorAll('.build-btn').forEach((button) => {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });
  ui.mapTip.querySelector('.map-tip__step').textContent = '1';
  ui.mapTip.querySelector('span:last-child').textContent = 'Turm wählen und auf einer dunklen Baufläche platzieren.';
}

function placeSelectedTower() {
  if (!gameState.selectedTowerType || gameState.visibleSide !== 'player') return;
  const result = tryBuildTower(gameState.player, gameState.selectedTowerType, mousePos.x, mousePos.y);

  if (result === true) {
    showToast(`${CONFIG.TOWERS[gameState.selectedTowerType].name} gebaut.`);
    clearTowerSelection();
  } else if (result === 'zone') {
    showToast('Türme können nur auf dunklen Bauflächen stehen.');
  } else if (result === 'occupied') {
    showToast('Dieser Bauplatz ist bereits belegt.');
  } else if (result === 'gold') {
    showToast('Nicht genug Gold.');
  }
}

function mapY(map, y) {
  return ((y - map.logicalCrop) / (CONFIG.CANVAS_HEIGHT - map.logicalCrop)) * CONFIG.CANVAS_HEIGHT;
}

function buildZonesForMap(map) {
  return BUILD_ZONES.map((zone) => {
    const top = mapY(map, zone.y);
    const bottom = mapY(map, zone.y + zone.h);
    return { x: zone.x, y: top, w: zone.w, h: bottom - top };
  });
}

function pointInBuildZone(map, x, y) {
  return buildZonesForMap(map).some((zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h);
}

function canBuildAt(side, type, x, y, isFree = false) {
  const towerData = CONFIG.TOWERS[type];
  if (!isFree && gameState.player.gold < towerData.cost) return 'gold';
  if (!pointInBuildZone(side.map, x, y)) return 'zone';
  if (side.towers.some((tower) => Math.hypot(tower.x - x, tower.y - y) < CONFIG.GRID_SIZE * 1.5)) return 'occupied';
  return true;
}

function tryBuildTower(side, type, x, y, isFree = false) {
  const result = canBuildAt(side, type, x, y, isFree);
  if (result !== true) return result;

  const towerData = CONFIG.TOWERS[type];
  if (!isFree) gameState.player.gold -= towerData.cost;

  side.towers.push({
    x, y, type,
    range: towerData.range,
    damage: towerData.damage,
    fireRate: towerData.fireRate,
    cooldown: 0,
    color: towerData.color,
    frameIndex: 0
  });
  updateUI();
  return true;
}

function sendBalloonToEnemy(type) {
  if (!gameState.active) return;
  const balloonData = CONFIG.BALLOONS[type];
  if (gameState.player.gold < balloonData.cost) {
    showToast('Nicht genug Gold für diesen Ballon.');
    return;
  }

  gameState.player.gold -= balloonData.cost;
  gameState.player.income += balloonData.income;
  spawnBalloon(gameState.enemy, type);
  updateUI();
  showToast(`${balloonData.name}-Ballon gesendet · Einkommen +${balloonData.income}/s`);
}

function spawnBalloon(targetSide, type) {
  const balloonData = CONFIG.BALLOONS[type];
  const sourcePath = targetSide.map.paths[Math.floor(Math.random() * targetSide.map.paths.length)];
  const path = sourcePath.map((point) => ({ x: point.x, y: mapY(targetSide.map, point.y) }));
  targetSide.balloons.push({
    type,
    x: path[0].x,
    y: path[0].y,
    path,
    pathIndex: 0,
    hp: balloonData.hp,
    maxHp: balloonData.hp,
    speed: balloonData.speed,
    spriteColumn: balloonData.spriteColumn,
    popRow: balloonData.popRow
  });
}

function gameLoop(now) {
  if (!gameState.active) return;
  const frameDelta = Math.min((now - lastFrameTime) / 1000, CONFIG.MAX_FRAME_DELTA);
  lastFrameTime = now;
  accumulator += frameDelta;

  while (accumulator >= CONFIG.FIXED_STEP) {
    updateGame(CONFIG.FIXED_STEP);
    accumulator -= CONFIG.FIXED_STEP;
  }

  renderSide(ctxPlayer, gameState.player, true);
  renderSide(ctxEnemy, gameState.enemy, false);
  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateGame(deltaTime) {
  gameState.economyClock += deltaTime;
  while (gameState.economyClock >= 1) {
    gameState.economyClock -= 1;
    gameState.secondsElapsed += 1;
    gameState.player.gold += gameState.player.income;

    if (gameState.secondsElapsed % 3 === 0) {
      const availableTypes = gameState.secondsElapsed > 42
        ? ['red', 'blue', 'green', 'yellow']
        : gameState.secondsElapsed > 26
          ? ['red', 'blue', 'green']
          : gameState.secondsElapsed > 12
            ? ['red', 'blue']
            : ['red'];
      spawnBalloon(gameState.player, availableTypes[Math.floor(Math.random() * availableTypes.length)]);
    }
    updateUI();
  }

  updateSide(gameState.player, true, deltaTime);
  updateSide(gameState.enemy, false, deltaTime);
}

function updateSide(side, isPlayer, deltaTime) {
  for (let index = side.balloons.length - 1; index >= 0; index -= 1) {
    const balloon = side.balloons[index];
    const target = balloon.path[balloon.pathIndex + 1];

    if (!target) {
      side.hp = Math.max(0, side.hp - 1);
      side.balloons.splice(index, 1);
      updateUI();
      checkGameOver();
      continue;
    }

    const dx = target.x - balloon.x;
    const dy = target.y - balloon.y;
    const distance = Math.hypot(dx, dy);
    const travel = balloon.speed * deltaTime;

    if (distance <= travel) {
      balloon.x = target.x;
      balloon.y = target.y;
      balloon.pathIndex += 1;
    } else {
      balloon.x += (dx / distance) * travel;
      balloon.y += (dy / distance) * travel;
    }
  }

  side.towers.forEach((tower) => {
    tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
    const target = side.balloons.find((balloon) => Math.hypot(balloon.x - tower.x, balloon.y - tower.y) <= tower.range);
    if (!target) return;

    updateTowerDirection(tower, target);
    if (tower.cooldown > 0) return;

    side.projectiles.push({
      x: tower.x,
      y: tower.y - 4,
      targetX: target.x,
      targetY: target.y,
      targetRef: target,
      damage: tower.damage,
      color: tower.color,
      life: 0.08
    });
    tower.cooldown = tower.fireRate;
  });

  for (let index = side.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = side.projectiles[index];
    projectile.life -= deltaTime;
    if (projectile.life > 0) continue;

    if (side.balloons.includes(projectile.targetRef)) {
      projectile.targetRef.hp -= projectile.damage;
      if (projectile.targetRef.hp <= 0) {
        const balloonIndex = side.balloons.indexOf(projectile.targetRef);
        if (balloonIndex > -1) {
          side.pops.push({
            x: projectile.targetRef.x,
            y: projectile.targetRef.y,
            row: projectile.targetRef.popRow,
            age: 0,
            duration: 0.42
          });
          side.balloons.splice(balloonIndex, 1);
          if (isPlayer) {
            gameState.player.gold += 2;
            updateUI();
          }
        }
      }
    }
    side.projectiles.splice(index, 1);
  }

  for (let index = side.pops.length - 1; index >= 0; index -= 1) {
    side.pops[index].age += deltaTime;
    if (side.pops[index].age >= side.pops[index].duration) side.pops.splice(index, 1);
  }
}

function updateTowerDirection(tower, target) {
  const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  const degrees = (angle * (180 / Math.PI) + 90 + 360) % 360;
  if (degrees >= 337.5 || degrees < 22.5) tower.frameIndex = 4;
  else if (degrees < 67.5) tower.frameIndex = 3;
  else if (degrees < 112.5) tower.frameIndex = 2;
  else if (degrees < 157.5) tower.frameIndex = 1;
  else if (degrees < 202.5) tower.frameIndex = 0;
  else if (degrees < 247.5) tower.frameIndex = 8;
  else if (degrees < 292.5) tower.frameIndex = 7;
  else tower.frameIndex = 6;
}

function checkGameOver() {
  if (!gameState.active) return;
  if (gameState.player.hp <= 0) endGame('Niederlage', 'Deine Verteidigung wurde von den Ballons überwältigt.');
  else if (gameState.enemy.hp <= 0) endGame('Sieg', 'Der Gegner konnte deine Ballons nicht halten.');
}

function endGame(title, message) {
  gameState.active = false;
  cancelAnimationFrame(animationFrameId);
  ui.gameOverTitle.textContent = title;
  ui.gameOverMessage.textContent = message;
  ui.modalGameOver.classList.add('active');
  document.getElementById('btn-return-lobby').focus();
}

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

  if (isPlayerSide && gameState.selectedTowerType) {
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
    drawBalloonSprite(ctx, balloon.spriteColumn, 0, balloon.x, balloon.y, CONFIG.BALLOON_SHEET.RENDER_SIZE);
  });

  side.pops.forEach((pop) => {
    const progress = pop.age / pop.duration;
    const frame = Math.min(7, 2 + Math.floor(progress * 6));
    drawBalloonSprite(ctx, frame, pop.row, pop.x, pop.y, CONFIG.BALLOON_SHEET.RENDER_SIZE + 2);
  });

  if (isPlayerSide && gameState.selectedTowerType && mousePos.onCanvas && gameState.visibleSide === 'player') {
    renderBuildPreview(ctx);
  }
}

function drawBalloonSprite(ctx, column, row, x, y, size) {
  const image = cleanBalloonSheet || ASSETS.balloonSheet;
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) return;

  const cellWidth = imageWidth / CONFIG.BALLOON_SHEET.COLS;
  const cellHeight = imageHeight / CONFIG.BALLOON_SHEET.ROWS;
  const padding = CONFIG.BALLOON_SHEET.CELL_PADDING;
  ctx.drawImage(
    image,
    column * cellWidth + padding,
    row * cellHeight + padding,
    cellWidth - padding * 2,
    cellHeight - padding * 2,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}

function drawTower(ctx, tower, alpha = 1) {
  const image = CLEAN_SHEETS[tower.type] || ASSETS.characters[tower.type];
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) return;
  const towerData = CONFIG.TOWERS[tower.type];
  const frameWidth = imageWidth / CONFIG.CHAR_SHEET.COLS;
  const frameHeight = imageHeight / CONFIG.CHAR_SHEET.ROWS;
  const column = tower.frameIndex % CONFIG.CHAR_SHEET.COLS;
  const row = Math.floor(tower.frameIndex / CONFIG.CHAR_SHEET.COLS);
  const cropTop = towerData.cropTop;
  const size = CONFIG.CHAR_SHEET.RENDER_SIZE;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    image,
    column * frameWidth,
    row * frameHeight + cropTop,
    frameWidth,
    frameHeight - cropTop,
    tower.x - size / 2,
    tower.y - size / 2 - 4,
    size,
    size
  );
  ctx.restore();
}

function renderBuildPreview(ctx) {
  const type = gameState.selectedTowerType;
  const towerData = CONFIG.TOWERS[type];
  const allowed = canBuildAt(gameState.player, type, mousePos.x, mousePos.y) === true;
  ctx.strokeStyle = allowed ? 'rgba(143, 242, 194, 0.95)' : 'rgba(239, 102, 107, 0.95)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, towerData.range, 0, Math.PI * 2);
  ctx.stroke();
  drawTower(ctx, { type, frameIndex: 0, x: mousePos.x, y: mousePos.y }, 0.58);
}

function renderTowerPortraits() {
  document.querySelectorAll('[data-portrait]').forEach((canvas) => {
    const type = canvas.dataset.portrait;
    const image = CLEAN_SHEETS[type] || ASSETS.characters[type];
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return;

    const ctx = canvas.getContext('2d');
    const towerData = CONFIG.TOWERS[type];
    const frameWidth = imageWidth / CONFIG.CHAR_SHEET.COLS;
    const frameHeight = imageHeight / CONFIG.CHAR_SHEET.ROWS;
    const sourceHeight = frameHeight - towerData.cropTop;
    const scale = Math.min(canvas.width / frameWidth, canvas.height / sourceHeight);
    const width = frameWidth * scale;
    const height = sourceHeight * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      0,
      towerData.cropTop,
      frameWidth,
      sourceHeight,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );
  });
}

function prepareCharacterSheets() {
  Object.entries(ASSETS.characters).forEach(([type, image]) => {
    if (!image.complete || image.naturalWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    try {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const neutral = Math.max(red, green, blue) - Math.min(red, green, blue) < 9;
        const backgroundGray = red > 188 && red < 232;
        if (neutral && backgroundGray) data[index + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
      CLEAN_SHEETS[type] = canvas;
    } catch {
      CLEAN_SHEETS[type] = image;
    }
  });
}

function prepareBalloonSheet() {
  const image = ASSETS.balloonSheet;
  if (!image.complete || image.naturalWidth === 0) return;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  try {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    const cellWidth = canvas.width / CONFIG.BALLOON_SHEET.COLS;
    const sampleX = Math.floor(cellWidth * 4.5);
    const sampleY = Math.floor((canvas.height / CONFIG.BALLOON_SHEET.ROWS) * 0.5);
    const sampleIndex = (sampleY * canvas.width + sampleX) * 4;
    const keyRed = data[sampleIndex];
    const keyGreen = data[sampleIndex + 1];
    const keyBlue = data[sampleIndex + 2];

    for (let index = 0; index < data.length; index += 4) {
      const redDistance = data[index] - keyRed;
      const greenDistance = data[index + 1] - keyGreen;
      const blueDistance = data[index + 2] - keyBlue;
      const distanceSquared = redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2;
      if (distanceSquared < 750) data[index + 3] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
    cleanBalloonSheet = canvas;
  } catch {
    cleanBalloonSheet = image;
  }
}

function renderBalloonPortraits() {
  document.querySelectorAll('[data-balloon-portrait]').forEach((canvas) => {
    const type = canvas.dataset.balloonPortrait;
    const balloonData = CONFIG.BALLOONS[type];
    const image = cleanBalloonSheet || ASSETS.balloonSheet;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    if (!balloonData || !imageWidth || !imageHeight) return;

    const ctx = canvas.getContext('2d');
    const cellWidth = imageWidth / CONFIG.BALLOON_SHEET.COLS;
    const cellHeight = imageHeight / CONFIG.BALLOON_SHEET.ROWS;
    const padding = CONFIG.BALLOON_SHEET.CELL_PADDING;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      balloonData.spriteColumn * cellWidth + padding,
      padding,
      cellWidth - padding * 2,
      cellHeight - padding * 2,
      0,
      0,
      canvas.width,
      canvas.height
    );
  });
}

function updateUI() {
  ui.p1Hp.textContent = `${gameState.player.hp} HP`;
  ui.p1Gold.textContent = Math.floor(gameState.player.gold);
  ui.p1Income.textContent = `+${gameState.player.income}/s`;
  ui.p2Hp.textContent = `${gameState.enemy.hp} HP`;

  const wave = Math.min(CONFIG.WAVES, Math.floor(gameState.secondsElapsed / 15) + 1);
  ui.wave.textContent = `${wave}/${CONFIG.WAVES}`;
  const minutes = String(Math.floor(gameState.secondsElapsed / 60)).padStart(2, '0');
  const seconds = String(gameState.secondsElapsed % 60).padStart(2, '0');
  ui.timer.textContent = `${minutes}:${seconds}`;

  document.querySelectorAll('.build-btn').forEach((button) => {
    button.disabled = gameState.player.gold < CONFIG.TOWERS[button.dataset.tower].cost;
  });
  document.querySelectorAll('.send-btn').forEach((button) => {
    button.disabled = gameState.player.gold < CONFIG.BALLOONS[button.dataset.balloon].cost;
  });
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('active');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('active'), 2100);
}

assetsReady.then(() => {
  renderSide(ctxPlayer, gameState.player, true);
  renderSide(ctxEnemy, gameState.enemy, false);
});
