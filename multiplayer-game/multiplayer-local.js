import { CONFIG } from '../game/modules/config.js';
import { ASSETS, whenImageReady } from '../game/modules/assets.js';
import { MAP_DATA } from '../game/modules/maps.js';
import { createSide } from '../game/modules/state.js';
import { canBuildAt } from '../game/modules/building.js';
import { createRenderer } from '../game/modules/renderer.js';

const shell = document.querySelector('.multiplayer-match-shell[data-local-engine="true"]');
if (!shell) throw new Error('Multiplayer canvas shell not found.');

const playerCanvas = document.getElementById('multiplayer-player-canvas');
const opponentCanvas = document.getElementById('multiplayer-opponent-canvas');
const playerContext = playerCanvas.getContext('2d');
const opponentContext = opponentCanvas.getContext('2d');
const loadingStatus = document.getElementById('multiplayer-canvas-status');
const mapTip = document.getElementById('multiplayer-map-tip');
const goldLabel = document.getElementById('your-gold');
const towerButtons = [...document.querySelectorAll('.mp-tower-card')];
const mousePosition = { x: 0, y: 0, onCanvas: false };

const playerMap = MAP_DATA[shell.dataset.playerMap];
const opponentMap = MAP_DATA[shell.dataset.opponentMap];
if (!playerMap || !opponentMap) throw new Error('Multiplayer map configuration is invalid.');

const localState = {
  active: true,
  paused: false,
  selectedTowerType: null,
  buildCursor: { x: 100, y: 40, active: false },
  player: createSide(playerMap),
  enemy: createSide(opponentMap)
};

const { renderSide, renderTowerPortraits } = createRenderer(() => localState, mousePosition);
let animationFrame = 0;
let assetsReady = false;

function prefixAsset(image) {
  const source = image.dataset.src;
  if (source && !source.startsWith('../game/') && !source.startsWith('game/')) {
    image.dataset.src = `game/${source}`;
  }
}

function requiredAssets() {
  const images = [
    localState.player.map.image,
    localState.enemy.map.image,
    ...Object.values(ASSETS.characters).flat()
  ];
  [...new Set(images)].forEach(prefixAsset);
  return [...new Set(images)];
}

function render() {
  renderSide(playerContext, localState.player, true);
  renderSide(opponentContext, localState.enemy, false);
  animationFrame = window.requestAnimationFrame(render);
}

function updateControls() {
  goldLabel.textContent = String(Math.floor(localState.player.gold));
  towerButtons.forEach((button) => {
    const selected = button.dataset.tower === localState.selectedTowerType;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = !assetsReady || localState.player.gold < CONFIG.TOWERS[button.dataset.tower].cost;
  });
}

function setTip(step, text) {
  mapTip.querySelector('b').textContent = String(step);
  mapTip.querySelector('span').textContent = text;
}

function selectTower(type) {
  if (!assetsReady) return;
  localState.selectedTowerType = localState.selectedTowerType === type ? null : type;
  localState.buildCursor.active = Boolean(localState.selectedTowerType);
  updateControls();
  if (localState.selectedTowerType) {
    setTip(2, `${CONFIG.TOWERS[type].name} auf einer dunklen Baufläche platzieren.`);
    playerCanvas.focus();
  } else {
    setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
  }
}

function clearSelection() {
  localState.selectedTowerType = null;
  localState.buildCursor.active = false;
  updateControls();
  setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
}

function placementMessage(result, type) {
  if (result === 'occupied') return 'Dieser Platz ist bereits belegt.';
  if (result === 'gold') return 'Nicht genug Gold für diesen Turm.';
  if (result === 'zone') return `${CONFIG.TOWERS[type].name} muss auf einer dunklen Baufläche stehen.`;
  return 'Turm konnte nicht platziert werden.';
}

function placeTower(x = mousePosition.x, y = mousePosition.y) {
  const type = localState.selectedTowerType;
  if (!type || !assetsReady) return;
  const result = canBuildAt(localState.player, type, x, y);
  if (result !== true) {
    setTip(2, placementMessage(result, type));
    return;
  }

  const definition = CONFIG.TOWERS[type];
  localState.player.gold -= definition.cost;
  localState.player.towers.push({
    x,
    y,
    type,
    range: definition.range,
    damage: definition.damage,
    fireRate: definition.fireRate,
    cooldown: 0,
    color: definition.color,
    frameIndex: 0
  });
  clearSelection();
  setTip('✓', `${definition.name} wurde lokal korrekt platziert.`);
}

function updatePointer(event) {
  const rectangle = playerCanvas.getBoundingClientRect();
  const scaleX = CONFIG.CANVAS_WIDTH / rectangle.width;
  const scaleY = CONFIG.CANVAS_HEIGHT / rectangle.height;
  mousePosition.x = Math.floor(((event.clientX - rectangle.left) * scaleX) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.y = Math.floor(((event.clientY - rectangle.top) * scaleY) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.onCanvas = true;
}

towerButtons.forEach((button) => button.addEventListener('click', () => selectTower(button.dataset.tower)));
playerCanvas.addEventListener('pointermove', updatePointer);
playerCanvas.addEventListener('pointerleave', () => { mousePosition.onCanvas = false; });
playerCanvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  updatePointer(event);
  placeTower();
});
playerCanvas.addEventListener('keydown', (event) => {
  if (!localState.selectedTowerType) return;
  const movement = {
    ArrowLeft: [-CONFIG.GRID_SIZE, 0],
    ArrowRight: [CONFIG.GRID_SIZE, 0],
    ArrowUp: [0, -CONFIG.GRID_SIZE],
    ArrowDown: [0, CONFIG.GRID_SIZE]
  }[event.key];
  if (movement) {
    event.preventDefault();
    localState.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, localState.buildCursor.x + movement[0]));
    localState.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, localState.buildCursor.y + movement[1]));
    localState.buildCursor.active = true;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    placeTower(localState.buildCursor.x, localState.buildCursor.y);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearSelection();
  }
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
    updateControls();
    render();
  } catch (error) {
    loadingStatus.textContent = `Grafik konnte nicht geladen werden: ${error.message}`;
    loadingStatus.classList.add('is-error');
  }
}

window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame));
updateControls();
initialize();
