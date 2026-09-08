/* 99 LUFTBALLONS – Vanilla HTML5 Canvas Tower Defense */

function imageAsset(src) {
  const image = new Image();
  image.dataset.src = src;
  return image;
}

function numberedImageAssets(folder, prefix) {
  return Array.from({ length: 10 }, (_, index) => imageAsset(`${folder}/${prefix} ${index + 1}.png`));
}

const ASSETS = {
  maps: {
    frost: imageAsset('assets/Maps/image2.webp'),
    woodland: imageAsset('assets/Maps/Grafik.webp'),
    desert: imageAsset('assets/Maps/image.webp'),
    mountain: imageAsset('assets/Maps/Grafik_2.webp')
  },
  characters: {
    cactus: numberedImageAssets('assets/Charaktere/Kaktus/Kaktus', 'Segment'),
    fan: numberedImageAssets('assets/Charaktere/Geblaese/Ballon Hunter', 'Ballon Hunter'),
    lens: numberedImageAssets('assets/Charaktere/Lupe/Fliegerstaffel', 'Fliegerstaffel')
  },
  balloons: Object.fromEntries(['red', 'blue', 'green', 'yellow'].map((type) => [type,
    Array.from({ length: type === 'yellow' ? 6 : 7 }, (_, index) =>
      imageAsset(`assets/Balloons/transparent/${type}/balloon_${type}_frame_${String(index + 1).padStart(2, '0')}.png`))
  ])),
  boss: imageAsset('assets/Balloons/boss-balloon.png')
};



const CONFIG = {
  CANVAS_WIDTH: 320,
  CANVAS_HEIGHT: 240,
  RENDER_SCALE: 3,
  GRID_SIZE: 8,
  FIXED_STEP: 1 / 60,
  MAX_FRAME_DELTA: 0.1,
  WAVES: 30,
  NORMAL_SPAWN_INTERVAL: 0.12,
  SEND_BATCH_SIZE: 10,
  SEND_SPAWN_INTERVAL: 0.12,
  BOSS_SPAWN_INTERVAL: 1.2,
  INTERMISSION_SECONDS: 5,
  CHARACTER_RENDER: { MAX_WIDTH: 25, HEIGHT: 29 },
  TOWERS: {
    cactus: { name: 'Kaktus', cost: 25, range: 45, damage: 0.3, fireRate: 0.58, color: '#43d17d', directionFrames: [5, 6, 2, 1, 0, 8, 9, 3] },
    fan: { name: 'Gebläse', cost: 45, range: 55, damage: 1, fireRate: 0.34, color: '#70a1ff', directionFrames: [4, 3, 2, 1, 0, 8, 7, 6] },
    lens: { name: 'Lupe', cost: 70, range: 65, damage: 3, fireRate: 1, color: '#f1b94d', directionFrames: [2, 6, 1, 5, 0, 8, 3, 7] }
  },
  BALLOONS: {
    red: { name: 'Rot', cost: 10, income: 1, hp: 1, speed: 60, lifeDamage: 1, renderSize: 18 },
    blue: { name: 'Blau', cost: 25, income: 2, hp: 2, speed: 84, lifeDamage: 1, renderSize: 18 },
    green: { name: 'Grün', cost: 45, income: 4, hp: 4, speed: 68, lifeDamage: 1, renderSize: 18 },
    yellow: { name: 'Gelb', cost: 70, income: 7, hp: 7, speed: 48, lifeDamage: 1, renderSize: 18 },
    boss: { name: 'Boss', hp: 150, speed: 24, lifeDamage: 25, renderSize: 36 }
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

const MAP_PATHS = {
  frost: {
    route: [
      { x: 165, y: 200 }, { x: 165, y: 270 }, { x: 195, y: 305 }, { x: 650, y: 305 },
      { x: 695, y: 335 }, { x: 710, y: 445 }, { x: 730, y: 490 }, { x: 835, y: 455 },
      { x: 890, y: 350 }, { x: 930, y: 285 }, { x: 1160, y: 285 }, { x: 1200, y: 325 },
      { x: 1200, y: 665 }, { x: 1160, y: 705 }, { x: 800, y: 710 }, { x: 750, y: 750 },
      { x: 710, y: 875 }, { x: 670, y: 920 }, { x: 620, y: 935 }, { x: 575, y: 900 },
      { x: 555, y: 760 }, { x: 515, y: 710 }, { x: 470, y: 680 }, { x: 465, y: 550 },
      { x: 425, y: 515 }, { x: 260, y: 505 }, { x: 220, y: 545 }, { x: 220, y: 845 },
      { x: 255, y: 890 }, { x: 555, y: 900 }, { x: 620, y: 935 }, { x: 850, y: 1015 }
    ]
  },
  woodland: {
    left: [
      { x: 105, y: 130 }, { x: 105, y: 190 }, { x: 135, y: 215 }, { x: 475, y: 215 },
      { x: 520, y: 240 }, { x: 545, y: 315 }, { x: 525, y: 340 }, { x: 205, y: 340 },
      { x: 170, y: 375 }, { x: 170, y: 565 }, { x: 205, y: 600 }, { x: 475, y: 600 },
      { x: 520, y: 575 }, { x: 550, y: 500 }, { x: 585, y: 475 }, { x: 720, y: 475 },
      { x: 750, y: 510 }, { x: 750, y: 650 }
    ],
    right: [
      { x: 105, y: 130 }, { x: 105, y: 190 }, { x: 135, y: 215 }, { x: 475, y: 215 },
      { x: 520, y: 240 }, { x: 545, y: 315 }, { x: 575, y: 350 }, { x: 615, y: 335 },
      { x: 640, y: 240 }, { x: 675, y: 210 }, { x: 825, y: 210 }, { x: 860, y: 240 },
      { x: 875, y: 430 }, { x: 845, y: 470 }, { x: 780, y: 475 }, { x: 750, y: 510 },
      { x: 750, y: 650 }
    ]
  },
  desert: {
    route: [
      { x: 165, y: 200 }, { x: 165, y: 270 }, { x: 205, y: 305 }, { x: 650, y: 305 },
      { x: 700, y: 335 }, { x: 715, y: 430 }, { x: 750, y: 470 }, { x: 835, y: 465 },
      { x: 875, y: 425 }, { x: 880, y: 320 }, { x: 920, y: 275 }, { x: 1175, y: 275 },
      { x: 1210, y: 320 }, { x: 1210, y: 655 }, { x: 1170, y: 700 }, { x: 805, y: 700 },
      { x: 760, y: 740 }, { x: 760, y: 875 }, { x: 720, y: 925 }, { x: 620, y: 925 },
      { x: 580, y: 885 }, { x: 580, y: 760 }, { x: 540, y: 720 }, { x: 500, y: 720 },
      { x: 450, y: 680 }, { x: 450, y: 530 }, { x: 410, y: 490 }, { x: 260, y: 490 },
      { x: 220, y: 530 }, { x: 220, y: 840 }, { x: 260, y: 890 }, { x: 500, y: 900 },
      { x: 550, y: 950 }, { x: 850, y: 1040 }
    ]
  },
  mountain: {
    route: [
      { x: 170, y: 205 }, { x: 170, y: 275 }, { x: 205, y: 315 }, { x: 680, y: 315 },
      { x: 730, y: 345 }, { x: 750, y: 455 }, { x: 725, y: 500 }, { x: 535, y: 520 },
      { x: 495, y: 560 }, { x: 495, y: 640 }, { x: 455, y: 680 }, { x: 250, y: 700 },
      { x: 205, y: 740 }, { x: 205, y: 835 }, { x: 250, y: 875 }, { x: 600, y: 885 },
      { x: 660, y: 920 }, { x: 680, y: 850 }, { x: 700, y: 780 }, { x: 760, y: 700 },
      { x: 820, y: 620 }, { x: 875, y: 520 }, { x: 900, y: 430 }, { x: 930, y: 350 },
      { x: 930, y: 310 },
      { x: 1160, y: 310 }, { x: 1200, y: 350 }, { x: 1200, y: 665 }, { x: 1160, y: 710 },
      { x: 1050, y: 710 }, { x: 1000, y: 755 }, { x: 1000, y: 885 }
    ]
  }
};

const MAP_DATA = {
  frost: { id: 'frost', name: 'Frostpfad', image: ASSETS.maps.frost, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.frost.route] },
  woodland: { id: 'woodland', name: 'Waldweg', image: ASSETS.maps.woodland, hudCrop: 38, logicalCrop: 12, paths: [MAP_PATHS.woodland.left, MAP_PATHS.woodland.right] },
  desert: { id: 'desert', name: 'Wüstendünen', image: ASSETS.maps.desert, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.desert.route] },
  mountain: { id: 'mountain', name: 'Bergpass', image: ASSETS.maps.mountain, hudCrop: 50, logicalCrop: 12, paths: [MAP_PATHS.mountain.route] }
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
  p2Gold: document.getElementById('p2-gold'),
  timer: document.getElementById('match-timer'),
  lobbyStatus: document.getElementById('lobby-status'),
  mapTip: document.getElementById('map-tip'),
  toast: document.getElementById('game-toast'),
  modalGameOver: document.getElementById('modal-gameover'),
  gameOverTitle: document.getElementById('gameover-title'),
  gameOverMessage: document.getElementById('gameover-message'),
  loadErrorModal: document.getElementById('modal-load-error'),
  loadErrorMessage: document.getElementById('load-error-message'),
  toggleControls: document.getElementById('btn-toggle-controls'),
  startRound: document.getElementById('btn-start-round'),
  autoStart: document.getElementById('input-auto-start'),
  remainingEnemies: document.getElementById('remaining-enemies'),
  nextWavePreview: document.getElementById('next-wave-preview'),
  roundCountdown: document.getElementById('round-countdown'),
  roundState: document.getElementById('round-state'),
  playerMapTitle: document.getElementById('player-map-title'),
  enemyMapTitle: document.getElementById('enemy-map-title')
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

function createSide(map) {
  return {
    map,
    hp: 99,
    gold: 100,
    income: 5,
    towers: [],
    balloons: [],
    sendQueue: [],
    sendClock: 0,
    projectiles: [],
    pops: []
  };
}

function createInitialState() {
  const maps = Object.values(MAP_DATA);
  const playerMap = maps[Math.floor(Math.random() * maps.length)];
  const enemyMaps = maps.filter((map) => map !== playerMap);

  return {
    active: false,
    paused: false,
    secondsElapsed: 0,
    economyClock: 0,
    selectedTowerType: null,
    buildCursor: { x: 100, y: 40, active: false },
    currentRound: 0,
    roundStatus: 'ready',
    spawnGroups: [],
    spawnGroupIndex: 0,
    spawnRemainingInGroup: 0,
    spawnClock: 0,
    remainingEnemies: 0,
    intermissionRemaining: 0,
    autoStart: true,
    player: createSide(playerMap),
    enemy: createSide(enemyMaps[Math.floor(Math.random() * enemyMaps.length)] || playerMap)
  };
}

function whenImageReady(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const source = image.dataset.src;
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error(source)), { once: true });
    if (image.complete && image.getAttribute('src')) image.removeAttribute('src');
    if (!image.getAttribute('src')) image.src = source;
  });
}

async function loadMatchAssets() {
  const requiredAssets = [
    gameState.player.map.image,
    gameState.enemy.map.image,
    ...Object.values(ASSETS.characters).flat(),
    ...Object.values(ASSETS.balloons).flat(),
    ASSETS.boss
  ];
  let loaded = 0;
  ui.lobbyStatus.textContent = `0/${requiredAssets.length} Assets geladen`;
  await Promise.all(requiredAssets.map((image) => whenImageReady(image).then(() => {
    loaded += 1;
    ui.lobbyStatus.textContent = `${loaded}/${requiredAssets.length} Assets geladen`;
  })));
  renderTowerPortraits();
  renderBalloonPortraits();
}


document.getElementById('btn-return-lobby').addEventListener('click', returnToHomepage);
document.getElementById('btn-retry-load').addEventListener('click', () => startGame(true));
document.getElementById('btn-cancel-load').addEventListener('click', returnToHomepage);
ui.startRound.addEventListener('click', () => {
  if (startPending || gameState.paused) return;
  if (!gameState.active && gameState.currentRound === 0) {
    gameState.active = true;
    clearTowerSelection();
    lastFrameTime = performance.now();
    accumulator = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  startNextRound();
});
ui.autoStart.addEventListener('change', () => {
  gameState.autoStart = ui.autoStart.checked;
  updateUI();
});
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

canvasPlayer.addEventListener('keydown', (event) => {
  if (!gameState.selectedTowerType || gameState.paused) return;
  const movement = {
    ArrowLeft: [-CONFIG.GRID_SIZE, 0], ArrowRight: [CONFIG.GRID_SIZE, 0],
    ArrowUp: [0, -CONFIG.GRID_SIZE], ArrowDown: [0, CONFIG.GRID_SIZE]
  }[event.key];
  if (movement) {
    event.preventDefault();
    gameState.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, gameState.buildCursor.x + movement[0]));
    gameState.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, gameState.buildCursor.y + movement[1]));
    gameState.buildCursor.active = true;
    announceBuildCursor();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    placeSelectedTower(gameState.buildCursor.x, gameState.buildCursor.y);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearTowerSelection();
    showToast('Turmauswahl abgebrochen.');
  }
});

function updatePointerPosition(event) {
  const rect = canvasPlayer.getBoundingClientRect();
  const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
  const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;
  mousePos.x = Math.floor(((event.clientX - rect.left) * scaleX) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePos.y = Math.floor(((event.clientY - rect.top) * scaleY) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePos.onCanvas = true;
}

async function startGame(retry = false) {
  if (startPending || gameState.paused) return;
  startPending = true;
  if (!retry) gameState = createInitialState();
  ui.loadErrorModal.classList.remove('active');
  try {
    await loadMatchAssets();
    cancelAnimationFrame(animationFrameId);
    gameState.active = false;
    screens.lobby.classList.remove('active');
    screens.game.classList.add('active');
    ui.modalGameOver.classList.remove('active');
    ui.playerMapTitle.textContent = gameState.player.map.name;
    ui.enemyMapTitle.textContent = gameState.enemy.map.name;
    ui.autoStart.checked = gameState.autoStart;
    setControlsExpanded(true);
    clearTowerSelection();
    ui.mapTip.querySelector('span:last-child').textContent = 'Klicke auf „Spiel starten“, um die Partie zu beginnen.';
    updateUI();
    renderSide(ctxPlayer, gameState.player, true);
    renderSide(ctxEnemy, gameState.enemy, false);
    ui.startRound.focus();
  } catch (error) {
    ui.loadErrorMessage.textContent = `Die Datei „${error.message}“ konnte nicht geladen werden.`;
    ui.loadErrorModal.classList.add('active');
    document.getElementById('btn-retry-load').focus();
  } finally {
    startPending = false;
  }
}

function returnToHomepage() {
  gameState.active = false;
  cancelAnimationFrame(animationFrameId);
  window.location.assign('../homepage/index.html');
}

function setControlsExpanded(expanded) {
  gameFrame.classList.toggle('controls-collapsed', !expanded);
  ui.toggleControls.setAttribute('aria-expanded', String(expanded));
  ui.toggleControls.textContent = expanded ? 'Interface ausblenden' : 'Interface einblenden';
}

function selectTower(type) {
  if (!gameState.active || gameState.paused) return;
  gameState.selectedTowerType = gameState.selectedTowerType === type ? null : type;
  gameState.buildCursor.active = Boolean(gameState.selectedTowerType);

  document.querySelectorAll('.build-btn').forEach((button) => {
    const selected = button.dataset.tower === gameState.selectedTowerType;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  ui.mapTip.querySelector('.map-tip__step').textContent = gameState.selectedTowerType ? '2' : '1';
  ui.mapTip.querySelector('span:last-child').textContent = gameState.selectedTowerType
    ? `${CONFIG.TOWERS[gameState.selectedTowerType].name} auf einer dunklen Baufläche platzieren.`
    : 'Turm wählen und auf einer dunklen Baufläche platzieren.';
  if (gameState.selectedTowerType) {
    canvasPlayer.focus();
    announceBuildCursor();
  }
}

function clearTowerSelection() {
  gameState.selectedTowerType = null;
  gameState.buildCursor.active = false;
  document.querySelectorAll('.build-btn').forEach((button) => {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });
  ui.mapTip.querySelector('.map-tip__step').textContent = '1';
  ui.mapTip.querySelector('span:last-child').textContent = 'Turm wählen und auf einer dunklen Baufläche platzieren.';
}

function announceBuildCursor() {
  const { x, y } = gameState.buildCursor;
  const result = canBuildAt(gameState.player, gameState.selectedTowerType, x, y);
  const state = result === true ? 'gültiger Bauplatz' : result === 'occupied' ? 'belegt' : result === 'gold' ? 'nicht genug Gold' : 'keine Baufläche';
  ui.mapTip.querySelector('span:last-child').textContent = `${CONFIG.TOWERS[gameState.selectedTowerType].name}: Position ${x}/${y}, ${state}. Enter platziert.`;
}

function placeSelectedTower(x = mousePos.x, y = mousePos.y) {
  if (!gameState.selectedTowerType || gameState.paused) return;
  const result = tryBuildTower(gameState.player, gameState.selectedTowerType, x, y);

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

function mapPathPoint(map, point) {
  return {
    x: (point.x / map.image.naturalWidth) * CONFIG.CANVAS_WIDTH,
    y: ((point.y - map.hudCrop) / (map.image.naturalHeight - map.hudCrop)) * CONFIG.CANVAS_HEIGHT
  };
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
  if (!isFree && side.gold < towerData.cost) return 'gold';
  if (!pointInBuildZone(side.map, x, y)) return 'zone';
  if (side.towers.some((tower) => Math.hypot(tower.x - x, tower.y - y) < CONFIG.GRID_SIZE * 1.5)) return 'occupied';
  return true;
}

function tryBuildTower(side, type, x, y, isFree = false) {
  const result = canBuildAt(side, type, x, y, isFree);
  if (result !== true) return result;

  const towerData = CONFIG.TOWERS[type];
  if (!isFree) side.gold -= towerData.cost;

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
  if (!gameState.active || gameState.paused) return;
  const balloonData = CONFIG.BALLOONS[type];
  if (!balloonData || !Number.isFinite(balloonData.cost)) return;
  if (gameState.player.gold < balloonData.cost) {
    showToast('Nicht genug Gold für diesen Ballon.');
    return;
  }

  gameState.player.gold -= balloonData.cost;
  gameState.player.income += balloonData.income;
  gameState.enemy.sendQueue.push({ type, remaining: CONFIG.SEND_BATCH_SIZE });
  updateSentBalloons(gameState.enemy, 0);
  updateUI();
  showToast(`${CONFIG.SEND_BATCH_SIZE} ${balloonData.name}-Ballons gesendet · Einkommen +${balloonData.income}/s`);
}

function updateSentBalloons(side, deltaTime) {
  if (side.sendQueue.length === 0) {
    side.sendClock = Math.max(0, side.sendClock - deltaTime);
    return;
  }
  side.sendClock -= deltaTime;
  while (side.sendClock <= 0 && side.sendQueue.length > 0) {
    const batch = side.sendQueue[0];
    spawnBalloon(side, batch.type);
    batch.remaining -= 1;
    if (batch.remaining === 0) side.sendQueue.shift();
    side.sendClock += CONFIG.SEND_SPAWN_INTERVAL;
  }
}

function spawnBalloon(targetSide, type, fromRound = false) {
  const balloonData = CONFIG.BALLOONS[type];
  const sourcePath = targetSide.map.paths[Math.floor(Math.random() * targetSide.map.paths.length)];
  const path = sourcePath.map((point) => mapPathPoint(targetSide.map, point));
  targetSide.balloons.push({
    type,
    x: path[0].x,
    y: path[0].y,
    path,
    pathIndex: 0,
    hp: balloonData.hp,
    maxHp: balloonData.hp,
    speed: balloonData.speed,
    lifeDamage: balloonData.lifeDamage,
    renderSize: balloonData.renderSize,
    fromRound
  });
}

function startNextRound() {
  if (!gameState.active || gameState.paused || ['spawning', 'clearing', 'completed'].includes(gameState.roundStatus) || gameState.currentRound >= CONFIG.WAVES) return;
  gameState.currentRound += 1;
  const definition = RoundConfig.ROUND_DEFINITIONS[gameState.currentRound - 1];
  gameState.spawnGroups = RoundConfig.shuffledSpawnGroups(definition);
  gameState.spawnGroupIndex = 0;
  gameState.spawnRemainingInGroup = gameState.spawnGroups[0].count;
  gameState.spawnClock = 0;
  gameState.remainingEnemies = gameState.spawnGroups.reduce((sum, group) => sum + group.count, 0);
  gameState.intermissionRemaining = 0;
  gameState.roundStatus = 'spawning';
  buyAITower();
  showToast(`Runde ${gameState.currentRound} gestartet: ${formatRound(definition)}.`);
  updateUI();
}

function desiredAIFieldCount(round) {
  if (round <= 0) return 0;
  return Math.min(BUILD_ZONES.length, 1 + Math.floor(((round - 1) * (BUILD_ZONES.length - 1)) / 19));
}

function firstGridCenter(value) {
  return Math.ceil((value - CONFIG.GRID_SIZE / 2) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
}

function getAIBuildFields() {
  return buildZonesForMap(gameState.enemy.map).map((zone, fieldIndex) => {
    const isLarge = zone.w * zone.h >= 1800;
    const targetCount = isLarge ? 5 + (fieldIndex % 4) : 3 + (fieldIndex % 4);
    const spots = [];
    for (let y = firstGridCenter(zone.y); y <= zone.y + zone.h; y += CONFIG.GRID_SIZE * 2) {
      for (let x = firstGridCenter(zone.x); x <= zone.x + zone.w; x += CONFIG.GRID_SIZE * 2) spots.push({ x, y });
    }
    return { fieldIndex, isLarge, targetCount, spots: spots.slice(0, targetCount) };
  });
}

function buyAITower() {
  const targetFieldCount = desiredAIFieldCount(gameState.currentRound);
  const priorities = gameState.currentRound >= 20 ? ['lens', 'fan', 'cactus'] : gameState.currentRound >= 10 ? ['fan', 'cactus'] : ['cactus'];
  const fields = getAIBuildFields();

  for (const field of fields.slice(0, targetFieldCount)) {
    const existing = gameState.enemy.towers.filter((tower) => tower.fieldIndex === field.fieldIndex).length;
    const missing = field.targetCount - existing;
    if (missing <= 0) continue;
    if (gameState.enemy.gold < missing * CONFIG.TOWERS.cactus.cost) break;

    for (const spot of field.spots.slice(existing)) {
      const type = priorities.find((candidate) => gameState.enemy.gold >= CONFIG.TOWERS[candidate].cost);
      if (!type || tryBuildTower(gameState.enemy, type, spot.x, spot.y) !== true) break;
      gameState.enemy.towers[gameState.enemy.towers.length - 1].fieldIndex = field.fieldIndex;
    }
  }
}

function finishRound() {
  if (gameState.currentRound === CONFIG.WAVES) {
    gameState.roundStatus = 'completed';
    endGame('Sieg', 'Du hast alle 30 Runden und beide Bosse überlebt.');
    return;
  }
  gameState.roundStatus = 'intermission';
  gameState.intermissionRemaining = CONFIG.INTERMISSION_SECONDS;
  showToast(`Runde ${gameState.currentRound} geschafft.`);
}

function updateRound(deltaTime) {
  if (gameState.roundStatus === 'spawning') {
    gameState.spawnClock -= deltaTime;
    while (gameState.spawnClock <= 0 && gameState.spawnGroupIndex < gameState.spawnGroups.length) {
      const group = gameState.spawnGroups[gameState.spawnGroupIndex];
      if (gameState.spawnRemainingInGroup <= 0) {
        gameState.spawnGroupIndex += 1;
        if (gameState.spawnGroupIndex >= gameState.spawnGroups.length) break;
        gameState.spawnRemainingInGroup = gameState.spawnGroups[gameState.spawnGroupIndex].count;
        continue;
      }
      spawnBalloon(gameState.player, group.type, true);
      gameState.spawnRemainingInGroup -= 1;
      gameState.spawnClock += group.type === 'boss' ? CONFIG.BOSS_SPAWN_INTERVAL : CONFIG.NORMAL_SPAWN_INTERVAL;
    }
    if (gameState.spawnGroupIndex >= gameState.spawnGroups.length) gameState.roundStatus = 'clearing';
  } else if (gameState.roundStatus === 'clearing' && gameState.remainingEnemies === 0) {
    finishRound();
  } else if (gameState.roundStatus === 'intermission') {
    gameState.intermissionRemaining = Math.max(0, gameState.intermissionRemaining - deltaTime);
    if (gameState.intermissionRemaining === 0) {
      if (gameState.autoStart) startNextRound();
      else gameState.roundStatus = 'ready';
    }
  }
}

function gameLoop(now) {
  if (!gameState.active || gameState.paused) return;
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
  if (gameState.paused) return;
  updateRound(deltaTime);
  updateSentBalloons(gameState.enemy, deltaTime);
  gameState.economyClock += deltaTime;
  while (gameState.economyClock >= 1) {
    gameState.economyClock -= 1;
    gameState.secondsElapsed += 1;
    gameState.player.gold += gameState.player.income;
    gameState.enemy.gold += gameState.enemy.income;
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
      side.hp = Math.max(0, side.hp - balloon.lifeDamage);
      if (balloon.fromRound) gameState.remainingEnemies = Math.max(0, gameState.remainingEnemies - 1);
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
            type: projectile.targetRef.type === 'boss' ? 'red' : projectile.targetRef.type,
            size: projectile.targetRef.renderSize,
            age: 0,
            duration: 0.42
          });
          side.balloons.splice(balloonIndex, 1);
          side.gold += 2;
          if (projectile.targetRef.fromRound) gameState.remainingEnemies = Math.max(0, gameState.remainingEnemies - 1);
          updateUI();
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
  const directionIndex = Math.round(degrees / 45) % 8;
  tower.frameIndex = CONFIG.TOWERS[tower.type].directionFrames[directionIndex];
}

function checkGameOver() {
  if (!gameState.active || gameState.paused) return;
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
    if (balloon.type === 'boss') drawBossSprite(ctx, balloon.x, balloon.y, balloon.renderSize);
    else drawBalloonSprite(ctx, balloon.type, 0, balloon.x, balloon.y, balloon.renderSize);
  });

  side.pops.forEach((pop) => {
    const progress = pop.age / pop.duration;
    const count = ASSETS.balloons[pop.type].length;
    const frame = Math.min(count - 1, 1 + Math.floor(progress * (count - 1)));
    drawBalloonSprite(ctx, pop.type, frame, pop.x, pop.y, pop.size);
  });

  if (isPlayerSide && gameState.selectedTowerType && mousePos.onCanvas) {
    renderBuildPreview(ctx);
  }
  if (isPlayerSide && gameState.selectedTowerType && gameState.buildCursor.active) renderKeyboardBuildCursor(ctx);
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

function renderKeyboardBuildCursor(ctx) {
  const { x, y } = gameState.buildCursor;
  const type = gameState.selectedTowerType;
  const allowed = canBuildAt(gameState.player, type, x, y) === true;
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
function formatRound(definition) {
  const names = { red: 'rote', blue: 'blaue', green: 'grüne', yellow: 'gelbe', boss: 'Boss' };
  return definition.groups.map((group) => `${group.count} ${names[group.type]}${group.type === 'boss' && group.count !== 1 ? 'e' : ''}`).join(' · ');
}

function updateUI() {
  const pauseButton = document.getElementById('btn-pause');
  pauseButton.disabled = !gameState.active;
  pauseButton.textContent = gameState.paused ? 'Fortsetzen' : 'Pausieren';
  pauseButton.setAttribute('aria-pressed', String(gameState.paused));
  document.getElementById('pause-status').textContent = gameState.paused ? 'Spiel pausiert' : '';
  gameFrame.classList.toggle('is-paused', gameState.paused);
  ui.autoStart.disabled = gameState.paused;
  ui.p1Hp.textContent = `${gameState.player.hp} HP`;
  ui.p1Gold.textContent = Math.floor(gameState.player.gold);
  ui.p1Income.textContent = `+${gameState.player.income}/s`;
  ui.p2Hp.textContent = `${gameState.enemy.hp} HP`;
  ui.p2Gold.textContent = Math.floor(gameState.enemy.gold);

  ui.wave.textContent = `${gameState.currentRound}/${CONFIG.WAVES}`;
  ui.remainingEnemies.textContent = gameState.remainingEnemies;
  const labels = { ready: 'Bereit', spawning: 'Angriff läuft', clearing: 'Restliche Gegner', intermission: 'Rundenpause', completed: 'Abgeschlossen' };
  ui.roundState.textContent = labels[gameState.roundStatus];
  const nextDefinition = RoundConfig.ROUND_DEFINITIONS[gameState.currentRound];
  ui.nextWavePreview.textContent = nextDefinition ? formatRound(nextDefinition) : 'Keine weitere Runde';
  ui.roundCountdown.textContent = gameState.roundStatus === 'intermission'
    ? `Start in ${Math.ceil(gameState.intermissionRemaining)} Sekunden`
    : gameState.roundStatus === 'ready'
      ? 'Warte auf Start'
      : gameState.roundStatus === 'spawning'
        ? 'Ballons werden gesendet'
        : gameState.roundStatus === 'clearing'
          ? 'Alle Ballons sind unterwegs'
          : 'Match abgeschlossen';
  const roundRunning = ['spawning', 'clearing', 'completed'].includes(gameState.roundStatus);
  ui.startRound.disabled = gameState.paused || roundRunning || gameState.currentRound >= CONFIG.WAVES;
  ui.startRound.textContent = gameState.roundStatus === 'intermission'
    ? `Runde ${gameState.currentRound + 1} jetzt starten`
    : gameState.currentRound >= CONFIG.WAVES
      ? 'Alle Runden gespielt'
      : gameState.currentRound === 0
        ? 'Spiel starten'
        : `Runde ${gameState.currentRound + 1} starten`;
  const minutes = String(Math.floor(gameState.secondsElapsed / 60)).padStart(2, '0');
  const seconds = String(gameState.secondsElapsed % 60).padStart(2, '0');
  ui.timer.textContent = `${minutes}:${seconds}`;

  document.querySelectorAll('.build-btn').forEach((button) => {
    button.disabled = !gameState.active || gameState.paused || gameState.player.gold < CONFIG.TOWERS[button.dataset.tower].cost;
  });
  document.querySelectorAll('.send-btn').forEach((button) => {
    const balloonData = CONFIG.BALLOONS[button.dataset.balloon];
    button.disabled = !gameState.active || gameState.paused || gameState.player.gold < balloonData.cost;
    button.querySelector('small').textContent = `${CONFIG.SEND_BATCH_SIZE} Ballons · ${balloonData.cost} G · +${balloonData.income}/s`;
  });
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('active');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('active'), 2100);
}

// The homepage links directly to this separate game page.
startGame();

function togglePause() {
  if (!gameState.active) return;
  gameState.paused = !gameState.paused;
  cancelAnimationFrame(animationFrameId);
  lastFrameTime = performance.now();
  accumulator = 0;
  updateUI();
  if (!gameState.paused) animationFrameId = requestAnimationFrame(gameLoop);
}

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-back-menu').addEventListener('click', returnToHomepage);