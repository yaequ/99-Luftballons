import { CONFIG } from './modules/config.js';
import { ASSETS, whenImageReady } from './modules/assets.js';
import { createInitialState } from './modules/state.js';
import { mapPathPoint, canBuildAt } from './modules/building.js';
import { buyAITower } from './modules/ai.js';
import { createRenderer } from './modules/renderer.js';
import * as RoundConfig from './rounds.js';

/* 99 LUFTBALLONS – Vanilla HTML5 Canvas Tower Defense */

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
  p1HealthMeter: document.getElementById('p1-health-meter'),
  p1HealthFill: document.getElementById('p1-health-fill'),
  p2HealthMeter: document.getElementById('p2-health-meter'),
  p2HealthFill: document.getElementById('p2-health-fill'),
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
  enemyMapTitle: document.getElementById('enemy-map-title'),
  gameMenu: document.getElementById('game-menu')
};

const gameFrame = document.querySelector('.game-frame');
const canvasPlayer = document.getElementById('canvas-player');
const canvasEnemy = document.getElementById('canvas-enemy');
const ctxPlayer = canvasPlayer.getContext('2d');
const ctxEnemy = canvasEnemy.getContext('2d');

const mousePos = { x: 0, y: 0, onCanvas: false };
let animationFrameId = 0;
let lastFrameTime = 0;
let accumulator = 0;
let toastTimer = 0;
let startPending = false;

let gameState = createInitialState();
const { renderSide, renderTowerPortraits, renderBalloonPortraits } = createRenderer(() => gameState, mousePos);

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
  if (event.key === 'Escape' && ui.gameMenu.open) {
    ui.gameMenu.removeAttribute('open');
    ui.gameMenu.querySelector('summary').focus();
    return;
  }
  if (event.key.toLowerCase() !== 'i' || event.target.matches('input, textarea')) return;
  setControlsExpanded(gameFrame.classList.contains('controls-collapsed'));
});

document.addEventListener('pointerdown', (event) => {
  if (ui.gameMenu.open && !ui.gameMenu.contains(event.target)) ui.gameMenu.removeAttribute('open');
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
  window.location.assign('../menu.php');
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

  if (result === true) clearTowerSelection();
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
    return;
  }

  gameState.player.gold -= balloonData.cost;
  gameState.player.income += balloonData.income;
  gameState.enemy.sendQueue.push({ type, remaining: CONFIG.SEND_BATCH_SIZE });
  updateSentBalloons(gameState.enemy, 0);
  updateUI();
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
  buyAITower(gameState, tryBuildTower);
  updateUI();
}

function finishRound() {
  if (gameState.currentRound === CONFIG.WAVES) {
    gameState.roundStatus = 'completed';
    endGame('win', 'Sieg', 'Du hast alle 30 Runden und beide Bosse überlebt.');
    return;
  }
  gameState.roundStatus = 'intermission';
  gameState.intermissionRemaining = CONFIG.INTERMISSION_SECONDS;
  showWaveCompleted();
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
  if (gameState.player.hp <= 0) endGame('loss', 'Niederlage', 'Deine Verteidigung wurde von den Ballons überwältigt.');
  else if (gameState.enemy.hp <= 0) endGame('win', 'Sieg', 'Der Gegner konnte deine Ballons nicht halten.');
}

async function saveMatchResult(result) {
  if (gameState.resultSubmitted) return;
  gameState.resultSubmitted = true;

  try {
    const response = await fetch('../save-match.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result,
        duration_seconds: Math.round(gameState.secondsElapsed),
        round_reached: gameState.currentRound
      }),
      keepalive: true
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error('Match result was rejected');
    if (Array.isArray(data.achievements) && data.achievements.length > 0) {
      showToast(`${data.achievements.length} neues Abzeichen freigeschaltet!`, 5000);
    }
  } catch (error) {
    gameState.resultSubmitted = false;
    showToast('Ergebnis konnte nicht gespeichert werden.', 5000);
  }
}

function endGame(result, title, message) {
  gameState.active = false;
  cancelAnimationFrame(animationFrameId);
  saveMatchResult(result);
  ui.gameOverTitle.textContent = title;
  ui.gameOverMessage.textContent = message;
  ui.modalGameOver.classList.add('active');
  document.getElementById('btn-return-lobby').focus();
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
  updateHealthDisplay(gameState.player.hp, ui.p1Hp, ui.p1HealthMeter, ui.p1HealthFill);
  ui.p1Gold.textContent = Math.floor(gameState.player.gold);
  ui.p1Income.textContent = `+${gameState.player.income}/s`;
  updateHealthDisplay(gameState.enemy.hp, ui.p2Hp, ui.p2HealthMeter, ui.p2HealthFill);
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

function updateHealthDisplay(value, label, meter, fill) {
  const maximum = 99;
  const health = Math.max(0, Math.min(maximum, Math.round(value)));
  const percentage = health / maximum * 100;
  label.textContent = `${health} / ${maximum}`;
  meter.setAttribute('aria-valuenow', String(health));
  meter.classList.toggle('is-critical', health > 0 && health <= 30);
  fill.style.width = `${percentage}%`;
}

function showWaveCompleted() {
  showToast(`Welle ${gameState.currentRound} geschafft!`);
}

function showToast(message, duration = 3000) {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    ui.toast.hidden = true;
    ui.toast.textContent = '';
  }, duration);
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
