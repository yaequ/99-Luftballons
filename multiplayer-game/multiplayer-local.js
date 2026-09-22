import { CONFIG } from '../game/modules/config.js';
import { ASSETS, whenImageReady } from '../game/modules/assets.js';
import { MAP_DATA } from '../game/modules/maps.js';
import { createRenderer } from '../game/modules/renderer.js';
import { createMultiplayerEngine } from './engine.js';

const shell = document.querySelector('.multiplayer-match-shell[data-local-engine="true"]');
if (!shell) throw new Error('Multiplayer canvas shell not found.');

const playerCanvas = document.getElementById('multiplayer-player-canvas');
const opponentCanvas = document.getElementById('multiplayer-opponent-canvas');
const playerContext = playerCanvas.getContext('2d');
const opponentContext = opponentCanvas.getContext('2d');
const loadingStatus = document.getElementById('multiplayer-canvas-status');
const mapTip = document.getElementById('multiplayer-map-tip');
const towerButtons = [...document.querySelectorAll('.mp-tower-card')];
const balloonButtons = [...document.querySelectorAll('.mp-balloon-card')];
const startRoundButton = document.getElementById('multiplayer-start-round');
const pauseButton = document.getElementById('multiplayer-pause');
const autoStartInput = document.getElementById('multiplayer-auto-start');
const localStatus = document.getElementById('multiplayer-local-status');
const mousePosition = { x: 0, y: 0, onCanvas: false };

const playerMap = MAP_DATA[shell.dataset.playerMap];
const opponentMap = MAP_DATA[shell.dataset.opponentMap];
if (!playerMap || !opponentMap) throw new Error('Multiplayer map configuration is invalid.');

const engine = createMultiplayerEngine(playerMap, opponentMap, {
  onChange: updateInterface,
  onRoundComplete: (round) => showStatus(`Runde ${round} geschafft. Nächste Runde startet gleich.`),
  onGameOver: (result) => showStatus(result === 'win'
    ? 'Lokaler Testsieg: Die gegnerische Basis ist gefallen.'
    : result === 'loss'
      ? 'Lokale Testniederlage: Deine Basis ist gefallen.'
      : 'Alle 30 lokalen Testrunden geschafft.')
});
const state = engine.state;
const { renderSide, renderTowerPortraits, renderBalloonPortraits } = createRenderer(() => state, mousePosition);
let animationFrame = 0;
let lastFrameTime = performance.now();
let accumulator = 0;
let assetsReady = false;

function prefixAsset(image) {
  const source = image.dataset.src;
  if (source && !source.startsWith('../game/') && !source.startsWith('game/')) image.dataset.src = `game/${source}`;
}

function requiredAssets() {
  const images = [
    state.player.map.image,
    state.enemy.map.image,
    ...Object.values(ASSETS.characters).flat(),
    ...Object.values(ASSETS.balloons).flat(),
    ASSETS.boss
  ];
  [...new Set(images)].forEach(prefixAsset);
  return [...new Set(images)];
}

function updateHealth(prefix, value) {
  const health = Math.max(0, Math.min(99, Math.round(value)));
  document.getElementById(`${prefix}-hp`).textContent = `${health} / 99`;
  const meter = document.getElementById(`${prefix}-health`);
  meter.setAttribute('aria-valuenow', String(health));
  meter.querySelector('i').style.width = `${health / 99 * 100}%`;
}

function roundButtonLabel() {
  if (state.result) return 'Lokaler Test beendet';
  if (state.roundStatus === 'spawning' || state.roundStatus === 'clearing') return `Runde ${state.currentRound} läuft`;
  if (state.roundStatus === 'intermission') return `Runde ${state.currentRound + 1} jetzt starten`;
  return state.currentRound === 0 ? 'Lokale Runde starten' : `Runde ${state.currentRound + 1} starten`;
}

function updateInterface() {
  document.getElementById('your-gold').textContent = String(Math.floor(state.player.gold));
  document.getElementById('your-income').textContent = `+${state.player.income} Gold/s`;
  document.getElementById('opponent-gold').textContent = String(Math.floor(state.enemy.gold));
  document.getElementById('opponent-income').textContent = `+${state.enemy.income} Gold/s`;
  document.getElementById('match-round').textContent = `${state.currentRound}/${CONFIG.WAVES}`;
  document.getElementById('multiplayer-round-state').textContent = state.paused
    ? 'Lokaler Test pausiert'
    : state.roundStatus === 'intermission'
      ? `Nächste Runde in ${Math.ceil(state.intermissionRemaining)} s`
      : state.roundStatus === 'spawning'
        ? `${state.remainingEnemies} Ballons verbleibend`
        : state.roundStatus === 'clearing'
          ? `${state.remainingEnemies} Ballons unterwegs`
          : 'Lokale Simulation bereit';
  updateHealth('your', state.player.hp);
  updateHealth('opponent', state.enemy.hp);

  towerButtons.forEach((button) => {
    const selected = button.dataset.tower === state.selectedTowerType;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = !assetsReady || Boolean(state.result) || state.player.gold < CONFIG.TOWERS[button.dataset.tower].cost;
  });
  balloonButtons.forEach((button) => {
    button.disabled = !assetsReady || !state.active || state.paused || Boolean(state.result) || state.player.gold < CONFIG.BALLOONS[button.dataset.balloon].cost;
  });
  const roundRunning = ['spawning', 'clearing'].includes(state.roundStatus);
  startRoundButton.disabled = !assetsReady || state.paused || Boolean(state.result) || roundRunning || state.currentRound >= CONFIG.WAVES;
  startRoundButton.textContent = roundButtonLabel();
  pauseButton.disabled = !state.active || Boolean(state.result);
  pauseButton.textContent = state.paused ? 'Fortsetzen' : 'Pausieren';
  pauseButton.setAttribute('aria-pressed', String(state.paused));
}

function showStatus(message) {
  localStatus.textContent = message;
}

function setTip(step, text) {
  mapTip.querySelector('b').textContent = String(step);
  mapTip.querySelector('span').textContent = text;
}

function selectTower(type) {
  if (!assetsReady || state.result) return;
  state.selectedTowerType = state.selectedTowerType === type ? null : type;
  state.buildCursor.active = Boolean(state.selectedTowerType);
  updateInterface();
  if (state.selectedTowerType) {
    setTip(2, `${CONFIG.TOWERS[type].name} auf einer dunklen Baufläche platzieren.`);
    playerCanvas.focus();
  } else {
    setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
  }
}

function clearSelection() {
  state.selectedTowerType = null;
  state.buildCursor.active = false;
  updateInterface();
  setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
}

function placementMessage(result, type) {
  if (result === 'occupied') return 'Dieser Platz ist bereits belegt.';
  if (result === 'gold') return 'Nicht genug Gold für diesen Turm.';
  if (result === 'zone') return `${CONFIG.TOWERS[type].name} muss auf einer dunklen Baufläche stehen.`;
  return 'Turm konnte nicht platziert werden.';
}

function placeTower(x = mousePosition.x, y = mousePosition.y) {
  const type = state.selectedTowerType;
  if (!type || !assetsReady) return;
  const result = engine.buildTower(type, x, y);
  if (result !== true) {
    setTip(2, placementMessage(result, type));
    return;
  }
  clearSelection();
  setTip('✓', `${CONFIG.TOWERS[type].name} wurde lokal korrekt platziert.`);
}

function updatePointer(event) {
  const rectangle = playerCanvas.getBoundingClientRect();
  const scaleX = CONFIG.CANVAS_WIDTH / rectangle.width;
  const scaleY = CONFIG.CANVAS_HEIGHT / rectangle.height;
  mousePosition.x = Math.floor(((event.clientX - rectangle.left) * scaleX) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.y = Math.floor(((event.clientY - rectangle.top) * scaleY) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.onCanvas = true;
}

function frame(now) {
  const frameDelta = Math.min((now - lastFrameTime) / 1000, CONFIG.MAX_FRAME_DELTA);
  lastFrameTime = now;
  accumulator += frameDelta;
  while (accumulator >= CONFIG.FIXED_STEP) {
    engine.update(CONFIG.FIXED_STEP);
    accumulator -= CONFIG.FIXED_STEP;
  }
  renderSide(playerContext, state.player, true);
  renderSide(opponentContext, state.enemy, false);
  animationFrame = window.requestAnimationFrame(frame);
}

towerButtons.forEach((button) => button.addEventListener('click', () => selectTower(button.dataset.tower)));
balloonButtons.forEach((button) => button.addEventListener('click', () => {
  const result = engine.sendBalloon(button.dataset.balloon);
  if (result === true) showStatus(`10 ${button.querySelector('strong').textContent.toLowerCase()}e Ballons lokal gesendet.`);
  else if (result === 'gold') showStatus('Nicht genug Gold für diese Ballons.');
}));
startRoundButton.addEventListener('click', () => {
  if (engine.startRound()) showStatus(`Lokale Testrunde ${state.currentRound} gestartet.`);
});
pauseButton.addEventListener('click', () => engine.setPaused(!state.paused));
autoStartInput.addEventListener('change', () => { state.autoStart = autoStartInput.checked; updateInterface(); });

playerCanvas.addEventListener('pointermove', updatePointer);
playerCanvas.addEventListener('pointerleave', () => { mousePosition.onCanvas = false; });
playerCanvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  updatePointer(event);
  placeTower();
});
playerCanvas.addEventListener('keydown', (event) => {
  if (!state.selectedTowerType) return;
  const movement = {
    ArrowLeft: [-CONFIG.GRID_SIZE, 0], ArrowRight: [CONFIG.GRID_SIZE, 0],
    ArrowUp: [0, -CONFIG.GRID_SIZE], ArrowDown: [0, CONFIG.GRID_SIZE]
  }[event.key];
  if (movement) {
    event.preventDefault();
    state.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, state.buildCursor.x + movement[0]));
    state.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, state.buildCursor.y + movement[1]));
    state.buildCursor.active = true;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    placeTower(state.buildCursor.x, state.buildCursor.y);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearSelection();
  }
});

document.addEventListener('visibilitychange', () => {
  lastFrameTime = performance.now();
  accumulator = 0;
});

async function initialize() {
  const images = requiredAssets();
  let loaded = 0;
  try {
    await Promise.all(images.map((image) => whenImageReady(image).then(() => {
      loaded += 1;
      loadingStatus.textContent = `Spielgrafiken werden geladen: ${loaded}/${images.length}`;
    })));
    assetsReady = true;
    loadingStatus.hidden = true;
    renderTowerPortraits();
    renderBalloonPortraits();
    updateInterface();
    frame(performance.now());
  } catch (error) {
    loadingStatus.textContent = `Grafik konnte nicht geladen werden: ${error.message}`;
    loadingStatus.classList.add('is-error');
  }
}

window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame));
updateInterface();
initialize();
